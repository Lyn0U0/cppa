import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders';
import type { Rect } from './tiles';
import type { EngineParams, Mat3 } from './types';

type GL = WebGLRenderingContext | WebGL2RenderingContext;

const UNIFORMS = [
  'u_image',
  'u_flipY',
  'u_tileOffset',
  'u_tileSize',
  'u_imageSize',
  'u_exposureGain',
  'u_whiteBalance',
  'u_mixer',
  'u_contrast',
  'u_highlights',
  'u_shadows',
  'u_saturation',
  'u_mono',
  'u_monoWeights',
  'u_shadowTint',
  'u_highlightTint',
  'u_fadeBlack',
  'u_fadeWhite',
  'u_vignette',
  'u_grain',
  'u_grainCell',
] as const;
type UniformName = (typeof UNIFORMS)[number];

/** GLSL mat3 uniforms are column-major. */
const toColumnMajor = (m: Mat3): Float32Array =>
  new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);

function compile(gl: GL, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

export interface DrawGeometry {
  /** Full-image size in the coordinate space used for vignette & grain. */
  imageWidth: number;
  imageHeight: number;
  /** Grain cell size, same units as imageWidth/imageHeight. */
  grainCell: number;
}

/**
 * WebGL implementation of the FILM LAB pipeline.
 *
 * - `setSource` + `draw` render a (preview-sized) image to the canvas.
 * - `renderRegion` renders an arbitrary tile to an RGBA buffer through a
 *   framebuffer; used for full-resolution export and thumbnails.
 */
export class WebGLFilmRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: GL;
  private program!: WebGLProgram;
  private buffer!: WebGLBuffer;
  private sourceTexture!: WebGLTexture;
  private scratchTexture!: WebGLTexture;
  private fbTexture!: WebGLTexture;
  private framebuffer!: WebGLFramebuffer;
  private uniforms = {} as Record<UniformName, WebGLUniformLocation | null>;
  private sourceSize = { width: 0, height: 0 };
  private fbSize = { width: 0, height: 0 };
  readonly maxTextureSize: number;
  readonly maxRenderSize: number;

  private constructor(canvas: HTMLCanvasElement, gl: GL) {
    this.canvas = canvas;
    this.gl = gl;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const maxRb = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
    const maxVp = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    this.maxRenderSize = Math.min(this.maxTextureSize, maxRb, maxVp[0], maxVp[1]);
    this.init();
  }

  /** Returns `null` if WebGL is not available. */
  static create(canvas: HTMLCanvasElement = document.createElement('canvas')): WebGLFilmRenderer | null {
    const attrs: WebGLContextAttributes = {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    };
    let gl: GL | null = null;
    try {
      gl =
        (canvas.getContext('webgl2', attrs) as WebGL2RenderingContext | null) ??
        (canvas.getContext('webgl', attrs) as WebGLRenderingContext | null);
    } catch {
      gl = null;
    }
    if (!gl) return null;
    try {
      return new WebGLFilmRenderer(canvas, gl);
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  get isContextLost(): boolean {
    return this.gl.isContextLost();
  }

  /** Recreate GPU resources after a `webglcontextrestored` event. */
  restore(): void {
    this.init();
    this.sourceSize = { width: 0, height: 0 };
    this.fbSize = { width: 0, height: 0 };
  }

  private init(): void {
    const gl = this.gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error('createProgram failed');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;
    gl.useProgram(program);

    this.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    for (const name of UNIFORMS) this.uniforms[name] = gl.getUniformLocation(program, name);

    this.sourceTexture = this.createTexture();
    this.scratchTexture = this.createTexture();
    this.fbTexture = this.createTexture();
    this.framebuffer = gl.createFramebuffer()!;

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.disable(gl.BLEND);
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // NEAREST: when rendering at the source size each fragment samples
    // exactly one source texel, so no resampling softness is introduced.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  private upload(texture: WebGLTexture, source: TexImageSource): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  /** Upload the preview source and size the canvas to match it 1:1. */
  setSource(source: TexImageSource, width: number, height: number): void {
    this.upload(this.sourceTexture, source);
    this.sourceSize = { width, height };
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  get hasSource(): boolean {
    return this.sourceSize.width > 0;
  }

  private setUniforms(p: EngineParams, geo: DrawGeometry, tile: Rect, flipY: number): void {
    const gl = this.gl;
    const u = this.uniforms;
    gl.useProgram(this.program);
    gl.uniform1i(u.u_image, 0);
    gl.uniform1f(u.u_flipY, flipY);
    gl.uniform2f(u.u_tileOffset, tile.x, tile.y);
    gl.uniform2f(u.u_tileSize, tile.width, tile.height);
    gl.uniform2f(u.u_imageSize, geo.imageWidth, geo.imageHeight);
    gl.uniform1f(u.u_exposureGain, p.exposureGain);
    gl.uniform3fv(u.u_whiteBalance, p.whiteBalance);
    gl.uniformMatrix3fv(u.u_mixer, false, toColumnMajor(p.mixer));
    gl.uniform1f(u.u_contrast, p.contrast);
    gl.uniform1f(u.u_highlights, p.highlights);
    gl.uniform1f(u.u_shadows, p.shadows);
    gl.uniform1f(u.u_saturation, p.saturation);
    gl.uniform1f(u.u_mono, p.mono);
    gl.uniform3fv(u.u_monoWeights, p.monoWeights);
    gl.uniform3fv(u.u_shadowTint, p.shadowTint);
    gl.uniform3fv(u.u_highlightTint, p.highlightTint);
    gl.uniform3fv(u.u_fadeBlack, p.fadeBlack);
    gl.uniform1f(u.u_fadeWhite, p.fadeWhite);
    gl.uniform1f(u.u_vignette, p.vignette);
    gl.uniform1f(u.u_grain, p.grain);
    gl.uniform1f(u.u_grainCell, geo.grainCell);
  }

  /** Render the preview source to the visible canvas. */
  draw(params: EngineParams, geo: DrawGeometry): void {
    const gl = this.gl;
    if (!this.hasSource || gl.isContextLost()) return;
    const { width, height } = this.sourceSize;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    this.setUniforms(params, geo, { x: 0, y: 0, width, height }, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private ensureFramebuffer(width: number, height: number): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.fbTexture);
    if (this.fbSize.width !== width || this.fbSize.height !== height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.fbSize = { width, height };
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fbTexture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete (0x${status.toString(16)})`);
    }
  }

  /**
   * Render `tileSource` (the pixels of `tile`, cut from a larger image)
   * and read the result back as top-down RGBA8.
   */
  renderRegion(
    tileSource: TexImageSource,
    tile: Rect,
    params: EngineParams,
    geo: DrawGeometry,
    out?: Uint8ClampedArray<ArrayBuffer>,
  ): Uint8ClampedArray<ArrayBuffer> {
    const gl = this.gl;
    if (gl.isContextLost()) throw new Error('WebGL context lost');
    if (tile.width > this.maxRenderSize || tile.height > this.maxRenderSize) {
      throw new Error('Tile larger than GPU limits');
    }
    gl.activeTexture(gl.TEXTURE0);
    this.upload(this.scratchTexture, tileSource);
    this.ensureFramebuffer(tile.width, tile.height);
    gl.viewport(0, 0, tile.width, tile.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scratchTexture);
    // flipY = -1 puts the image's top row at framebuffer row 0, so
    // readPixels returns rows top-down (no extra flip needed).
    this.setUniforms(params, geo, tile, -1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    const pixels = out ?? new Uint8ClampedArray(tile.width * tile.height * 4);
    gl.readPixels(
      0,
      0,
      tile.width,
      tile.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(pixels.buffer, pixels.byteOffset, tile.width * tile.height * 4),
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return pixels;
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.sourceTexture);
    gl.deleteTexture(this.scratchTexture);
    gl.deleteTexture(this.fbTexture);
    gl.deleteFramebuffer(this.framebuffer);
    gl.deleteBuffer(this.buffer);
    gl.deleteProgram(this.program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
