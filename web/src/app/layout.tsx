import type { Metadata } from "next";
import "@near-wallet-selector/modal-ui/styles.css";
import "./globals.css";
import { NearProvider } from "@/components/NearProvider";
import { Navbar } from "@/components/Navbar";
import { KawungPatternBg } from "@/components/KawungOrnament";

export const metadata: Metadata = {
  title: "Pusaka · Membership NFTs That Carry Their Own Keyless NEAR Vault",
  description:
    "Sell the seat. The wallet goes with it. Zero-access-key NEP-171 membership sub-accounts, O(1) club revenue sharing, and atomic safe secondary market on NEAR.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-obsidian-900 bg-kraton-radial font-sans text-slate-100 antialiased selection:bg-gold-500/30 selection:text-gold-300">
        <KawungPatternBg />
        <NearProvider>
          <div className="relative z-10 flex min-h-screen flex-col">
            <Navbar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
              {children}
            </main>
            <footer className="border-t border-gold-500/15 bg-obsidian-950/80 py-6 text-xs text-slate-400">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4">
                <div className="flex items-center gap-3">
                  <span className="font-serif text-base font-bold text-gold-400">
                    PUSAKA
                  </span>
                  <span>·</span>
                  <span>
                    NEAR Hackathon Track 10 (&ldquo;NFTs That Do Something&rdquo;)
                  </span>
                  <span>·</span>
                  <span className="font-mono text-slate-300">
                    sharded-item-1.0.0
                  </span>
                </div>
                <div className="flex items-center gap-4 font-mono text-[11px]">
                  <span className="text-segel-400">
                    K1 Zero Keys · K2 Canonical Vault · K3 O(1) Accrual
                  </span>
                </div>
              </div>
            </footer>
          </div>
        </NearProvider>
      </body>
    </html>
  );
}
