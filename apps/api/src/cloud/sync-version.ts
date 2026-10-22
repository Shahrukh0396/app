export function classifyVersion(clientVersion: number, serverVersion: number): 'apply' | 'conflict' {
  if (!Number.isInteger(clientVersion) || clientVersion < 0) {
    throw new Error('Client version must be a non-negative integer');
  }
  if (!Number.isInteger(serverVersion) || serverVersion < 0) {
    throw new Error('Server version must be a non-negative integer');
  }
  return clientVersion === serverVersion ? 'apply' : 'conflict';
}
