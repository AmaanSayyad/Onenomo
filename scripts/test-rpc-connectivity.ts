#!/usr/bin/env tsx
/**
 * OneChain RPC Connectivity Test Script
 * 
 * This script tests the OneChain testnet RPC endpoint to verify:
 * - RPC endpoint is reachable
 * - Basic RPC calls work (getBlockNumber, getBalance)
 * - Response times are acceptable
 * 
 * Usage: npx tsx scripts/test-rpc-connectivity.ts
 * 
 * Requirements: 15.1
 */

import { OneChainClient } from '../lib/ctc/client';
import { oneChainTestnet } from '../lib/ctc/config';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Format milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Print test result with color
 */
function printResult(testName: string, success: boolean, duration?: number, details?: string) {
  const status = success ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`;
  const durationStr = duration ? ` (${formatDuration(duration)})` : '';
  const detailsStr = details ? `\n  ${colors.cyan}${details}${colors.reset}` : '';
  console.log(`${status} ${testName}${durationStr}${detailsStr}`);
}

/**
 * Print section header
 */
function printHeader(text: string) {
  console.log(`\n${colors.blue}━━━ ${text} ━━━${colors.reset}`);
}

/**
 * Test RPC endpoint reachability
 */
async function testRpcReachability(): Promise<boolean> {
  const startTime = Date.now();
  try {
    const client = new OneChainClient();
    const blockNumber = await client['provider'].getBlockNumber();
    const duration = Date.now() - startTime;
    
    printResult(
      'RPC Endpoint Reachability',
      true,
      duration,
      `Current block: ${blockNumber}`
    );
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'RPC Endpoint Reachability',
      false,
      duration,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test getBlockNumber RPC call
 */
async function testGetBlockNumber(): Promise<boolean> {
  const startTime = Date.now();
  try {
    const client = new OneChainClient();
    const blockNumber = await client['provider'].getBlockNumber();
    const duration = Date.now() - startTime;
    
    if (typeof blockNumber !== 'number' || blockNumber <= 0) {
      printResult(
        'getBlockNumber()',
        false,
        duration,
        `Invalid block number: ${blockNumber}`
      );
      return false;
    }
    
    printResult(
      'getBlockNumber()',
      true,
      duration,
      `Block number: ${blockNumber.toLocaleString()}`
    );
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'getBlockNumber()',
      false,
      duration,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test getBalance RPC call with treasury address
 */
async function testGetBalance(): Promise<boolean> {
  const startTime = Date.now();
  try {
    const client = new OneChainClient();
    const balance = await client.getBalance(oneChainTestnet.treasuryAddress);
    const duration = Date.now() - startTime;
    
    if (typeof balance !== 'bigint') {
      printResult(
        'getBalance()',
        false,
        duration,
        `Invalid balance type: ${typeof balance}`
      );
      return false;
    }
    
    const formattedBalance = client.formatOCT(balance);
    printResult(
      'getBalance()',
      true,
      duration,
      `Treasury balance: ${formattedBalance} OCT`
    );
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'getBalance()',
      false,
      duration,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test response time performance
 */
async function testResponseTime(): Promise<boolean> {
  const iterations = 5;
  const times: number[] = [];
  
  console.log(`\n${colors.yellow}Running ${iterations} iterations to measure average response time...${colors.reset}`);
  
  try {
    const client = new OneChainClient();
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await client['provider'].getBlockNumber();
      const duration = Date.now() - startTime;
      times.push(duration);
      console.log(`  Iteration ${i + 1}/${iterations}: ${formatDuration(duration)}`);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    const success = avgTime < 5000; // Consider success if average < 5 seconds
    
    printResult(
      'Response Time Performance',
      success,
      avgTime,
      `Min: ${formatDuration(minTime)}, Max: ${formatDuration(maxTime)}, Avg: ${formatDuration(avgTime)}`
    );
    
    if (!success) {
      console.log(`  ${colors.yellow}⚠ Warning: Average response time exceeds 5 seconds${colors.reset}`);
    }
    
    return success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'Response Time Performance',
      false,
      undefined,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test network configuration
 */
function testNetworkConfiguration(): boolean {
  printHeader('Network Configuration');
  
  console.log(`  Chain ID: ${colors.cyan}${oneChainTestnet.chainId}${colors.reset}`);
  console.log(`  Chain Name: ${colors.cyan}${oneChainTestnet.chainName}${colors.reset}`);
  console.log(`  Currency: ${colors.cyan}${oneChainTestnet.nativeCurrency.symbol}${colors.reset} (${oneChainTestnet.nativeCurrency.decimals} decimals)`);
  console.log(`  RPC URL: ${colors.cyan}${oneChainTestnet.rpcUrls[0]}${colors.reset}`);
  console.log(`  Explorer: ${colors.cyan}${oneChainTestnet.blockExplorerUrls[0]}${colors.reset}`);
  console.log(`  Treasury: ${colors.cyan}${oneChainTestnet.treasuryAddress}${colors.reset}`);
  
  // Validate configuration
  const validations = [
    { name: 'Chain ID is 102031', valid: oneChainTestnet.chainId === 102031 },
    { name: 'Currency is OCT', valid: oneChainTestnet.nativeCurrency.symbol === 'OCT' },
    { name: 'Decimals is 18', valid: oneChainTestnet.nativeCurrency.decimals === 18 },
    { name: 'RPC URL is set', valid: oneChainTestnet.rpcUrls.length > 0 },
    { name: 'Treasury address is set', valid: oneChainTestnet.treasuryAddress.length > 0 },
  ];
  
  console.log();
  let allValid = true;
  for (const validation of validations) {
    printResult(validation.name, validation.valid);
    if (!validation.valid) {
      allValid = false;
    }
  }
  
  return allValid;
}

/**
 * Main test runner
 */
async function main() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  OneChain RPC Connectivity Test                         ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  
  const results: { name: string; passed: boolean }[] = [];
  
  // Test 1: Network Configuration
  const configValid = testNetworkConfiguration();
  results.push({ name: 'Network Configuration', passed: configValid });
  
  // Test 2: RPC Endpoint Reachability
  printHeader('RPC Connectivity Tests');
  const reachable = await testRpcReachability();
  results.push({ name: 'RPC Reachability', passed: reachable });
  
  if (!reachable) {
    console.log(`\n${colors.red}✗ RPC endpoint is not reachable. Skipping remaining tests.${colors.reset}`);
    printSummary(results);
    process.exit(1);
  }
  
  // Test 3: getBlockNumber
  const blockNumberWorks = await testGetBlockNumber();
  results.push({ name: 'getBlockNumber()', passed: blockNumberWorks });
  
  // Test 4: getBalance
  const balanceWorks = await testGetBalance();
  results.push({ name: 'getBalance()', passed: balanceWorks });
  
  // Test 5: Response Time
  printHeader('Performance Tests');
  const performanceGood = await testResponseTime();
  results.push({ name: 'Response Time', passed: performanceGood });
  
  // Print summary
  printSummary(results);
  
  // Exit with appropriate code
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

/**
 * Print test summary
 */
function printSummary(results: { name: string; passed: boolean }[]) {
  printHeader('Test Summary');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(0);
  
  console.log(`\n  Total Tests: ${total}`);
  console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${total - passed}${colors.reset}`);
  console.log(`  Success Rate: ${percentage}%\n`);
  
  if (passed === total) {
    console.log(`${colors.green}✓ All tests passed! OneChain RPC is working correctly.${colors.reset}\n`);
  } else {
    console.log(`${colors.red}✗ Some tests failed. Please check the RPC configuration and network connectivity.${colors.reset}\n`);
  }
}

// Run tests
main().catch((error) => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
