import { ethers } from 'ethers';
import { isValidSuiAddress } from '@mysten/sui/utils';

/**
 * Validates supported wallet addresses (EVM and OneChain/Sui style).
 */
export async function isValidAddress(address: string): Promise<boolean> {
  if (!address) return false;
  return ethers.isAddress(address) || isValidSuiAddress(address);
}
