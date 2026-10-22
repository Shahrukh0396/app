import { classifyVersion } from './sync-version';

describe('classifyVersion', () => {
  it('applies when the client base version matches the server', () => {
    expect(classifyVersion(3, 3)).toBe('apply');
    expect(classifyVersion(1, 1)).toBe('apply');
  });

  it('conflicts when the server moved ahead or the client is stale', () => {
    expect(classifyVersion(2, 4)).toBe('conflict');
    expect(classifyVersion(5, 4)).toBe('conflict');
  });

  it('rejects non-integer versions', () => {
    expect(() => classifyVersion(1.5, 1)).toThrow(/non-negative integer/);
    expect(() => classifyVersion(-1, 1)).toThrow(/non-negative integer/);
  });
});
