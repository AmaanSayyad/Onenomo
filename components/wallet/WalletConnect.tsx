import React, { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useCurrentAccount, useDisconnectWallet, useSuiClient } from '@mysten/dapp-kit';
import { useBynomoStore } from '@/lib/store';

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

  const normalized = list.flatMap((type) => {
    const inner = normalizeCoinType(type);
    const object = `0x2::coin::Coin<${inner}>`;
    return [type, inner, object];
  });

  return [...new Set([...normalized, normalizeCoinType(DEFAULT_OCT_TYPE), DEFAULT_OCT_TYPE, SUI_FALLBACK_COIN_TYPE])];
}

function formatBalance(totalBalance: string, decimals: number): string {
  const safeDecimals = Number.isFinite(decimals) ? decimals : 9;
  return (Number(totalBalance) / Math.pow(10, safeDecimals)).toFixed(4);
}

export const WalletConnect: React.FC = () => {
  const { logout: logoutPrivy, authenticated } = usePrivy();
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: disconnectWallet } = useDisconnectWallet();

  const { address, setConnectModalOpen, disconnect: disconnectStore, setPreferredNetwork, setAddress, setIsConnected } = useBynomoStore();

  const [octBalance, setOctBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!account?.address) {
        setOctBalance('0');
        return;
      }

      setIsLoadingBalance(true);
      try {
        const preferredCoinTypes = getPreferredCoinTypes();
        const allBalances = await suiClient.getAllBalances({ owner: account.address });

        const octLike =
          allBalances.find((balance) => preferredCoinTypes.includes(balance.coinType)) ||
          allBalances.find((balance) => /::oct::oct$/i.test(balance.coinType)) ||
          allBalances.find((balance) => balance.totalBalance !== '0');

        if (!octLike) {
          setOctBalance('0.0000');
          useBynomoStore.setState({ walletBalance: 0 });
          return;
        }

        const metadata = await suiClient.getCoinMetadata({ coinType: octLike.coinType }).catch(() => null);
        const decimals = Number(metadata?.decimals ?? 9);
        const formatted = formatBalance(octLike.totalBalance, decimals);
        setOctBalance(formatted);

        const balNum = Number.parseFloat(formatted);
        useBynomoStore.setState({ walletBalance: Number.isNaN(balNum) ? 0 : balNum });
      } catch (error) {
        console.warn('Failed to fetch OCT balance:', error);
        setOctBalance('0');
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [account?.address, suiClient]);

  const handleDisconnect = async () => {
    if (authenticated) {
      logoutPrivy();
    }

    try {
      await disconnectWallet();
    } catch {
      // Ignore wallet disconnect errors, state will still be reset below.
    }

    disconnectStore();
    setPreferredNetwork(null);
    setAddress(null);
    setIsConnected(false);
  };

  const isConnected = !!address || !!account?.address || authenticated;

  return (
    <div className="flex items-center gap-3">
      {!isConnected ? (
        <button
          onClick={() => setConnectModalOpen(true)}
          data-tour="connect-button"
          className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest border border-white/10 transition-all active:scale-95"
        >
          Connect
        </button>
      ) : (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="bg-white/5 border border-white/10 rounded-xl px-2 sm:px-3 py-1.5 flex items-center gap-2">
            <div className="flex flex-col items-end">
              <span className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">OCT Balance</span>
              <span className="text-white text-[10px] sm:text-[11px] font-mono leading-none">
                {isLoadingBalance ? '...' : octBalance}
              </span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl px-2 sm:px-3 py-1.5 flex items-center gap-2 sm:gap-2.5">
            <div className="w-4 h-4 shrink-0">
              <img src="/logos/ctc-logo.png" alt="Network" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col items-center sm:items-end">
              <span className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">OneChain</span>
              <span className="text-white text-[10px] sm:text-[11px] font-mono leading-none">
                {address ? `${address.slice(0, 4)}...${address.slice(-3)}` : '...'}
              </span>
            </div>
          </div>

          <button
            onClick={handleDisconnect}
            className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-all"
            title="Disconnect"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
