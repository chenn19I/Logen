import { LogenMascot } from "@/components/brand/LogenMascot";
import { SeatGlyph } from "@/components/seat/SeatGlyph";
import { cn } from "@/lib/utils";

/**
 * The seat pass: the mascot framed as a physical club credential, not as a
 * picture in a card. It is a preview of the product, so the numbers are the
 * same seat data the wallet screen shows.
 */
export function MascotPass({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-label text-paper-muted">
        <span>Member pass / 001</span>
        <span className="inline-flex items-center gap-1.5 text-positive">
          <span className="h-1 w-1 rounded-full bg-positive" aria-hidden="true" />
          Live on testnet
        </span>
      </div>

      <div className="relative mt-2 overflow-hidden rounded border border-line bg-[#05070d]">
        <LogenMascot
          size={430}
          aspectRatio="4 / 5"
          priority
          caption={null}
          className="w-full !rounded-none !border-0"
          imageClassName="object-cover object-[50%_44%]"
        />

        <span
          className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l border-t border-[rgba(236,232,216,0.3)]"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r border-t border-[rgba(236,232,216,0.3)]"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-b border-l border-[rgba(236,232,216,0.3)]"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b border-r border-[rgba(236,232,216,0.3)]"
          aria-hidden="true"
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
          <div>
            <div className="font-display text-[13px] font-semibold uppercase leading-none tracking-[0.18em] text-paper">
              Logen
            </div>
            <div className="mt-1.5 font-mono text-[8px] uppercase tracking-label text-paper-muted">
              Members club / est. 2026
            </div>
          </div>
          <div className="text-right font-mono text-[8px] uppercase leading-relaxed tracking-label text-paper-muted">
            <div className="text-[#4de8ff]">Keeper 07</div>
            <div>Est. 2026</div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end gap-3">
              <span aria-hidden="true">
                <SeatGlyph tokenId="s007.logen.testnet" innerDots={7} size={38} />
              </span>
              <div>
                <div className="font-mono text-[8px] uppercase tracking-label text-paper-muted">
                  Seat no.
                </div>
                <div className="mt-1 font-mono text-[52px] leading-[0.72] tracking-[-0.05em] text-paper tabular">
                  07
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[8px] uppercase tracking-label text-paper-muted">
                Inside
              </div>
              <div className="mt-1 font-mono text-[20px] leading-none text-positive tabular">
                3.20
              </div>
              <div className="mt-1 font-mono text-[8px] uppercase tracking-label text-paper-muted">
                NEAR / 0 keys
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[rgba(236,232,216,0.18)] pt-2.5 font-mono text-[8px] uppercase tracking-label">
            <span className="text-paper-muted">Keeper of the seat</span>
            <span className="text-[#4de8ff]">No keys, ever</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px border-x border-b border-line bg-line">
        <div className="bg-ink px-2.5 py-2.5">
          <div className="font-mono text-[8px] uppercase tracking-label text-paper-muted">
            Network
          </div>
          <div className="mt-1 font-mono text-[10px] text-paper">NEAR Testnet</div>
        </div>
        <div className="bg-ink px-2.5 py-2.5">
          <div className="font-mono text-[8px] uppercase tracking-label text-paper-muted">
            Wallet
          </div>
          <div className="mt-1 font-mono text-[10px] text-positive">Keyless</div>
        </div>
        <div className="bg-ink px-2.5 py-2.5">
          <div className="font-mono text-[8px] uppercase tracking-label text-paper-muted">
            Access
          </div>
          <div className="mt-1 font-mono text-[10px] text-paper">Holder</div>
        </div>
      </div>
    </div>
  );
}
