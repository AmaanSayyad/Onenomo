/**
 * Check Supabase stored procedures and user balance
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSupabase() {
  const userAddress = '0xf6a1574c7507e1c178c1254857882eece14e1e49064e2e0068d379de289df240';
  
  console.log('Checking user balance...');
  const { data: balance, error: balanceError } = await supabase
    .from('user_balances')
    .select('*')
    .eq('user_address', userAddress.toLowerCase())
    .eq('currency', 'OCT')
    .single();
  
  if (balanceError) {
    console.error('Balance error:', balanceError);
  } else {
    console.log('User balance:', balance);
    console.log('Address from DB:', balance.user_address);
    console.log('Address lowercase:', userAddress.toLowerCase());
    console.log('Addresses match:', balance.user_address === userAddress.toLowerCase());
  }
  
  console.log('\nTesting with SQL query directly...');
  const { data: sqlTest, error: sqlError } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT balance, user_address, currency,
             LOWER(user_address) as lower_address,
             LOWER('${userAddress}') as lower_input
      FROM user_balances 
      WHERE LOWER(user_address) = LOWER('${userAddress}') 
        AND currency = 'OCT'
    `
  });
  
  if (sqlError) {
    console.error('SQL test error:', sqlError);
  } else {
    console.log('SQL test result:', sqlTest);
  }
  
  console.log('\nTesting stored procedure...');
  const { data, error } = await supabase.rpc('deduct_balance_for_bet', {
    p_user_address: userAddress.toLowerCase(),
    p_bet_amount: 0.1,
    p_currency: 'OCT',
  });
  
  if (error) {
    console.error('Stored procedure error:', error);
  } else {
    console.log('Stored procedure result:', data);
  }
}

checkSupabase().catch(console.error);
