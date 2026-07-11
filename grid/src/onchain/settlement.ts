/**
 * Phase 63 core (D-63-1/2/3) — on-chain settlement via oracle attestation + Grid relayer.
 *
 * Bridges an in-Grid completed job to the on-chain `LaborEscrow`: the Grid, as the completion
 * ORACLE, signs `completionDigest(jobId)` and the Grid RELAYER submits `attestCompletion`,
 * opening the dispute window; after the window, the relayer submits `finalize`, which pays the
 * worker (amount − fee) and routes the fee to `CivicTreasury`.
 *
 * ZERO CUSTODY (PHILOSOPHY §8 / D-63-1): this module holds ONLY the Grid's oracle key
 * (attestation authority) and relayer key (gas). It never takes custody of user funds — there
 * is no `transferFrom`, no allowance, no user-money movement here. The escrow contract + the
 * signatures/timeouts move funds; the Grid only attests and pays gas. The `grid/src` custody CI
 * ban stays green.
 *
 * OFF BY DEFAULT (D-63-3): behind GRID_ONCHAIN_SETTLEMENT_ENABLED. When disabled the ctor takes
 * no config and every method fails closed with `onchain_settlement_disabled` — no provider is
 * created, no wallet is loaded, no tx is sent.
 */
import {
    AbiCoder,
    Contract,
    getAddress,
    getBytes,
    JsonRpcProvider,
    keccak256,
    NonceManager,
    Wallet,
    type InterfaceAbi,
} from 'ethers';
import {
    loadOnchainSettlementConfig,
    type OnchainSettlementConfig,
} from './config.js';

/** Thrown by every method when the feature flag is off (fail-closed, no side effects). */
export class OnchainSettlementDisabledError extends Error {
    constructor() {
        super('onchain_settlement_disabled');
        this.name = 'OnchainSettlementDisabledError';
    }
}

/** LaborEscrow.State enum (mirrors the Solidity ordering). */
export enum JobState {
    None = 0,
    Funded = 1,
    Attested = 2,
    Released = 3,
    Refunded = 4,
    Disputed = 5,
}

/** A decoded on-chain job (subset used for assertions/observability). */
export interface OnchainJob {
    readonly payer: string;
    readonly worker: string;
    readonly amount: bigint;
    readonly deadline: bigint;
    readonly disputeDeadline: bigint;
    readonly state: JobState;
}

/** Minimal human-readable ABI for the calls this module makes (kept in sync with LaborEscrow.sol). */
const LABOR_ESCROW_ABI: InterfaceAbi = [
    'function attestCompletion(uint256 jobId, bytes oracleSig)',
    'function finalize(uint256 jobId)',
    'function jobs(uint256) view returns (address payer, address worker, uint256 amount, uint64 deadline, uint64 disputeDeadline, uint8 state)',
    'function completionDigest(uint256 jobId) view returns (bytes32)',
    'event JobAttested(uint256 indexed jobId, uint64 disputeDeadline)',
    'event JobReleased(uint256 indexed jobId, uint256 toWorker, uint256 fee)',
];

/**
 * On-chain settlement client. Construct disabled (no config) for the default off-path, or with an
 * explicit {@link OnchainSettlementConfig} (typically via {@link OnchainSettlement.fromEnv}).
 */
export class OnchainSettlement {
    private readonly provider: JsonRpcProvider | null;
    // The relayer is wrapped in a NonceManager: it submits txns sequentially (attest, later
    // finalize) and NonceManager tracks the nonce locally after one on-chain read, so rapid
    // back-to-back submissions never re-query a lagging `pending` count and collide (NONCE_EXPIRED).
    private readonly relayerSigner: NonceManager | null;
    private readonly oracleWallet: Wallet | null;
    private readonly escrow: Contract | null;
    private readonly escrowAddress: string | null;
    private chainId: bigint | null = null;

    constructor(private readonly config: OnchainSettlementConfig | null) {
        if (!config) {
            this.provider = null;
            this.relayerSigner = null;
            this.oracleWallet = null;
            this.escrow = null;
            this.escrowAddress = null;
            return;
        }
        this.provider = new JsonRpcProvider(config.rpcUrl);
        this.relayerSigner = new NonceManager(new Wallet(config.relayerKey, this.provider));
        this.oracleWallet = new Wallet(config.oracleKey, this.provider);
        this.escrowAddress = getAddress(config.laborEscrowAddress);
        this.escrow = new Contract(this.escrowAddress, LABOR_ESCROW_ABI, this.provider);
    }

    /** Build a client from the environment (off unless GRID_ONCHAIN_SETTLEMENT_ENABLED === 'true'). */
    static fromEnv(env: NodeJS.ProcessEnv = process.env): OnchainSettlement {
        return new OnchainSettlement(loadOnchainSettlementConfig(env));
    }

    /** Whether the feature flag is on and the client is wired. */
    get enabled(): boolean {
        return this.config !== null;
    }

    private requireEnabled(): {
        provider: JsonRpcProvider;
        relayerSigner: NonceManager;
        oracleWallet: Wallet;
        escrow: Contract;
        escrowAddress: string;
    } {
        if (
            !this.config ||
            !this.provider ||
            !this.relayerSigner ||
            !this.oracleWallet ||
            !this.escrow ||
            !this.escrowAddress
        ) {
            throw new OnchainSettlementDisabledError();
        }
        return {
            provider: this.provider,
            relayerSigner: this.relayerSigner,
            oracleWallet: this.oracleWallet,
            escrow: this.escrow,
            escrowAddress: this.escrowAddress,
        };
    }

    /** Resolve + cache the chain id (bound into the attestation digest). */
    private async getChainId(provider: JsonRpcProvider): Promise<bigint> {
        if (this.chainId === null) {
            this.chainId = (await provider.getNetwork()).chainId;
        }
        return this.chainId;
    }

    /**
     * Oracle-sign the completion digest for `jobId` and relayer-submit `attestCompletion`,
     * opening the dispute window. Does NOT pay the worker (that is {@link finalizeJob} after the
     * window). Returns the mined tx hash.
     *
     * Digest parity with LaborEscrow.completionDigest: the contract computes
     * `toEthSignedMessageHash(keccak256(abi.encode(chainid, address(this), jobId)))`; we compute
     * the same inner keccak and `signMessage(getBytes(inner))` — ethers' EIP-191 personal_sign
     * prefix is exactly `toEthSignedMessageHash`.
     */
    async attestJobCompletion(jobId: bigint): Promise<{ txHash: string }> {
        const { provider, relayerSigner, oracleWallet, escrow, escrowAddress } = this.requireEnabled();
        const chainId = await this.getChainId(provider);
        const inner = keccak256(
            AbiCoder.defaultAbiCoder().encode(
                ['uint256', 'address', 'uint256'],
                [chainId, escrowAddress, jobId],
            ),
        );
        const oracleSig = await oracleWallet.signMessage(getBytes(inner));
        const tx = await (escrow.connect(relayerSigner) as Contract).attestCompletion(jobId, oracleSig);
        const receipt = await tx.wait();
        return { txHash: receipt?.hash ?? tx.hash };
    }

    /**
     * Relayer-submit `finalize(jobId)` after the dispute window: pays the worker (amount − fee)
     * and routes the fee to CivicTreasury. Returns the mined tx hash.
     */
    async finalizeJob(jobId: bigint): Promise<{ txHash: string }> {
        const { relayerSigner, escrow } = this.requireEnabled();
        const tx = await (escrow.connect(relayerSigner) as Contract).finalize(jobId);
        const receipt = await tx.wait();
        return { txHash: receipt?.hash ?? tx.hash };
    }

    /** Read a job's on-chain state (for assertions/observability). */
    async getJob(jobId: bigint): Promise<OnchainJob> {
        const { escrow } = this.requireEnabled();
        const j = await escrow.jobs(jobId);
        return {
            payer: j.payer,
            worker: j.worker,
            amount: BigInt(j.amount),
            deadline: BigInt(j.deadline),
            disputeDeadline: BigInt(j.disputeDeadline),
            state: Number(j.state) as JobState,
        };
    }
}
