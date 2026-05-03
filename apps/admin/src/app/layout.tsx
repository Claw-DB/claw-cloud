// Admin panel root layout — wraps all internal admin pages
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Claw Cloud Admin',
  description: 'Internal operations dashboard',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
