import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CONNECTA — People, communities, connected',
  description: 'A privacy-first social network for people, families, creators, organisations and communities.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
