/**
 * Economy Config — Grid-level Ousia rules and faucet.
 */

import type { EconomyConfig } from './types.js';

const DEFAULT_CONFIG: EconomyConfig = {
    initialSupply: 1000,
    transactionFee: 0,
    minTransfer: 1,
    maxTransfer: 1_000_000,
};

export class EconomyManager {
    private config: EconomyConfig;

    constructor(config: Partial<EconomyConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /** Get the initial Ousia supply for new Nous. */
    get initialSupply(): number {
        return this.config.initialSupply;
    }

    /** Validate a transfer amount against Grid rules. */
    validateTransfer(amount: number): { valid: boolean; error?: string } {
        if (amount < this.config.minTransfer) {
            return { valid: false, error: `Amount below minimum (${this.config.minTransfer})` };
        }
        if (amount > this.config.maxTransfer) {
            return { valid: false, error: `Amount above maximum (${this.config.maxTransfer})` };
        }
        if (!Number.isInteger(amount) || amount <= 0) {
            return { valid: false, error: 'Amount must be a positive integer' };
        }
        return { valid: true };
    }

    /** Calculate transaction fee for a given amount. */
    calculateFee(amount: number): number {
        return Math.floor(amount * this.config.transactionFee);
    }

    /** Get full config. */
    get settings(): Readonly<EconomyConfig> {
        return { ...this.config };
    }

    /** Update config. */
    update(changes: Partial<EconomyConfig>): void {
        this.config = { ...this.config, ...changes };
    }
}
