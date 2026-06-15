// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSALite} from "./lib/ECDSALite.sol";
import {IAccount, PackedUserOperation} from "./erc4337/IAccount.sol";

/// @title NousAccount — smart account with capped session keys (D-MONEY-02)
/// @notice Holds ETH for one holder: a Nous, a Group treasury, or a Holding. The
///         owner (the human wallet for Type A, the constitutional substrate key
///         for Type B, or a Group controller) may spend freely. A registered
///         session key — e.g. the Brain — spends autonomously up to a cap and
///         until an expiry, with no per-transaction human signature.
/// @dev    Zero-custody: no platform key exists; only the owner and its authorized
///         session keys move funds. Self-contained model — a session key is an EOA
///         that calls `execute` directly; full ERC-4337 EntryPoint/UserOp wiring is
///         a later refinement. Testnet-first. Verified with `forge test`.
contract NousAccount is IAccount {
    address public owner;
    /// @notice ERC-4337 EntryPoint (may be address(0) for non-4337 deployments).
    address public immutable entryPoint;

    uint256 private constant SIG_VALIDATION_FAILED = 1;

    struct SessionKey {
        uint128 cap;     // max total wei this key may spend
        uint128 spent;   // wei spent so far
        uint64  expiry;  // unix ts; key invalid at/after this
        bool    active;
    }

    mapping(address => SessionKey) public sessionKeys;

    event OwnerChanged(address indexed prevOwner, address indexed newOwner);
    event SessionKeyRegistered(address indexed key, uint128 cap, uint64 expiry);
    event SessionKeyRevoked(address indexed key);
    event Executed(address indexed by, address indexed to, uint256 value);

    error NotOwner();
    error NotAuthorized();
    error BadParams();
    error CapExceeded();
    error KeyExpired();
    error CallFailed();
    error NotEntryPoint();

    constructor(address _owner, address _entryPoint) {
        if (_owner == address(0)) revert BadParams();
        owner = _owner;
        entryPoint = _entryPoint;
    }

    receive() external payable {}

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert BadParams();
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Authorize `key` to spend up to `cap` wei until `expiry`.
    function registerSessionKey(address key, uint128 cap, uint64 expiry) external onlyOwner {
        if (key == address(0) || cap == 0 || expiry <= block.timestamp) revert BadParams();
        sessionKeys[key] = SessionKey({cap: cap, spent: 0, expiry: expiry, active: true});
        emit SessionKeyRegistered(key, cap, expiry);
    }

    function revokeSessionKey(address key) external onlyOwner {
        sessionKeys[key].active = false;
        emit SessionKeyRevoked(key);
    }

    /// @notice Remaining spend allowance for a session key (0 if inactive/expired).
    function remaining(address key) external view returns (uint256) {
        SessionKey storage sk = sessionKeys[key];
        if (!sk.active || block.timestamp >= sk.expiry || sk.spent >= sk.cap) return 0;
        return sk.cap - sk.spent;
    }

    /// @notice Execute a call from this account. Owner is unrestricted; a session
    ///         key is bounded by its remaining cap and expiry.
    function execute(address to, uint256 value, bytes calldata data)
        external
        returns (bytes memory result)
    {
        if (msg.sender != owner && msg.sender != entryPoint) {
            SessionKey storage sk = sessionKeys[msg.sender];
            if (!sk.active) revert NotAuthorized();
            if (block.timestamp >= sk.expiry) revert KeyExpired();
            uint256 newSpent = uint256(sk.spent) + value;
            if (newSpent > sk.cap) revert CapExceeded();
            sk.spent = uint128(newSpent); // effects before interaction
        }
        emit Executed(msg.sender, to, value);
        (bool ok, bytes memory ret) = to.call{value: value}(data);
        if (!ok) revert CallFailed();
        return ret;
    }

    // ── ERC-4337 ────────────────────────────────────────────────────────────────

    /// @notice EntryPoint validation. An owner-signed op validates unconditionally;
    ///         a session-key-signed op must call `execute` and is bounded by the
    ///         key's remaining cap (accounted here) and its expiry (returned as
    ///         `validUntil` for the EntryPoint to enforce). Execution then runs via
    ///         the EntryPoint calling `execute` (which trusts this accounting).
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        if (msg.sender != entryPoint) revert NotEntryPoint();

        address signer = ECDSALite.recover(ECDSALite.toEthSignedMessageHash(userOpHash), userOp.signature);

        if (signer == owner) {
            validationData = 0; // success, no time bound
        } else {
            SessionKey storage sk = sessionKeys[signer];
            if (signer == address(0) || !sk.active || block.timestamp >= sk.expiry) {
                validationData = SIG_VALIDATION_FAILED;
            } else {
                uint256 spend = _executeValue(userOp.callData);
                uint256 newSpent = uint256(sk.spent) + spend;
                if (spend == type(uint256).max || newSpent > sk.cap) {
                    validationData = SIG_VALIDATION_FAILED;
                } else {
                    sk.spent = uint128(newSpent);
                    validationData = uint256(sk.expiry) << 160; // success + validUntil
                }
            }
        }

        if (missingAccountFunds > 0) {
            (bool ok, ) = msg.sender.call{value: missingAccountFunds}("");
            ok; // a failed prefund is the EntryPoint's concern (ERC-4337)
        }
    }

    /// @dev The wei value of an `execute(address,uint256,bytes)` callData, or
    ///      type(uint256).max if `callData` is not an execute call (so it is rejected).
    function _executeValue(bytes calldata callData) private pure returns (uint256) {
        if (callData.length < 4 || bytes4(callData[:4]) != NousAccount.execute.selector) {
            return type(uint256).max;
        }
        (, uint256 value, ) = abi.decode(callData[4:], (address, uint256, bytes));
        return value;
    }
}
