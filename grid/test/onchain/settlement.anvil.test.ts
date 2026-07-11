/**
 * Phase 63 core — anvil integration test for on-chain settlement (D-63-1/2/3).
 *
 * Proves the Grid oracle-attestation + relayer-finalize path end-to-end against a REAL EVM:
 *   payer fundJob → Grid attestJobCompletion (oracle signs, relayer submits) → advance the
 *   dispute window (anvil evm_increaseTime/evm_mine) → Grid finalizeJob → worker paid
 *   (amount − fee), CivicTreasury credited the fee.
 *
 * Mirrors the real-MySQL skip-if-no-DB philosophy (treasury-rail.integration.test.ts): it
 * probes the RPC at collection time and `describe.skipIf(!anvilUp)` — a no-op in CI / any env
 * without a local anvil. To run it, start `anvil` (default :8545) and:
 *   npx vitest run test/onchain/settlement.anvil.test.ts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { Contract, ContractFactory, Interface, JsonRpcProvider, NonceManager, Wallet, parseEther, type InterfaceAbi } from 'ethers';
import { OnchainSettlement } from '../../src/onchain/settlement.js';
import { loadOnchainSettlementConfig } from '../../src/onchain/config.js';

const RPC_URL = process.env.GRID_ONCHAIN_RPC_URL ?? 'http://127.0.0.1:8545';

// Anvil default keys (deterministic mnemonic). acct0 = deployer + relayer, acct1 = arbiter/
// authorizer, acct2 = oracle, acct3 = payer, acct4 = worker.
const KEY_RELAYER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // acct0 — relayer (pays gas)
const KEY_ARBITER = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // acct1 — arbiter/authorizer
const KEY_ORACLE = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'; // acct2 — oracle (attestation signer)
const KEY_PAYER = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6'; // acct3 — payer
const KEY_WORKER = '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a'; // acct4 — worker
// acct9 — deployer only, kept distinct from the relayer (acct0) so their nonces never contend.
const KEY_DEPLOYER = '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6';

const FEE_BPS = 200n; // 2%
const DISPUTE_WINDOW = 2n; // seconds — short so the test is fast

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../../../contracts/out');

interface Artifact {
    abi: InterfaceAbi;
    bytecode: { object: string };
}
function loadArtifact(name: string): Artifact {
    return JSON.parse(readFileSync(join(OUT, `${name}.sol`, `${name}.json`), 'utf8')) as Artifact;
}

// Interaction ABI for the payer's fundJob + event parsing (kept minimal).
const ESCROW_IX_ABI: InterfaceAbi = [
    'function fundJob(address worker, uint64 deadline) payable returns (uint256 jobId)',
    'event JobFunded(uint256 indexed jobId, address indexed payer, address indexed worker, uint256 amount, uint64 deadline)',
];

// Probe the RPC once at collection time so describe.skipIf() reflects real readiness.
let anvilUp = false;
try {
    const probe = new JsonRpcProvider(RPC_URL);
    await probe.getNetwork();
    anvilUp = true;
    probe.destroy();
} catch {
    anvilUp = false;
}

describe.skipIf(!anvilUp)('on-chain settlement — anvil integration (Phase 63 core)', () => {
    let provider: JsonRpcProvider;
    let escrowAddr: string;
    let treasuryAddr: string;
    let workerAddr: string;
    let settlement: OnchainSettlement;

    beforeAll(async () => {
        provider = new JsonRpcProvider(RPC_URL);
        // NonceManager serialises nonce allocation across the two back-to-back deploys — anvil's
        // pending-nonce can lag between an awaited waitForDeployment and the next deploy on a
        // persistent node, which otherwise races into a NONCE_EXPIRED.
        const deployer = new NonceManager(new Wallet(KEY_DEPLOYER, provider));
        const oracleAddr = new Wallet(KEY_ORACLE).address;
        const arbiterAddr = new Wallet(KEY_ARBITER).address;
        workerAddr = new Wallet(KEY_WORKER).address;

        // Deploy CivicTreasury(authorizer) then LaborEscrow(oracle, arbiter, treasury, feeBps, window).
        const treasuryArt = loadArtifact('CivicTreasury');
        const treasuryFactory = new ContractFactory(treasuryArt.abi, treasuryArt.bytecode.object, deployer);
        const treasury = await treasuryFactory.deploy(arbiterAddr);
        await treasury.waitForDeployment();
        treasuryAddr = await treasury.getAddress();

        const escrowArt = loadArtifact('LaborEscrow');
        const escrowFactory = new ContractFactory(escrowArt.abi, escrowArt.bytecode.object, deployer);
        const escrow = await escrowFactory.deploy(
            oracleAddr,
            arbiterAddr,
            treasuryAddr,
            FEE_BPS,
            DISPUTE_WINDOW,
        );
        await escrow.waitForDeployment();
        escrowAddr = await escrow.getAddress();

        // Instantiate the Grid client: relayer = acct0, oracle = acct2, flag on.
        settlement = new OnchainSettlement(
            loadOnchainSettlementConfig({
                GRID_ONCHAIN_SETTLEMENT_ENABLED: 'true',
                GRID_ONCHAIN_RPC_URL: RPC_URL,
                GRID_LABOR_ESCROW_ADDRESS: escrowAddr,
                GRID_CIVIC_TREASURY_ADDRESS: treasuryAddr,
                GRID_RELAYER_KEY: KEY_RELAYER,
                GRID_ORACLE_KEY: KEY_ORACLE,
            } as NodeJS.ProcessEnv),
        );
    }, 60_000);

    it('fund → oracle-attest → advance window → finalize pays worker (amount − fee) + treasury fee', async () => {
        const amount = parseEther('1');
        const fee = (amount * FEE_BPS) / 10_000n;
        const toWorker = amount - fee;

        // Payer (acct3) funds a job for the worker (acct4).
        const payer = new Wallet(KEY_PAYER, provider);
        const escrowIx = new Contract(escrowAddr, ESCROW_IX_ABI, payer);
        const latest = await provider.getBlock('latest');
        const deadline = BigInt(latest!.timestamp) + 1000n;
        const fundTx = await escrowIx.fundJob(workerAddr, deadline, { value: amount });
        const fundReceipt = await fundTx.wait();

        // Recover jobId from the JobFunded event.
        const iface = new Interface(ESCROW_IX_ABI);
        let jobId: bigint | null = null;
        for (const log of fundReceipt.logs) {
            const parsed = iface.parseLog(log);
            if (parsed?.name === 'JobFunded') {
                jobId = BigInt(parsed.args.jobId as bigint);
                break;
            }
        }
        expect(jobId).not.toBeNull();

        // Read balances via the raw eth_getBalance RPC (bypasses ethers' typed perform-cache,
        // which can otherwise serve a stale 'latest' balance right after a same-process mine).
        const balanceOf = async (addr: string): Promise<bigint> =>
            BigInt(await provider.send('eth_getBalance', [addr, 'latest']));
        const workerBefore = await balanceOf(workerAddr);
        const treasuryBefore = await balanceOf(treasuryAddr);

        // Grid oracle-signs + relayer-submits the attestation → opens the dispute window.
        const attest = await settlement.attestJobCompletion(jobId!);
        expect(attest.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
        expect((await settlement.getJob(jobId!)).state).toBe(2 /* Attested */);

        // Advance past the dispute window via anvil RPCs, then finalize.
        await provider.send('evm_increaseTime', [Number(DISPUTE_WINDOW) + 1]);
        await provider.send('evm_mine', []);
        const finalize = await settlement.finalizeJob(jobId!);
        expect(finalize.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);

        const workerAfter = await balanceOf(workerAddr);
        const treasuryAfter = await balanceOf(treasuryAddr);
        expect(workerAfter - workerBefore).toBe(toWorker);
        expect(treasuryAfter - treasuryBefore).toBe(fee);
        expect((await settlement.getJob(jobId!)).state).toBe(3 /* Released */);
    }, 60_000);

    it('disabled path: attestJobCompletion throws onchain_settlement_disabled and sends no tx', async () => {
        const disabled = new OnchainSettlement(loadOnchainSettlementConfig({} as NodeJS.ProcessEnv));
        expect(disabled.enabled).toBe(false);
        await expect(disabled.attestJobCompletion(1n)).rejects.toThrow('onchain_settlement_disabled');
        await expect(disabled.finalizeJob(1n)).rejects.toThrow('onchain_settlement_disabled');
    });
});
