import Link from "next/link";
import { SeatGlyph } from "@/components/seat/SeatGlyph";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-page flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-3">
          <SeatGlyph tokenId="pusaka-club-footer" innerDots={6} size={28} />
          <div>
            <div className="font-display text-14 font-semibold uppercase tracking-[0.06em] text-paper">
              Pusaka
            </div>
            <p className="mt-1 max-w-[38ch] text-12 leading-relaxed text-paper-muted">
              A members club where every seat is an NFT with its own keyless wallet.
              Sell the seat and everything goes with it.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-label text-paper-muted">
          <Link href="/market" className="hover:text-paper">
            Market
          </Link>
          <Link href="/lounge" className="hover:text-paper">
            Lounge
          </Link>
          <Link href="/lab" className="hover:text-paper">
            Attack Lab
          </Link>
          <Link href="/kit" className="hover:text-paper">
            Kit
          </Link>
          <span className="text-paper-muted">NEAR Testnet</span>
          <span className="text-positive">No keys, ever</span>
        </div>
      </div>
    </footer>
  );
}
