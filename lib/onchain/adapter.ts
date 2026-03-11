import { ethers } from 'ethers';
import { OneChainClient } from '@/lib/ctc/client';
import { getRpcUrl, oneChainTestnet } from '@/lib/ctc/config';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64, fromHex, isValidSuiAddress, isValidTransactionDigest } from '@mysten/sui/utils';

const RAW_OCT_TYPE = process.env.ONECHAIN_OCT_COIN_TYPE || process.env.NEXT_PUBLIC_ONECHAIN_OCT_COIN_TYPE || '0x2::coin::Coin<0x2::oct::OCT>';
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

    const tx = new Transaction();
    tx.setSender(treasuryAddress);
    tx.setGasBudget(10_000_000n);

    let coinObjects: Array<{ coinObjectId: string; balance: string }> = [];
    for (const coinType of getPreferredCoinTypes()) {
      const coins = await client.getCoins({ owner: treasuryAddress, coinType });
      if (coins.data.length > 0) {
        coinObjects = coins.data as Array<{ coinObjectId: string; balance: string }>;
        break;
      }
    }

    if (coinObjects.length === 0) {
      return { success: false, error: 'Treasury has no transferable coins' };
    }

    const sorted = [...coinObjects].sort((a, b) => Number(BigInt(b.balance) - BigInt(a.balance)));
    const primaryCoin = tx.object(sorted[0].coinObjectId);
    if (sorted.length > 1) {
      tx.mergeCoins(primaryCoin, sorted.slice(1).map((coin) => tx.object(coin.coinObjectId)));
    }

    const [withdrawCoin] = tx.splitCoins(primaryCoin, [amount]);
    tx.transferObjects([withdrawCoin], input.userAddress);

    const execution = await client.signAndExecuteTransaction({
      signer,
      transaction: tx,
      options: { showEffects: true },
    });

    const txHash = execution.digest;

    if (execution.effects?.status?.status !== 'success') {
      return { success: false, txHash, error: 'Transaction failed on blockchain' };
    }

    return { success: true, txHash };
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
