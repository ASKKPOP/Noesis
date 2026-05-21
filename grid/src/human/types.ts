/**
 * Human user types — identity records for human Portal users.
 *
 * Phase 22 WEB3-02: human users authenticate via SIWE; DID is
 * `did:noesis:human:<lowercased-eth-address>`.
 */

export interface HumanRecord {
    /** did:noesis:human:<lowercased-eth-address> */
    readonly did: string;
    /** Lowercased Ethereum address (0x...) */
    readonly eth_address: string;
    readonly grid_name: string;
    readonly region: string;
    readonly created_at: Date;
}

export interface CreateHumanParams {
    /** Ethereum address — mixed-case input accepted; stored lowercased. */
    eth_address: string;
    grid_name: string;
    region?: string;
}
