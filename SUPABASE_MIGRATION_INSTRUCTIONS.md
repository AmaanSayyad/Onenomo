# Supabase Migration Instructions

## Problem
The stored procedure `deduct_balance_for_bet` is missing from your Supabase database.

## Solution
Run the following SQL migrations in your Supabase SQL Editor:

### Step 1: Go to Supabase SQL Editor
https://supabase.com/dashboard/project/bmoxsrormjyqygomiwgz/sql/new

### Step 2: Run Migration 005
Copy and paste the entire content of `supabase/migrations/005_update_procedures_multi_currency.sql` and click "Run".

### Step 3: Verify
Run this query to verify the procedure exists:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'deduct_balance_for_bet';
```

## Alternative: Run All Migrations
If you want to ensure all migrations are applied, run them in order:
1. 001_create_user_balances.sql
2. 002_create_balance_audit_log.sql
3. 003_create_balance_procedures.sql
4. 003_multi_currency_support.sql
5. 005_update_procedures_multi_currency.sql
6. 012_add_refund_procedure.sql

## Quick Test
After running the migrations, test with:
```sql
SELECT deduct_balance_for_bet(
  '0xf6a1574c7507e1c178c1254857882eece14e1e49064e2e0068d379de289df240',
  0.1,
  'OCT'
);
```

This should return a JSON object with success status.
