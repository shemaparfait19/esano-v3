
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AppProvider } from '@/contexts/app-context';
import { AuthProvider } from '@/contexts/auth-context';

export const metadata: Metadata = {
  title: 'Esano: AI Genealogy Explorer',
  description: 'Explore your ancestry and connect with relatives through AI-powered DNA analysis.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <AppProvider>
            {children}
            <Toaster />
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
