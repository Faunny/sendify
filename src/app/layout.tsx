import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/app/theme-provider";

export const metadata: Metadata = {
  title: "Sendify — Email marketing for Divain",
  description: "Multi-store, multi-language email marketing platform built on Amazon SES.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="bg-app antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
