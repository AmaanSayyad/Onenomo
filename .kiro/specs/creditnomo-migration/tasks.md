# Implementation Plan: CreditNomo Migration

## Overview

Bu implementation plan, Binomo oyununun BNB Chain'den CreditCoin testnet'e tam migrasyonunu adım adım gerçekleştirir. Plan, blockchain configuration'dan başlayarak, core utilities, database schema, deposit/withdrawal functionality, Blitz mode integration ve testing'e kadar tüm bileşenleri kapsar.

TypeScript kullanılarak Next.js framework'ü üzerinde implement edilecektir. Her task, design document'teki component'leri ve requirements document'teki acceptance criteria'ları referans alır.

## Tasks

- [x] 1. Setup CreditCoin network configuration and core utilities
  - [x] 1.1 Create lib/ctc/config.ts with CreditCoin testnet configuration
    - Define CreditCoinConfig interface with chainId, chainName, nativeCurrency, rpcUrls, blockExplorerUrls, treasuryAddress
    - Export creditCoinTestnet constant with Chain ID 102031, 18 decimals, RPC endpoint, block explorer URL
    - Add environment variable support with fallback values
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 11.1, 11.2, 11.3, 11.4_

  - [ ]* 1.2 Write property test for network configuration
    - **Property 1: EVM Address Validation**
    - **Validates: Requirements 2.3**

  - [x] 1.3 Create lib/ctc/client.ts with CreditCoinClient class
    - Implement constructor with JsonRpcProvider initialization
    - Implement getBalance(address) method with retry logic
    - Implement sendTransaction(to, amount) method with error handling
    - Implement waitForTransaction(txHash) method with status tracking
    - Implement formatCTC(amount) and parseCTC(amount) utility methods for 18 decimal precision
    - _Requirements: 3.2, 3.3, 3.4_

  - [ ]* 1.4 Write property test for CTC formatting precision
    - **Property 2: CTC Balance Formatting Precision**
    - **Validates: Requirements 3.2**

  - [x] 1.5 Create lib/ctc/wagmi.ts with Wagmi v2 configuration
    - Import createConfig and http from wagmi
    - Configure creditCoinTestnet chain with transports
    - Add MetaMask, WalletConnect, and Privy connectors
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 1.6 Create lib/ctc/backend-client.ts with TreasuryClient class
    - Implement constructor with private key from environment variable
    - Implement processWithdrawal(userAddress, amount) method
    - Implement getTreasuryBalance() method
    - Implement validateWithdrawal(amount, treasuryBalance) method
    - Add comprehensive error handling and logging
    - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [x] 2. Setup Supabase database schema
  - [x] 2.1 Create database migration script for user_balances table
    - Create table with user_address (TEXT PRIMARY KEY), currency (TEXT DEFAULT 'CTC'), balance (NUMERIC(20,18)), updated_at, created_at
    - Add index on user_address and currency columns
    - Enable Row Level Security with public read and insert policies
    - _Requirements: 4.1, 4.4, 4.5, 4.6_

  - [x] 2.2 Create database migration script for bet_history table
    - Create table with all required columns (id, wallet_address, asset, direction, amount, multiplier, strike_price, end_price, payout, won, mode, network, resolved_at, created_at)
    - Use NUMERIC(20,18) for CTC amounts with 18 decimal precision
    - Add CHECK constraint for direction IN ('UP', 'DOWN')
    - Add indexes on wallet_address and created_at columns
    - Enable Row Level Security with public read and insert policies
    - _Requirements: 4.2, 4.4, 4.5, 4.6_

  - [x] 2.3 Create database migration script for balance_audit_log table
    - Create table with id (SERIAL PRIMARY KEY), user_address, currency, operation, amount, balance_before, balance_after, tx_hash, created_at
    - Use NUMERIC(20,18) for all balance and amount columns
    - Add indexes on user_address and created_at columns
    - Enable Row Level Security with public read and insert policies
    - _Requirements: 4.3, 4.4, 4.5, 4.6_

  - [x] 2.4 Create lib/ctc/database.ts with Supabase client and helper functions
    - Initialize Supabase client with environment variables
    - Implement getHouseBalance(userAddress) function
    - Implement updateHouseBalance(userAddress, amount, operation) function with audit logging
    - Implement createAuditLog(userAddress, operation, amount, balanceBefore, balanceAfter, txHash) function
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 3. Implement deposit functionality
  - [x] 3.1 Create app/api/deposit/route.ts API endpoint
    - Implement POST handler with userAddress, txHash, amount validation
    - Verify transaction on CreditCoin testnet (to address = treasury, amount matches)
    - Credit user's house balance in Supabase
    - Create audit log entry with operation='deposit'
    - Return success response with newBalance or error response
    - _Requirements: 5.3, 5.4, 5.6_

  - [ ]* 3.2 Write property test for deposit amount validation
    - **Property 3: Deposit Amount Validation**
    - **Validates: Requirements 5.2**

  - [ ]* 3.3 Write property test for deposit credits house balance
    - **Property 4: Deposit Credits House Balance**
    - **Validates: Requirements 5.4**

  - [ ]* 3.4 Write property test for failed deposit preserves balance
    - **Property 5: Failed Deposit Preserves Balance**
    - **Validates: Requirements 5.5**

  - [x] 3.5 Create components/wallet/DepositModal.tsx component
    - Display CTC token information and current wallet balance
    - Implement amount input with validation (> 0, <= wallet balance)
    - Implement deposit transaction flow with CreditCoinClient
    - Display transaction status (pending, confirmed, failed)
    - Show transaction hash with block explorer link on success
    - _Requirements: 5.1, 5.2, 5.5_

- [x] 4. Checkpoint - Ensure deposit functionality works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement withdrawal functionality
  - [x] 5.1 Create app/api/withdraw/route.ts API endpoint
    - Implement POST handler with userAddress, amount validation
    - Check user's house balance is sufficient
    - Debit house balance optimistically
    - Process withdrawal via TreasuryClient.processWithdrawal()
    - On success: create audit log entry with operation='withdraw'
    - On failure: revert house balance debit and return error
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 5.2 Write property test for withdrawal amount validation
    - **Property 6: Withdrawal Amount Validation**
    - **Validates: Requirements 6.2**

  - [ ]* 5.3 Write property test for withdrawal debits house balance
    - **Property 7: Withdrawal Debits House Balance**
    - **Validates: Requirements 6.3**

  - [ ]* 5.4 Write property test for withdrawal transfers CTC
    - **Property 8: Withdrawal Transfers CTC**
    - **Validates: Requirements 6.4**

  - [ ]* 5.5 Write property test for failed withdrawal reverts balance
    - **Property 9: Failed Withdrawal Reverts Balance**
    - **Validates: Requirements 6.5**

  - [x] 5.6 Create components/wallet/WithdrawModal.tsx component
    - Display current house balance in CTC
    - Implement amount input with validation (> 0, <= house balance)
    - Implement withdrawal request flow via API
    - Display transaction status (pending, confirmed, failed)
    - Show transaction hash with block explorer link on success
    - _Requirements: 6.1, 6.2, 6.5_

- [x] 6. Checkpoint - Ensure withdrawal functionality works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Blitz mode CTC integration
  - [x] 7.1 Update app/api/bet/route.ts to handle CTC bets
    - Update bet placement to deduct CTC from house balance
    - Update bet settlement to credit CTC payout for winning bets
    - Record all bets in bet_history with network='CTC', asset='CTC'
    - Create audit log entries for bet_debit and bet_credit operations
    - Use 18 decimal precision for all CTC amounts
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

  - [ ]* 7.2 Write property test for bet placement debits house balance
    - **Property 10: Bet Placement Debits House Balance**
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 7.3 Write property test for winning bet credits payout
    - **Property 11: Winning Bet Credits Payout**
    - **Validates: Requirements 7.3**

  - [ ]* 7.4 Write property test for losing bet no credit
    - **Property 12: Losing Bet No Credit**
    - **Validates: Requirements 7.4**

  - [x] 7.5 Update components/game/BlitzMode.tsx for CTC display
    - Update bet amount display to show CTC with 18 decimal formatting
    - Update payout display to show CTC currency symbol
    - Update balance display to show house balance in CTC
    - _Requirements: 7.5_

  - [ ]* 7.6 Write property test for bet display formatting
    - **Property 13: Bet Display Formatting**
    - **Validates: Requirements 7.5**

  - [ ]* 7.7 Write property test for bet recording with CTC metadata
    - **Property 14: Bet Recording with CTC Metadata**
    - **Validates: Requirements 7.6**

- [x] 8. Implement wallet connection for CreditCoin testnet
  - [x] 8.1 Update components/wallet/WalletConnect.tsx component
    - Configure wagmi with CreditCoin testnet chain
    - Implement chain verification (chainId === 102031)
    - Implement network switch prompt when on wrong chain
    - Display connected wallet address and CTC balance in header
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 8.2 Write property test for wallet chain verification
    - **Property 15: Wallet Chain Verification**
    - **Validates: Requirements 8.4**

- [x] 9. Integrate Pyth oracle for CreditCoin
  - [x] 9.1 Verify lib/utils/priceFeed.ts works with CreditCoin
    - Ensure fetchPythPrice() function uses correct Pyth Hermes endpoint
    - Verify retry logic (3 attempts with 1 second delay)
    - Ensure price feed IDs are correct for supported assets
    - _Requirements: 9.1, 9.2, 9.4_

  - [x] 9.2 Update bet settlement logic to use Pyth oracle
    - Fetch price from Pyth Hermes when bet expires
    - Determine bet outcome (win/loss) based on oracle price
    - Refund bet amount if oracle fails after all retries
    - Create audit log entry with operation='refund' for oracle failures
    - _Requirements: 9.3, 9.5, 9.6_

  - [ ]* 9.3 Write property test for oracle price fetch on bet expiry
    - **Property 16: Oracle Price Fetch on Bet Expiry**
    - **Validates: Requirements 9.3**

  - [ ]* 9.4 Write property test for oracle failure refunds bet
    - **Property 17: Oracle Failure Refunds Bet**
    - **Validates: Requirements 9.5**

- [x] 10. Update branding and UI for CreditNomo
  - [x] 10.1 Update application branding
    - Change app name to "CreditNomo" in all UI components
    - Update page title to "CreditNomo - Binary Options on CreditCoin"
    - Update navbar text to CreditNomo branding
    - Update footer links to reference CreditCoin documentation
    - Update README.md to describe CreditNomo on CreditCoin testnet
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6_

  - [x] 10.2 Update currency symbol display throughout application
    - Replace all "BNB" references with "CTC" in UI
    - Update balance displays to show "CTC" symbol
    - Update bet amount displays to show "CTC" symbol
    - Update deposit/withdrawal modals to show "CTC" symbol
    - _Requirements: 10.4, 3.1_

- [x] 11. Implement transaction monitoring
  - [x] 11.1 Create components/wallet/TransactionStatus.tsx component
    - Display transaction hash with copy-to-clipboard functionality
    - Display transaction status (pending, confirmed, failed) in real-time
    - Generate CreditCoin block explorer link (https://creditcoin-testnet.blockscout.com/tx/{txHash})
    - Show clickable link to block explorer
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ]* 11.2 Write property test for transaction hash display with explorer link
    - **Property 18: Transaction Hash Display with Explorer Link**
    - **Validates: Requirements 13.1, 13.2**

  - [ ]* 11.3 Write property test for block explorer URL formatting
    - **Property 19: Block Explorer URL Formatting**
    - **Validates: Requirements 13.3**

  - [ ]* 11.4 Write property test for transaction status display
    - **Property 20: Transaction Status Display**
    - **Validates: Requirements 13.4**

  - [x] 11.5 Update database to store transaction hashes
    - Ensure deposit API stores txHash in balance_audit_log
    - Ensure withdrawal API stores txHash in balance_audit_log
    - Ensure bet settlement stores txHash if applicable
    - _Requirements: 13.6_

  - [ ]* 11.6 Write property test for transaction hash storage
    - **Property 21: Transaction Hash Storage**
    - **Validates: Requirements 13.6**

- [x] 12. Implement comprehensive error handling and logging
  - [x] 12.1 Add RPC connection error handling
    - Implement retry logic (3 attempts) for RPC failures
    - Log errors with RPC endpoint and timestamp
    - Display user-friendly error messages
    - _Requirements: 14.1_

  - [x] 12.2 Add transaction error handling
    - Catch and log transaction failures with details
    - Display user-friendly error messages to users
    - Ensure no sensitive data (private keys) in logs
    - _Requirements: 14.2, 14.5_

  - [ ]* 12.3 Write property test for transaction failure logging
    - **Property 22: Transaction Failure Logging**
    - **Validates: Requirements 14.2**

  - [x] 12.4 Add database error handling
    - Catch and log database operation failures
    - Return appropriate HTTP status codes (4xx, 5xx)
    - Implement structured logging format
    - _Requirements: 14.3, 14.6_

  - [ ]* 12.5 Write property test for database failure error handling
    - **Property 23: Database Failure Error Handling**
    - **Validates: Requirements 14.3**

  - [x] 12.6 Add comprehensive audit logging
    - Log all treasury operations (deposits, withdrawals) with timestamps and amounts
    - Ensure balance_audit_log captures all balance-changing operations
    - Implement structured logging for easy parsing
    - _Requirements: 14.4, 14.6_

  - [ ]* 12.7 Write property test for comprehensive audit logging
    - **Property 24: Comprehensive Audit Logging**
    - **Validates: Requirements 5.6, 6.6, 9.6, 14.4**

- [x] 13. Code cleanup and migration
  - [x] 13.1 Remove BNB-specific code
    - Delete lib/bnb/ directory and all BNB utilities
    - Remove BNB Chain references from package.json
    - Remove BNB-specific test files
    - Update all imports from lib/bnb/ to lib/ctc/
    - _Requirements: 12.1, 12.3, 12.4, 12.6, 1.6_

  - [x] 13.2 Update TypeScript types and interfaces
    - Rename all BNB-related types to CTC equivalents
    - Update token amount types to use 18 decimal precision
    - Update network configuration types
    - _Requirements: 12.5_

  - [x] 13.3 Update environment configuration
    - Create .env.example with CreditCoin environment variables
    - Document all required environment variables in README
    - Add validation for missing environment variables with warnings
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 14. Create testing and validation scripts
  - [x] 14.1 Create scripts/test-rpc-connectivity.ts
    - Test CreditCoin RPC endpoint reachability
    - Test basic RPC calls (getBlockNumber, getBalance)
    - Measure and log response time
    - _Requirements: 15.1_

  - [x] 14.2 Create scripts/test-treasury-wallet.ts
    - Verify treasury address is valid EVM address
    - Check treasury CTC balance
    - Test transaction signing with private key (dry run)
    - _Requirements: 15.2_

  - [x] 14.3 Create scripts/test-database-schema.ts
    - Verify all tables exist (user_balances, bet_history, balance_audit_log)
    - Check column types and constraints
    - Verify indexes are created
    - Test RLS policies
    - _Requirements: 15.3_

  - [x] 14.4 Create scripts/test-deposit-withdrawal.ts
    - Simulate full deposit flow (transaction → API → database)
    - Simulate full withdrawal flow (API → treasury → database)
    - Test error scenarios (insufficient balance, failed transaction)
    - Verify audit logging
    - _Requirements: 15.4_

  - [x] 14.5 Create scripts/test-oracle-integration.ts
    - Fetch prices for all supported assets from Pyth Hermes
    - Test retry logic with simulated failures
    - Measure response time
    - Verify price data format
    - _Requirements: 15.5_

  - [ ]* 14.6 Write property test for deposit-withdrawal round trip
    - **Property 25: Deposit-Withdrawal Round Trip**
    - **Validates: Requirements 15.6**

- [-] 15. Final integration and wiring
  - [x] 15.1 Wire all components together
    - Ensure DepositModal uses CreditCoinClient and deposit API
    - Ensure WithdrawModal uses withdraw API
    - Ensure BlitzMode uses bet API with CTC
    - Ensure WalletConnect uses wagmi with CreditCoin testnet
    - Ensure TransactionStatus displays CreditCoin block explorer links
    - _Requirements: All requirements_

  - [ ] 15.2 Verify end-to-end flows
    - Test full deposit flow: wallet → treasury → house balance
    - Test full withdrawal flow: house balance → treasury → wallet
    - Test full bet flow: bet placement → oracle → settlement → payout
    - Test wallet connection and network switching
    - Test transaction monitoring and block explorer links
    - _Requirements: All requirements_

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties from design document
- All CTC amounts use 18 decimal precision (changed from 8 decimals for BNB)
- Pyth Network Hermes integration remains unchanged (same price feed IDs)
- Treasury wallet address: 0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123
- CreditCoin testnet Chain ID: 102031
- RPC endpoint: https://rpc.cc3-testnet.creditcoin.network
- Block explorer: https://creditcoin-testnet.blockscout.com
