import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'cg — competitive git',
  description:
    'Post a change you want, contributors claim it, and a verified skill record comes out the other side.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="mx-auto max-w-5xl px-5 py-7">{children}</main>
      </body>
    </html>
  );
}
