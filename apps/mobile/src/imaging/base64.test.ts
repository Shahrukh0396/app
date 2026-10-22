import { base64ToBytes, bytesToBase64 } from './base64';

describe('base64', () => {
  it('round-trips bytes that include zeros', () => {
    const bytes = Uint8Array.from([0, 1, 255, 10, 200]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });
});
