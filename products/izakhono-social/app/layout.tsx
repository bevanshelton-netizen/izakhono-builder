import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CONNECTA by IZAKHONO — Public conversation, communities and opportunity',
  description: 'An African-built, privacy-first public conversation network with user-controlled feeds, communities and a sovereign social engine.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
