/**
 * Human user types — identity records for human Portal users.
 *
 * Phase 22 WEB3-02: human users authenticate via SIWE; DID is
 * `did:noesis:human:<lowercased-eth-address>`.
 */

export interface HumanRecord {
    /** did:noesis:human:<lowercased-eth-address> or did:noesis:human:email:<uuid> */
    readonly did: string;
    /** Lowercased Ethereum address (0x...) — null for email-only users. */
    readonly eth_address: string | null;
    /** Email address — null for SIWE-only users. */
    readonly email: string | null;
    readonly grid_name: string;
    readonly region: string;
    readonly created_at: Date;
}

export interface CreateHumanParams {
    /** Ethereum address — mixed-case input accepted; stored lowercased. Omit for email-only users. */
    eth_address?: string | null;
    /** Email address — omit for SIWE-only users. */
    email?: string | null;
    /** Hashed password (scrypt) — only set for email auth users. */
    password_hash?: string | null;
    grid_name: string;
    region?: string;
}
