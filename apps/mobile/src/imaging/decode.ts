import { decode as decodeJpeg } from 'jpeg-js';
import type { RgbaImage } from './filters';
import { decodePng } from './png';

export function imageMime(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  return null;
}

export function decodeImage(bytes: Uint8Array): RgbaImage {
  const mime = imageMime(bytes);
  if (mime === 'image/jpeg') {
    const decoded = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true });
    return { width: decoded.width, height: decoded.height, data: new Uint8ClampedArray(decoded.data) };
  }
  if (mime === 'image/png') return decodePng(bytes);
  throw new Error('The captured file is not a JPEG or PNG');
}
