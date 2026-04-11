import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { FooterSubscribeForm } from "./components/FooterSubscribeForm";
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
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

const ADMIN_PREFIXES = ["/orders-admin", "/customers-admin", "/edit", "/add", "/admin", "/products-admin", "/vendors", "/profile", "/coupons-admin", "/subscribers-admin"];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isAdmin = ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isStudio = headersList.get("x-is-studio") === "1";

  return (
    <html lang="en" suppressHydrationWarning style={{ scrollbarGutter: "stable" }}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100`}>
        <ThemeProvider>
          <CartProvider>
          {isStudio ? (
            <>{children}</>
          ) : (
            <>
              <header className="sticky top-0 z-40 bg-white dark:bg-gray-950">
                {/* Beta banner — only shown in beta mode */}
                {process.env.NEXT_PUBLIC_CHECKOUT_MODE !== "live" && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-center text-[12px] sm:text-xs text-amber-800 dark:text-amber-300">
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

              <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                {/* ── Main footer body ── */}
                <div className="mx-auto max-w-6xl px-6 pt-14 pb-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

                  {/* Brand */}
                  <div className="lg:col-span-1">
                    <p className="text-sm font-bold tracking-widest uppercase text-gray-900 dark:text-gray-100 mb-3">BingBing Jade</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed max-w-[200px]">
                      Natural Type A jadeite jewelry — no dye, no heat, no polymer. Certified &amp; guaranteed.
                    </p>
                  </div>

                  {/* Shop */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Shop</p>
                    <ul className="space-y-2.5">
                      {[
                        { href: "/products", label: "All Pieces" },
                        { href: "/products?category=bracelet", label: "Bracelets" },
                        { href: "/products?category=bangle", label: "Bangles" },
                        { href: "/products?category=pendant", label: "Pendants" },
                        { href: "/products?category=ring", label: "Rings" },
                        { href: "/custom-sourcing", label: "Custom Sourcing" },
                      ].map(({ href, label }) => (
                        <li key={href}>
                          <Link href={href} className="text-xs text-gray-500 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Help */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Help</p>
                    <ul className="space-y-2.5">
                      {[
                        { href: "/faq", label: "FAQ & Shipping" },
                        { href: "/size-guide", label: "Size Guide" },
                        { href: "/policy", label: "Store Policy" },
                        { href: "/privacy-policy", label: "Privacy Policy" },
                      ].map(({ href, label }) => (
                        <li key={href}>
                          <Link href={href} className="text-xs text-gray-500 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Newsletter */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Newsletter</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                      New arrivals, restocks, and a welcome discount for first-time subscribers.
                    </p>
                    <FooterSubscribeForm />
                    <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-2.5">No spam. Unsubscribe anytime.</p>
                  </div>
                </div>

                {/* ── Bottom bar ── */}
                <div className="border-t border-gray-100 dark:border-gray-800">
                  <div className="mx-auto max-w-6xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-400 dark:text-gray-600">
                    <span>© {new Date().getFullYear()} BingBing Jade. All rights reserved.</span>
                    <span className="hidden sm:block">Natural Type A Jadeite · Certified · US Based</span>
                  </div>
                </div>
              </footer>
            </>
          )}
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
