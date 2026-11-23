export const HEX64_RE = /^[0-9a-f]{64}$/i;

export const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export const NOESIS_DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
export const NOESIS_DID_WITH_COLONS_RE = /^did:noesis:[a-z0-9_:\-]+$/i;
export const NOESIS_DID_CASE_SENSITIVE_PREFIX_RE = /^did:noesis:[a-zA-Z0-9_\-]+$/;
export const NOUS_OR_SYSTEM_DID_RE = /^did:noesis:(nous:[a-z0-9_\-]+|sophia|hermes|themis)$/i;
export const NOUS_OR_SYSTEM_DID_WITH_COLONS_RE = /^did:noesis:(nous:[a-z0-9_:\-]+|sophia|hermes|themis)$/i;
export const HUMAN_DID_RE = /^did:noesis:human:[a-z0-9_:\-]+$/i;

export const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
export const CIVIC_HUMAN_DID_PREFIX_RE = /^did:civic:noesis:human:/i;
export const NOESIS_OR_CIVIC_DID_RE = /^did:(?:civic:)?noesis:[a-z0-9_:\-]+$/i;
export const NOESIS_OR_CIVIC_KIND_DID_RE = /^did:(?:noesis|civic):[a-z0-9_:\-]+$/i;
export const BIZ_DID_RE = /^did:biz:noesis:[a-z0-9_:\-]+$/i;
export const ANY_KIND_NOESIS_DID_RE = /^did:[a-z0-9]+:noesis:[a-z0-9_:\-]+$/i;
