import type { Metadata, Viewport } from 'next';
import { Outfit, Inter } from 'next/font/google';
import './globals.css';
import { SmoothScrollProvider } from '@/components/providers/SmoothScrollProvider';
import { CurrencyProvider } from '@/components/providers/CurrencyProvider';

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#070B14',
};

export const metadata: Metadata = {
  title: 'Digital Heroes | Play for You. Give for Real.',
  description:
    'Join Digital Heroes: A premium monthly draw platform where your participation directly funds verified charities while giving you the chance to win life-changing cash prizes.',
  keywords: [
    'charity draw',
    'monthly lottery',
    'giving back',
    'transparent prize pools',
    'digital heroes',
  ],
  authors: [{ name: 'Digital Heroes Platform' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable} dark h-full`}>
      <body className="min-h-full flex flex-col bg-navy-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
        <SmoothScrollProvider>
          <CurrencyProvider>{children}</CurrencyProvider>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
