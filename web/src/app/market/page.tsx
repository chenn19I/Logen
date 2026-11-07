"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CircleAlert,
  RefreshCw,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNear } from "@/components/NearProvider";
import { useDemo } from "@/lib/demo/DemoProvider";
import { useListings } from "@/lib/chain/hooks";
import type { SeatListing } from "@/lib/chain/types";
import { near, nearValue, seatLabel, shortAccount } from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { SeatArtwork } from "@/components/seat/SeatArtwork";
import { SeatGlyph } from "@/components/seat/SeatGlyph";
import { ConfirmationSheet } from "@/components/seat/ConfirmationSheet";
import { HandoffOverlay } from "@/components/seat/Handoff";

function CompareBar({ inside, price }: { inside: string; price: string }) {
  const insideValue = nearValue(inside, 4);
  const priceValue = nearValue(price, 4);
  const pct = priceValue > 0 ? Math.min(100, (insideValue / priceValue) * 100) : 0;
  const covers = insideValue >= priceValue;
  const netCost = Math.max(0, priceValue - insideValue);
  return (
    <div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-line"
        role="img"
        aria-label={`${insideValue.toFixed(2)} NEAR inside covers ${Math.round(
          pct
        )} percent of the asking price.`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${covers ? "bg-positive" : "bg-signal"}`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-12 leading-relaxed text-paper-muted">
        <span>
          {covers
            ? "Inside is worth more than the asking price."
            : `Inside covers ${Math.round(pct)}% of the asking price.`}
        </span>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-label text-paper-dim tabular">
          {covers ? "Net 0.00 NEAR" : `Net ${netCost.toFixed(2)} NEAR`}
        </span>
      </div>
    </div>
  );
}

function ListingCard({
  listing,
  currentAccount,
  onBuy,
}: {
  listing: SeatListing;
  currentAccount: string | null;
  onBuy: (listing: SeatListing) => void;
}) {
  const number = seatLabel(listing.tokenId);
  const isMine = listing.seller === currentAccount;
  const price = near(listing.priceYocto, 2);
  const inside = near(listing.insideYocto, 2);

  return (
    <Panel className="card-lift flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <span className="font-mono text-12 uppercase tracking-label text-paper-muted">
          Seat {number}
        </span>
        <Chip tone="caution" dot>
          Listed
        </Chip>
      </div>

      <div className="flex items-center gap-4 px-4 py-5">
        {listing.seat.imageUrl ? (
          <SeatArtwork
            seat={listing.seat}
            className="h-20 w-20 shrink-0"
            showLabel={false}
          />
        ) : (
          <SeatGlyph tokenId={listing.tokenId} innerDots={listing.seat.innerDots} size={64} />
        )}
        <div className="min-w-0">
          <div className="mono-label">Asking</div>
          <div className="mt-1 font-mono text-24 tabular text-paper">
            {price}
            <span className="ml-1 text-12 uppercase tracking-label text-paper-muted">
              NEAR
            </span>
          </div>
          <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-label text-paper-muted">
            {listing.seat.name ? (
              <span className="text-paper-dim">{listing.seat.name} · </span>
            ) : null}
            from {isMine ? "you" : shortAccount(listing.seller, 22)}
          </div>
        </div>
      </div>

      <div className="px-4">
        <div className="flex items-center justify-between gap-3 border-y border-line py-3">
          <span className="text-14 text-paper-dim">Inside</span>
          <span className="font-mono text-16 tabular text-positive">
            {inside} NEAR
          </span>
        </div>
        <div className="py-3">
          <CompareBar inside={listing.insideYocto} price={listing.priceYocto} />
        </div>
      </div>

      <div className="mt-auto px-4 pb-4">
        {isMine ? (
          <LinkButton href="/" variant="secondary" fullWidth>
            <Tag className="h-4 w-4" aria-hidden="true" />
            Your listing
          </LinkButton>
        ) : (
          <Button fullWidth onClick={() => onBuy(listing)}>
            Buy this seat
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </Panel>
  );
}

function MarketSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Reading listings">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-[320px] animate-skeleton rounded border border-line bg-surface" />
      ))}
    </div>
  );
}

export default function MarketPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accountId, registryId, openWalletModal, callContractMethod } = useNear();
  const { demo, demoAccount, mock } = useDemo();
  const currentAccount = demo ? demoAccount : accountId;

  const listingsQuery = useListings();
  const listings = useMemo(
    () => listingsQuery.data ?? [],
    [listingsQuery.data]
  );

  const [selected, setSelected] = useState<SeatListing | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<{
    open: boolean;
    seatNumber: string;
    amount: string;
    tokenId: string;
  }>({ open: false, seatNumber: "03", amount: "0.00", tokenId: "" });

  const openBuy = (listing: SeatListing) => {
    setSelected(listing);
    setError(null);
  };

  const buy = async () => {
    if (!selected) return;
    setError(null);
    setPending(true);
    const listing = selected;
    try {
      if (!currentAccount) {
        openWalletModal();
        throw new Error("Connect a wallet first");
      }
      if (demo) {
        await new Promise((resolve) => window.setTimeout(resolve, 1100));
        await mock.buySeat(listing.tokenId);
      } else {
        await callContractMethod({
          receiverId: registryId,
          methodName: "buy_seat",
          args: {
            token_id: listing.tokenId,
            nonce: listing.nonce,
            min_balance: listing.minBalanceYocto,
          },
          gas: "300000000000000",
          deposit: listing.priceYocto,
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["listings"] }),
          queryClient.invalidateQueries({ queryKey: ["seats"] }),
          queryClient.invalidateQueries({ queryKey: ["seat"] }),
          queryClient.invalidateQueries({ queryKey: ["history"] }),
        ]);
      }
      setSelected(null);
      setHandoff({
        open: true,
        seatNumber: seatLabel(listing.tokenId),
        amount: near(listing.insideYocto, 2),
        tokenId: listing.tokenId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="bracket-label">[ MARKET / SEATS ]</span>
          <h1 className="mt-2 text-40 font-semibold text-paper">Seats for sale.</h1>
          <p className="mt-2 max-w-[56ch] text-14 leading-relaxed text-paper-muted">
            Buy the seat and its wallet comes with it. The money inside is already
            there.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone={demo ? "neutral" : "accent"} dot>
            {demo ? "Simulated" : "NEAR Testnet"}
          </Chip>
          <button
            type="button"
            onClick={() => void listingsQuery.refetch()}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-paper-muted transition-colors hover:border-line-strong hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
            aria-label="Refresh listings"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded border border-line bg-surface px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden="true" />
        <p className="text-12 leading-relaxed text-paper-muted">
          Every purchase is checked against the balance inside at the moment it lands.
          If the balance is lower, nothing happens and you pay nothing.
        </p>
      </div>

      {listingsQuery.isLoading ? (
        <MarketSkeleton />
      ) : listingsQuery.isError ? (
        <Panel className="mx-auto max-w-prose p-8 text-center">
          <CircleAlert className="mx-auto h-6 w-6 text-caution" aria-hidden="true" />
          <h2 className="mt-4 text-24 font-semibold text-paper">
            We could not read the market.
          </h2>
          <p className="mt-2 text-14 leading-relaxed text-paper-muted">
            Nothing changed. Try again in a moment.
          </p>
          <Button
            className="mt-5"
            variant="secondary"
            onClick={() => listingsQuery.refetch()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </Panel>
      ) : listings.length === 0 ? (
        <Panel className="p-8 text-center sm:p-12">
          <Tag className="mx-auto h-5 w-5 text-paper-muted" aria-hidden="true" />
          <h2 className="mt-4 text-24 font-semibold text-paper">
            No seats are listed right now.
          </h2>
          <p className="mx-auto mt-2 max-w-[40ch] text-14 leading-relaxed text-paper-muted">
            When a holder lists a seat, it appears here with the money inside.
          </p>
          <LinkButton href="/" variant="secondary" className="mt-5">
            Back to your wallet
          </LinkButton>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing, idx) => (
            <motion.div
              key={listing.tokenId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 340,
                damping: 28,
                delay: idx * 0.05,
              }}
              className="h-full"
            >
              <ListingCard
                listing={listing}
                currentAccount={currentAccount}
                onBuy={openBuy}
              />
            </motion.div>
          ))}
        </div>
      )}

      <p className="text-center font-mono text-[10px] uppercase tracking-label text-paper-muted">
        {listings.length} {listings.length === 1 ? "seat" : "seats"} listed
        {demo ? " · simulated data, not on chain" : ""}
      </p>

      <ConfirmationSheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected ? `Buy Seat ${seatLabel(selected.tokenId)}` : "Buy seat"}
        description="One purchase. The seat and its wallet change hands together."
        primaryLabel={
          selected
            ? `Buy for ${near(selected.priceYocto, 2)} NEAR`
            : "Buy this seat"
        }
        onConfirm={buy}
        pending={pending}
        error={error}
        blocks={
          selected
            ? [
                {
                  label: "What you get",
                  value: `Seat ${seatLabel(selected.tokenId)} with at least ${near(
                    selected.insideYocto,
                    2
                  )} NEAR inside.`,
                },
                {
                  label: "What leaves your wallet",
                  value: `${near(selected.priceYocto, 2)} NEAR. Nothing else.`,
                },
                {
                  label: "Who can do this",
                  value: "You, as the buyer.",
                },
              ]
            : []
        }
        note="If the balance is lower when your purchase lands, nothing happens and you pay nothing."
      >
        {selected ? (
          <div className="rounded border border-line bg-surface-sunken p-4">
            <div className="flex items-center gap-3">
              <SeatGlyph
                tokenId={selected.tokenId}
                innerDots={selected.seat.innerDots}
                size={48}
              />
              <div>
                <div className="mono-label">Inside this seat</div>
                <div className="mt-1 font-mono text-24 tabular text-positive">
                  {near(selected.insideYocto, 2)}{" "}
                  <span className="text-12 text-paper-muted">NEAR</span>
                </div>
              </div>
            </div>
            <div className="mt-4 border-t border-line pt-3">
              <CompareBar
                inside={selected.insideYocto}
                price={selected.priceYocto}
              />
            </div>
          </div>
        ) : null}
      </ConfirmationSheet>

      <HandoffOverlay
        open={handoff.open}
        mode="buyer"
        seatNumber={handoff.seatNumber}
        amountNear={handoff.amount}
        onClose={() => setHandoff((value) => ({ ...value, open: false }))}
        onContinue={() => {
          setHandoff((value) => ({ ...value, open: false }));
          if (handoff.tokenId) {
            router.push(`/seat/${encodeURIComponent(handoff.tokenId)}`);
          }
        }}
        continueLabel="Open the seat"
      />

      <Panel className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line bg-surface-sunken">
            <Tag className="h-4 w-4 text-paper-muted" aria-hidden="true" />
          </span>
          <div>
            <div className="mono-label">Have a seat to sell?</div>
            <p className="mt-1 max-w-[58ch] text-12 leading-relaxed text-paper-muted">
              List it from your wallet. The asking price and the money inside the
              seat settle together.
            </p>
          </div>
        </div>
        <LinkButton href="/" variant="secondary" size="sm" className="shrink-0">
          List a seat
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </LinkButton>
      </Panel>
    </div>
  );
}
