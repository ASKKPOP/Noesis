import { describe, it, expect, beforeEach } from 'vitest';
import { EconomyManager } from '../src/economy/config.js';

describe('EconomyManager', () => {
    let econ: EconomyManager;

    beforeEach(() => {
        econ = new EconomyManager();
    });

    it('has default settings', () => {
        expect(econ.initialSupply).toBe(1000);
        expect(econ.settings.minTransfer).toBe(1);
        expect(econ.settings.maxTransfer).toBe(1_000_000);
        expect(econ.settings.transactionFee).toBe(0);
    });

    it('accepts custom config', () => {
        const custom = new EconomyManager({ initialSupply: 500, transactionFee: 0.01 });
        expect(custom.initialSupply).toBe(500);
        expect(custom.settings.transactionFee).toBe(0.01);
    });

    describe('validateTransfer', () => {
        it('accepts valid amount', () => {
            expect(econ.validateTransfer(100)).toEqual({ valid: true });
        });

        it('rejects below minimum', () => {
            const result = econ.validateTransfer(0);
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('rejects above maximum', () => {
            const result = econ.validateTransfer(2_000_000);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('maximum');
        });

        it('rejects negative amount', () => {
            const result = econ.validateTransfer(-5);
            expect(result.valid).toBe(false);
        });

        it('rejects non-integer', () => {
            const result = econ.validateTransfer(10.5);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('positive integer');
        });
    });

    it('calculates fee', () => {
        const feeEcon = new EconomyManager({ transactionFee: 0.05 });
        expect(feeEcon.calculateFee(100)).toBe(5);
        expect(feeEcon.calculateFee(33)).toBe(1); // floor(1.65)
    });

    it('zero fee by default', () => {
        expect(econ.calculateFee(1000)).toBe(0);
    });

    it('updates config', () => {
        econ.update({ initialSupply: 2000 });
        expect(econ.initialSupply).toBe(2000);
        expect(econ.settings.minTransfer).toBe(1); // unchanged
    });
});
