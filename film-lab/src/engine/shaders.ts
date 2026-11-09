/**
 * FILM LAB colour pipeline – GLSL ES 1.00 (works in WebGL1 and WebGL2).
 *
 * KEEP IN SYNC with `pipeline.ts` (the CPU reference implementation).
 * Every stage below has a 1:1 counterpart there; the unit tests and the
 * GPU/CPU consistency check rely on it.
 *
 * Pipeline (all operations are per-pixel; geometry is never touched):
 *   1. sRGB → linear
 *   2. exposure gain × white-balance multipliers
 *   3. preset channel mixer (3×3)
 *   4. linear → sRGB
 *   5. shadows / highlights (luminance masks)
 *   6. contrast (smooth S-curve)
 *   7. saturation
 *   8. monochrome mix
 *   9. split toning (shadow / highlight tints)
 *  10. fade (lifted blacks, lowered whites)
 *  11. vignette (in full-image coordinates)
 *  12. grain (deterministic value noise in full-image coordinates)
 */

export const VERTEX_SHADER = /* glsl */ `
attribute vec2 a_position;
uniform float u_flipY;
varying vec2 v_uv;
void main() {
  // v_uv.y = 0 is the top row of the uploaded image.
  v_uv = vec2((a_position.x + 1.0) * 0.5, (1.0 - a_position.y * u_flipY) * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 v_uv;
uniform sampler2D u_image;

// Where this tile sits inside the full source image (pixels).
uniform vec2 u_tileOffset;
uniform vec2 u_tileSize;
uniform vec2 u_imageSize;

uniform float u_exposureGain;
uniform vec3 u_whiteBalance;
uniform mat3 u_mixer;
uniform float u_contrast;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_saturation;
uniform float u_mono;
uniform vec3 u_monoWeights;
uniform vec3 u_shadowTint;
uniform vec3 u_highlightTint;
uniform vec3 u_fadeBlack;
uniform float u_fadeWhite;
uniform float u_vignette;
uniform float u_grain;
uniform float u_grainCell;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 srgbToLinear(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(lo, hi, step(vec3(0.04045), c));
}

vec3 linearToSrgb(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

float permute(float x) { return mod((x * 34.0 + 1.0) * x, 289.0); }

float hash(vec2 p) {
  p = mod(p, 289.0);
  return permute(permute(permute(p.x) + p.y) + 17.0) / 289.0;
}

float valueNoise(vec2 q) {
  vec2 i = floor(q);
  vec2 f = q - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec4 src = texture2D(u_image, v_uv);
  vec2 pixel = u_tileOffset + v_uv * u_tileSize;   // full-image pixel coords
  vec2 imgUV = pixel / u_imageSize;

  // 1–3: linear light operations
  vec3 lin = srgbToLinear(src.rgb);
  lin = lin * u_exposureGain * u_whiteBalance;
  lin = max(u_mixer * lin, vec3(0.0));

  // 4
  vec3 c = linearToSrgb(lin);

  // 5: shadows / highlights
  float L = clamp(dot(c, LUMA), 0.0, 1.0);
  float sMask = 1.0 - smoothstep(0.0, 0.6, L);
  float hMask = smoothstep(0.35, 1.0, L);
  c += vec3(u_shadows * 0.3 * sMask + u_highlights * 0.3 * hMask);

  // 6: contrast
  vec3 t = clamp(c, 0.0, 1.0);
  if (u_contrast >= 0.0) {
    c = mix(t, t * t * (3.0 - 2.0 * t), u_contrast);
  } else {
    c = t + (vec3(0.5) - t) * (-u_contrast * 0.5);
  }

  // 7: saturation
  float L2 = dot(c, LUMA);
  c = vec3(L2) + (c - vec3(L2)) * u_saturation;

  // 8: monochrome
  c = mix(c, vec3(dot(c, u_monoWeights)), u_mono);

  // 9: split toning
  float L3 = clamp(dot(c, LUMA), 0.0, 1.0);
  c += u_shadowTint * (1.0 - L3) * (1.0 - L3) + u_highlightTint * L3 * L3;

  // 10: fade
  c = clamp(c, 0.0, 1.0);
  c = u_fadeBlack + c * (vec3(u_fadeWhite) - u_fadeBlack);

  // 11: vignette
  float r = length((imgUV - 0.5) * 2.0) * 0.70710678;
  float vMask = smoothstep(0.3, 1.0, r);
  if (u_vignette >= 0.0) {
    c *= 1.0 - u_vignette * 0.75 * vMask;
  } else {
    c += (vec3(1.0) - c) * (-u_vignette * 0.6 * vMask);
  }

  // 12: grain
  if (u_grain > 0.0) {
    vec2 q = pixel / u_grainCell;
    float n = valueNoise(q) * 0.6 + valueNoise(q * 2.03 + vec2(17.0, 59.0)) * 0.4 - 0.5;
    float Lg = clamp(dot(c, LUMA), 0.0, 1.0);
    float w = 1.0 - (2.0 * Lg - 1.0) * (2.0 * Lg - 1.0) * 0.7;
    c += vec3(n * u_grain * 0.22 * w);
  }

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);
}
`;
