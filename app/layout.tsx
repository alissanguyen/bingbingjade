import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "./components/ThemeProvider";
import { Navbar } from "./components/Navbar";
import { headers } from "next/headers";
import { CategoryBar } from "./components/CategoryBar";
import { CartProvider } from "./components/CartContext";
import { CartDrawer } from "./components/CartDrawer";
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

const ADMIN_PREFIXES = ["/orders-admin", "/customers-admin", "/edit", "/add", "/admin", "/products-admin", "/vendors"];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isAdmin = ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <html lang="en" suppressHydrationWarning style={{ scrollbarGutter: "stable" }}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100`}>
        <ThemeProvider>
          <CartProvider>
          <header className="sticky top-0 z-40 bg-white dark:bg-gray-950">
            {/* Beta banner — only shown in beta mode */}
            {process.env.NEXT_PUBLIC_CHECKOUT_MODE !== "live" && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-center text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Site under beta testing.</span>
                {" "}Online checkout is temporarily disabled — to purchase, please inquire directly via{" "}
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 font-semibold hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
                >
                  WhatsApp
                </a>
                .
              </div>
            )}
            <div className="border-b border-gray-200 dark:border-gray-800">
              <Navbar />
            </div>
            {!isAdmin && <CategoryBar />}
          </header>

          {/* CartDrawer must be outside the header so it sits in the root stacking context,
              allowing the sticky header (z-40) to always render above it (z-30) */}
          <CartDrawer />

          <main className="flex-1">{children}</main>

          <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-8">
            <div className="mx-auto max-w-5xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs xs:text-sm text-gray-400 dark:text-gray-500">
              <span>© {new Date().getFullYear()} BingBing Jade. All rights reserved.</span>
              <div className="flex gap-6 text-xs xs:text-sm">
                <Link href="/faq" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
                  FAQ
                </Link>
                <Link href="/policy" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
                  Store Policy
                </Link>
                <Link href="/privacy-policy" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
                  Privacy Policy
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
