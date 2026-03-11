/**
 * Check if stored procedure was updated correctly
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkProcedure() {
  const userAddress = '0xf6a1574c7507e1c178c1254857882eece14e1e49064e2e0068d379de289df240';
  
  console.log('Testing stored procedure with different variations...\n');
  
  // Test 1: Exact address from DB
  console.log('Test 1: Exact address');
  let result = await supabase.rpc('deduct_balance_for_bet', {
    p_user_address: userAddress,
    p_bet_amount: 0.1,
    p_currency: 'OCT',
  });
  console.log('Result:', result.data);
  console.log('Error:', result.error);
  
  // Test 2: Lowercase address
  console.log('\nTest 2: Lowercase address');
  result = await supabase.rpc('deduct_balance_for_bet', {
    p_user_address: userAddress.toLowerCase(),
    p_bet_amount: 0.1,
    p_currency: 'OCT',
  });
  console.log('Result:', result.data);
  console.log('Error:', result.error);
  
  // Test 3: Check if balance exists
  console.log('\nTest 3: Check balance directly');
  const { data: balance } = await supabase
    .from('user_balances')
    .select('*')
    .eq('user_address', userAddress)
    .eq('currency', 'OCT')
    .single();
  console.log('Balance:', balance);
  
  // Test 4: Try with exact balance address
  if (balance) {
    console.log('\nTest 4: Using exact address from balance');
    result = await supabase.rpc('deduct_balance_for_bet', {
      p_user_address: balance.user_address,
      p_bet_amount: 0.1,
      p_currency: balance.currency,
    });
    console.log('Result:', result.data);
    console.log('Error:', result.error);
  }
}

checkProcedure().catch(console.error);
