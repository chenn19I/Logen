import type { Metadata } from "next";
import "@near-wallet-selector/modal-ui/styles.css";
import "@/styles/tokens.css";
import "./globals.css";
import { NearProvider } from "@/components/NearProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { DemoProvider } from "@/lib/demo/DemoProvider";
import { Navbar } from "@/components/Navbar";
import { SiteFooter } from "@/components/SiteFooter";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://logen-roan.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Logen — The seat that carries its own wallet",
  description:
    "A members club where each seat is an NFT that owns its own keyless wallet. Mint a seat with your own artwork, sell it, and the money, history and access go with it. NEAR Testnet.",
  applicationName: "Logen",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
  openGraph: {
    type: "website",
    title: "Logen — The seat that carries its own wallet",
    description:
      "Mint a membership seat with your own portrait. The seat is an NFT and a keyless NEAR wallet. Sell it and everything inside goes with it.",
    url: siteUrl,
    siteName: "Logen",
    images: [
      {
        url: "/logen-mascot.png",
        width: 1254,
        height: 1254,
        alt: "Logen, the pixel-art cybernetic wizard mascot.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Logen — The seat that carries its own wallet",
    description:
      "Mint a membership seat with your own portrait. The seat is an NFT and a keyless NEAR wallet.",
    images: ["/logen-mascot.png"],
  },
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
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ink font-sans text-paper antialiased">
        <NearProvider>
          <QueryProvider>
            <DemoProvider>
              <div className="flex min-h-screen flex-col">
                <Navbar />
                <main className="mx-auto w-full max-w-page flex-1 px-4 py-8 sm:px-6 sm:py-10">
                  {children}
                </main>
                <SiteFooter />
              </div>
            </DemoProvider>
          </QueryProvider>
        </NearProvider>
      </body>
    </html>
  );
}
