import { Bebas_Neue, Inter } from 'next/font/google';
import './globals.css';

const display = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata = {
  title: 'IZAKHONO SPORTS — POWERING ALL SPORTS.',
  description: 'The connected operating layer for clubs, athletes, competitions, sponsors and the sporting economy.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={`${display.variable} ${body.variable}`}>{children}</body></html>;
}
