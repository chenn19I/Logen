import {
  AccessKeyInfo,
  AccessKeyListResult,
  AccountLedgers,
  AccountViewResult,
  EventView,
  KeylessProofCheck,
  ListingView,
  Nep171Token,
  Nep177Metadata,
  NftItemInfo,
  RegistryConfig,
  RegistryStats,
  Sale,
  SeatHistory,
  SeatView,
  TicketCount,
  VaultOutflow,
  VaultStateView,
} from "./types";
import { pairCheck, SHARDED_ITEM_SPEC, verifyDirectSubaccount } from "../gate/pairCheck";

export const DEFAULT_REGISTRY_ID =
  process.env.NEXT_PUBLIC_REGISTRY_ID || "pusaka-c10747.testnet";
export const PRIMARY_RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://test.rpc.fastnear.com";
export const FALLBACK_RPC_URL =
  process.env.NEXT_PUBLIC_FALLBACK_RPC_URL || "https://rpc.testnet.near.org";
export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER || "https://testnet.nearblocks.io";

export type BlockReference =
  | { finality: "final" | "optimistic" }
  | { block_id: number | string };

interface JsonRpcResponse<T> {
  jsonrpc: string;
  id: string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Low-level JSON-RPC call to NEAR Testnet with automatic failover between primary and fallback RPC.
 */
export async function nearRpcQuery<T>(
  params: Record<string, unknown>,
  rpcOverride?: string
): Promise<T> {
  const urls = rpcOverride
    ? [rpcOverride]
    : [PRIMARY_RPC_URL, FALLBACK_RPC_URL];

  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "logen",
          method: "query",
          params,
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`RPC HTTP ${res.status} from ${url}`);
      }
      const data = (await res.json()) as JsonRpcResponse<T>;
      if (data.error) {
        const detail =
          typeof data.error.data === "string"
            ? data.error.data
            : JSON.stringify(data.error.data ?? data.error.message);
        throw new Error(`RPC Error: ${detail}`);
      }
      if (!data.result) {
        throw new Error("Empty RPC result");
      }
      return data.result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // If it's a deterministic chain error (AccountDoesNotExist, MethodNotFound, etc.), don't retry unless network error
      if (
        lastError.message.includes("DoesNotExist") ||
        lastError.message.includes("CodeDoesNotExist") ||
        lastError.message.includes("MethodNotFound") ||
        lastError.message.includes("FunctionCallError")
      ) {
        throw lastError;
      }
    }
  }
  throw lastError || new Error("All NEAR RPC endpoints failed");
}

/**
 * Queries the latest final block height & hash from NEAR RPC (`status` or `block`).
 */
export async function getFinalBlock(): Promise<{
  blockHeight: number;
  blockHash: string;
  timestampNs: number;
}> {
  const urls = [PRIMARY_RPC_URL, FALLBACK_RPC_URL];
  let lastErr: Error | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "logen-block",
          method: "block",
          params: { finality: "final" },
        }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const header = json?.result?.header;
      if (header) {
        return {
          blockHeight: Number(header.height),
          blockHash: String(header.hash),
          timestampNs: Number(header.timestamp),
        };
      }
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr || new Error("Unable to fetch final block");
}

export interface CallViewResult<T> {
  data: T;
  blockHeight: number;
  blockHash: string;
}

/**
 * Calls a NEAR contract view function at `final` finality or at a pinned `block_id`.
 */
export async function callViewMethodWithBlock<T>(
  accountId: string,
  methodName: string,
  args: Record<string, unknown> = {},
  blockRef: BlockReference = { finality: "final" }
): Promise<CallViewResult<T>> {
  const argsBase64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(JSON.stringify(args), "utf8").toString("base64")
      : btoa(JSON.stringify(args));

  const raw = await nearRpcQuery<{
    result: number[];
    logs: string[];
    block_height: number;
    block_hash: string;
  }>({
    request_type: "call_function",
    ...blockRef,
    account_id: accountId,
    method_name: methodName,
    args_base64: argsBase64,
  });

  const bytes = new Uint8Array(raw.result);
  const text = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(text) as T;
  return {
    data: parsed,
    blockHeight: raw.block_height,
    blockHash: raw.block_hash,
  };
}

export async function callViewMethod<T>(
  accountId: string,
  methodName: string,
  args: Record<string, unknown> = {},
  blockRef: BlockReference = { finality: "final" }
): Promise<T> {
  const res = await callViewMethodWithBlock<T>(accountId, methodName, args, blockRef);
  return res.data;
}

export async function viewAccount(
  accountId: string,
  blockRef: BlockReference = { finality: "final" }
): Promise<AccountViewResult> {
  return nearRpcQuery<AccountViewResult>({
    request_type: "view_account",
    ...blockRef,
    account_id: accountId,
  });
}

export async function viewAccessKeyList(
  accountId: string,
  blockRef: BlockReference = { finality: "final" }
): Promise<AccessKeyListResult> {
  return nearRpcQuery<AccessKeyListResult>({
    request_type: "view_access_key_list",
    ...blockRef,
    account_id: accountId,
  });
}

export async function viewAccessKey(
  accountId: string,
  publicKey: string,
  blockRef: BlockReference = { finality: "final" }
): Promise<{
  nonce: number;
  permission: AccessKeyInfo["access_key"]["permission"];
  block_height: number;
  block_hash: string;
}> {
  return nearRpcQuery({
    request_type: "view_access_key",
    ...blockRef,
    account_id: accountId,
    public_key: publicKey,
  });
}

// High-level Registry & Vault Views matching docs/API.md

export async function getRegistryConfig(registryId = DEFAULT_REGISTRY_ID): Promise<RegistryConfig | null> {
  try {
    return await callViewMethod<RegistryConfig>(registryId, "get_config");
  } catch {
    return null;
  }
}

export async function getRegistryStats(registryId = DEFAULT_REGISTRY_ID): Promise<RegistryStats | null> {
  try {
    return await callViewMethod<RegistryStats>(registryId, "get_stats");
  } catch {
    return null;
  }
}

export async function getNftMetadata(registryId = DEFAULT_REGISTRY_ID): Promise<Nep177Metadata | null> {
  try {
    return await callViewMethod<Nep177Metadata>(registryId, "nft_metadata");
  } catch {
    return null;
  }
}

export async function getNftTokens(
  registryId = DEFAULT_REGISTRY_ID,
  fromIndex = "0",
  limit = 50
): Promise<Nep171Token[]> {
  try {
    return await callViewMethod<Nep171Token[]>(registryId, "nft_tokens", {
      from_index: fromIndex,
      limit,
    });
  } catch {
    return [];
  }
}

export async function getNftTokensForOwner(
  accountId: string,
  registryId = DEFAULT_REGISTRY_ID,
  blockRef: BlockReference = { finality: "final" }
): Promise<Nep171Token[]> {
  try {
    return await callViewMethod<Nep171Token[]>(
      registryId,
      "nft_tokens_for_owner",
      { account_id: accountId, limit: 50 },
      blockRef
    );
  } catch {
    return [];
  }
}

export async function getNftToken(
  tokenId: string,
  registryId = DEFAULT_REGISTRY_ID,
  blockRef: BlockReference = { finality: "final" }
): Promise<Nep171Token | null> {
  try {
    return await callViewMethod<Nep171Token | null>(
      registryId,
      "nft_token",
      { token_id: tokenId },
      blockRef
    );
  } catch {
    return null;
  }
}

export async function getSeat(
  tokenId: string,
  registryId = DEFAULT_REGISTRY_ID,
  blockRef: BlockReference = { finality: "final" }
): Promise<SeatView | null> {
  try {
    return await callViewMethod<SeatView | null>(
      registryId,
      "get_seat",
      { token_id: tokenId },
      blockRef
    );
  } catch {
    return null;
  }
}

export async function getSeatHistory(
  tokenId: string,
  registryId = DEFAULT_REGISTRY_ID,
  limit = 100
): Promise<SeatHistory> {
  try {
    return await callViewMethod<SeatHistory>(registryId, "get_seat_history", {
      token_id: tokenId,
      limit,
    });
  } catch {
    return { holders: [], claims: [], earnings: [] };
  }
}

export async function getListings(registryId = DEFAULT_REGISTRY_ID): Promise<ListingView[]> {
  try {
    return await callViewMethod<ListingView[]>(registryId, "get_listings");
  } catch {
    return [];
  }
}

export async function getEvents(
  registryId = DEFAULT_REGISTRY_ID,
  fromIndex = 0,
  limit = 50
): Promise<EventView[]> {
  try {
    return await callViewMethod<EventView[]>(registryId, "get_events", {
      from_index: fromIndex,
      limit,
    });
  } catch {
    return [];
  }
}

export async function getTicketsForAccount(
  accountId: string,
  registryId = DEFAULT_REGISTRY_ID
): Promise<TicketCount[]> {
  try {
    return await callViewMethod<TicketCount[]>(registryId, "get_tickets", {
      account_id: accountId,
    });
  } catch {
    return [];
  }
}

export async function getTicketPriceFor(
  eventId: number,
  accountId: string,
  registryId = DEFAULT_REGISTRY_ID
): Promise<string | null> {
  try {
    return await callViewMethod<string>(registryId, "ticket_price_for", {
      event_id: eventId,
      account_id: accountId,
    });
  } catch {
    return null;
  }
}

export async function getAccountLedgers(
  accountId: string,
  registryId = DEFAULT_REGISTRY_ID
): Promise<AccountLedgers> {
  try {
    return await callViewMethod<AccountLedgers>(registryId, "get_ledgers", {
      account_id: accountId,
    });
  } catch {
    return { refund: "0", proceeds: "0" };
  }
}

export async function getSales(
  registryId = DEFAULT_REGISTRY_ID,
  fromIndex = 0,
  limit = 50
): Promise<Sale[]> {
  try {
    return await callViewMethod<Sale[]>(registryId, "get_sales", {
      from_index: fromIndex,
      limit,
    });
  } catch {
    return [];
  }
}

// Vault Direct Views (<token_id>)

export async function getVaultItemInfo(
  tokenId: string,
  blockRef: BlockReference = { finality: "final" }
): Promise<NftItemInfo | null> {
  try {
    return await callViewMethod<NftItemInfo>(tokenId, "nft_item_info", {}, blockRef);
  } catch {
    return null;
  }
}

export async function getVaultState(
  tokenId: string,
  blockRef: BlockReference = { finality: "final" }
): Promise<VaultStateView | null> {
  try {
    return await callViewMethod<VaultStateView>(tokenId, "vault_state", {}, blockRef);
  } catch {
    return null;
  }
}

export async function getVaultOutflows(tokenId: string): Promise<VaultOutflow[]> {
  try {
    return await callViewMethod<VaultOutflow[]>(tokenId, "get_outflows");
  } catch {
    return [];
  }
}

/**
 * Performs the complete 5-part Bukti Tanpa Kunci (Keyless Proof) Live Verification at a single final block.
 * 1. T0 Namespace: `<token_id>` is a direct sub-account of `<registry_id>`
 * 2. T1/T2 Pair Check: `registry.get_seat` (or `nft_token`) vs `vault.nft_item_info` at the same final block_id
 * 3. Seat Zero-Key Proof: `view_access_key_list(<token_id>)` has `keys.length === 0`
 * 4. Parent Segel Status: `view_access_key_list(<registry_id>)` has `keys.length === 0`
 * 5. Vault Code Hash check: `view_account(<token_id>).code_hash === config.vault_code_hash`
 */
export async function verifyKeylessProofOnChain(
  tokenId: string,
  registryId = DEFAULT_REGISTRY_ID
): Promise<KeylessProofCheck> {
  const finalBlock = await getFinalBlock();
  const blockRef: BlockReference = { block_id: finalBlock.blockHeight };

  const [config, seat, itemInfo, seatKeys, parentKeys, seatAccount] =
    await Promise.all([
      getRegistryConfig(registryId),
      getSeat(tokenId, registryId, blockRef),
      getVaultItemInfo(tokenId, blockRef),
      viewAccessKeyList(tokenId, blockRef).catch(() => ({
        keys: [],
        block_height: finalBlock.blockHeight,
        block_hash: finalBlock.blockHash,
      })),
      viewAccessKeyList(registryId, blockRef).catch(() => ({
        keys: [],
        block_height: finalBlock.blockHeight,
        block_hash: finalBlock.blockHash,
      })),
      viewAccount(tokenId, blockRef).catch(() => null),
    ]);

  const t0NamespaceOk = verifyDirectSubaccount(tokenId, registryId);
  const t0Detail = t0NamespaceOk
    ? `${tokenId} is a direct child sub-account of ${registryId}`
    : `${tokenId} is NOT a direct sub-account of ${registryId}`;

  let pairStatus: "Consistent" | "IndexBehind" | "Invalid" = "Invalid";
  let pairDetail = "Seat or vault not found on-chain";

  if (seat && itemInfo) {
    pairStatus = pairCheck(
      seat.owner_id,
      seat.rotation_seq,
      itemInfo.owner_id,
      itemInfo.rotation_seq
    );
    if (pairStatus === "Consistent") {
      pairDetail = `Both registry index & vault agree: owner=${itemInfo.owner_id} at rotation_seq=${itemInfo.rotation_seq}`;
    } else if (pairStatus === "IndexBehind") {
      pairDetail = `Vault (seq=${itemInfo.rotation_seq}, owner=${itemInfo.owner_id}) is ahead of Registry Index (seq=${seat.rotation_seq}, owner=${seat.owner_id}). Call sync("${tokenId}") to advance index.`;
    } else {
      pairDetail = `Divergence detected: registry (${seat.owner_id}@${seat.rotation_seq}) != vault (${itemInfo.owner_id}@${itemInfo.rotation_seq})`;
    }
  }

  const vaultSpecOk = itemInfo?.spec === SHARDED_ITEM_SPEC && itemInfo?.init === true;
  const seatKeysCount = seatKeys.keys.length;
  const seatZeroKeysOk = seatAccount !== null && seatKeysCount === 0;

  const parentKeysCount = parentKeys.keys.length;
  const parentSegelOk = parentKeysCount === 0;

  const actualCodeHash = seatAccount?.code_hash || "—";
  const expectedCodeHash = config?.vault_code_hash || "—";
  const vaultCodeHashOk =
    Boolean(seatAccount && config?.vault_code_hash) &&
    actualCodeHash === expectedCodeHash;

  const allVerified =
    t0NamespaceOk &&
    pairStatus === "Consistent" &&
    vaultSpecOk &&
    seatZeroKeysOk &&
    parentSegelOk &&
    vaultCodeHashOk;

  return {
    blockHeight: finalBlock.blockHeight,
    blockHash: finalBlock.blockHash,
    t0NamespaceOk,
    t0Detail,
    pairStatus,
    pairDetail,
    registryOwner: seat?.owner_id ?? null,
    registrySeq: seat?.rotation_seq ?? null,
    vaultOwner: itemInfo?.owner_id ?? null,
    vaultSeq: itemInfo?.rotation_seq ?? null,
    vaultSpecOk,
    seatZeroKeysOk,
    seatKeysCount,
    parentSegelOk,
    parentKeysCount,
    vaultCodeHashOk,
    actualCodeHash,
    expectedCodeHash,
    allVerified,
  };
}
