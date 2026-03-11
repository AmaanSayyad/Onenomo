/**
 * Wallet state slice for Zustand store
 * Manages wallet connection status and address (OneChain Chain only).
 * Actual wallet connection is handled by OCT integration in lib/ctc/client.ts and Privy.
 */

import { StateCreator } from "zustand";
import { isValidAddress } from '@/lib/utils/address';

export type OctNetwork = 'OCT' | null;

export interface WalletState {
  address: string | null;
  walletBalance: number;
  isConnected: boolean;
  isConnecting: boolean;
  network: OctNetwork;
  preferredNetwork: OctNetwork;
  error: string | null;
  isConnectModalOpen: boolean;

  connect: () => Promise<void>;
  disconnect: () => void;
  refreshWalletBalance: () => Promise<void>;
  clearError: () => void;
  setConnectModalOpen: (open: boolean) => void;

  setAddress: (address: string | null) => void;
  setIsConnected: (connected: boolean) => void;
  setNetwork: (network: OctNetwork) => void;
  setPreferredNetwork: (network: OctNetwork) => void;
}

export const createWalletSlice: StateCreator<WalletState> = (set, get) => ({
  address: null,
  walletBalance: 0,
  isConnected: false,
  isConnecting: false,
  network: null,
  preferredNetwork: typeof window !== 'undefined' ? (localStorage.getItem('bynomo_preferred_network') as OctNetwork) || null : null,
  error: null,
  isConnectModalOpen: false,

  connect: async () => {
    set({ isConnectModalOpen: true });
  },

  disconnect: () => {
    const state = get() as any;
    const accountType = state.accountType;
    set({
      address: null,
      walletBalance: 0,
      isConnected: false,
      isConnecting: false,
      network: null,
      error: null
    } as any);
    const currentAccessCode = state.accessCode;
    if (accountType !== 'demo' && !currentAccessCode) {
      set({
        username: null,
        accessCode: null
      } as any);
    }
  },

  refreshWalletBalance: async () => {
    const { address, isConnected } = get();
    if (!isConnected || !address || !(await isValidAddress(address))) return;
    try {
      const { getOCTBalance } = await import('@/lib/ctc/client');
      const balStr = await getOCTBalance(address);
      const balNum = parseFloat(balStr);
      set({ walletBalance: isNaN(balNum) ? 0 : balNum });
    } catch (error) {
      console.warn('Error refreshing wallet balance:', error);
    }
  },

  clearError: () => set({ error: null }),
  setConnectModalOpen: (open: boolean) => set({ isConnectModalOpen: open }),
  setAddress: (address: string | null) => set({ address }),
  setIsConnected: (connected: boolean) => set({ isConnected: connected }),

  setNetwork: (network: OctNetwork) => set({ network }),

  setPreferredNetwork: (network: OctNetwork) => {
    set({ preferredNetwork: network });
    if (typeof window !== 'undefined') {
      if (network) localStorage.setItem('bynomo_preferred_network', network);
      else localStorage.removeItem('bynomo_preferred_network');
    }
  }
});
