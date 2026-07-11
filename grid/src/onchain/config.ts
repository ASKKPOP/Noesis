/**
 * Phase 63 (D-63-3) — on-chain settlement feature configuration.
 *
 * Off by default. All on-chain settlement is gated behind GRID_ONCHAIN_SETTLEMENT_ENABLED
 * (mirrors GRID_ENDOWMENT_ENABLED): when the flag is not exactly 'true' the loader returns
 * `null` and every OnchainSettlement method fails closed with `onchain_settlement_disabled`
 * (no provider, no wallet, no tx). This keeps the on-chain path a no-op in every environment
 * that has not explicitly opted in (Sepolia deploy is the operator's, later — D-63-3).
 *
 * ZERO CUSTODY (D-63-1): the config carries only the Grid's own operational keys — the
 * ORACLE key (attestation-signing authority) and the RELAYER key (pays gas). Neither holds
 * user funds; the module never takes custody of, approves, or transfers user money.
 */

/** The env vars that drive on-chain settlement. All required when the flag is on. */
export interface OnchainSettlementConfig {
    /** JSON-RPC endpoint of the target chain (local anvil first; Sepolia later). */
    readonly rpcUrl: string;
    /** Deployed LaborEscrow address. */
    readonly laborEscrowAddress: string;
    /** Deployed CivicTreasury address (fee sink; used for observability/assertions). */
    readonly civicTreasuryAddress: string;
    /** Relayer EOA private key — submits txns + pays gas (D-63-2). Never holds user funds. */
    readonly relayerKey: string;
    /** Oracle EOA private key — signs completion attestations (D-63-1). Never holds user funds. */
    readonly oracleKey: string;
}

/** Raised when the flag is on but a required env var is missing (misconfiguration, not disabled). */
export class OnchainSettlementConfigError extends Error {}

const REQUIRED: Array<[keyof OnchainSettlementConfig, string]> = [
    ['rpcUrl', 'GRID_ONCHAIN_RPC_URL'],
    ['laborEscrowAddress', 'GRID_LABOR_ESCROW_ADDRESS'],
    ['civicTreasuryAddress', 'GRID_CIVIC_TREASURY_ADDRESS'],
    ['relayerKey', 'GRID_RELAYER_KEY'],
    ['oracleKey', 'GRID_ORACLE_KEY'],
];

/**
 * Build the settlement config from the environment, or `null` when the feature is disabled.
 *
 * Returns `null` unless GRID_ONCHAIN_SETTLEMENT_ENABLED === 'true'. When the flag is on but a
 * required var is missing, throws {@link OnchainSettlementConfigError} (a live misconfiguration
 * must be loud — it is NOT the same as the intentional off state).
 */
export function loadOnchainSettlementConfig(
    env: NodeJS.ProcessEnv = process.env,
): OnchainSettlementConfig | null {
    if (env.GRID_ONCHAIN_SETTLEMENT_ENABLED !== 'true') return null;

    const missing: string[] = [];
    const partial: Partial<Record<keyof OnchainSettlementConfig, string>> = {};
    for (const [field, name] of REQUIRED) {
        const v = env[name];
        if (typeof v !== 'string' || v.trim() === '') {
            missing.push(name);
        } else {
            partial[field] = v.trim();
        }
    }
    if (missing.length > 0) {
        throw new OnchainSettlementConfigError(
            `onchain_settlement_misconfigured: missing ${missing.join(', ')}`,
        );
    }
    return {
        rpcUrl: partial.rpcUrl!,
        laborEscrowAddress: partial.laborEscrowAddress!,
        civicTreasuryAddress: partial.civicTreasuryAddress!,
        relayerKey: partial.relayerKey!,
        oracleKey: partial.oracleKey!,
    };
}
