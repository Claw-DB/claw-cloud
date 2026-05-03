// Next.js app layout — root layout wrapping all dashboard pages with auth context
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Claw Cloud — Managed ClawDB Platform',
  description: 'The managed hosted platform for ClawDB',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
