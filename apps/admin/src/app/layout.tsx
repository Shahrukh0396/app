import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Scanflow Admin',
  description: 'Operations console for Scanflow',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
