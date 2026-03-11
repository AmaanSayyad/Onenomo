/**
 * Check treasury wallet balance and coins
 */

import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

const RPC_URL = process.env.NEXT_PUBLIC_ONECHAIN_TESTNET_RPC || 'https://rpc-testnet.onelabs.cc:443';
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_ONECHAIN_TREASURY_ADDRESS || '0xdeac1680f935c0d5265b4e0656a2436361d8adebee0adf3060ef6c06e95c89eb';

const OCT_COIN_TYPE = '0x2::oct::OCT';
const SUI_COIN_TYPE = '0x2::sui::SUI';

async function checkTreasuryBalance() {
  const client = new SuiJsonRpcClient({ url: RPC_URL, network: 'testnet' as any });
  
  console.log('Treasury Address:', TREASURY_ADDRESS);
  console.log('RPC URL:', RPC_URL);
  console.log('\n=== Checking Treasury Balance ===\n');
  
  // Check OCT coins
  console.log('Checking OCT coins...');
  const octCoins = await client.getCoins({ 
    owner: TREASURY_ADDRESS, 
    coinType: OCT_COIN_TYPE 
  });
  
  if (octCoins.data.length > 0) {
    console.log(`Found ${octCoins.data.length} OCT coin objects:`);
    let totalOCT = 0n;
    octCoins.data.forEach((coin: any, index: number) => {
      const balance = BigInt(coin.balance);
      totalOCT += balance;
      console.log(`  ${index + 1}. ${coin.coinObjectId.slice(0, 20)}... - ${Number(balance) / 1e9} OCT`);
    });
    console.log(`Total OCT: ${Number(totalOCT) / 1e9} OCT`);
  } else {
    console.log('No OCT coins found!');
  }
  
  // Check SUI coins (for gas)
  console.log('\nChecking SUI coins (for gas)...');
  const suiCoins = await client.getCoins({ 
    owner: TREASURY_ADDRESS, 
    coinType: SUI_COIN_TYPE 
  });
  
  if (suiCoins.data.length > 0) {
    console.log(`Found ${suiCoins.data.length} SUI coin objects:`);
    let totalSUI = 0n;
    suiCoins.data.forEach((coin: any, index: number) => {
      const balance = BigInt(coin.balance);
      totalSUI += balance;
      console.log(`  ${index + 1}. ${coin.coinObjectId.slice(0, 20)}... - ${Number(balance) / 1e9} SUI`);
    });
    console.log(`Total SUI: ${Number(totalSUI) / 1e9} SUI`);
  } else {
    console.log('No SUI coins found!');
  }
  
  // Check all balances
  console.log('\nChecking all coin types...');
  const allBalances = await client.getAllBalances({ owner: TREASURY_ADDRESS });
  
  if (allBalances.length > 0) {
    console.log('All balances:');
    allBalances.forEach((balance: any) => {
      console.log(`  ${balance.coinType}: ${balance.totalBalance}`);
    });
  } else {
    console.log('No balances found!');
  }
}

checkTreasuryBalance().catch(console.error);
