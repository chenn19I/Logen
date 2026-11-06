export interface SeatPortrait {
  dataUrl: string;
  name?: string;
  description?: string;
  savedAtMs: number;
}

const STORAGE_KEY = "logen_seat_portraits_v1";

function readAll(): Record<string, SeatPortrait> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, SeatPortrait>;
  } catch {
    return {};
  }
}

/**
 * Portraits are local display art for live seats. The on-chain NFT keeps its
 * dynamic SVG; this browser remembers the image the holder chose.
 */
export function savePortrait(tokenId: string, portrait: Omit<SeatPortrait, "savedAtMs">): boolean {
  if (typeof window === "undefined") return false;
  try {
    const all = readAll();
    all[tokenId] = { ...portrait, savedAtMs: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function getPortrait(tokenId: string): SeatPortrait | null {
  if (typeof window === "undefined") return null;
  return readAll()[tokenId] ?? null;
}

export function removePortrait(tokenId: string): void {
  if (typeof window === "undefined") return;
  try {
    const all = readAll();
    delete all[tokenId];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // A full or blocked storage is not a reason to break the page.
  }
}
