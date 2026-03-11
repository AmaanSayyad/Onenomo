/**
 * Deposit API Endpoint
 * 
 * This endpoint handles user deposit operations by:
 * 1. Validating the deposit request (userAddress, txHash, amount)
 * 2. Verifying the transaction on OneChain testnet
 * 3. Adding the user's house balance in Supabase
 * 4. Creating an audit log entry
 * 
 * Error Handling:
 * - All transaction failures are logged with details (no sensitive data)
 * - User-friendly error messages are returned to clients
 * - Appropriate HTTP status codes for different error types
 * 
 * Requirements: 5.3, 5.4, 5.6, 14.2, 14.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateHouseBalance, getHouseBalance } from '@/lib/ctc/database';
import { getOnchainAdapter } from '@/lib/onchain/adapter';

/**
 * Sanitize error messages to prevent sensitive data leakage
 */
function sanitizeError(error: any): string {
  if (!error) return 'Unknown error';
  
  const message = error?.message || String(error);
  const lowerMessage = message.toLowerCase();
  
  // Check for sensitive keywords
  const sensitiveKeywords = ['private', 'key', 'secret', 'password', 'mnemonic', 'seed'];
  if (sensitiveKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'An internal error occurred. Please contact support.';
  }
  
  return message;
}

/**
 * Request body interface
 */
interface DepositRequest {
  userAddress: string;
  txHash: string;
  amount: string; // OCT amount as string
}

/**
 * Success response interface
 */
interface DepositSuccessResponse {
  success: true;
  newBalance: string;
}

/**
 * Error response interface
 */
interface DepositErrorResponse {
  success: false;
  error: string;
}

type DepositResponse = DepositSuccessResponse | DepositErrorResponse;

/**
 * POST /api/deposit
 * 
 * Process a deposit transaction by verifying it on-chain and adding to the user's house balance.
 */
export async function POST(request: NextRequest): Promise<NextResponse<DepositResponse>> {
  const timestamp = new Date().toISOString();
  const adapter = getOnchainAdapter();

  try {
    // Parse request body
    const body: DepositRequest = await request.json();
    const { userAddress, txHash, amount } = body;

    // Validate required fields
    if (!userAddress || !txHash || !amount) {
      console.error(`[${timestamp}] [Deposit API] Validation error: Missing required fields`, {
        hasUserAddress: !!userAddress,
        hasTxHash: !!txHash,
        hasAmount: !!amount,
      });
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userAddress, txHash, amount' },
        { status: 400 }
      );
    }

    // Validate user address format
    if (!adapter.validateAddress(userAddress)) {
      console.error(`[${timestamp}] [Deposit API] Validation error: Invalid address format`, {
        userAddress,
      });
      return NextResponse.json(
        { success: false, error: 'Invalid user address format' },
        { status: 400 }
      );
    }

    // Validate amount
    let amountBigInt: bigint;
    try {
      amountBigInt = adapter.parseAmount(amount);
      if (amountBigInt <= BigInt(0)) {
        console.error(`[${timestamp}] [Deposit API] Validation error: Invalid amount`, {
          amount,
          userAddress,
        });
        return NextResponse.json(
          { success: false, error: 'Deposit amount must be greater than 0' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error(`[${timestamp}] [Deposit API] Validation error: Amount parsing failed`, {
        amount,
        userAddress,
        error: sanitizeError(error),
      });
      return NextResponse.json(
        { success: false, error: 'Invalid amount format' },
        { status: 400 }
      );
    }

    console.log(`[${timestamp}] [Deposit API] Processing deposit:`, {
      userAddress,
      txHash,
      amount,
      chain: adapter.chainName,
    });

    const verification = await adapter.verifyDeposit({ userAddress, txHash, amount });
    if (!verification.success) {
      console.error(`[${timestamp}] [Deposit API] Transaction verification failed:`, {
        txHash,
        userAddress,
        amount,
        chain: adapter.chainName,
        reason: verification.error,
      });
      return NextResponse.json(
        { success: false, error: verification.error || 'Transaction verification failed' },
        { status: 400 }
      );
    }

    // Add user's house balance
    try {
      const newBalance = await updateHouseBalance(
        userAddress,
        amount, // Positive amount to add
        'deposit',
        txHash
      );

      console.log(`[${timestamp}] [Deposit API] Deposit successful:`, {
        userAddress,
        txHash,
        amount,
        newBalance,
      });

      return NextResponse.json({
        success: true,
        newBalance,
      });
    } catch (error) {
      // Determine appropriate HTTP status code based on error type
      let statusCode = 500;
      let errorMessage = 'Failed to update house balance. Please contact support.';
      
      if (error instanceof Error) {
        // Database connection errors
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          statusCode = 503; // Service Unavailable
          errorMessage = 'Database temporarily unavailable. Please try again later.';
        }
        // Constraint violations or validation errors
        else if (error.message.includes('constraint') || error.message.includes('validation')) {
          statusCode = 400; // Bad Request
          errorMessage = 'Invalid data format. Please check your request.';
        }
      }
      
      console.error(`[${timestamp}] [Database Error] Failed to update house balance:`, {
        operation: 'deposit',
        txHash,
        userAddress,
        amount,
        statusCode,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: sanitizeError(error),
      });
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: statusCode }
      );
    }
  } catch (error) {
    console.error(`[${timestamp}] [Deposit API] Unexpected error:`, {
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage: sanitizeError(error),
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error. Please try again later.' },
      { status: 500 }
    );
  }
}
