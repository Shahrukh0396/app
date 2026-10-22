const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const remaining = bytes.length - index;
    const a = bytes[index] ?? 0;
    const b = remaining > 1 ? (bytes[index + 1] ?? 0) : 0;
    const c = remaining > 2 ? (bytes[index + 2] ?? 0) : 0;
    const triple = (a << 16) | (b << 8) | c;
    output += ALPHABET[(triple >> 18) & 63];
    output += ALPHABET[(triple >> 12) & 63];
    output += remaining > 1 ? ALPHABET[(triple >> 6) & 63] : '=';
    output += remaining > 2 ? ALPHABET[triple & 63] : '=';
  }
  return output;
}

export function base64ToBytes(value: string): Uint8Array {
  const clean = value.replace(/=+$/g, '').replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let cursor = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const a = ALPHABET.indexOf(clean[index] ?? 'A');
    const b = ALPHABET.indexOf(clean[index + 1] ?? 'A');
    const c = index + 2 < clean.length ? ALPHABET.indexOf(clean[index + 2] ?? 'A') : 0;
    const d = index + 3 < clean.length ? ALPHABET.indexOf(clean[index + 3] ?? 'A') : 0;
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    bytes[cursor] = (triple >> 16) & 255;
    cursor += 1;
    if (index + 2 < clean.length) {
      bytes[cursor] = (triple >> 8) & 255;
      cursor += 1;
    }
    if (index + 3 < clean.length) {
      bytes[cursor] = triple & 255;
      cursor += 1;
    }
  }
  return bytes.subarray(0, cursor);
}
