'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useBynomoStore } from '@/lib/store';
import { useToast } from '@/lib/hooks/useToast';
import { getOCTConfig } from '@/lib/ctc/config';
import { Transaction } from '@mysten/sui/transactions';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';

const DEFAULT_OCT_TYPE = '0x2::coin::Coin<0x2::oct::OCT>';
const SUI_FALLBACK_COIN_TYPE = '0x2::sui::SUI';

function normalizeCoinType(type: string): string {
  const trimmed = type.trim();
  const match = /^0x2::coin::Coin<(.+)>$/i.exec(trimmed);
  return match ? match[1] : trimmed;
}

function getPreferredCoinTypes(): string[] {
  const configured = process.env.NEXT_PUBLIC_ONECHAIN_OCT_COIN_TYPE || DEFAULT_OCT_TYPE;
  const list = configured
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const expanded = list.flatMap((type) => {
    const inner = normalizeCoinType(type);
    return [type, inner, `0x2::coin::Coin<${inner}>`];
  });

  return [...new Set([...expanded, DEFAULT_OCT_TYPE, normalizeCoinType(DEFAULT_OCT_TYPE), SUI_FALLBACK_COIN_TYPE])];
}

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (amount: number, txHash: string) => void;
  onError?: (error: string) => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError
}) => {
  const [amount, setAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();

  const { depositFunds, walletBalance, refreshWalletBalance, address } = useBynomoStore();
  const toast = useToast();

  const currencySymbol = 'OCT';
  const networkName = 'OneChain Testnet';
  const quickAmounts = [0.1, 0.5, 1, 5];
  const decimals = Number(process.env.NEXT_PUBLIC_ONECHAIN_TESTNET_CURRENCY_DECIMALS || 9);

  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  const validateAmount = (value: string): string | null => {
    if (!value || value.trim() === '') return 'Please enter an amount';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'Please enter a valid number';
    if (numValue <= 0) return 'Amount must be greater than zero';
    if (numValue > walletBalance) return `Insufficient ${currencySymbol} balance`;
    return null;
  };

  const handleMaxClick = () => {
    if (walletBalance > 0) {
      const gasBuffer = 0.005;
      const maxAmount = Math.max(0, walletBalance - gasBuffer);
      setAmount(maxAmount.toFixed(4));
      setError(null);
    }
  };

  const handleDeposit = async () => {
    const validationError = validateAmount(amount);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const depositAmount = parseFloat(amount);

      const octConfig = getOCTConfig();
      if (!octConfig.treasuryAddress) throw new Error('Treasury address not configured');

      const treasuryAddress = octConfig.treasuryAddress;
      const amountInSmallestUnit = BigInt(Math.floor(depositAmount * Math.pow(10, decimals)));
      let txHash: string;

      if (currentAccount?.address && currentAccount.address.toLowerCase() === address.toLowerCase()) {
        toast.info('Please confirm the transaction in your wallet...');
        const tx = new Transaction();

        const preferredCoinTypes = getPreferredCoinTypes();
        let coins: Array<{ coinObjectId: string; balance: string }> = [];
        let selectedCoinType: string | null = null;

        for (const coinType of preferredCoinTypes) {
          const result = await suiClient.getCoins({ owner: address, coinType });
          if (result.data?.length) {
            coins = result.data as Array<{ coinObjectId: string; balance: string }>;
            selectedCoinType = coinType;
            break;
          }
        }

        if (!coins.length || !selectedCoinType) {
          throw new Error('No OCT coin objects found in wallet. Set NEXT_PUBLIC_ONECHAIN_OCT_COIN_TYPE correctly.');
        }

        const isSuiGasType = selectedCoinType === SUI_FALLBACK_COIN_TYPE || /::sui::SUI$/i.test(selectedCoinType);

        if (isSuiGasType) {
          const [depositCoin] = tx.splitCoins(tx.gas, [amountInSmallestUnit]);
          tx.transferObjects([depositCoin], treasuryAddress);
        } else {
          const sortedCoins = [...coins].sort((a, b) => Number(BigInt(b.balance) - BigInt(a.balance)));
          const primaryCoin = tx.object(sortedCoins[0].coinObjectId);

          if (sortedCoins.length > 1) {
            tx.mergeCoins(primaryCoin, sortedCoins.slice(1).map((coin) => tx.object(coin.coinObjectId)));
          }

          const [depositCoin] = tx.splitCoins(primaryCoin, [amountInSmallestUnit]);
          tx.transferObjects([depositCoin], treasuryAddress);
        }

        const result = await signAndExecuteTransaction({ transaction: tx });
        txHash = result.digest;
      } else {
        throw new Error('Please connect your OneChain wallet to deposit.');
      }

      toast.info('Transaction submitted. Waiting for confirmation...');
      await depositFunds(address, depositAmount, txHash);
      refreshWalletBalance();
      toast.success(`Successfully deposited ${depositAmount.toFixed(4)} ${currencySymbol}! Balance updated.`);
      if (onSuccess) onSuccess(depositAmount, txHash);
      onClose();
    } catch (err: any) {
      console.error('Deposit error:', err);
      const errorMessage = err.message || 'Failed to deposit funds';
      setError(errorMessage);
      toast.error(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Deposit ${currencySymbol}`}
      showCloseButton={!isLoading}
    >
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-[#00f5ff]/10 to-purple-500/10 border border-[#00f5ff]/30 rounded-lg p-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 px-2 py-0.5 bg-[#00f5ff]/20 text-[#00f5ff] text-[8px] font-bold uppercase tracking-tighter rounded-bl-lg">
            {networkName}
          </div>
          <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-mono">Wallet Balance</p>
          <p className="text-[#00f5ff] text-xl font-bold font-mono flex items-center gap-2">
            <img src="/logos/ctc-logo.png" alt="OCT" className="w-5 h-5 rounded-sm" />
            {walletBalance.toFixed(4)} {currencySymbol}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="deposit-amount" className="text-gray-400 text-xs font-mono uppercase">Amount to Deposit</label>
          <div className="relative">
            <input
              id="deposit-amount"
              type="text"
              value={amount}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); setError(null);
              }}
              placeholder="0.00"
              disabled={isLoading}
              className={`w-full px-4 py-3 bg-black/50 border rounded-lg text-lg text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#00f5ff] disabled:opacity-50 disabled:cursor-not-allowed ${error ? 'border-red-500' : 'border-[#00f5ff]/30'}`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono">{currencySymbol}</span>
          </div>
          <button
            onClick={handleMaxClick}
            disabled={isLoading}
            className="text-[10px] text-[#00f5ff] hover:text-cyan-400 font-mono disabled:opacity-50 transition-colors uppercase tracking-wider"
          >
            Use Max
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {quickAmounts.map((q) => (
            <button
              key={q}
              onClick={() => { setAmount(q.toString()); setError(null); }}
              disabled={isLoading}
              className={`px-2 py-2 rounded border font-mono text-xs transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${amount === q.toString() ? 'bg-[#00f5ff]/20 border-[#00f5ff] text-[#00f5ff] shadow-[0_0_10px_rgba(0,245,255,0.3)]' : 'bg-black/30 border-[#00f5ff]/30 text-gray-300 hover:border-[#00f5ff] hover:text-[#00f5ff]'}`}
            >
              {q}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg px-3 py-2">
            <p className="text-red-400 text-xs font-mono">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button onClick={onClose} variant="secondary" className="flex-1" disabled={isLoading}>Cancel</Button>
          <Button
            onClick={handleDeposit}
            variant="primary"
            className="flex-1"
            disabled={isLoading || !amount || parseFloat(amount || '0') <= 0}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                <span>Processing</span>
              </span>
            ) : (
              `Deposit ${currencySymbol}`
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
