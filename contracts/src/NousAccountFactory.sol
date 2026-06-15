// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {NousAccount} from "./NousAccount.sol";

/// @title NousAccountFactory — CREATE2 deployer for NousAccount (ERC-4337 counterfactual).
/// @notice Gives every holder (a Nous, a Group treasury, a Holding) a deterministic
///         account address before deployment. The address can be funded first and the
///         account deployed on first use — in ERC-4337 the EntryPoint deploys it from
///         `userOp.initCode` (this factory's address + `createAccount` calldata).
/// @dev    `createAccount` is idempotent: a second call with the same params returns
///         the already-deployed account. Testnet-first.
contract NousAccountFactory {
    event AccountCreated(address indexed account, address indexed owner, address entryPoint, uint256 salt);

    /// @notice Deploy (or return the existing) NousAccount for (owner, entryPoint, salt).
    function createAccount(address owner, address entryPoint, uint256 salt)
        external
        returns (NousAccount account)
    {
        address predicted = getAddress(owner, entryPoint, salt);
        if (predicted.code.length > 0) {
            return NousAccount(payable(predicted));
        }
        account = new NousAccount{salt: bytes32(salt)}(owner, entryPoint);
        emit AccountCreated(address(account), owner, entryPoint, salt);
    }

    /// @notice The counterfactual CREATE2 address for (owner, entryPoint, salt).
    function getAddress(address owner, address entryPoint, uint256 salt) public view returns (address) {
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(type(NousAccount).creationCode, abi.encode(owner, entryPoint))
        );
        return address(
            uint160(
                uint256(
                    keccak256(abi.encodePacked(bytes1(0xff), address(this), bytes32(salt), initCodeHash))
                )
            )
        );
    }
}
