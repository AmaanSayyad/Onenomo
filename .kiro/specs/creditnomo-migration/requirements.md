# Requirements Document: CreditNomo Migration

## Introduction

Bu doküman, mevcut Binomo oyununun BNB Chain'den CreditCoin testnet'e migrasyonunu tanımlar. Proje, blockchain altyapısını, token sistemini, veritabanı şemasını ve tüm ilgili entegrasyonları CreditCoin ekosistemi için yeniden yapılandırmayı içerir.

## Glossary

- **CreditNomo_System**: CreditCoin testnet üzerinde çalışan binary options trading uygulaması
- **BNB_Legacy_System**: Mevcut BNB Chain üzerinde çalışan Binomo uygulaması
- **CTC_Token**: CreditCoin native token'ı (18 decimals)
- **Treasury_Wallet**: Kullanıcı depozitlerini ve çekimlerini yöneten merkezi cüzdan
- **House_Balance**: Kullanıcıların off-chain bakiyeleri (Supabase'de saklanır)
- **Blitz_Mode**: Hızlı bahis modu (Classic ve Box modları)
- **Price_Oracle**: Pyth Network Hermes fiyat besleme servisi
- **Migration_Process**: BNB Chain'den CreditCoin testnet'e geçiş süreci
- **Database_Schema**: Supabase PostgreSQL veritabanı yapısı
- **RPC_Endpoint**: CreditCoin testnet RPC bağlantı noktası
- **Block_Explorer**: CreditCoin testnet blockchain tarayıcısı

## Requirements

### Requirement 1: Blockchain Network Configuration

**User Story:** As a developer, I want to configure CreditCoin testnet connection, so that the application can interact with CreditCoin blockchain.

#### Acceptance Criteria

1. THE CreditNomo_System SHALL use CreditCoin testnet RPC endpoint (https://rpc.cc3-testnet.creditcoin.network)
2. THE CreditNomo_System SHALL use chain ID 102031 for all blockchain transactions
3. THE CreditNomo_System SHALL use CTC as the native currency symbol
4. THE CreditNomo_System SHALL use 18 decimals for CTC token amounts
5. THE CreditNomo_System SHALL use CreditCoin testnet block explorer (https://creditcoin-testnet.blockscout.com) for transaction links
6. THE CreditNomo_System SHALL remove all BNB Chain configuration references from the codebase

### Requirement 2: Treasury Wallet Configuration

**User Story:** As a system administrator, I want to configure the CreditCoin treasury wallet, so that deposits and withdrawals can be processed.

#### Acceptance Criteria

1. THE CreditNomo_System SHALL use treasury address 0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123 for all deposit operations
2. THE CreditNomo_System SHALL use treasury private key from environment variable CREDITCOIN_TREASURY_PRIVATE_KEY for withdrawal operations
3. THE CreditNomo_System SHALL validate treasury address format as valid EVM address
4. WHEN treasury private key is missing, THE CreditNomo_System SHALL log error and prevent withdrawal operations
5. THE CreditNomo_System SHALL never expose treasury private key in client-side code or logs

### Requirement 3: Token System Migration

**User Story:** As a user, I want to use CTC tokens instead of BNB, so that I can trade on CreditCoin network.

#### Acceptance Criteria

1. THE CreditNomo_System SHALL replace all BNB token references with CTC in the user interface
2. THE CreditNomo_System SHALL display balances in CTC with 18 decimal precision
3. THE CreditNomo_System SHALL process deposits in CTC tokens
4. THE CreditNomo_System SHALL process withdrawals in CTC tokens
5. THE CreditNomo_System SHALL update all bet amounts to use CTC as currency
6. THE CreditNomo_System SHALL remove BNB-specific utility functions and replace with CTC equivalents

### Requirement 4: Database Schema Migration

**User Story:** As a developer, I want to create a new Supabase database schema for CreditNomo, so that user data is properly structured for CTC operations.

#### Acceptance Criteria

1. THE CreditNomo_System SHALL create user_balances table with columns: user_address (TEXT PRIMARY KEY), currency (TEXT DEFAULT 'CTC'), balance (NUMERIC(20,18)), updated_at (TIMESTAMPTZ), created_at (TIMESTAMPTZ)
2. THE CreditNomo_System SHALL create bet_history table with columns: id (TEXT PRIMARY KEY), wallet_address (TEXT), asset (TEXT DEFAULT 'CTC'), direction (TEXT CHECK IN ('UP','DOWN')), amount (NUMERIC(20,18)), multiplier (NUMERIC(10,4)), strike_price (NUMERIC(20,18)), end_price (NUMERIC(20,18)), payout (NUMERIC(20,18)), won (BOOLEAN), mode (TEXT DEFAULT 'creditnomo'), network (TEXT DEFAULT 'CTC'), resolved_at (TIMESTAMPTZ), created_at (TIMESTAMPTZ)
3. THE CreditNomo_System SHALL create balance_audit_log table with columns: id (SERIAL PRIMARY KEY), user_address (TEXT), currency (TEXT DEFAULT 'CTC'), operation (TEXT), amount (NUMERIC(20,18)), balance_before (NUMERIC(20,18)), balance_after (NUMERIC(20,18)), created_at (TIMESTAMPTZ)
4. THE CreditNomo_System SHALL create indexes on user_address and currency columns for performance
5. THE CreditNomo_System SHALL enable Row Level Security policies for public read and insert operations
6. THE CreditNomo_System SHALL use 18 decimal places for all CTC amount columns (changed from 8 decimals)

### Requirement 5: Deposit Functionality

**User Story:** As a user, I want to deposit CTC tokens to my house balance, so that I can place bets.

#### Acceptance Criteria

1. WHEN a user initiates deposit, THE CreditNomo_System SHALL display DepositModal with CTC token information
2. WHEN a user enters deposit amount, THE CreditNomo_System SHALL validate amount is greater than 0 and user has sufficient CTC balance
3. WHEN a user confirms deposit, THE CreditNomo_System SHALL transfer CTC from user wallet to Treasury_Wallet on CreditCoin testnet
4. WHEN deposit transaction is confirmed, THE CreditNomo_System SHALL credit user's House_Balance in Supabase database
5. WHEN deposit transaction fails, THE CreditNomo_System SHALL display error message and not credit House_Balance
6. THE CreditNomo_System SHALL log all deposit transactions in balance_audit_log table

### Requirement 6: Withdrawal Functionality

**User Story:** As a user, I want to withdraw CTC tokens from my house balance, so that I can transfer funds to my wallet.

#### Acceptance Criteria

1. WHEN a user initiates withdrawal, THE CreditNomo_System SHALL display WithdrawModal with current House_Balance in CTC
2. WHEN a user enters withdrawal amount, THE CreditNomo_System SHALL validate amount is greater than 0 and less than or equal to House_Balance
3. WHEN a user confirms withdrawal, THE CreditNomo_System SHALL debit user's House_Balance in Supabase database
4. WHEN House_Balance is debited, THE CreditNomo_System SHALL transfer CTC from Treasury_Wallet to user wallet on CreditCoin testnet
5. WHEN withdrawal transaction fails, THE CreditNomo_System SHALL revert House_Balance debit and display error message
6. THE CreditNomo_System SHALL log all withdrawal transactions in balance_audit_log table

### Requirement 7: Blitz Mode CTC Integration

**User Story:** As a user, I want to play Blitz mode (Classic and Box) with CTC tokens, so that I can place fast bets.

#### Acceptance Criteria

1. WHEN a user places bet in Classic mode, THE CreditNomo_System SHALL deduct bet amount in CTC from House_Balance
2. WHEN a user places bet in Box mode, THE CreditNomo_System SHALL deduct bet amount in CTC from House_Balance
3. WHEN a bet wins, THE CreditNomo_System SHALL credit payout in CTC to House_Balance
4. WHEN a bet loses, THE CreditNomo_System SHALL not credit House_Balance
5. THE CreditNomo_System SHALL display all bet amounts and payouts in CTC with proper decimal formatting
6. THE CreditNomo_System SHALL record all bets in bet_history table with network='CTC' and asset='CTC'

### Requirement 8: Wallet Connection

**User Story:** As a user, I want to connect my EVM wallet to CreditNomo, so that I can interact with CreditCoin testnet.

#### Acceptance Criteria

1. THE CreditNomo_System SHALL support MetaMask wallet connection for CreditCoin testnet
2. THE CreditNomo_System SHALL support WalletConnect for CreditCoin testnet
3. THE CreditNomo_System SHALL support Privy embedded wallet for CreditCoin testnet
4. WHEN a user connects wallet, THE CreditNomo_System SHALL verify wallet is connected to CreditCoin testnet (chain ID 102031)
5. WHEN wallet is on wrong network, THE CreditNomo_System SHALL prompt user to switch to CreditCoin testnet
6. THE CreditNomo_System SHALL display connected wallet address and CTC balance in header

### Requirement 9: Price Oracle Integration

**User Story:** As a system, I want to continue using Pyth Network Hermes for price feeds, so that bets are settled with accurate oracle prices.

#### Acceptance Criteria

1. THE CreditNomo_System SHALL maintain existing Pyth Network Hermes integration for price feeds
2. THE CreditNomo_System SHALL use same Pyth price feed IDs for supported assets (BTC, ETH, SOL, etc.)
3. WHEN a bet expires, THE CreditNomo_System SHALL fetch price from Pyth Hermes oracle
4. WHEN oracle price is unavailable, THE CreditNomo_System SHALL retry up to 3 times with 1 second delay
5. IF oracle price fails after retries, THE CreditNomo_System SHALL refund bet amount to user's House_Balance
6. THE CreditNomo_System SHALL log all oracle price fetches and failures

### Requirement 10: Branding and UI Updates

**User Story:** As a user, I want to see CreditNomo branding instead of Binomo, so that I know I'm using the CreditCoin version.

#### Acceptance Criteria

1. THE CreditNomo_System SHALL display "CreditNomo" as application name in all UI components
2. THE CreditNomo_System SHALL update page title to "CreditNomo - Binary Options on CreditCoin"
3. THE CreditNomo_System SHALL update logo and favicon to CreditNomo branding
4. THE CreditNomo_System SHALL display "CTC" as currency symbol throughout the application
5. THE CreditNomo_System SHALL update footer links to reference CreditCoin documentation
6. THE CreditNomo_System SHALL update README.md to describe CreditNomo on CreditCoin testnet

### Requirement 11: Environment Configuration

**User Story:** As a developer, I want to configure environment variables for CreditCoin, so that the application uses correct network settings.

#### Acceptance Criteria

1. THE CreditNomo_System SHALL read NEXT_PUBLIC_CREDITCOIN_TESTNET_RPC from environment for RPC endpoint
2. THE CreditNomo_System SHALL read NEXT_PUBLIC_CREDITCOIN_TESTNET_CHAIN_ID from environment for chain ID
3. THE CreditNomo_System SHALL read NEXT_PUBLIC_CREDITCOIN_TESTNET_EXPLORER from environment for block explorer URL
4. THE CreditNomo_System SHALL read CREDITCOIN_TREASURY_ADDRESS from environment for treasury wallet
5. THE CreditNomo_System SHALL read CREDITCOIN_TREASURY_PRIVATE_KEY from environment for withdrawal operations
6. WHEN required environment variables are missing, THE CreditNomo_System SHALL log warning and use fallback values where safe

### Requirement 12: Code Migration and Cleanup

**User Story:** As a developer, I want to remove all BNB-specific code, so that the codebase only contains CreditCoin logic.

#### Acceptance Criteria

1. THE CreditNomo_System SHALL remove lib/bnb/ directory and all BNB-specific utilities
2. THE CreditNomo_System SHALL create lib/ctc/ directory with CreditCoin-specific utilities
3. THE CreditNomo_System SHALL update all imports from lib/bnb/ to lib/ctc/
4. THE CreditNomo_System SHALL remove BNB Chain references from package.json description
5. THE CreditNomo_System SHALL update all TypeScript types from BNB to CTC naming
6. THE CreditNomo_System SHALL remove BNB-specific test files and create CTC equivalents

### Requirement 13: Transaction Monitoring

**User Story:** As a user, I want to view my transaction history on CreditCoin block explorer, so that I can verify deposits and withdrawals.

#### Acceptance Criteria

1. WHEN a deposit transaction completes, THE CreditNomo_System SHALL display transaction hash with link to CreditCoin block explorer
2. WHEN a withdrawal transaction completes, THE CreditNomo_System SHALL display transaction hash with link to CreditCoin block explorer
3. THE CreditNomo_System SHALL format block explorer URLs as https://creditcoin-testnet.blockscout.com/tx/{txHash}
4. THE CreditNomo_System SHALL display transaction status (pending, confirmed, failed) in real-time
5. THE CreditNomo_System SHALL allow users to copy transaction hash to clipboard
6. THE CreditNomo_System SHALL store transaction hashes in database for historical reference

### Requirement 14: Error Handling and Logging

**User Story:** As a developer, I want comprehensive error handling for CreditCoin operations, so that issues can be diagnosed and resolved quickly.

#### Acceptance Criteria

1. WHEN RPC connection fails, THE CreditNomo_System SHALL log error with RPC endpoint and retry up to 3 times
2. WHEN transaction fails, THE CreditNomo_System SHALL log error with transaction details and user-friendly message
3. WHEN database operation fails, THE CreditNomo_System SHALL log error and return appropriate HTTP status code
4. THE CreditNomo_System SHALL log all treasury operations (deposits, withdrawals) with timestamp and amounts
5. THE CreditNomo_System SHALL never log sensitive data (private keys, user passwords) in any log level
6. THE CreditNomo_System SHALL use structured logging format for easy parsing and monitoring

### Requirement 15: Testing and Validation

**User Story:** As a developer, I want to test CreditCoin integration, so that I can verify all functionality works correctly.

#### Acceptance Criteria

1. THE CreditNomo_System SHALL provide test script to verify CreditCoin RPC connectivity
2. THE CreditNomo_System SHALL provide test script to verify treasury wallet balance and permissions
3. THE CreditNomo_System SHALL provide test script to verify Supabase database schema and migrations
4. THE CreditNomo_System SHALL provide test script to simulate deposit and withdrawal flows
5. THE CreditNomo_System SHALL provide test script to verify Pyth oracle price fetching
6. FOR ALL valid deposit/withdrawal operations, executing then reversing SHALL return user to original balance state (round-trip property)

## Migration Checklist

Bu requirements dokümanı aşağıdaki migration adımlarını kapsar:

1. ✅ Blockchain network configuration (CreditCoin testnet)
2. ✅ Treasury wallet setup (address and private key)
3. ✅ Token system migration (BNB → CTC)
4. ✅ Database schema creation (Supabase with CTC support)
5. ✅ Deposit functionality (CTC deposits to house balance)
6. ✅ Withdrawal functionality (CTC withdrawals from house balance)
7. ✅ Blitz mode integration (Classic and Box modes with CTC)
8. ✅ Wallet connection (MetaMask, WalletConnect, Privy)
9. ✅ Price oracle integration (Pyth Hermes)
10. ✅ Branding updates (Binomo → CreditNomo)
11. ✅ Environment configuration (.env setup)
12. ✅ Code cleanup (remove BNB code, add CTC code)
13. ✅ Transaction monitoring (block explorer links)
14. ✅ Error handling and logging
15. ✅ Testing and validation scripts

## Notes

- Mevcut Pyth Network Hermes entegrasyonu değiştirilmeyecek (aynı price feed'ler kullanılacak)
- Supabase yeni bir proje olarak kurulacak, mevcut BNB verileri migrate edilmeyecek
- Treasury wallet adresi ve private key .env dosyasında mevcut
- CreditCoin testnet EVM-compatible olduğu için ethers.js ve wagmi kütüphaneleri kullanılabilir
- Decimal precision 8'den 18'e çıkarılacak (CTC native token 18 decimals kullanıyor)
