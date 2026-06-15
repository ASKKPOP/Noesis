// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ERC-4337 v0.7 packed user operation.
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

/// @notice ERC-4337 v0.7 account validation interface (the EntryPoint calls this).
interface IAccount {
    /// @return validationData packed `authorizer(160) | validUntil(48) | validAfter(48)`;
    ///         authorizer 0 = success, 1 = signature failure.
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}
