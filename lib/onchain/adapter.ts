import { ethers } from 'ethers';
import { OneChainClient } from '@/lib/ctc/client';
import { getRpcUrl, oneChainTestnet } from '@/lib/ctc/config';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase58, fromBase64, fromHex, isValidSuiAddress, isValidTransactionDigest, toBase58, toBase64 } from '@mysten/sui/utils';

const RAW_OCT_TYPE = process.env.ONECHAIN_OCT_COIN_TYPE || process.env.NEXT_PUBLIC_ONECHAIN_OCT_COIN_TYPE || '0x2::oct::OCT';
const SUI_FALLBACK_COIN_TYPE = '0x2::sui::SUI';
const DEFAULT_SUI_DECIMALS = 9;

function normalizeCoinType(type: string): string {
  const trimmed = type.trim();
  const match = /^0x2::coin::Coin<(.+)>$/i.exec(trimmed);
  return match ? match[1] : trimmed;
}

const OCT_COIN_TYPE = normalizeCoinType(RAW_OCT_TYPE);
const OCT_OBJECT_TYPE = `0x2::coin::Coin<${OCT_COIN_TYPE}>`;

function getPreferredCoinTypes(): string[] {
  return [...new Set([RAW_OCT_TYPE, OCT_COIN_TYPE, OCT_OBJECT_TYPE, SUI_FALLBACK_COIN_TYPE])];
}

/** Base58 excludes 0, O, I, l - if digest contains these, it's base64 or hex. */
const BASE58_ALPHABET = /^[1-9A-HJ-NP-Za-km-z]+$/;

/** Normalize base64url to base64 (OneChain may use base64url). */
function base64UrlToBase64(s: string): string {
  return s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
}

/**
 * Normalize object digest for Sui SDK. OneChain RPC returns base64; SDK expects base58.
 * ObjectDigest.validate: fromBase58(digest).length === 32. Must return base58 that decodes to 32 bytes.
 */
function normalizeObjectDigest(digest: string): string {
  if (!digest || typeof digest !== 'string') return digest;
  try {
    let bytes: Uint8Array;
    if (/^0x[0-9a-fA-F]{64}$/.test(digest) || /^[0-9a-fA-F]{64}$/.test(digest)) {
      bytes = fromHex(digest.startsWith('0x') ? digest : `0x${digest}`);
    } else if (BASE58_ALPHABET.test(digest)) {
      const decoded = fromBase58(digest);
      if (decoded.length === 32) return digest;
      if (decoded.length > 32) bytes = decoded.slice(0, 32);
      else return digest;
    } else {
      try {
        bytes = fromBase64(digest);
      } catch {
        bytes = fromBase64(base64UrlToBase64(digest));
      }
    }
    if (!bytes || bytes.length < 32) return digest;
    const b32 = bytes.length > 32 ? bytes.slice(0, 32) : bytes;
    const b58 = toBase58(b32);
    if (fromBase58(b58).length !== 32) return digest;
    return b58;
  } catch {
    return digest;
  }
}

export interface DepositVerificationInput {
  userAddress: string;
  txHash: string;
  amount: string;
}

export interface DepositVerificationResult {
  success: boolean;
  error?: string;
}

export interface WithdrawalExecutionInput {
  userAddress: string;
  amount: string;
}

export interface WithdrawalExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface OnchainAdapter {
  readonly chainName: string;
  validateAddress(address: string): boolean;
  parseAmount(amount: string): bigint;
  formatAmount(amount: bigint): string;
  verifyDeposit(input: DepositVerificationInput): Promise<DepositVerificationResult>;
  executeWithdrawal(input: WithdrawalExecutionInput): Promise<WithdrawalExecutionResult>;
}

class OneChainEvmAdapter implements OnchainAdapter {
  readonly chainName = 'onechain-evm';

  validateAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  parseAmount(amount: string): bigint {
    return ethers.parseUnits(amount, 18);
  }

  formatAmount(amount: bigint): string {
    return ethers.formatUnits(amount, 18);
  }

  async verifyDeposit(input: DepositVerificationInput): Promise<DepositVerificationResult> {
    if (!/^0x[0-9a-fA-F]{64}$/.test(input.txHash)) {
      return { success: false, error: 'Invalid transaction hash format' };
    }

    const amount = this.parseAmount(input.amount);
    const client = new OneChainClient();
    let receipt;

    try {
      receipt = await client.waitForTransaction(input.txHash);
    } catch {
      return { success: false, error: 'Failed to verify transaction on blockchain. Please try again.' };
    }

    if (receipt.status === 'failed') {
      return { success: false, error: 'Transaction failed on blockchain' };
    }

    const treasuryAddress = oneChainTestnet.treasuryAddress.toLowerCase();
    if (receipt.to.toLowerCase() !== treasuryAddress) {
      return { success: false, error: 'Transaction recipient is not the treasury address' };
    }

    if (receipt.value !== amount) {
      return { success: false, error: 'Transaction amount does not match deposit amount' };
    }

    if (receipt.from.toLowerCase() !== input.userAddress.toLowerCase()) {
      return { success: false, error: 'Transaction sender does not match user address' };
    }

    return { success: true };
  }

  async executeWithdrawal(input: WithdrawalExecutionInput): Promise<WithdrawalExecutionResult> {
    const client = new OneChainClient(undefined, process.env.ONECHAIN_TREASURY_PRIVATE_KEY);
    const txHash = await client.sendTransaction(input.userAddress, this.parseAmount(input.amount));
    const receipt = await client.waitForTransaction(txHash);

    if (receipt.status === 'failed') {
      return { success: false, txHash, error: 'Transaction failed on blockchain' };
    }

    return { success: true, txHash };
  }
}

class OneChainSuiAdapter implements OnchainAdapter {
  readonly chainName = 'onechain-sui';
  private readonly decimals = Number(process.env.ONECHAIN_DECIMALS || process.env.NEXT_PUBLIC_ONECHAIN_TESTNET_CURRENCY_DECIMALS || DEFAULT_SUI_DECIMALS);

  validateAddress(address: string): boolean {
    return isValidSuiAddress(address);
  }

  parseAmount(amount: string): bigint {
    const value = Number.parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Invalid amount format');
    }

    return BigInt(Math.floor(value * Math.pow(10, this.decimals)));
  }

  formatAmount(amount: bigint): string {
    return (Number(amount) / Math.pow(10, this.decimals)).toString();
  }

  private getClient(): SuiJsonRpcClient {
    return new SuiJsonRpcClient({ url: getRpcUrl(), network: 'testnet' as any });
  }

  private getTreasuryAddress(): string {
    return process.env.ONECHAIN_CASINO_WALLET_ADDRESS || process.env.ONECHAIN_TREASURY_ADDRESS || oneChainTestnet.treasuryAddress;
  }

  private loadTreasuryKeypair(): Ed25519Keypair {
    const privateKey = process.env.ONECHAIN_TREASURY_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('ONECHAIN_TREASURY_PRIVATE_KEY is not configured');
    }

    try {
      if (privateKey.startsWith('0x') || /^[0-9a-fA-F]{64}$/.test(privateKey)) {
        const secretKey = fromHex(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
        return Ed25519Keypair.fromSecretKey(secretKey);
      }

      const decoded = fromBase64(privateKey);
      const secretKey = decoded.length === 33 ? decoded.slice(1, 33) : decoded;
      return Ed25519Keypair.fromSecretKey(secretKey);
    } catch {
      throw new Error('Invalid treasury private key format for Sui adapter');
    }
  }

  async verifyDeposit(input: DepositVerificationInput): Promise<DepositVerificationResult> {
    if (!isValidTransactionDigest(input.txHash)) {
      return { success: false, error: 'Invalid transaction digest format' };
    }

    const client = this.getClient();
    const tx = await client.getTransactionBlock({
      digest: input.txHash,
      options: {
        showEffects: true,
        showBalanceChanges: true,
        showInput: true,
      },
    });

    if (tx.effects?.status?.status !== 'success') {
      return { success: false, error: 'Transaction failed on blockchain' };
    }

    if (tx.transaction?.data?.sender?.toLowerCase() !== input.userAddress.toLowerCase()) {
      return { success: false, error: 'Transaction sender does not match user address' };
    }

    const expected = this.parseAmount(input.amount);
    const balanceChanges = (tx.balanceChanges || []) as Array<{ owner?: any; coinType?: string; amount?: string }>;
    const userDebit = balanceChanges
      .filter((change) => {
        const owner = typeof change.owner === 'string'
          ? change.owner
          : change.owner?.AddressOwner || change.owner?.ObjectOwner || change.owner?.Shared;
        return typeof owner === 'string' && owner.toLowerCase() === input.userAddress.toLowerCase();
      })
      .filter((change) => {
        const type = change.coinType || '';
        return type === OCT_COIN_TYPE || type === OCT_OBJECT_TYPE || type === SUI_FALLBACK_COIN_TYPE;
      })
      .map((change) => BigInt(change.amount || '0'))
      .filter((amount: bigint) => amount < 0n)
      .reduce((sum: bigint, amount: bigint) => sum + (-amount), 0n);

    if (userDebit < expected) {
      return { success: false, error: 'Transaction amount does not match deposit amount' };
    }

    return { success: true };
  }

  async executeWithdrawal(input: WithdrawalExecutionInput): Promise<WithdrawalExecutionResult> {
    const client = this.getClient();
    const signer = this.loadTreasuryKeypair();
    const treasuryAddress = this.getTreasuryAddress();
    const amount = this.parseAmount(input.amount);

    // Fetch current epoch and chain ID to satisfy Sui's "min_epoch must equal max_epoch" constraint
    // (Multi-epoch transaction expiration is not yet supported)
    const [systemState, chainId] = await Promise.all([
      client.getLatestSuiSystemState(),
      client.getChainIdentifier(),
    ]);
    const currentEpoch = Number(systemState.epoch ?? 0);

    const tx = new Transaction();
    tx.setSender(treasuryAddress);
    tx.setGasBudget(50_000_000n); // Increased gas budget to 0.05 OCT
    tx.setExpiration({
      ValidDuring: {
        chain: chainId,
        minEpoch: currentEpoch,
        maxEpoch: currentEpoch,
        minTimestamp: null,
        maxTimestamp: null,
        nonce: Date.now() >>> 0,
      },
    });

    let coinObjects: Array<{ coinObjectId: string; balance: string; version: string; digest: string }> = [];
    for (const coinType of getPreferredCoinTypes()) {
      const coins = await client.getCoins({ owner: treasuryAddress, coinType });
      if (coins.data.length > 0) {
        coinObjects = coins.data as Array<{ coinObjectId: string; balance: string; version: string; digest: string }>;
        break;
      }
    }

    if (coinObjects.length === 0) {
      return { success: false, error: 'Treasury has no transferable coins' };
    }

    // Sort coins by balance (largest first)
    const sorted = [...coinObjects].sort((a, b) => Number(BigInt(b.balance) - BigInt(a.balance)));
    
    // Calculate total available balance
    const totalBalance = sorted.reduce((sum, coin) => sum + BigInt(coin.balance), 0n);
    
    // Reserve some OCT for gas (0.05 OCT = 50,000,000 MIST)
    const gasReserve = 50_000_000n;
    const availableForWithdrawal = totalBalance - gasReserve;
    
    if (availableForWithdrawal < amount) {
      return { 
        success: false, 
        error: `Treasury has insufficient balance. Available: ${this.formatAmount(availableForWithdrawal)} OCT, Requested: ${this.formatAmount(amount)} OCT` 
      };
    }

    const objRef = (c: { coinObjectId: string; version: string; digest: string }) =>
      tx.objectRef({ objectId: c.coinObjectId, version: c.version, digest: normalizeObjectDigest(c.digest) });

    // SDK resolver looks for SUI coins for gas; OneChain uses OCT. We must set gas payment
    // explicitly with OCT coins. Use smallest coins for gas to preserve larger ones for withdrawal.
    const gasCoins = sorted.slice(-3).filter(c => BigInt(c.balance) > 0n);
    if (gasCoins.length > 0) {
      tx.setGasPayment(gasCoins.map(c => ({ objectId: c.coinObjectId, version: c.version, digest: normalizeObjectDigest(c.digest) })));
    }

    const gasCoinsIds = new Set(gasCoins.map(c => c.coinObjectId));

    // Use objectRef (not tx.object) so we control digest format - RPC returns base64, SDK expects base58
    const largestCoin = sorted[0];

    if (BigInt(largestCoin.balance) >= amount && !gasCoinsIds.has(largestCoin.coinObjectId)) {
      const primaryCoin = objRef(largestCoin);
      const [withdrawCoin] = tx.splitCoins(primaryCoin, [amount]);
      tx.transferObjects([withdrawCoin], input.userAddress);
    } else {
      const availableCoins = sorted.filter(c => !gasCoinsIds.has(c.coinObjectId));
      if (availableCoins.length === 0) {
        return { success: false, error: 'No coins available for withdrawal after gas reservation' };
      }
      const primaryCoin = objRef(availableCoins[0]);
      let accumulated = BigInt(availableCoins[0].balance);
      const coinsToMerge = [];
      for (let i = 1; i < availableCoins.length && accumulated < amount; i++) {
        coinsToMerge.push(objRef(availableCoins[i]));
        accumulated += BigInt(availableCoins[i].balance);
      }
      if (coinsToMerge.length > 0) {
        tx.mergeCoins(primaryCoin, coinsToMerge);
      }
      const [withdrawCoin] = tx.splitCoins(primaryCoin, [amount]);
      tx.transferObjects([withdrawCoin], input.userAddress);
    }

    try {
      const execution = await client.signAndExecuteTransaction({
        signer,
        transaction: tx,
        options: { 
          showEffects: true,
          showObjectChanges: true,
        },
      });

      const txHash = execution.digest;

      if (execution.effects?.status?.status !== 'success') {
        return { success: false, txHash, error: 'Transaction failed on blockchain' };
      }

      return { success: true, txHash };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check for specific error types
      if (errorMessage.includes('gas') || errorMessage.includes('insufficient')) {
        return { 
          success: false, 
          error: 'No valid gas coins found for the transaction. Treasury may need more OCT.' 
        };
      }
      
      return { 
        success: false, 
        error: `Transaction failed: ${errorMessage}` 
      };
    }
  }
}

let adapterInstance: OnchainAdapter | null = null;

function resolveAdapterMode(): 'sui' | 'evm' {
  const configured = (process.env.ONECHAIN_ADAPTER_MODE || process.env.NEXT_PUBLIC_ONECHAIN_ADAPTER_MODE || 'sui').toLowerCase();
  return configured === 'evm' ? 'evm' : 'sui';
}

export function getOnchainAdapter(): OnchainAdapter {
  if (!adapterInstance) {
    adapterInstance = resolveAdapterMode() === 'evm' ? new OneChainEvmAdapter() : new OneChainSuiAdapter();
  }

  return adapterInstance;
}
