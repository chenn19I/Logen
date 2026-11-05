// Pure BigInt yoctoNEAR formatting & parsing utilities (1 NEAR = 10^24 yoctoNEAR)

const YOCTO_EXPONENT = 24;
const ONE_NEAR = 10n ** 24n;

/**
 * Formats a yoctoNEAR decimal string or BigInt into a human-readable NEAR string.
 * Never uses floating-point arithmetic.
 */
export function formatYocto(
  yocto: string | bigint | number | null | undefined,
  maxDecimals: number = 4
): string {
  if (yocto === null || yocto === undefined || yocto === "") return "0";
  let value: bigint;
  try {
    value = typeof yocto === "bigint" ? yocto : BigInt(String(yocto).trim());
  } catch {
    return "0";
  }

  const isNegative = value < 0n;
  const abs = isNegative ? -value : value;
  const whole = abs / ONE_NEAR;
  const fraction = abs % ONE_NEAR;

  const wholeFormatted = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (fraction === 0n || maxDecimals <= 0) {
    return `${isNegative ? "-" : ""}${wholeFormatted}`;
  }

  const fractionStr = fraction.toString().padStart(YOCTO_EXPONENT, "0");
  const sliced = fractionStr.slice(0, maxDecimals).replace(/0+$/, "");

  if (sliced.length === 0) {
    if (whole === 0n && fraction > 0n) {
      return `${isNegative ? "-" : ""}<0.${"0".repeat(Math.max(0, maxDecimals - 1))}1`;
    }
    return `${isNegative ? "-" : ""}${wholeFormatted}`;
  }

  return `${isNegative ? "-" : ""}${wholeFormatted}.${sliced}`;
}

/**
 * Parses a human-entered NEAR decimal string (e.g. "2.5" or "0.05") into a exact yoctoNEAR decimal string.
 */
export function parseNearToYocto(nearStr: string): string {
  const cleaned = nearStr.trim().replace(/,/g, "");
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`Invalid NEAR amount: "${nearStr}"`);
  }
  const [wholePart, fracPart = ""] = cleaned.split(".");
  if (fracPart.length > YOCTO_EXPONENT) {
    throw new Error("NEAR amount has more than 24 decimal places");
  }
  const paddedFrac = fracPart.padEnd(YOCTO_EXPONENT, "0");
  const total = BigInt(wholePart) * ONE_NEAR + BigInt(paddedFrac);
  return total.toString();
}

/**
 * Overflow-safe basis point calculation matching logen-core `apply_bps(amount, bps)`.
 * `amount * bps / 10_000`
 */
export function applyBps(amountYocto: string | bigint, bps: number): bigint {
  const amount = typeof amountYocto === "bigint" ? amountYocto : BigInt(amountYocto || "0");
  const d = 10_000n;
  const b = BigInt(bps);
  const q = amount / d;
  const r = amount % d;
  return q * b + (r * b) / d;
}

/**
 * Splits a ticket payment into Pool Anggota (40%), Kas Klub (50% + dust), and Organizer (10%),
 * matching `logen_core::split::Bps::split`.
 */
export function splitTicketRevenue(
  amountYocto: string | bigint,
  bps: { pool: number; kas: number; organizer: number } = {
    pool: 4000,
    kas: 5000,
    organizer: 1000,
  },
  seatsMinted: number = 1
): {
  pool: bigint;
  kas: bigint;
  organizer: bigint;
  perSeat: bigint;
  carry: bigint;
  redirectedToKas: bigint;
} {
  const amount = typeof amountYocto === "bigint" ? amountYocto : BigInt(amountYocto || "0");
  const pool = applyBps(amount, bps.pool);
  const organizer = applyBps(amount, bps.organizer);
  const kas = amount - pool - organizer;

  if (seatsMinted <= 0) {
    return {
      pool,
      kas: kas + pool,
      organizer,
      perSeat: 0n,
      carry: 0n,
      redirectedToKas: pool,
    };
  }

  const n = BigInt(seatsMinted);
  const perSeat = pool / n;
  const carry = pool % n;
  return {
    pool,
    kas,
    organizer,
    perSeat,
    carry,
    redirectedToKas: 0n,
  };
}

export function shortenAccount(accountId: string, maxLen: number = 26): string {
  if (!accountId || accountId.length <= maxLen) return accountId;
  const half = Math.floor((maxLen - 3) / 2);
  return `${accountId.slice(0, half)}...${accountId.slice(-half)}`;
}

export function formatTimestampMs(ms: number | null | undefined): string {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return String(ms);
  }
}
