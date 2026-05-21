import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Bungee, JetBrains_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { Providers } from '@/components/providers/Providers';
import { branding } from '@/config/branding';
import { SerwistProvider } from './serwist';
import './globals.css';

// Body sans — Geist (kit default). Equivalent to Inter for design spec §0.4.
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

// Kit-shipped mono — retained as fallback when JetBrains is unavailable.
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

// Display — Bungee (retro-feria) per design spec §0.4. Single weight 400.
// Used for hero/title typography (countdown digits, winner number, brand wordmark).
const bungee = Bungee({
  variable: '--font-bungee',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
});

// Mono — JetBrains Mono per design spec §0.4. Used for seed_commit hash and
// numeric data in admin tables (better readability than Geist Mono for hex).
const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: branding.themeColor,
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    template: `${process.env.NEXT_PUBLIC_APP_NAME || 'TimeKast Factory'} | %s`,
    default: process.env.NEXT_PUBLIC_APP_NAME || 'TimeKast Factory',
  },
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'TimeKast Factory — Starter Kit',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: process.env.NEXT_PUBLIC_APP_NAME || 'TimeKast Factory',
  },
  icons: {
    icon: '/icon.png', // Transparent favicon for browser tab
    apple: { url: '/pwa/apple-touch-icon.png', sizes: '180x180' }, // Opaque icon for iOS
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang="es" + className="carnaval" — Rifatela's branded theme (design §0.3 / DD-006 light-only).
    <html lang="es" className="carnaval" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bungee.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <SerwistProvider swUrl="/serwist/sw.js">
          <Providers>{children}</Providers>
          <Toaster />
        </SerwistProvider>
      </body>
    </html>
  );
}
