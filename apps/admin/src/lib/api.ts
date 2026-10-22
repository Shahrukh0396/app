import { cookies } from 'next/headers';

export const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function apiGet<T>(path: string): Promise<T> {
  const jar = await cookies();
  const token = jar.get('scanflow_admin')?.value;
  if (!token) {
    throw new Error('Admin session is missing');
  }
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`API ${path} returned ${response.status}`);
  }
  return (await response.json()) as T;
}
