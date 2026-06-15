// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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
contract NousAccount {
    address public owner;

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

    constructor(address _owner) {
        if (_owner == address(0)) revert BadParams();
        owner = _owner;
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
        if (msg.sender != owner) {
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
}
