// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ECDSALite — minimal signature recovery shared by the money contracts.
/// @dev Returns address(0) on any malformed/invalid signature (length, high-s per
///      EIP-2, or a zero ecrecover) so each caller reverts with its OWN error after
///      comparing against the expected signer. No reverts here.
library ECDSALite {
    /// @notice EIP-191 personal-sign digest of a 32-byte hash.
    function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    /// @notice Recover the signer of `digest` from a 65-byte (r,s,v) signature, or
    ///         address(0) if the signature is malformed or invalid.
    function recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        // Reject malleable high-s per EIP-2.
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return address(0);
        }
        return ecrecover(digest, v, r, s);
    }
}
