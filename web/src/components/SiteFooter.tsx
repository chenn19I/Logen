import Link from "next/link";
import { SeatGlyph } from "@/components/seat/SeatGlyph";

const clubLinks = [
  { href: "/mint", label: "Mint a seat" },
  { href: "/seats", label: "Seat roll" },
  { href: "/market", label: "Market" },
  { href: "/lounge", label: "Lounge" },
];

const systemLinks = [
  { href: "/verify", label: "Verify" },
  { href: "/lab", label: "Attack Lab" },
  { href: "/events", label: "Events" },
  { href: "/treasury", label: "Treasury" },
  { href: "/kit", label: "Kit" },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-line">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 right-0 hidden select-none font-display text-[180px] font-semibold leading-none tracking-[-0.07em] text-[rgba(236,232,216,0.025)] sm:block"
      >
        LOGEN
      </div>

      <div className="relative mx-auto w-full max-w-page px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-10 md:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="flex items-center gap-3">
              <span aria-hidden="true">
                <SeatGlyph tokenId="logen-club-footer" innerDots={6} size={34} />
              </span>
              <div>
                <div className="font-display text-16 font-semibold uppercase tracking-[0.1em] text-paper">
                  Logen
                </div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-label text-paper-muted">
                  Members club / NEAR Testnet
                </div>
              </div>
            </div>
            <p className="mt-5 max-w-[42ch] text-14 leading-relaxed text-paper-muted">
              Every seat is an NFT with its own keyless wallet. Sell the seat and the
              money, history and access go with it.
            </p>
            <p className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-positive">
              <span className="h-1 w-1 rounded-full bg-positive" aria-hidden="true" />
              No keys. Ever.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 font-mono text-[10px] uppercase tracking-label">
            <div>
              <div className="text-paper-muted">Club</div>
              <ul className="mt-3 space-y-2.5">
                {clubLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-paper-dim transition-colors hover:text-paper"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-paper-muted">System</div>
              <ul className="mt-3 space-y-2.5">
                {systemLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-paper-dim transition-colors hover:text-paper"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 font-mono text-[9px] uppercase tracking-label text-paper-muted">
          <span>© 2026 Logen · [ SEAT == KEYLESS VAULT ]</span>
          <span>Built on NEAR Testnet · NEP-171 + NEP-413 · Not audited</span>
        </div>
      </div>
    </footer>
  );
}
