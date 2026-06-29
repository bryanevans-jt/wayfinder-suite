import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Footer } from '@/components/Footer';
import { ReportsPwaPrompt } from '@/components/ReportsPwaPrompt';
import { REPORTS_APP_PRODUCT_NAME, WAYFINDER_FAVICON_PATH, WAYFINDER_PWA_ICON_PATH } from '@wayfinder/branding';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: REPORTS_APP_PRODUCT_NAME,
  description: 'Employee report submission portal',
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: WAYFINDER_FAVICON_PATH, type: 'image/png' }],
    apple: [{ url: WAYFINDER_PWA_ICON_PATH, sizes: '512x512', type: 'image/png' }],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'JT Reports',
    statusBarStyle: 'default',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen flex flex-col`}>
        <ReportsPwaPrompt />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
