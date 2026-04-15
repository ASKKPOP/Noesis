/**
 * Economy configuration types for Grid.
 */

export interface EconomyConfig {
    initialSupply: number;      // Ousia given to new Nous (default: 1000)
    transactionFee: number;     // % fee on transfers (0 = free, default: 0)
    minTransfer: number;        // Minimum transfer amount (default: 1)
    maxTransfer: number;        // Maximum transfer amount (default: 1000000)
}
