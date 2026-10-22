import { downsampleLuma, quadFromLuma } from './framePixels';

function yPlane(width: number, height: number): Uint8Array {
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const page = x >= 16 && x <= 56 && y >= 12 && y <= 52;
      pixels[y * width + x] = page ? 245 : 12;
    }
  }
  return pixels;
}

describe('camera luma sampling', () => {
  it('downsamples a Y plane and finds the page in full-resolution coordinates', () => {
    const width = 72;
    const height = 64;
    const sample = downsampleLuma(yPlane(width, height), width, height, width, 1, 40);
    expect(sample.scale).toBeGreaterThan(1);
    expect(sample.width).toBeLessThan(width);
    const quad = quadFromLuma(sample);
    expect(quad).not.toBeNull();
    const xs = quad?.map((point) => point.x) ?? [];
    const ys = quad?.map((point) => point.y) ?? [];
    expect(Math.min(...xs)).toBeLessThan(20);
    expect(Math.max(...xs)).toBeGreaterThan(48);
    expect(Math.min(...ys)).toBeLessThan(18);
    expect(Math.max(...ys)).toBeGreaterThan(44);
  });
});
