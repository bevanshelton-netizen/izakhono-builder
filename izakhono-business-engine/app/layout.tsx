import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata={title:'IZAKHONO BUSINESS ENGINE™',description:'AI-powered digital growth infrastructure.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}