// Pair check & namespace verification logic matching pusaka-core/src/index.rs and Sharded NFT Items draft (1.0.0)

export type PairCheckStatus = "Consistent" | "IndexBehind" | "Invalid";

export interface PairCheckResult {
  status: PairCheckStatus;
  reason: string;
}

export const SHARDED_ITEM_SPEC = "sharded-item-1.0.0";

/**
 * Verifies Tier T0 Namespace: `tokenId` must be a direct sub-account of `registryId`.
 * e.g. `s001.pusaka.testnet` is a direct sub-account of `pusaka.testnet`,
 * whereas `a.b.pusaka.testnet` or `pusaka.testnet` or `s001.other.testnet` is not.
 */
export function verifyDirectSubaccount(tokenId: string, registryId: string): boolean {
  const t = tokenId.trim().toLowerCase();
  const r = registryId.trim().toLowerCase();
  if (!t || !r || !t.endsWith(`.${r}`)) return false;
  const prefix = t.slice(0, t.length - r.length - 1);
  if (!prefix || prefix.includes(".")) return false;
  return /^[a-z0-9_-]+$/.test(prefix);
}

/**
 * Decision table for consumers comparing `registry.nft_token` (or `get_seat`) with
 * `vault.nft_item_info` read at the **same final block** (Tier T2 in Sharded NFT Items draft).
 * Mirrors `pusaka_core::index::pair_check` exactly.
 */
export function pairCheck(
  indexOwner: string,
  indexSeq: number | bigint,
  vaultOwner: string,
  vaultSeq: number | bigint
): PairCheckStatus {
  const iSeq = BigInt(indexSeq);
  const vSeq = BigInt(vaultSeq);
  if (vSeq > iSeq) {
    return "IndexBehind";
  }
  if (vSeq < iSeq || vaultOwner !== indexOwner) {
    return "Invalid";
  }
  return "Consistent";
}

/**
 * Full T0-T2 gate verification at a single final block for a seat.
 * Fails closed on any divergence, spec mismatch, uninitialized vault, or namespace violation.
 */
export function evaluateGatePairCheck(params: {
  expectedAccountId: string;
  pinnedRegistryId: string;
  tokenId: string;
  indexOwner: string | null;
  indexSeq: number | null;
  itemInfo: {
    spec: string;
    init: boolean;
    status: "Active" | "Frozen";
    collection_id: string;
    token_id: string;
    owner_id: string;
    rotation_seq: number;
    rotation_epoch: number;
  } | null;
}): {
  allowed: boolean;
  pairStatus: PairCheckStatus;
  reason: string;
} {
  const {
    expectedAccountId,
    pinnedRegistryId,
    tokenId,
    indexOwner,
    indexSeq,
    itemInfo,
  } = params;

  if (!verifyDirectSubaccount(tokenId, pinnedRegistryId)) {
    return {
      allowed: false,
      pairStatus: "Invalid",
      reason: `T0 failure: ${tokenId} is not a direct sub-account of ${pinnedRegistryId}`,
    };
  }

  if (!itemInfo || !itemInfo.init) {
    return {
      allowed: false,
      pairStatus: "Invalid",
      reason: "T2 failure: vault nft_item_info missing or not initialized",
    };
  }

  if (itemInfo.spec !== SHARDED_ITEM_SPEC) {
    return {
      allowed: false,
      pairStatus: "Invalid",
      reason: `T2 failure: unexpected item spec "${itemInfo.spec}" (expected "${SHARDED_ITEM_SPEC}")`,
    };
  }

  if (itemInfo.token_id !== tokenId || itemInfo.collection_id !== pinnedRegistryId) {
    return {
      allowed: false,
      pairStatus: "Invalid",
      reason: "T2 failure: vault self-reported token_id/collection_id mismatch",
    };
  }

  if (!indexOwner || indexSeq === null || indexSeq === undefined) {
    return {
      allowed: false,
      pairStatus: "Invalid",
      reason: "T1 failure: token not found in registry index",
    };
  }

  const status = pairCheck(indexOwner, indexSeq, itemInfo.owner_id, itemInfo.rotation_seq);

  if (status === "IndexBehind") {
    return {
      allowed: false,
      pairStatus: "IndexBehind",
      reason: `D5 fail-closed: vault rotation_seq (${itemInfo.rotation_seq}) is ahead of registry index (${indexSeq}). Call sync(${tokenId}) first.`,
    };
  }

  if (status === "Invalid") {
    return {
      allowed: false,
      pairStatus: "Invalid",
      reason: `T2 divergence: registry (${indexOwner}@seq=${indexSeq}) != vault (${itemInfo.owner_id}@seq=${itemInfo.rotation_seq})`,
    };
  }

  if (itemInfo.owner_id !== expectedAccountId) {
    return {
      allowed: false,
      pairStatus: "Consistent",
      reason: `Caller ${expectedAccountId} is no longer the canonical vault owner (${itemInfo.owner_id})`,
    };
  }

  return {
    allowed: true,
    pairStatus: "Consistent",
    reason: `Verified T0+T1+T2 at seq=${itemInfo.rotation_seq} for owner ${expectedAccountId}`,
  };
}
