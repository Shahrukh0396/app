'use client';

import { FormEvent, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, deviceId: 'admin-portal-device' }),
    });
    if (!response.ok) {
      setError('Login was rejected');
      return;
    }
    const body = (await response.json()) as { accessToken?: string; user?: { role?: string } };
    if (!body.accessToken || body.user?.role !== 'ADMIN') {
      setError('This account is not an administrator');
      return;
    }
    const session = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: body.accessToken }),
    });
    if (!session.ok) {
      setError('Could not store the admin session');
      return;
    }
    window.location.href = '/dashboard';
  }

  return (
    <form className="login" onSubmit={(event) => void onSubmit(event)}>
      <h1>Scanflow admin</h1>
      <label>
        Email
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
      </label>
      <label>
        Password
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={8} />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="primary" type="submit">
        Sign in
      </button>
    </form>
  );
}
