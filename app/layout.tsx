import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "./components/ThemeProvider";
import { Navbar } from "./components/Navbar";
import { CategoryBar } from "./components/CategoryBar";
import { CartProvider } from "./components/CartContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://bingbingjade.com";

export const metadata: Metadata = {
  title: {
    default: "BingBing Jade — Authentic Jade Jewelry",
    template: "%s | BingBing Jade",
  },
  description: "Shop authentic, handpicked jade jewelry — bracelets, bangles, rings, pendants, and necklaces. Direct from trusted vendors.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    siteName: "BingBing Jade",
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    title: "BingBing Jade — Authentic Jade Jewelry",
    description: "Shop authentic, handpicked jade jewelry — bracelets, bangles, rings, pendants, and necklaces.",
    images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: "BingBing Jade" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BingBing Jade — Authentic Jade Jewelry",
    description: "Shop authentic, handpicked jade jewelry — bracelets, bangles, rings, pendants, and necklaces.",
    images: ["/og-default.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning style={{ scrollbarGutter: "stable" }}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100`}>
        <ThemeProvider>
          <CartProvider>
          <header className="sticky top-0 z-40 bg-white dark:bg-gray-950">
            <div className="border-b border-gray-200 dark:border-gray-800">
              <Navbar />
            </div>
            <CategoryBar />
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-8">
            <div className="mx-auto max-w-5xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400 dark:text-gray-500">
              <span>© {new Date().getFullYear()} BingBing Jade. All rights reserved.</span>
              <div className="flex gap-6">
                <Link href="/faq" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
                  FAQ
                </Link>
                <Link href="/policy" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
                  Store Policy
                </Link>
              </div>
            </div>
          </footer>
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
