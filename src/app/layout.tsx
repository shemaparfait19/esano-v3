import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AppProvider } from "@/contexts/app-context";
import FloatingAssistant from "@/components/assistant/floating-assistant";
import { AuthProvider } from "@/contexts/auth-context";

export const metadata: Metadata = {
  title: "Esano: AI Genealogy Explorer",
  description:
    "Explore your ancestry and connect with relatives through AI-powered DNA analysis.",
  icons: {
    icon: "/assets/favicon.png",
    shortcut: "/assets/favicon.png",
    apple: "/assets/favicon.png",
  },
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
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=PT+Sans:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/assets/favicon.png" sizes="any" />
        <link rel="apple-touch-icon" href="/assets/favicon.png" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <AppProvider>
            {children}
            <Toaster />
            <FloatingAssistant
              gifSrc="/assets/esano-assistant.gif"
              title="eSANO Assistant"
            />
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
