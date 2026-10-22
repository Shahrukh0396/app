import type { Quad } from './homography';
import { detectDocumentQuad } from './quadDetector';

export interface LumaSample {
  width: number;
  height: number;
  pixels: Float32Array;
  scale: number;
}

export function downsampleLuma(
  pixels: Uint8Array,
  width: number,
  height: number,
  bytesPerRow: number,
  channels: 1 | 4,
  maxEdge: number,
): LumaSample {
  const scale = Math.max(1, Math.ceil(Math.max(width, height) / Math.max(1, maxEdge)));
  const outWidth = Math.max(1, Math.floor(width / scale));
  const outHeight = Math.max(1, Math.floor(height / scale));
  const out = new Float32Array(outWidth * outHeight);
  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const sx = x * scale;
      const sy = y * scale;
      const offset = sy * bytesPerRow + sx * channels;
      if (channels === 1) {
        out[y * outWidth + x] = pixels[offset] ?? 0;
      } else {
        const red = pixels[offset] ?? 0;
        const green = pixels[offset + 1] ?? 0;
        const blue = pixels[offset + 2] ?? 0;
        out[y * outWidth + x] = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      }
    }
  }
  return { width: outWidth, height: outHeight, pixels: out, scale };
}

export function quadFromLuma(sample: LumaSample): Quad | null {
  const quad = detectDocumentQuad({ width: sample.width, height: sample.height, pixels: sample.pixels });
  if (!quad) return null;
  return quad.map((point) => ({ x: point.x * sample.scale, y: point.y * sample.scale })) as Quad;
}
