"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CircleAlert,
  ImagePlus,
  Loader2,
  Lock,
  Sparkles,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { useDemo } from "@/lib/demo/DemoProvider";
import { useAllSeats } from "@/lib/chain/hooks";
import type { ChainPort, Seat } from "@/lib/chain/types";
import { fileToSeatArtwork, type SeatArtwork } from "@/lib/image";
import { savePortrait } from "@/lib/portraits";
import { near, seatLabel } from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { Reveal } from "@/components/ui/Reveal";
import { LogenMascot } from "@/components/brand/LogenMascot";
import { SeatGlyph } from "@/components/seat/SeatGlyph";

interface MintedResult {
  seat: Seat;
  live: boolean;
  portraitSaved: boolean;
}

function validateHandle(value: string): string | null {
  if (value.length < 2 || value.length > 20) {
    return "Use 2 to 20 characters.";
  }
  if (!/^[a-z0-9-]+$/.test(value)) {
    return "Use lowercase letters, numbers and hyphens only.";
  }
  if (value.startsWith("-") || value.endsWith("-")) {
    return "A handle cannot start or end with a hyphen.";
  }
  if (/^s\d+$/.test(value)) {
    return "Handles like s013 are reserved for numbered seats.";
  }
  return null;
}

async function waitForSeat(
  chain: ChainPort,
  tokenId: string,
  timeoutMs = 20_000
): Promise<Seat | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const seat = await chain.getSeat(tokenId);
      if (seat) return seat;
    } catch {
      // The callback may still be landing. Keep trying until the timeout.
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1_200));
  }
  return null;
}

function MintSuccessDialog({
  open,
  onOpenChange,
  result,
  onMintAnother,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: MintedResult | null;
  onMintAnother: () => void;
}) {
  const reduced = useReducedMotion();
  if (!result) return null;
  const { seat, live, portraitSaved } = result;
  const title = seat.handle ? seat.tokenId : `Seat ${seatLabel(seat.tokenId)}`;
  const label = seat.handle ? seat.tokenId : `Seat ${seatLabel(seat.tokenId)}`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[60] bg-[var(--overlay)]" />
        <Dialog.Content className="sheet-shadow fixed left-1/2 top-1/2 z-[61] max-h-[92dvh] w-[calc(100%-2rem)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Chip
                tone="positive"
                icon={<Check className="h-3 w-3" aria-hidden="true" />}
                className={reduced ? undefined : "animate-stamp-in"}
              >
                {live ? "On chain" : "Simulated"}
              </Chip>
              <Dialog.Title className="mt-4 text-24 font-semibold text-paper">
                {live ? "Seat minted on chain." : "Seat minted."}
              </Dialog.Title>
              <Dialog.Description className="mt-2 max-w-[38ch] text-14 leading-relaxed text-paper-muted">
                {label} is yours. Its wallet starts empty and earns with the club.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-transparent text-paper-muted transition-colors hover:border-line hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="relative mt-5 flex min-h-[190px] items-center justify-center overflow-hidden rounded border border-line bg-ink-deep">
            {seat.imageUrl ? (
              <motion.div
                initial={reduced ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduced ? 0.01 : 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                className="absolute inset-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={seat.imageUrl}
                  alt={`Portrait for ${label}`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </motion.div>
            ) : (
              <SeatGlyph tokenId={seat.tokenId} innerDots={seat.innerDots} size={100} ping />
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-label text-[#4de8ff]">
                  {seat.handle ? "Custom handle" : "New seat"}
                </div>
                <div className="mt-1 font-mono text-14 text-paper">{title}</div>
              </div>
              <SeatGlyph tokenId={seat.tokenId} innerDots={seat.innerDots} size={38} />
            </div>
          </div>

          <dl className="mt-4 divide-y divide-line border-y border-line">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="mono-label">Owner</dt>
              <dd className="max-w-[60%] truncate font-mono text-12 text-paper">
                {seat.ownerId}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="mono-label">Wallet</dt>
              <dd className="font-mono text-12 text-positive">Keyless · 0 keys</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="mono-label">Portrait</dt>
              <dd className="text-right text-12 text-paper-muted">
                {live
                  ? portraitSaved
                    ? "Saved in this browser"
                    : "Not saved; on-chain SVG remains"
                  : "Simulated, kept in memory"}
              </dd>
            </div>
          </dl>

          {!live ? (
            <p className="mt-4 rounded border border-[rgba(230,180,80,0.3)] bg-caution-soft px-3 py-2 text-12 leading-relaxed text-caution">
              Demo mint. Nothing was sent on chain. Reset demo clears this seat.
            </p>
          ) : (
            <p className="mt-4 text-12 leading-relaxed text-paper-muted">
              The live NFT keeps its dynamic Logen SVG on chain. Your uploaded portrait
              is a local display layer for this browser.
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <LinkButton
              href={`/seat/${encodeURIComponent(seat.tokenId)}`}
              fullWidth
              onClick={() => onOpenChange(false)}
            >
              Open seat
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </LinkButton>
            <Button variant="secondary" fullWidth onClick={onMintAnother}>
              Mint another
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StepStrip({ hasArtwork, hasName }: { hasArtwork: boolean; hasName: boolean }) {
  const steps = [
    { label: "Portrait", done: hasArtwork },
    { label: "Details", done: hasName },
    { label: "Mint", done: false },
  ];
  return (
    <div className="grid gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-3">
      {steps.map((step, index) => (
        <div key={step.label} className="bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded border font-mono text-[9px] ${
                step.done
                  ? "border-[rgba(123,216,143,0.4)] bg-positive-soft text-positive"
                  : "border-line text-paper-muted"
              }`}
            >
              {step.done ? (
                <Check className="h-3 w-3" aria-hidden="true" />
              ) : (
                `0${index + 1}`
              )}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-label text-paper">
              {step.label}
            </span>
          </div>
          <p className="mt-1.5 text-12 leading-relaxed text-paper-muted">
            {index === 0
              ? "Drop an image. It becomes the seat's face."
              : index === 1
                ? "Name it. Add a handle if you want one."
                : "Mint it. The wallet comes with it."}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function MintPage() {
  const queryClient = useQueryClient();
  const { accountId, registryId, config, openWalletModal, callContractMethod } =
    useNear();
  const { demo, demoAccount, mock, chain } = useDemo();
  const allSeatsQuery = useAllSeats(demo);

  const [artwork, setArtwork] = useState<SeatArtwork | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [handle, setHandle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [pending, setPending] = useState(false);
  const [liveStage, setLiveStage] = useState<"idle" | "signing" | "waiting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<MintedResult | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nextNumber = useMemo(() => {
    const numbers = (allSeatsQuery.data ?? []).map((seat) => seat.number);
    return Math.max(12, ...numbers) + 1;
  }, [allSeatsQuery.data]);

  const handleError = useMemo(() => {
    const cleaned = handle.trim();
    if (!cleaned) return null;
    return validateHandle(cleaned);
  }, [handle]);

  const mintFeeYocto = config?.seat_price ?? "2200000000000000000000000";
  const mintFee = near(mintFeeYocto, 2);
  const registryLabel = demo ? "logen.testnet" : registryId;
  const previewHandle = handle.trim() || (demo ? `s${String(nextNumber).padStart(3, "0")}` : "your-handle");
  const previewTokenId = `${previewHandle}.${registryLabel}`;
  const previewNumber = handle.trim() ? "CUSTOM" : String(nextNumber).padStart(2, "0");
  const canMint =
    Boolean(artwork) &&
    !pending &&
    !handleError &&
    (demo || Boolean(handle.trim())) &&
    (demo || Boolean(accountId));

  const acceptFile = async (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    setReading(true);
    try {
      const nextArtwork = await fileToSeatArtwork(file);
      setArtwork(nextArtwork);
      if (!name.trim()) {
        const base = file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[-_]+/g, " ")
          .trim();
        if (base) setName(base.slice(0, 48));
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "That image could not be read.");
    } finally {
      setReading(false);
    }
  };

  const clearArtwork = () => {
    setArtwork(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    clearArtwork();
    setName("");
    setDescription("");
    setHandle("");
    setError(null);
    setMinted(null);
    setSuccessOpen(false);
  };

  const mint = async () => {
    setError(null);
    if (!artwork) {
      setError("Upload a portrait first.");
      return;
    }
    if (handleError) {
      setError(handleError);
      return;
    }
    if (!demo && !accountId) {
      openWalletModal();
      setError("Connect a wallet to mint on chain.");
      return;
    }
    if (!demo && !handle.trim()) {
      setError("Choose a handle for a live seat.");
      return;
    }

    setPending(true);
    try {
      if (demo) {
        await new Promise((resolve) => window.setTimeout(resolve, 850));
        const seat = await mock.mintSeat({
          name: name.trim() || null,
          description: description.trim() || null,
          imageUrl: artwork.dataUrl,
          handle: handle.trim() || null,
          ownerId: demoAccount,
        });
        setMinted({ seat, live: false, portraitSaved: true });
        setSuccessOpen(true);
      } else {
        if (!accountId) throw new Error("Connect a wallet first.");
        const tokenId = `${handle.trim()}.${registryId}`;
        setLiveStage("signing");
        await callContractMethod({
          receiverId: registryId,
          methodName: "mint_seat",
          args: {
            receiver_id: accountId,
            handle: handle.trim(),
          },
          gas: "220000000000000",
          deposit: mintFeeYocto,
        });
        setLiveStage("waiting");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["seats"] }),
          queryClient.invalidateQueries({ queryKey: ["listings"] }),
        ]);
        const seat = await waitForSeat(chain, tokenId);
        const portraitSaved = savePortrait(tokenId, {
          dataUrl: artwork.dataUrl,
          name: name.trim() || undefined,
          description: description.trim() || undefined,
        });
        const fallback: Seat = {
          tokenId,
          number: Number(tokenId.split(".")[0].replace(/\D/g, "")) || 0,
          ownerId: accountId,
          balanceYocto: "0",
          withdrawableYocto: "0",
          status: "active",
          listedPriceYocto: null,
          holderSinceMs: Date.now(),
          holdersCount: 1,
          earnedYocto: "0",
          paidOutYocto: "0",
          eventsAttended: 0,
          innerDots: 1,
          cooldownUntilMs: null,
          privateBuyer: null,
          name: name.trim() || null,
          description: description.trim() || null,
          imageUrl: artwork.dataUrl,
          handle: handle.trim(),
        };
        setMinted({
          seat: seat
            ? {
                ...seat,
                name: seat.name ?? (name.trim() || null),
                description: seat.description ?? (description.trim() || null),
                imageUrl: artwork.dataUrl,
                handle: handle.trim(),
              }
            : fallback,
          live: true,
          portraitSaved,
        });
        setSuccessOpen(true);
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "The mint did not go through. Nothing changed."
      );
    } finally {
      setPending(false);
      setLiveStage("idle");
    }
  };

  const stageLabel = pending
    ? liveStage === "signing"
      ? "Waiting for your wallet…"
      : liveStage === "waiting"
        ? "Waiting for the chain…"
        : "Minting…"
    : demo
      ? "Mint this seat · demo"
      : `Mint for ${mintFee} NEAR`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="bracket-label">[ MINT / SEAT ]</span>
          <h1 className="mt-2 text-40 font-semibold text-paper">
            Give a seat a face.
          </h1>
          <p className="mt-2 max-w-[58ch] text-14 leading-relaxed text-paper-muted">
            Upload a portrait, name it, and mint a membership seat. The seat is an NFT
            and a keyless wallet. The portrait becomes its face.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={demo ? "caution" : "accent"} dot>
            {demo ? "Simulated mint" : "NEAR Testnet"}
          </Chip>
          <Chip tone="neutral" icon={<Lock className="h-3 w-3" aria-hidden="true" />}>
            Keyless
          </Chip>
        </div>
      </div>

      <Reveal>
        <StepStrip hasArtwork={Boolean(artwork)} hasName={Boolean(name.trim())} />
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)] lg:items-start">
        <div className="space-y-4">
          <Reveal>
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <span className="bracket-label">[ 01 / PORTRAIT ]</span>
                <span className="mono-label">PNG, JPEG or WebP · 8 MB max</span>
              </div>
              <div className="p-4 sm:p-5">
                <label
                  data-dragging={dragging}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                    setDragging(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    void acceptFile(event.dataTransfer.files?.[0]);
                  }}
                  className="dropzone group flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded p-6 text-center focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => void acceptFile(event.target.files?.[0])}
                    aria-label="Choose a portrait image"
                  />
                  {reading ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-6 w-6 animate-spin text-signal" aria-hidden="true" />
                      <p className="mt-3 text-14 text-paper">Preparing your portrait…</p>
                      <p className="mt-1 text-12 text-paper-muted">
                        Resizing to 1200px and compressing it.
                      </p>
                    </div>
                  ) : artwork ? (
                    <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:text-left">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={artwork.dataUrl}
                        alt="Selected portrait preview"
                        className="h-28 w-28 rounded border border-line object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-12 text-paper">
                          {artwork.fileName}
                        </p>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-label text-paper-muted">
                          {artwork.width} × {artwork.height} · ready
                        </p>
                        <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label text-positive">
                            <Check className="h-3 w-3" aria-hidden="true" />
                            Portrait set
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              clearArtwork();
                            }}
                            className="font-mono text-[10px] uppercase tracking-label text-paper-muted underline decoration-line underline-offset-4 hover:text-paper"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded border border-line bg-surface text-paper-muted transition-colors group-hover:border-[rgba(59,155,255,0.5)] group-hover:text-signal">
                        <Upload className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <p className="mt-4 text-14 text-paper">Drop an image here</p>
                      <p className="mt-1 text-12 text-paper-muted">
                        or click to choose a file
                      </p>
                    </div>
                  )}
                </label>
                <p className="mt-3 text-12 leading-relaxed text-paper-muted">
                  The image is resized to fit 1200px and kept with the seat. In demo mode
                  it stays in memory; in live mode it is saved in this browser as a
                  display layer.
                </p>
                {error ? (
                  <p
                    role="alert"
                    className="mt-3 flex items-start gap-2 rounded border border-[rgba(255,107,94,0.35)] bg-danger-soft px-3 py-2 text-12 leading-relaxed text-danger"
                  >
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {error}
                  </p>
                ) : null}
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={0.05}>
            <Panel>
              <div className="border-b border-line px-4 py-3">
                <span className="bracket-label">[ 02 / DETAILS ]</span>
              </div>
              <div className="space-y-4 p-4 sm:p-5">
                <label className="block">
                  <span className="mono-label">Seat name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={48}
                    placeholder="The Blue Cube"
                    className="mt-2 min-h-11 w-full rounded border border-line bg-surface-sunken px-3 font-mono text-14 text-paper outline-none placeholder:text-paper-muted focus:border-signal"
                  />
                  <span className="mt-1 block text-right font-mono text-[10px] uppercase tracking-label text-paper-muted">
                    {name.length}/48
                  </span>
                </label>

                <label className="block">
                  <span className="mono-label">
                    Handle {demo ? "(optional)" : "(required for live)"}
                  </span>
                  <div className="mt-2 flex min-h-11 items-center rounded border border-line bg-surface-sunken px-3 focus-within:border-signal">
                    <input
                      type="text"
                      value={handle}
                      onChange={(event) => setHandle(event.target.value.toLowerCase())}
                      maxLength={20}
                      placeholder="blue-cube"
                      aria-invalid={Boolean(handleError)}
                      aria-describedby="handle-hint"
                      className="w-full bg-transparent py-2.5 font-mono text-14 text-paper outline-none placeholder:text-paper-muted"
                    />
                    <span className="ml-2 max-w-[52%] shrink-0 truncate font-mono text-12 text-paper-muted">
                      .{registryLabel}
                    </span>
                  </div>
                  <p id="handle-hint" className="mt-2 text-12 leading-relaxed text-paper-muted">
                    {handleError
                      ? handleError
                      : demo
                        ? "Optional. Leave it blank for the next numbered seat."
                        : "2–20 lowercase letters, numbers or hyphens. It becomes the seat account."}
                  </p>
                </label>

                <label className="block">
                  <span className="mono-label">Short story (optional)</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={280}
                    rows={3}
                    placeholder="Why this seat exists, in one or two lines."
                    className="mt-2 w-full resize-y rounded border border-line bg-surface-sunken px-3 py-2.5 text-14 leading-relaxed text-paper outline-none placeholder:text-paper-muted focus:border-signal"
                  />
                  <span className="mt-1 block text-right font-mono text-[10px] uppercase tracking-label text-paper-muted">
                    {description.length}/280
                  </span>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded border border-line bg-surface-sunken p-3">
                    <div className="mono-label">Owner</div>
                    <div className="mt-1 truncate font-mono text-12 text-paper">
                      {demo ? demoAccount : accountId ?? "Not connected"}
                    </div>
                  </div>
                  <div className="rounded border border-line bg-surface-sunken p-3">
                    <div className="mono-label">Mint fee</div>
                    <div className="mt-1 font-mono text-12 text-paper">
                      {demo ? "0.00 NEAR" : `${mintFee} NEAR`}
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          </Reveal>

        </div>

        <div className="space-y-4 lg:sticky lg:top-20">
          <Reveal delay={0.08}>
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                <span className="bracket-label">[ PREVIEW ]</span>
                <Chip tone="accent" dot>
                  {demo ? "Demo" : "Live"}
                </Chip>
              </div>
              <div className="p-4">
                <div className="relative aspect-[4/5] overflow-hidden rounded border border-line bg-ink-deep">
                  {artwork ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={artwork.dataUrl}
                      alt="Seat portrait preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded border border-line bg-surface text-paper-muted">
                        <ImagePlus className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-14 text-paper">Your portrait here</p>
                        <p className="mt-1 text-12 leading-relaxed text-paper-muted">
                          Upload an image to see the seat take shape.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
                    <span className="font-mono text-[10px] uppercase tracking-label text-paper">
                      {handle.trim() ? "Custom" : `Seat ${previewNumber}`}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-label text-[#4de8ff]">
                      New
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-3">
                    <p className="truncate text-16 font-medium text-paper">
                      {name.trim() || "Untitled seat"}
                    </p>
                    <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-label text-paper-muted">
                      {previewTokenId}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <dt className="mono-label">Owner</dt>
                    <dd className="mt-1 truncate font-mono text-12 text-paper">
                      {demo ? demoAccount : accountId ?? "Not connected"}
                    </dd>
                  </div>
                  <div>
                    <dt className="mono-label">Wallet</dt>
                    <dd className="mt-1 font-mono text-12 text-positive">Keyless</dd>
                  </div>
                  <div>
                    <dt className="mono-label">Network</dt>
                    <dd className="mt-1 font-mono text-12 text-paper">
                      {demo ? "Simulated" : "Testnet"}
                    </dd>
                  </div>
                  <div>
                    <dt className="mono-label">Mint fee</dt>
                    <dd className="mt-1 font-mono text-12 text-paper">
                      {demo ? "0.00 NEAR" : `${mintFee} NEAR`}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-start gap-2 rounded border border-line bg-surface-sunken px-3 py-2.5">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal" aria-hidden="true" />
                  <p className="text-12 leading-relaxed text-paper-muted">
                    {demo
                      ? "Demo mint. The seat appears in your wallet immediately; reset demo clears it."
                      : "The mint fee goes to the club treasury and organizer. The new seat's wallet starts empty."}
                  </p>
                </div>

                <Button
                  size="lg"
                  fullWidth
                  className="mt-3"
                  onClick={() => void mint()}
                  loading={pending}
                  disabled={!canMint}
                >
                  {!pending ? <Sparkles className="h-4 w-4" aria-hidden="true" /> : null}
                  {stageLabel}
                </Button>
                {!demo && !accountId ? (
                  <Button
                    variant="secondary"
                    fullWidth
                    className="mt-2"
                    onClick={openWalletModal}
                  >
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    Connect wallet
                  </Button>
                ) : null}
                <p className="mt-3 text-center text-12 leading-relaxed text-paper-muted">
                  {demo
                    ? "No wallet, no fee. Switch demo off to mint a real testnet seat."
                    : "Live mint creates the seat and its keyless wallet in one transaction."}
                </p>
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="flex items-center gap-3 rounded border border-line bg-surface p-4">
              <LogenMascot
                size={72}
                caption={null}
                showSparks={false}
                className="shrink-0"
              />
              <div className="min-w-0">
                <p className="mono-label">The keeper says</p>
                <p className="mt-1 text-12 leading-relaxed text-paper-muted">
                  “A seat with a face is easier to remember. A seat with no keys is
                  easier to trust.”
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-line bg-surface px-4 py-3">
              <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
                Prefer the directory?
              </span>
              <Link
                href="/seats"
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label text-paper-muted underline decoration-line underline-offset-4 hover:text-paper"
              >
                All seats
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>

      <MintSuccessDialog
        open={successOpen}
        onOpenChange={setSuccessOpen}
        result={minted}
        onMintAnother={resetForm}
      />
    </div>
  );
}
