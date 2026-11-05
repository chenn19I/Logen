import { formatYocto } from "@/lib/near/format";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function near(value: string | bigint | null | undefined, decimals = 2): string {
  return formatYocto(value ?? "0", decimals);
}

export function nearValue(value: string | bigint | null | undefined, decimals = 2): number {
  return Number(formatYocto(value ?? "0", decimals).replace(/,/g, ""));
}

export function shortAccount(accountId: string | null | undefined, maxLen = 22): string {
  if (!accountId) return "—";
  if (accountId.length <= maxLen) return accountId;
  const half = Math.floor((maxLen - 3) / 2);
  return `${accountId.slice(0, half)}...${accountId.slice(-half)}`;
}

export function seatNumber(tokenId: string): number {
  const raw = tokenId.split(".")[0] ?? "";
  const match = raw.match(/(\d+)$/);
  if (match) return Number(match[1]);
  let hash = 0;
  for (let i = 0; i < tokenId.length; i += 1) {
    hash = (hash * 31 + tokenId.charCodeAt(i)) >>> 0;
  }
  return (hash % 99) + 1;
}

export function seatLabel(tokenId: string): string {
  return String(seatNumber(tokenId)).padStart(2, "0");
}

export function formatDate(
  ms: number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  }
): string {
  if (!ms) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", options).format(new Date(ms));
  } catch {
    return "—";
  }
}

export function formatTime(ms: number | null | undefined): string {
  if (!ms) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ms));
  } catch {
    return "—";
  }
}

export function formatMonth(ms: number): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date(ms));
  } catch {
    return "—";
  }
}

export function durationLabel(fromMs: number, toMs = Date.now()): string {
  const days = Math.max(1, Math.round((toMs - fromMs) / 86_400_000));
  if (days < 31) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"}`;
}

export function countdownLabel(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function relativeSeconds(seconds: number): string {
  if (seconds < 2) return "just now";
  return `${seconds}s ago`;
}
