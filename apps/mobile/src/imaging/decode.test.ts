import { encode } from 'jpeg-js';
import { decodeImage } from './decode';
import { encodePng } from './png';

describe('decodeImage', () => {
  it('round-trips a PNG written by encodePng', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
    const decoded = decodeImage(encodePng({ width: 2, height: 1, data }));
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(1);
    expect(Array.from(decoded.data)).toEqual(Array.from(data));
  });

  it('decodes a JPEG into RGBA of the same size', () => {
    const source = new Uint8Array(16);
    source.set([240, 240, 240, 255, 20, 20, 20, 255, 20, 20, 20, 255, 240, 240, 240, 255]);
    const jpeg = encode({ data: source, width: 2, height: 2 }, 90).data;
    const decoded = decodeImage(jpeg);
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(decoded.data[0]).toBeGreaterThan(180);
    expect(decoded.data[4]).toBeLessThan(80);
  });
});
