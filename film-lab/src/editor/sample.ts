/**
 * Procedurally painted sample photo (seaside at dusk with a figure, flowers
 * and a colour chart) so the app can be tried without uploading anything.
 */
export async function createSampleFile(): Promise<File> {
  const W = 2400;
  const H = 1600;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;

  // Sky
  const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, '#4f7fb8');
  sky.addColorStop(0.55, '#a9b8c9');
  sky.addColorStop(1, '#f1c592');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // Sun glow
  const sun = g.createRadialGradient(1700, 860, 10, 1700, 860, 520);
  sun.addColorStop(0, 'rgba(255,236,190,1)');
  sun.addColorStop(0.12, 'rgba(255,214,150,0.95)');
  sun.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, W, H);

  // Clouds
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (const [x, y, rx, ry] of [[500, 300, 260, 50], [760, 340, 200, 38], [1400, 220, 320, 46], [2000, 380, 240, 40]]) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Sea
  const sea = g.createLinearGradient(0, H * 0.6, 0, H * 0.78);
  sea.addColorStop(0, '#5d7f99');
  sea.addColorStop(1, '#2f4f68');
  g.fillStyle = sea;
  g.fillRect(0, H * 0.6, W, H * 0.2);
  g.fillStyle = 'rgba(255,220,170,0.55)';
  for (let i = 0; i < 40; i++) {
    const y = H * 0.61 + i * 7;
    const w = 300 - i * 6;
    g.fillRect(1700 - w / 2 + Math.sin(i) * 30, y, w, 2);
  }

  // Hills
  g.fillStyle = '#3f5b3a';
  g.beginPath();
  g.moveTo(0, H * 0.6);
  g.bezierCurveTo(300, H * 0.48, 650, H * 0.5, 900, H * 0.6);
  g.fill();

  // Sand / grass foreground
  const ground = g.createLinearGradient(0, H * 0.76, 0, H);
  ground.addColorStop(0, '#c9a77c');
  ground.addColorStop(1, '#8f6f4c');
  g.fillStyle = ground;
  g.fillRect(0, H * 0.76, W, H * 0.24);

  // Figure (skin tones + clothing)
  g.fillStyle = '#e0b08f';
  g.beginPath();
  g.arc(760, 820, 70, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3a2a22';
  g.beginPath();
  g.arc(760, 795, 74, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = '#b8473a';
  g.beginPath();
  g.moveTo(660, 1300);
  g.lineTo(700, 900);
  g.lineTo(820, 900);
  g.lineTo(870, 1300);
  g.closePath();
  g.fill();
  g.fillStyle = '#e0b08f';
  g.fillRect(745, 885, 30, 25);

  // Flowers
  const petals = ['#f4d35e', '#ee964b', '#f95738', '#faf0ca', '#c06c84'];
  for (let i = 0; i < 28; i++) {
    const x = 1050 + (i % 14) * 85 + (i > 13 ? 40 : 0);
    const y = 1260 + (i > 13 ? 90 : 0) + Math.sin(i * 1.7) * 18;
    g.strokeStyle = '#4c6b3a';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y + 120);
    g.stroke();
    g.fillStyle = petals[i % petals.length];
    g.beginPath();
    g.arc(x, y, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5a3d1f';
    g.beginPath();
    g.arc(x, y, 9, 0, Math.PI * 2);
    g.fill();
  }

  // Colour chart
  for (let i = 0; i < 12; i++) {
    g.fillStyle = `hsl(${i * 30}, 65%, 52%)`;
    g.fillRect(80 + i * 64, 1440, 56, 56);
    g.fillStyle = `hsl(0, 0%, ${(i / 11) * 100}%)`;
    g.fillRect(80 + i * 64, 1504, 56, 56);
  }

  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/jpeg', 0.93));
  return new File([blob], 'sample-seaside.jpg', { type: 'image/jpeg' });
}
