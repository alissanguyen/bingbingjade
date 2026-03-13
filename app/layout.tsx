import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeToggle } from "./components/ThemeToggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jade Shop",
  description: "Your premier jade jewelry destination",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100`}>
        <ThemeProvider>
          <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            <nav className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
              <Link href="/" className="text-xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
                Jade Shop
              </Link>
              <ul className="flex items-center gap-8 text-sm font-medium text-gray-600 dark:text-gray-300">
                <li>
                  <Link href="/" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">Home</Link>
                </li>
                <li>
                  <Link href="/products" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">Products</Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">Contact</Link>
                </li>
                <li>
                  <ThemeToggle />
                </li>
              </ul>
            </nav>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-8">
            <div className="mx-auto max-w-5xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400 dark:text-gray-500">
              <span>© {new Date().getFullYear()} Jade Shop. All rights reserved.</span>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
