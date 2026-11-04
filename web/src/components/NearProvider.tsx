"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type {
  WalletSelector,
  WalletModuleFactory,
} from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import {
  DEFAULT_REGISTRY_ID,
  getFinalBlock,
  getRegistryConfig,
  getRegistryStats,
  viewAccessKeyList,
} from "@/lib/near/rpc";
import type { RegistryConfig, RegistryStats } from "@/lib/near/types";

interface CallMethodParams {
  receiverId: string;
  methodName: string;
  args?: Record<string, unknown>;
  gas?: string; // in yoctoGas string e.g. "100000000000000" (100 Tgas)
  deposit?: string; // in yoctoNEAR string e.g. "1"
}

interface SignNep413Result {
  accountId: string;
  publicKey: string;
  signature: string;
}

interface NearContextValue {
  accountId: string | null;
  registryId: string;
  setRegistryId: (id: string) => void;
  config: RegistryConfig | null;
  stats: RegistryStats | null;
  parentKeysCount: number | null;
  finalBlockHeight: number | null;
  finalBlockHash: string | null;
  rpcOnline: boolean;
  contractDeployed: boolean;
  isLoadingChain: boolean;
  lastError: string | null;
  refreshChainState: () => Promise<void>;
  openWalletModal: () => void;
  signOutWallet: () => Promise<void>;
  callContractMethod: (params: CallMethodParams) => Promise<unknown>;
  signNep413Message: (params: {
    message: string;
    recipient: string;
    nonceBase64: string;
  }) => Promise<SignNep413Result>;
}

const NearContext = createContext<NearContextValue | null>(null);

const TLA_GAS_100 = "100000000000000";

export function NearProvider({ children }: { children: React.ReactNode }) {
  const [registryId, setRegistryIdState] = useState<string>(DEFAULT_REGISTRY_ID);
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  const [config, setConfig] = useState<RegistryConfig | null>(null);
  const [stats, setStats] = useState<RegistryStats | null>(null);
  const [parentKeysCount, setParentKeysCount] = useState<number | null>(null);
  const [finalBlockHeight, setFinalBlockHeight] = useState<number | null>(null);
  const [finalBlockHash, setFinalBlockHash] = useState<string | null>(null);
  const [rpcOnline, setRpcOnline] = useState<boolean>(true);
  const [contractDeployed, setContractDeployed] = useState<boolean>(false);
  const [isLoadingChain, setIsLoadingChain] = useState<boolean>(true);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("registry");
    const saved = window.localStorage.getItem("pusaka_registry_id");
    if (fromQuery && fromQuery.trim()) {
      setRegistryIdState(fromQuery.trim());
      window.localStorage.setItem("pusaka_registry_id", fromQuery.trim());
    } else if (saved && saved.trim()) {
      setRegistryIdState(saved.trim());
    }
  }, []);

  const setRegistryId = useCallback((id: string) => {
    const cleaned = id.trim() || DEFAULT_REGISTRY_ID;
    setRegistryIdState(cleaned);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("pusaka_registry_id", cleaned);
    }
  }, []);

  const refreshChainState = useCallback(async () => {
    setIsLoadingChain(true);
    setLastError(null);
    try {
      const block = await getFinalBlock();
      setFinalBlockHeight(block.blockHeight);
      setFinalBlockHash(block.blockHash);
      setRpcOnline(true);

      const [cfg, st, pKeys] = await Promise.all([
        getRegistryConfig(registryId),
        getRegistryStats(registryId),
        viewAccessKeyList(registryId).catch(() => null),
      ]);

      setConfig(cfg);
      setStats(st);
      setParentKeysCount(pKeys ? pKeys.keys.length : null);
      setContractDeployed(Boolean(cfg && st));
    } catch (err) {
      setRpcOnline(false);
      setLastError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingChain(false);
    }
  }, [registryId]);

  useEffect(() => {
    refreshChainState();
  }, [refreshChainState]);

  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;
    async function initWallet() {
      if (typeof window === "undefined") return;
      try {
        const [
          { setupWalletSelector },
          { setupModal },
          { setupMyNearWallet },
          { setupMeteorWallet },
        ] = await Promise.all([
          import("@near-wallet-selector/core"),
          import("@near-wallet-selector/modal-ui"),
          import("@near-wallet-selector/my-near-wallet"),
          import("@near-wallet-selector/meteor-wallet"),
        ]);

        const sel = await setupWalletSelector({
          network: "testnet",
          modules: [
            setupMyNearWallet() as unknown as WalletModuleFactory,
            setupMeteorWallet() as unknown as WalletModuleFactory,
          ],
        });

        const mod = setupModal(sel, {
          contractId: registryId,
        });

        setSelector(sel);
        setModal(mod);

        const state = sel.store.getState();
        const active = state.accounts.find((a) => a.active)?.accountId ?? null;
        setAccountId(active);

        sub = sel.store.observable.subscribe((next) => {
          const nextActive =
            next.accounts.find((a) => a.active)?.accountId ?? null;
          setAccountId(nextActive);
        });
      } catch (err) {
        console.warn("Wallet selector initialization warning:", err);
      }
    }
    initWallet();
    return () => {
      sub?.unsubscribe();
    };
  }, [registryId]);

  const openWalletModal = useCallback(() => {
    if (modal) {
      modal.show();
    }
  }, [modal]);

  const signOutWallet = useCallback(async () => {
    if (!selector) return;
    try {
      const wallet = await selector.wallet();
      await wallet.signOut();
      setAccountId(null);
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  }, [selector]);

  const callContractMethod = useCallback(
    async ({
      receiverId,
      methodName,
      args = {},
      gas = TLA_GAS_100,
      deposit = "0",
    }: CallMethodParams) => {
      if (!selector) {
        throw new Error("Wallet selector not initialized");
      }
      if (!accountId) {
        modal?.show();
        throw new Error("Please connect your NEAR Testnet wallet first");
      }
      const wallet = await selector.wallet();
      const result = await wallet.signAndSendTransaction({
        signerId: accountId,
        receiverId,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName,
              args,
              gas,
              deposit,
            },
          },
        ],
      });
      await refreshChainState();
      return result;
    },
    [selector, accountId, modal, refreshChainState]
  );

  const signNep413Message = useCallback(
    async ({
      message,
      recipient,
      nonceBase64,
    }: {
      message: string;
      recipient: string;
      nonceBase64: string;
    }): Promise<SignNep413Result> => {
      if (!selector || !accountId) {
        modal?.show();
        throw new Error("Please connect a NEAR wallet that supports NEP-413 signMessage");
      }
      const wallet = await selector.wallet();
      if (!("signMessage" in wallet) || typeof wallet.signMessage !== "function") {
        throw new Error(
          "Selected wallet does not support NEP-413 off-chain signMessage. Use Meteor Wallet or MyNearWallet, or use the Cryptographic Judge Inspector below."
        );
      }
      const nonceBuffer = Buffer.from(nonceBase64, "base64");
      const signed = await wallet.signMessage({
        message,
        recipient,
        nonce: nonceBuffer,
      });
      if (!signed) {
        throw new Error("Wallet returned empty NEP-413 signature");
      }
      return {
        accountId: signed.accountId || accountId,
        publicKey: signed.publicKey,
        signature: signed.signature,
      };
    },
    [selector, accountId, modal]
  );

  return (
    <NearContext.Provider
      value={{
        accountId,
        registryId,
        setRegistryId,
        config,
        stats,
        parentKeysCount,
        finalBlockHeight,
        finalBlockHash,
        rpcOnline,
        contractDeployed,
        isLoadingChain,
        lastError,
        refreshChainState,
        openWalletModal,
        signOutWallet,
        callContractMethod,
        signNep413Message,
      }}
    >
      {children}
    </NearContext.Provider>
  );
}

export function useNear() {
  const ctx = useContext(NearContext);
  if (!ctx) {
    throw new Error("useNear must be used within a NearProvider");
  }
  return ctx;
}
