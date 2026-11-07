"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  Check,
  Download,
  Loader2,
  Plus,
  ShieldCheck,
  Tag,
} from "lucide-react";
import type { ProofSnapshot, Seat } from "@/lib/chain/types";
import { parseNearToYocto } from "@/lib/near/format";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Panel } from "@/components/ui/Panel";
import { LogenMascot } from "@/components/brand/LogenMascot";
import { SeatCard } from "@/components/seat/SeatCard";
import { SeatArtwork } from "@/components/seat/SeatArtwork";
import { SeatGlyph } from "@/components/seat/SeatGlyph";
import { PixelChair } from "@/components/seat/PixelChair";
import { ProofStamp } from "@/components/seat/ProofStamp";
import { VerifyDrawer } from "@/components/seat/VerifyDrawer";
import { ConfirmationSheet } from "@/components/seat/ConfirmationSheet";
import { HandoffOverlay, type HandoffMode } from "@/components/seat/Handoff";
import { AsciiVaultField } from "@/components/ascii/AsciiVaultField";
import { PixelMatrixReadout } from "@/components/ascii/PixelMatrixReadout";
import { SignalTape } from "@/components/ascii/SignalTape";

const DEMO_SEAT: Seat = {
  tokenId: "s007.logen.testnet",
  number: 7,
  ownerId: "demo.logen.testnet",
  balanceYocto: parseNearToYocto("3.20"),
  withdrawableYocto: parseNearToYocto("3.20"),
  status: "active",
  listedPriceYocto: null,
  holderSinceMs: Date.UTC(2026, 9, 12, 16, 30),
  holdersCount: 2,
  earnedYocto: parseNearToYocto("2.40"),
  paidOutYocto: parseNearToYocto("1.00"),
  eventsAttended: 6,
  innerDots: 6,
  cooldownUntilMs: null,
  privateBuyer: null,
};

const PORTRAIT_SEAT: Seat = {
  ...DEMO_SEAT,
  tokenId: "blue-cube.logen.testnet",
  number: 8,
  name: "The Blue Cube",
  description:
    "A seat for the one who keeps the cube lit. Minted with a portrait instead of a number.",
  imageUrl: "/logen-mascot.png",
  handle: "blue-cube",
};

const DEMO_PROOF: ProofSnapshot = {
  seatId: DEMO_SEAT.tokenId,
  rows: [
    {
      id: "keys",
      label: "Access keys",
      value: "None",
      detail: "view_access_key_list returns 0 keys. Nothing can sign for this seat.",
      status: "ok",
      recheckable: true,
    },
    {
      id: "code",
      label: "Code",
      value: "DFuv6M...LmwSg",
      detail:
        "Pinned hash DFuv6MrVh9yz62uvRxYbZhAEewiWeqUKdYvb3kPLmwSg. The club cannot swap it.",
      status: "ok",
      recheckable: true,
    },
    {
      id: "identity",
      label: "Identity",
      value: "Club and seat agree",
      detail: "Owner and sequence match at the same final block.",
      status: "ok",
      recheckable: true,
    },
    {
      id: "holder",
      label: "Holder",
      value: DEMO_SEAT.ownerId,
      detail: "Only this account can open the seat. It changes with the seat.",
      status: "ok",
      recheckable: true,
    },
    {
      id: "build",
      label: "Build",
      value: "UNSEALED",
      detail: "Testnet build. A sealed build is required before mainnet.",
      status: "warn",
      recheckable: true,
    },
  ],
  blockHeight: 214_889_771,
  blockHash: "8mF3kPzqH7vN2sC5xL9dR4tY6wB1aE0uJ8gQ3nK5pV2c",
  allOk: true,
  checkedAtMs: Date.now(),
};

const COLORS = [
  { name: "Background", token: "--bg", value: "#11140F", className: "bg-ink" },
  { name: "Surface", token: "--surface", value: "#181C16", className: "bg-surface" },
  { name: "Line", token: "--line", value: "#2A2F27", className: "bg-line" },
  { name: "Text", token: "--text", value: "#ECE8D8", className: "bg-paper" },
  { name: "Muted", token: "--muted", value: "#8D9585", className: "bg-paper-muted" },
  { name: "Accent", token: "--accent", value: "#3B9BFF", className: "bg-signal" },
  { name: "Positive", token: "--positive", value: "#7BD88F", className: "bg-positive" },
  { name: "Caution", token: "--caution", value: "#E6B450", className: "bg-caution" },
  { name: "Danger", token: "--danger", value: "#FF6B5E", className: "bg-danger" },
];

function Section({
  label,
  title,
  children,
  id,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="border-t border-line pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="mono-label">{label}</div>
          <h2 className="mt-1 text-24 font-semibold text-paper">{title}</h2>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function KitPage() {
  const [proofOpen, setProofOpen] = useState(false);
  const [handoff, setHandoff] = useState<HandoffMode | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stampKey, setStampKey] = useState(0);
  const [switchOn, setSwitchOn] = useState(true);

  return (
    <div className="space-y-10">
      <header>
        <span className="bracket-label">[ KIT / SPECIMENS ]</span>
        <h1 className="mt-4 text-40 font-semibold text-paper sm:text-72">The kit.</h1>
        <p className="mt-3 max-w-[54ch] font-mono text-14 leading-relaxed text-paper-muted">
          Tokens, type, controls and the seat in every state. One accent, one
          hairline, no shadows except sheets.
        </p>
      </header>

      <Section label="01 / Colour" title="Ink, paper, one signal.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
          {COLORS.map((color) => (
            <div key={color.token}>
              <div
                className={`h-16 rounded border border-line ${color.className}`}
                aria-hidden="true"
              />
              <div className="mt-2 font-mono text-[10px] uppercase tracking-label text-paper">
                {color.name}
              </div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-label text-paper-muted">
                {color.value}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="02 / Type" title="Geist and Geist Mono.">
        <div className="space-y-5">
          <div className="flex flex-wrap items-baseline gap-4">
            <span className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-label text-paper-muted">
              72
            </span>
            <span className="text-72 font-semibold text-paper">Sell the seat.</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-4">
            <span className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-label text-paper-muted">
              40
            </span>
            <span className="text-40 font-semibold text-paper">The wallet goes with it.</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-4">
            <span className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-label text-paper-muted">
              24
            </span>
            <span className="text-24 font-semibold text-paper">Rooftop Screening</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-4">
            <span className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-label text-paper-muted">
              16
            </span>
            <span className="text-16 text-paper-dim">
              Hold the seat, hold the money. Built on NEAR.
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-4">
            <span className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-label text-paper-muted">
              14
            </span>
            <span className="font-mono text-14 text-paper-muted">
              This seat has no keys. Only the club contract can move its money.
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-4">
            <span className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-label text-paper-muted">
              12
            </span>
            <span className="font-mono text-12 uppercase tracking-label text-paper-muted">
              [ 07 / SEAT ] · MEMBERSHIP SEATS · NO KEYS. EVER.
            </span>
          </div>
        </div>
      </Section>

      <Section label="03 / Controls" title="Buttons, chips, fields.">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button>
                Withdraw
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="secondary">List for sale</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="danger">Remove</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary">
                Small
              </Button>
              <Button size="md" variant="secondary">
                Medium
              </Button>
              <Button size="lg" variant="secondary">
                Large
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button loading>Withdrawing</Button>
              <Button disabled>Disabled</Button>
              <Button variant="secondary" loading>
                Checking
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="neutral">Neutral</Chip>
              <Chip tone="accent" dot>
                Accent
              </Chip>
              <Chip tone="positive" dot>
                Active
              </Chip>
              <Chip tone="caution" dot>
                Listed, withdrawals paused
              </Chip>
              <Chip tone="danger" dot>
                Blocked
              </Chip>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={switchOn}
                onCheckedChange={setSwitchOn}
                label="Demo mode"
                id="kit-demo"
              />
              <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
                {switchOn ? "On" : "Off"}
              </span>
            </div>
          </div>
          <div className="space-y-4">
            <Field label="Amount" placeholder="0.50" suffix="NEAR" hint="Withdrawable: 3.20 NEAR" />
            <Field
              label="Price"
              placeholder="6.40"
              suffix="NEAR"
              hint="While listed, withdrawals are paused so buyers can trust the balance."
            />
            <Field
              label="Private buyer"
              placeholder="account.testnet"
              error="Use a full testnet account."
            />
          </div>
        </div>
      </Section>

      <Section label="04 / Seat glyph" title="A 5x5 dot grid. Outer ring always lit.">
        <div className="flex flex-wrap items-end gap-6">
          {[
            { size: 16, dots: 1 },
            { size: 24, dots: 2 },
            { size: 40, dots: 4 },
            { size: 96, dots: 6 },
            { size: 160, dots: 8 },
          ].map((item) => (
            <div key={item.size} className="text-center">
              <SeatGlyph
                tokenId="s007.logen.testnet"
                innerDots={item.dots}
                size={item.size}
              />
              <div className="mt-2 font-mono text-[9px] uppercase tracking-label text-paper-muted">
                {item.size}px
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="05 / Seat card" title="Front and proof side.">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <div className="mono-label mb-2">Front</div>
            <SeatCard seat={DEMO_SEAT} />
          </div>
          <div>
            <div className="mono-label mb-2">Back</div>
            <SeatCard seat={DEMO_SEAT} defaultFlipped />
          </div>
        </div>
      </Section>

      <Section label="06 / Proof" title="The stamp opens the drawer.">
        <div className="flex flex-wrap items-center gap-4">
          <ProofStamp onClick={() => setProofOpen(true)} />
          <span className="text-14 text-paper-muted">
            A KEYLESS chip with a check. Tapping reads five rows again.
          </span>
        </div>
      </Section>

      <Section label="07 / Handoff" title="Seller and buyer.">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setHandoff("seller")}>
            Seller handoff
          </Button>
          <Button onClick={() => setHandoff("buyer")}>Buyer handoff</Button>
        </div>
      </Section>

      <Section label="08 / Attack stamp" title="Blocked, every time.">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="secondary"
            onClick={() => setStampKey((value) => value + 1)}
          >
            Run a blocked test
          </Button>
          <span
            key={stampKey}
            className="inline-flex -rotate-3 items-center gap-1 rounded-[2px] border border-danger px-3 py-1.5 font-mono text-12 font-semibold uppercase tracking-label text-danger animate-stamp-in"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Blocked
          </span>
        </div>
      </Section>

      <Section label="09 / Confirmation" title="What happens. What leaves. Who can.">
        <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
          Open confirmation sheet
        </Button>
      </Section>

      <Section label="10 / States" title="Loading, empty, error, pending, offline, simulated.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Panel className="p-4" aria-busy="true">
            <div className="mono-label">Loading</div>
            <div className="mt-3 space-y-2">
              <div className="h-3 w-24 animate-skeleton rounded bg-line" />
              <div className="h-6 w-40 animate-skeleton rounded bg-line" />
              <div className="h-3 w-full animate-skeleton rounded bg-line" />
            </div>
          </Panel>
          <Panel className="p-4">
            <div className="mono-label">Empty</div>
            <p className="mt-3 text-14 leading-relaxed text-paper-muted">
              Nothing here yet. Earnings appear after the first event settles.
            </p>
          </Panel>
          <Panel className="p-4">
            <div className="mono-label">Error</div>
            <p className="mt-3 text-14 leading-relaxed text-danger">
              That did not go through. Nothing moved.
            </p>
          </Panel>
          <Panel className="p-4">
            <div className="mono-label">Pending</div>
            <p className="mt-3 flex items-center gap-2 text-14 text-paper-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Finishing a payout. This takes a few seconds.
            </p>
          </Panel>
          <Panel className="p-4">
            <div className="mono-label">Offline</div>
            <p className="mt-3 text-14 leading-relaxed text-paper-muted">
              The chain did not answer. Nothing changed. Try again in a moment.
            </p>
          </Panel>
          <Panel className="p-4">
            <div className="mono-label">Simulated</div>
            <p className="mt-3 text-14 leading-relaxed text-caution">
              Simulated data. Not on chain.
            </p>
          </Panel>
        </div>
      </Section>

      <Section label="11 / Identity" title="The club chair.">
        <div className="flex flex-wrap items-center gap-8">
          <div className="rounded border border-line bg-ink p-6">
            <PixelChair size={180} />
          </div>
          <div className="max-w-[40ch]">
            <p className="text-14 leading-relaxed text-paper-dim">
              A cream frame, one blue cushion, three green buttons. It is drawn on a
              24x24 grid and scales without a raster asset.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip tone="positive" icon={<ShieldCheck className="h-3 w-3" aria-hidden="true" />}>
                Keyless
              </Chip>
              <Chip tone="accent" icon={<Download className="h-3 w-3" aria-hidden="true" />}>
                SVG
              </Chip>
              <Chip tone="neutral" icon={<Plus className="h-3 w-3" aria-hidden="true" />}>
                Scalable
              </Chip>
            </div>
          </div>
        </div>
      </Section>

      <Section label="12 / Mascot" title="Logen, keeper of the seat.">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-center">
          <LogenMascot size={380} priority className="w-full" />
          <div className="max-w-[44ch]">
            <p className="text-14 leading-relaxed text-paper-dim">
              The pixel wizard is the club&apos;s face: a wide navy hat, cyan goggles,
              a white beard, and a staff holding a glowing blue cube. The portrait
              floats a few pixels and the cube breathes. Both stop when the visitor
              prefers reduced motion.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip tone="accent" dot>
                Mascot
              </Chip>
              <Chip tone="neutral">Pixel art</Chip>
              <Chip tone="neutral">7s float</Chip>
            </div>
          </div>
        </div>
      </Section>

      <Section label="13 / Portrait" title="A seat can have a face.">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
          <SeatCard seat={PORTRAIT_SEAT} />
          <div className="space-y-4">
            <div className="max-w-[44ch]">
              <p className="text-14 leading-relaxed text-paper-dim">
                Uploaded portraits sit in the seat card, the market listing and the
                seat page. The artwork is display art: the live NFT keeps its dynamic
                Logen SVG on chain, while this browser remembers the image.
              </p>
            </div>
            <SeatArtwork
              seat={PORTRAIT_SEAT}
              className="aspect-[16/9] w-full max-w-[420px]"
              showLabel
            />
            <div className="flex flex-wrap gap-2">
              <Chip tone="positive">Demo: in memory</Chip>
              <Chip tone="caution">Live: local display layer</Chip>
            </div>
          </div>
        </div>
      </Section>

      <Section label="14 / ASCII & Matrix" title="Interactive 3D ASCII field and 5x7 dot-matrix readouts.">
        <div className="space-y-6">
          <SignalTape />
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <AsciiVaultField compact />
            <div className="space-y-4">
              <p className="max-w-[42ch] text-14 leading-relaxed text-paper-dim">
                Pre-rendered glyph sprites on a 60fps canvas with pointer-tracking tilt,
                target-lock leader lines, and 5x7 dot-matrix SVG readouts.
              </p>
              <div className="flex flex-wrap items-center gap-6 border-y border-line py-4">
                <div>
                  <div className="mono-label mb-2">Balance readout</div>
                  <PixelMatrixReadout value="3.20 NEAR" size="sm" tone="positive" />
                </div>
                <div>
                  <div className="mono-label mb-2">Door code</div>
                  <PixelMatrixReadout value="P-07-4812" size="sm" tone="signal" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-6">
        <p className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
          Logen kit · dark only · radius 4 · 1px lines
        </p>
        <p className="font-mono text-[10px] uppercase tracking-label text-positive">
          No keys. Ever.
        </p>
      </div>

      <VerifyDrawer
        open={proofOpen}
        onOpenChange={setProofOpen}
        proof={DEMO_PROOF}
        onRecheck={async () => {
          await new Promise((resolve) => window.setTimeout(resolve, 600));
        }}
      />

      <HandoffOverlay
        open={handoff !== null}
        mode={handoff ?? "seller"}
        seatNumber="07"
        amountNear="3.20"
        onClose={() => setHandoff(null)}
        onContinue={() => setHandoff(null)}
      />

      <ConfirmationSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Withdraw 0.50 NEAR"
        description="Money leaves the seat and goes to your wallet."
        primaryLabel="Withdraw 0.50 NEAR"
        onConfirm={() => setConfirmOpen(false)}
        blocks={[
          {
            label: "What will happen",
            value: "0.50 NEAR moves from the seat to your wallet.",
          },
          {
            label: "What leaves the seat",
            value: "0.50 NEAR. Nothing else moves.",
          },
          { label: "Who can do this", value: "You, as the holder." },
        ]}
      >
        <Field label="Amount" defaultValue="0.50" suffix="NEAR" />
      </ConfirmationSheet>
    </div>
  );
}
