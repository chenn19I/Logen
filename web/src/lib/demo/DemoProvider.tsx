"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNear } from "@/components/NearProvider";
import { MockChain } from "@/lib/chain/mock";
import { NearChain } from "@/lib/chain/near";
import { DEMO_ACCOUNT, type ChainPort } from "@/lib/chain/types";

interface DemoContextValue {
  demo: boolean;
  toggleDemo: () => void;
  setDemo: (value: boolean) => void;
  chain: ChainPort;
  mock: MockChain;
  version: number;
  demoAccount: string;
  simulateHandoff: (tokenId?: string) => Promise<void>;
  resetDemo: () => Promise<void>;
}

const DemoContext = createContext<DemoContextValue | null>(null);
const STORAGE_KEY = "pusaka_demo_mode";

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const { registryId, accountId } = useNear();
  const [demo, setDemoState] = useState(false);
  const [version, setVersion] = useState(0);
  const mockRef = useRef<MockChain | null>(null);
  if (!mockRef.current) {
    mockRef.current = new MockChain();
  }
  const mock = mockRef.current;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("demo");
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (fromQuery === "1") {
      setDemoState(true);
      window.localStorage.setItem(STORAGE_KEY, "1");
    } else if (fromQuery === "0") {
      setDemoState(false);
      window.localStorage.setItem(STORAGE_KEY, "0");
    } else if (stored === "1") {
      setDemoState(true);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = mock.subscribe(() => {
      setVersion((value) => value + 1);
    });
    return unsubscribe;
  }, [mock]);

  const setDemo = useCallback((value: boolean) => {
    setDemoState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    }
  }, []);

  const toggleDemo = useCallback(() => {
    setDemo(!demo);
  }, [demo, setDemo]);

  const chain = useMemo<ChainPort>(() => {
    if (demo) return mock;
    return new NearChain(registryId, accountId);
  }, [demo, mock, registryId, accountId]);

  const simulateHandoff = useCallback(
    async (tokenId?: string) => {
      if (!demo) return;
      await mock.simulateHandoff(tokenId);
    },
    [demo, mock]
  );

  const resetDemo = useCallback(async () => {
    await mock.reset();
  }, [mock]);

  const value = useMemo<DemoContextValue>(
    () => ({
      demo,
      toggleDemo,
      setDemo,
      chain,
      mock,
      version,
      demoAccount: DEMO_ACCOUNT,
      simulateHandoff,
      resetDemo,
    }),
    [demo, toggleDemo, setDemo, chain, mock, version, simulateHandoff, resetDemo]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo must be used inside DemoProvider");
  }
  return context;
}
