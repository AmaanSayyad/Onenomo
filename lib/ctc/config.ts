/**
 * OneChain Testnet Configuration
 * 
 * This module provides the network configuration for OneChain testnet,
 * including chain parameters, RPC endpoints, and treasury wallet address.
 * 
 * Environment variables are used with fallback values for development.
 */

// Import environment validation (runs on server-side only)
import './env-validation';

export interface OneChainConfig {
  chainId: number;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  treasuryAddress: string;
}

/**
 * OneChain Testnet Configuration
 * 
 * Chain ID: 102031
 * Native Token: OCT (18 decimals)
 * RPC: https://rpc-testnet.onechain.one
 * Explorer: https://explorer-testnet.onechain.one
 * Treasury: 0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123
 */
export const oneChainTestnet: OneChainConfig = {
  chainId: Number(process.env.NEXT_PUBLIC_ONECHAIN_TESTNET_CHAIN_ID) || 102031,
  chainName: "OneChain Testnet",
  nativeCurrency: {
    name: "OneChain",
    symbol: process.env.NEXT_PUBLIC_ONECHAIN_TESTNET_CURRENCY_SYMBOL || "OCT",
    decimals: Number(process.env.NEXT_PUBLIC_ONECHAIN_TESTNET_CURRENCY_DECIMALS) || 18,
  },
  rpcUrls: [
    process.env.NEXT_PUBLIC_ONECHAIN_TESTNET_RPC || "https://rpc-testnet.onechain.one"
  ],
  blockExplorerUrls: [
    process.env.NEXT_PUBLIC_ONECHAIN_TESTNET_EXPLORER || "https://explorer-testnet.onechain.one"
  ],
  treasuryAddress:
    process.env.NEXT_PUBLIC_ONECHAIN_TREASURY_ADDRESS ||
    process.env.ONECHAIN_TREASURY_ADDRESS ||
    "0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123",
};

/**
 * Get the full OneChain Testnet Configuration
 */
export function getOCTConfig(): OneChainConfig {
  return oneChainTestnet;
}

/**
 * Get the primary RPC URL for OneChain testnet
 */
export function getRpcUrl(): string {
  return oneChainTestnet.rpcUrls[0];
}

/**
 * Get the block explorer URL for a transaction
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${oneChainTestnet.blockExplorerUrls[0]}/tx/${txHash}`;
}

/**
 * Get the block explorer URL for an address
 */
export function getExplorerAddressUrl(address: string): string {
  return `${oneChainTestnet.blockExplorerUrls[0]}/address/${address}`;
}
