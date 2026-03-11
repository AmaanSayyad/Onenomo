import { ethers } from 'ethers';
import { OneChainClient } from '@/lib/ctc/client';
import { getRpcUrl, oneChainTestnet } from '@/lib/ctc/config';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase58, fromBase64, fromHex, isValidSuiAddress, isValidTransactionDigest, toBase58 } from '@mysten/sui/utils';

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


/**
 * Normalize object digest for Sui SDK. 
 * OneChain RPC often returns digests in Base64 format, but the SDK requires Base58 (32 bytes).
 */
function normalizeObjectDigest(digest: string): string | null {
  if (!digest || typeof digest !== 'string') return null;
  const cleaned = digest.trim();
  if (!cleaned) return null;

  try {
    // 1. Try as Hex (0x...)
    if (cleaned.startsWith('0x') || /^[0-9a-fA-F]{64,66}$/.test(cleaned)) {
      try {
        const bytes = fromHex(cleaned.startsWith('0x') ? cleaned : `0x${cleaned}`);
        if (bytes.length === 32) return toBase58(bytes);
        if (bytes.length === 33) return toBase58(bytes.slice(1)); // Remove flag byte
      } catch {}
    }

    // 2. Try as Base58 (the desired format)
    try {
      const bytes = fromBase58(cleaned);
      if (bytes.length === 32) return cleaned;
      if (bytes.length === 33) return toBase58(bytes.slice(1)); // Remove flag byte
    } catch {}

    // 3. Try as Base64 (OneChain RPC often returns 33-byte flagged Base64)
    try {
      // Standard Base64
      let bytes = fromBase64(cleaned);
      if (bytes.length === 32) return toBase58(bytes);
      if (bytes.length === 33) return toBase58(bytes.slice(1)); // Remove flag byte
      
      // Try Base64url
      const urlCleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (cleaned.length % 4)) % 4);
      bytes = fromBase64(urlCleaned);
      if (bytes.length === 32) return toBase58(bytes);
      if (bytes.length === 33) return toBase58(bytes.slice(1)); // Remove flag byte
    } catch {}

    return cleaned;
  } catch (err) {
    console.error('Error normalizing digest:', cleaned, err);
    return cleaned;
  }
}

type CoinObjectRef = {
  coinObjectId: string;
  balance: string;
  version: string;
  digest: string;
};

type RawCoinResponse = {
  coinObjectId?: string;
  objectId?: string;
  balance?: string;
  version?: string | number;
  digest?: string;
  objectDigest?: string;
};

type BalanceChangeOwner = string | {
  AddressOwner?: string;
  ObjectOwner?: string;
  Shared?: string;
};

type BalanceChange = {
  owner?: BalanceChangeOwner;
  coinType?: string;
  amount?: string;
};

function toResolvedCoinRef(coin: CoinObjectRef): CoinObjectRef | null {
  if (!coin.coinObjectId) return null;

  const digest = normalizeObjectDigest(coin.digest);
  if (!digest || !isValidTransactionDigest(digest)) {
    return null;
  }

  return {
    ...coin,
    digest,
  };
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
    const value = typeof amount === 'number' ? amount : Number.parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Invalid amount format');
    }

    return BigInt(Math.round(value * Math.pow(10, this.decimals)));
  }

  formatAmount(amount: bigint): string {
    return (Number(amount) / Math.pow(10, this.decimals)).toString();
  }

  private getClient(): SuiJsonRpcClient {
    return new SuiJsonRpcClient({ url: getRpcUrl(), network: 'testnet' as const });
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
    const balanceChanges = (tx.balanceChanges || []) as BalanceChange[];
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

    // Use epoch-based expiration to avoid OneChain RPC chain identifier format issues
    // when serializing ValidDuring transactions.
    const systemState = await client.getLatestSuiSystemState();
    const currentEpoch = Number(systemState.epoch ?? 0);

    const tx = new Transaction();
    tx.setSender(treasuryAddress);
    tx.setGasBudget(50_000_000n); // Increased gas budget to 0.05 OCT
    tx.setExpiration({ Epoch: currentEpoch + 1 });

    const coinObjects: CoinObjectRef[] = [];
    for (const coinType of getPreferredCoinTypes()) {
      const coins = await client.getCoins({ owner: treasuryAddress, coinType });
      if (coins.data && coins.data.length > 0) {
        // RPC might use different field names (Sui vs OneChain vs older versions)
        // Also filter out coins with invalid/missing digests
        const rawCoins: CoinObjectRef[] = (coins.data as RawCoinResponse[]).map((c) => ({
          coinObjectId: c.coinObjectId || c.objectId || '',
          balance: c.balance || '0',
          version: String(c.version || '0'),
          digest: c.digest || c.objectDigest || '',
        }));
        
        // Normalize digests and filter out invalid ones
        for (const coin of rawCoins) {
          const resolvedCoinRef = toResolvedCoinRef(coin);
          if (resolvedCoinRef) {
            coinObjects.push(resolvedCoinRef);
          }
        }
        
        if (coinObjects.length > 0) break;
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


    // For native OCT withdrawals, use the gas coin itself as the source of funds.
    // This supports the common case where treasury balance sits in a single coin object.
    let paymentBalance = 0n;
    const paymentCoins: CoinObjectRef[] = [];

    for (const coin of sorted) {
      paymentCoins.push(coin);
      paymentBalance += BigInt(coin.balance);

      if (paymentBalance >= amount + gasReserve) {
        break;
      }
    }

    if (paymentBalance < amount + gasReserve) {
      return {
        success: false,
        error: `Treasury has insufficient spendable OCT. Need ${this.formatAmount(amount + gasReserve)} OCT including gas, found ${this.formatAmount(paymentBalance)} OCT`,
      };
    }

    tx.setGasPayment(paymentCoins.map((coin) => ({
      objectId: coin.coinObjectId,
      version: coin.version,
      digest: coin.digest,
    })));

    const [withdrawCoin] = tx.splitCoins(tx.gas, [amount]);
    tx.transferObjects([withdrawCoin], input.userAddress);

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
