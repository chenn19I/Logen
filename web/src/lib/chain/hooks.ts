"use client";

import { useQuery } from "@tanstack/react-query";
import { useNear } from "@/components/NearProvider";
import { useDemo } from "@/lib/demo/DemoProvider";
import { DEMO_ACCOUNT } from "./types";

export function useSeats(ownerId?: string | null) {
  const { chain, version, demo } = useDemo();
  const { accountId } = useNear();
  const owner = ownerId === undefined ? (demo ? DEMO_ACCOUNT : accountId) : ownerId;

  return useQuery({
    queryKey: ["seats", demo ? "demo" : "live", version, owner],
    queryFn: () => chain.getSeats(owner),
    enabled: demo || Boolean(owner),
  });
}

export function useAllSeats(enabled = true) {
  const { chain, version, demo } = useDemo();
  return useQuery({
    queryKey: ["seats", demo ? "demo" : "live", version, "all"],
    queryFn: () => chain.getSeats(null),
    enabled,
  });
}

export function useSeat(tokenId: string | null | undefined) {
  const { chain, version, demo } = useDemo();
  return useQuery({
    queryKey: ["seat", demo ? "demo" : "live", version, tokenId],
    queryFn: () => chain.getSeat(tokenId as string),
    enabled: Boolean(tokenId),
  });
}

export function useSeatHistory(tokenId: string | null | undefined) {
  const { chain, version, demo } = useDemo();
  return useQuery({
    queryKey: ["history", demo ? "demo" : "live", version, tokenId],
    queryFn: () => chain.getHistory(tokenId as string),
    enabled: Boolean(tokenId),
  });
}

export function useEvents() {
  const { chain, version, demo } = useDemo();
  return useQuery({
    queryKey: ["events", demo ? "demo" : "live", version],
    queryFn: () => chain.getEvents(),
  });
}

export function useListings() {
  const { chain, version, demo } = useDemo();
  return useQuery({
    queryKey: ["listings", demo ? "demo" : "live", version],
    queryFn: () => chain.getListings(),
  });
}

export function useProof(tokenId: string | null | undefined) {
  const { chain, version, demo } = useDemo();
  return useQuery({
    queryKey: ["proof", demo ? "demo" : "live", version, tokenId],
    queryFn: () => chain.getProof(tokenId as string),
    enabled: Boolean(tokenId),
  });
}
