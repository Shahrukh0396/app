import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, randomBytes } from '@noble/hashes/utils.js';

export function createSalt(): string {
  return bytesToHex(randomBytes(16));
}

export function hashSecret(value: string, saltHex: string): string {
  const material = new TextEncoder().encode(`${saltHex}:${value}`);
  return bytesToHex(sha256(material));
}

export function verifySecret(value: string, saltHex: string, expectedHex: string): boolean {
  const actual = hashSecret(value, saltHex);
  if (actual.length !== expectedHex.length) return false;
  let diff = 0;
  for (let index = 0; index < actual.length; index += 1) {
    diff |= actual.charCodeAt(index) ^ expectedHex.charCodeAt(index);
  }
  return diff === 0;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

export function isValidPattern(pattern: number[]): boolean {
  if (pattern.length < 4 || pattern.length > 9) return false;
  const seen = new Set<number>();
  for (const cell of pattern) {
    if (!Number.isInteger(cell) || cell < 0 || cell > 8 || seen.has(cell)) return false;
    seen.add(cell);
  }
  return true;
}
