import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getOneChainClient } from '@/lib/ctc/client';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { isValidSuiAddress } from '@mysten/sui/utils';
import { getRpcUrl } from '@/lib/ctc/config';

const DEFAULT_OCT_TYPE = '0x2::coin::Coin<0x2::oct::OCT>';
const SUI_FALLBACK_COIN_TYPE = '0x2::sui::SUI';

function normalizeCoinType(type: string): string {
  const trimmed = type.trim();
  const match = /^0x2::coin::Coin<(.+)>$/i.exec(trimmed);
  return match ? match[1] : trimmed;
}

function getPreferredCoinTypes(): string[] {
  const configured = process.env.ONECHAIN_OCT_COIN_TYPE || process.env.NEXT_PUBLIC_ONECHAIN_OCT_COIN_TYPE || DEFAULT_OCT_TYPE;
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (ethers.isAddress(address)) {
      const client = getOneChainClient();
      const balanceWei = await client.getBalance(address);

      return NextResponse.json({
        balance: client.formatOCT(balanceWei),
      });
    }

    if (isValidSuiAddress(address)) {
      const suiClient = new SuiJsonRpcClient({ url: getRpcUrl(), network: 'testnet' as any });
      const preferredCoinTypes = getPreferredCoinTypes();
      const allBalances = await suiClient.getAllBalances({ owner: address });

      const octLike =
        allBalances.find((balance) => preferredCoinTypes.includes(balance.coinType)) ||
        allBalances.find((balance) => /::oct::oct$/i.test(balance.coinType)) ||
        allBalances.find((balance) => balance.totalBalance !== '0');

      if (!octLike) {
        return NextResponse.json({ balance: '0' });
      }

      const metadata = await suiClient.getCoinMetadata({ coinType: octLike.coinType }).catch(() => null);
      const decimals = Number(metadata?.decimals ?? 9);

      return NextResponse.json({
        balance: (Number(octLike.totalBalance) / Math.pow(10, decimals)).toString(),
        coinType: octLike.coinType,
        decimals,
      });
    }

    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch onchain balance';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
