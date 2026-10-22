import type { ReactNode } from 'react';
import Link from 'next/link';

const LINKS = [
  ['/dashboard', 'Dashboard'],
  ['/users', 'Users'],
  ['/subscriptions', 'Subscriptions'],
  ['/revenue', 'Revenue'],
  ['/storage', 'Storage'],
  ['/documents', 'Documents'],
  ['/support', 'Support'],
  ['/analytics', 'Analytics'],
  ['/health', 'Health'],
  ['/audit', 'Audit'],
] as const;

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="nav">
        <p className="brand">Scanflow</p>
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
        <form action="/api/session" method="post">
          <input type="hidden" name="intent" value="logout" />
          <button type="submit">Sign out</button>
        </form>
      </aside>
      <main className="content">
        <header className="top">
          <h1>{title}</h1>
        </header>
        {children}
      </main>
    </div>
  );
}
