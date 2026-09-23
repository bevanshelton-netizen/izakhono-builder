import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IZAKHONO SOCIAL — People, not profiling',
  description: 'A privacy-first social network built around real people, communities and strong safety standards.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
