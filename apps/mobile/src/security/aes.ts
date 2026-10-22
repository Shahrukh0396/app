import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/hashes/utils.js';

export interface SealedBlob {
  iv: string;
  ciphertext: string;
}

function bytesToB64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function b64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function seal(plaintext: Uint8Array, key: Uint8Array): SealedBlob {
  if (key.length !== 32) throw new Error('AES-GCM key must be 32 bytes');
  const iv = randomBytes(12);
  const ciphertext = gcm(key, iv).encrypt(plaintext);
  return { iv: bytesToB64(iv), ciphertext: bytesToB64(ciphertext) };
}

export function open(blob: SealedBlob, key: Uint8Array): Uint8Array {
  if (key.length !== 32) throw new Error('AES-GCM key must be 32 bytes');
  return gcm(key, b64ToBytes(blob.iv)).decrypt(b64ToBytes(blob.ciphertext));
}

export function sealText(value: string, key: Uint8Array): SealedBlob {
  return seal(new TextEncoder().encode(value), key);
}

export function openText(blob: SealedBlob, key: Uint8Array): string {
  return new TextDecoder().decode(open(blob, key));
}

export function randomKey(): Uint8Array {
  return randomBytes(32);
}
