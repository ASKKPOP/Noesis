// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAccount, PackedUserOperation} from "../../src/erc4337/IAccount.sol";

/// @dev Minimal ERC-4337 EntryPoint stand-in for tests: validate then execute.
contract MockEntryPoint {
    error SigFail();
    error Expired();
    error ExecFail();

    function handleOp(address account, PackedUserOperation calldata op, bytes32 userOpHash) external {
        uint256 vd = IAccount(account).validateUserOp(op, userOpHash, 0);
        if ((vd & type(uint160).max) == 1) revert SigFail();
        uint64 validUntil = uint64(vd >> 160);
        if (validUntil != 0 && block.timestamp > validUntil) revert Expired();
        (bool ok, ) = account.call(op.callData);
        if (!ok) revert ExecFail();
    }
}
