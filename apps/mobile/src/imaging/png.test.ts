import { encodePng } from './png';

describe('encodePng', () => {
  it('writes a PNG signature and the source dimensions', () => {
    const data = new Uint8ClampedArray(8);
    data.set([255, 0, 0, 255, 0, 255, 0, 255]);
    const png = encodePng({ width: 2, height: 1, data });
    expect(Array.from(png.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(view.getUint32(16)).toBe(2);
    expect(view.getUint32(20)).toBe(1);
    expect(png[25]).toBe(6);
  });
});