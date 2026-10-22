export interface RgbaBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function zlibStore(data: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [Uint8Array.of(0x78, 0x01)];
  let offset = 0;
  while (offset < data.length || data.length === 0) {
    const length = Math.min(65535, data.length - offset);
    const last = offset + length >= data.length;
    const header = new Uint8Array(5);
    header[0] = last ? 0x01 : 0x00;
    header[1] = length & 0xff;
    header[2] = (length >> 8) & 0xff;
    const nlen = length ^ 0xffff;
    header[3] = nlen & 0xff;
    header[4] = (nlen >> 8) & 0xff;
    parts.push(header, data.subarray(offset, offset + length));
    offset += length;
    if (last) break;
  }
  const checksum = adler32(data);
  parts.push(Uint8Array.of((checksum >>> 24) & 0xff, (checksum >>> 16) & 0xff, (checksum >>> 8) & 0xff, checksum & 0xff));
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  const crc = crc32(crcInput);
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc);
  return out;
}

export function decodePng(bytes: Uint8Array): RgbaBuffer {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) throw new Error('Invalid PNG');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const type = String.fromCharCode(bytes[offset + 4] ?? 0, bytes[offset + 5] ?? 0, bytes[offset + 6] ?? 0, bytes[offset + 7] ?? 0);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = header.getUint32(0);
      height = header.getUint32(4);
      if (data[8] !== 8 || data[9] !== 6) throw new Error('PNG must be 8-bit RGBA');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const compressedSize = idat.reduce((sum, part) => sum + part.length, 0);
  const compressed = new Uint8Array(compressedSize);
  let cursor = 0;
  for (const part of idat) {
    compressed.set(part, cursor);
    cursor += part.length;
  }
  const raw = inflateStored(compressed);
  const stride = width * 4 + 1;
  if (width < 1 || height < 1 || raw.length < stride * height) throw new Error('PNG image data is truncated');
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    if (raw[y * stride] !== 0) throw new Error('PNG row filters other than None are not supported');
    pixels.set(raw.subarray(y * stride + 1, (y + 1) * stride), y * width * 4);
  }
  return { width, height, data: pixels };
}

function inflateStored(zlib: Uint8Array): Uint8Array {
  if (zlib.length < 7 || zlib[0] !== 0x78) throw new Error('Unsupported PNG compression');
  const parts: Uint8Array[] = [];
  let offset = 2;
  while (offset + 5 <= zlib.length) {
    const header = zlib[offset] ?? 0;
    if (header !== 0x00 && header !== 0x01) throw new Error('Only stored zlib blocks are supported');
    const length = (zlib[offset + 1] ?? 0) | ((zlib[offset + 2] ?? 0) << 8);
    offset += 5;
    parts.push(zlib.subarray(offset, offset + length));
    offset += length;
    if (header === 0x01) break;
  }
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const raw = new Uint8Array(size);
  let cursor = 0;
  for (const part of parts) {
    raw.set(part, cursor);
    cursor += part.length;
  }
  return raw;
}

export function encodePng(image: RgbaBuffer): Uint8Array {
  if (image.data.length !== image.width * image.height * 4) {
    throw new Error('RGBA buffer length does not match width and height');
  }
  const raw = new Uint8Array((image.width * 4 + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) {
    const row = y * (image.width * 4 + 1);
    raw[row] = 0;
    raw.set(image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4), row + 1);
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, image.width);
  view.setUint32(4, image.height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  const parts = [signature, chunk('IHDR', ihdr), chunk('IDAT', zlibStore(raw)), chunk('IEND', new Uint8Array())];
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const png = new Uint8Array(size);
  let cursor = 0;
  for (const part of parts) {
    png.set(part, cursor);
    cursor += part.length;
  }
  return png;
}
