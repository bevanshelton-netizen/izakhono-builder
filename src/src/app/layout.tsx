import './globals.css'

export const metadata = {
  title: 'IZAKHONO SOCIAL COMMAND™',
  description: 'Owned-first marketing operating system for the IZAKHONO ecosystem.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
