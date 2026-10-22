import { openText, randomKey, sealText } from './aes';

describe('AES-GCM', () => {
  it('round-trips text and rejects a different key', () => {
    const key = randomKey();
    const blob = sealText('scanflow-file-key', key);
    expect(openText(blob, key)).toBe('scanflow-file-key');
    expect(blob.ciphertext).not.toContain('scanflow-file-key');
    expect(() => openText(blob, randomKey())).toThrow();
  });
});
