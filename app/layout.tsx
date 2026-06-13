import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'D2JSP HC Ladder Panel',
  description: 'Read-side control panel for D2:R RotW HC Ladder trading',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
