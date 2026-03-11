'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useBynomoStore } from '@/lib/store';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import {
  WalletProvider as SuiWalletProvider,
  SuiClientProvider,
  createNetworkConfig,
  useCurrentAccount,
} from '@mysten/dapp-kit';
import '@mysten/dapp-kit/dist/index.css';

// Custom Components
import { WalletConnectModal } from '@/components/wallet/WalletConnectModal';
import { ReferralSync } from './ReferralSync';

// Wallet Sync component to bridge all wallet states with our Zustand store
function WalletSync() {
  const { authenticated, ready: privyReady } = usePrivy();
  const { wallets: privyWallets } = useWallets();
  const suiAccount = useCurrentAccount();

  const {
    address,
    accountType,
    setAddress,
    setIsConnected,
    setNetwork,
    refreshWalletBalance,
    fetchProfile,
    fetchBalance,
  } = useBynomoStore();


  // 1. Sync Wallet Address & Connection Status
  useEffect(() => {
    // Check Demo Mode
    if (accountType === 'demo') {
      if (address !== '0xDEMO_1234567890') {
        setAddress('0xDEMO_1234567890');
        setIsConnected(true);
        setNetwork('OCT');
      }
      return;
    }

    const effectiveAddress =
      suiAccount?.address ||
      (authenticated && privyWallets[0] ? privyWallets[0].address : null);
    const effectiveConnected = !!suiAccount || (authenticated && !!privyWallets[0]);

    if (effectiveConnected && effectiveAddress) {
      if (address !== effectiveAddress) {
        setAddress(effectiveAddress);
        setIsConnected(true);
        setNetwork('OCT');

        // Initial fetch
        refreshWalletBalance();
        fetchProfile(effectiveAddress);
        fetchBalance(effectiveAddress);
      }
    } else if (address !== null && address !== '0xDEMO_1234567890') {
      setAddress(null);
      setIsConnected(false);
      setNetwork(null);
    }
  }, [
    authenticated, privyWallets, privyReady, suiAccount, address, accountType,
    setAddress, setIsConnected, setNetwork, refreshWalletBalance, fetchProfile, fetchBalance
  ]);

  // 2. Poll House Balance
  useEffect(() => {
    if (!address || address === '0xDEMO_1234567890' || accountType === 'demo') return;

    const interval = setInterval(() => {
      fetchBalance(address);
    }, 10000);

    return () => clearInterval(interval);
  }, [address, accountType, fetchBalance]);

  return null;
}

function WalletSyncSuiOnly() {
  const suiAccount = useCurrentAccount();
  const {
    address,
    accountType,
    setAddress,
    setIsConnected,
    setNetwork,
    refreshWalletBalance,
    fetchProfile,
    fetchBalance,
  } = useBynomoStore();

  useEffect(() => {
    if (accountType === 'demo') {
      if (address !== '0xDEMO_1234567890') {
        setAddress('0xDEMO_1234567890');
        setIsConnected(true);
        setNetwork('OCT');
      }
      return;
    }

    const effectiveAddress = suiAccount?.address || null;
    const effectiveConnected = !!suiAccount;

    if (effectiveConnected && effectiveAddress) {
      if (address !== effectiveAddress) {
        setAddress(effectiveAddress);
        setIsConnected(true);
        setNetwork('OCT');
        refreshWalletBalance();
        fetchProfile(effectiveAddress);
        fetchBalance(effectiveAddress);
      }
    } else if (address !== null && address !== '0xDEMO_1234567890') {
      setAddress(null);
      setIsConnected(false);
      setNetwork(null);
    }
  }, [
    suiAccount,
    address,
    accountType,
    setAddress,
    setIsConnected,
    setNetwork,
    refreshWalletBalance,
    fetchProfile,
    fetchBalance,
  ]);

  useEffect(() => {
    if (!address || address === '0xDEMO_1234567890' || accountType === 'demo') return;
    const interval = setInterval(() => fetchBalance(address), 10000);
    return () => clearInterval(interval);
  }, [address, accountType, fetchBalance]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initializeApp = async () => {
      try {
        const { updateAllPrices, loadTargetCells, startGlobalPriceFeed } = useBynomoStore.getState();

        await loadTargetCells().catch(console.error);
        const stopPriceFeed = startGlobalPriceFeed(updateAllPrices);
        setIsReady(true);
        return () => { if (stopPriceFeed) stopPriceFeed(); };
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
  const isPrivyEnabled = Boolean(PRIVY_APP_ID.trim());
  const { networkConfig } = createNetworkConfig({
    onechainTestnet: {
      url: process.env.NEXT_PUBLIC_ONECHAIN_TESTNET_RPC || 'https://rpc-testnet.onelabs.cc:443',
      network: 'testnet' as any,
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="onechainTestnet">
        <SuiWalletProvider autoConnect>
          {isPrivyEnabled ? (
            <PrivyProvider
              appId={PRIVY_APP_ID}
              config={{
                appearance: {
                  theme: 'dark',
                  accentColor: '#A855F7',
                  showWalletLoginFirst: true,
                },
                embeddedWallets: {
                  createOnLogin: 'users-without-wallets',
                },
              }}
            >
              <WalletSync />
              <ReferralSync />
              {children}
              <WalletConnectModal />
              <ToastProvider />
            </PrivyProvider>
          ) : (
            <>
              <WalletSyncSuiOnly />
              <ReferralSync />
              {children}
              <WalletConnectModal />
              <ToastProvider />
            </>
          )}
        </SuiWalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
