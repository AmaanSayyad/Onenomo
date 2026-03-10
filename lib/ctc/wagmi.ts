/**
 * Wagmi v2 Configuration for OneChain Testnet
 * 
 * This module configures Wagmi for wallet connections on OneChain testnet.
 * Supports MetaMask (injected), WalletConnect v2, and Privy embedded wallet.
 * 
 * Requirements: 8.1, 8.2, 8.3
 */

import { getDefaultConfig } from 'connectkit';
import { createConfig, http } from 'wagmi';
import { defineChain } from 'viem';
import { oneChainTestnet } from './config';

/**
 * Define OneChain Testnet as a Wagmi-compatible chain
 * 
 * Wagmi requires chains to be defined in a specific format.
 * We convert our OneChainConfig to Wagmi's chain format.
 */
export const oneChainTestnetChain = defineChain({
  id: oneChainTestnet.chainId,
  name: oneChainTestnet.chainName,
  nativeCurrency: {
    name: oneChainTestnet.nativeCurrency.name,
    symbol: oneChainTestnet.nativeCurrency.symbol,
    decimals: oneChainTestnet.nativeCurrency.decimals,
  },
  rpcUrls: {
    default: {
      http: oneChainTestnet.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'OneChain Explorer',
      url: oneChainTestnet.blockExplorerUrls[0],
    },
  },
  testnet: true,
});

/**
 * Wagmi Configuration for OneChain Testnet
 * 
 * Configures wallet connectors:
 * - MetaMask (injected provider)
 * - WalletConnect v2
 * - Privy embedded wallet (configured separately in app)
 * 
 * ConnectKit's getDefaultConfig automatically sets up MetaMask and WalletConnect.
 */
export const config = createConfig(
  getDefaultConfig({
    // OneChain testnet chain
    chains: [oneChainTestnetChain],
    transports: {
      [oneChainTestnetChain.id]: http(),
    },

    // WalletConnect Project ID (required for WalletConnect v2)
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'dummy-id',

    // App Info
    appName: 'Onenomo',
    appDescription: 'Binary Options Trading on OneChain Testnet',
    appUrl: 'https://onenomo.app',
    appIcon: 'https://onenomo.app/logo.png',
  }),
);
