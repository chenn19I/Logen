import type { Metadata } from "next";
import "@near-wallet-selector/modal-ui/styles.css";
import "./globals.css";
import { NearProvider } from "@/components/NearProvider";
import { Navbar } from "@/components/Navbar";
import { KawungPatternBg } from "@/components/KawungOrnament";

export const metadata: Metadata = {
  title: "PUSAKA · Tactile Cryptographic Relic — Keyless Membership Vaults on NEAR",
  description:
    "Keanggotaan yang diwariskan bersama isinya. Zero-access-key NEP-171 membership sub-accounts, O(1) club revenue sharing, and atomic safe secondary market on NEAR.",
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#06080D] font-sans text-slate-100 antialiased selection:bg-[#00EC97]/25 selection:text-[#00EC97]">
        <KawungPatternBg />
        <NearProvider>
          <div className="relative z-10 flex min-h-screen flex-col">
            <Navbar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
              {children}
            </main>
            <footer className="border-t border-white/[0.06] bg-[#06080D]/90 py-6 text-xs text-slate-400 backdrop-blur-xl">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-extrabold tracking-[-0.04em] text-[#00EC97]">
                    PUSAKA
                  </span>
                  <span className="text-white/20">·</span>
                  <span>
                    NEAR Hackathon Track 10 (&ldquo;NFTs That Do Something&rdquo;)
                  </span>
                  <span className="text-white/20">·</span>
                  <span className="font-mono text-slate-300">
                    sharded-item-1.0.0
                  </span>
                </div>
                <div className="flex items-center gap-4 font-mono text-[11px]">
                  <span className="text-[#00EC97]">
                    K1 Zero Keys · K2 Canonical Vault · K3 O(1) Accrual · 80,620 Verified Schedules
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
