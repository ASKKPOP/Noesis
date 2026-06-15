// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CivicTreasury — per-Grid civic fund (D-MONEY-03)
/// @notice Accumulates transaction fees (in the canonical money, ETH/wei) and
///         disburses ONLY against a valid authorization signed by the Polis
///         authorizer — the on-chain successor to the v3.0 `verifyDisbursementAuth`
///         JWT (D-V3-21: Nous-only legislation; Henry cannot withdraw).
/// @dev    Zero-custody w.r.t. user funds: this holds civic money only, and moves
///         it solely on a Polis-signed authorization. No platform key can drain it.
///         Testnet-first (Sepolia). UNVERIFIED DRAFT — needs `forge test`.
contract CivicTreasury {
    /// @notice The Polis authorizer (elected Speaker key). Disbursements require its signature.
    address public immutable authorizer;

    /// @notice Consumed disbursement nonces (replay protection).
    mapping(uint256 => bool) public usedNonce;

    event FeeDeposited(address indexed from, uint256 amount);
    event Disbursed(address indexed to, uint256 amount, uint256 indexed nonce, bytes32 legislationRefHash);

    error ZeroAuthorizer();
    error NonceUsed();
    error BadSignature();
    error InsufficientBalance();
    error TransferFailed();

    constructor(address _authorizer) {
        if (_authorizer == address(0)) revert ZeroAuthorizer();
        authorizer = _authorizer;
    }

    /// @notice Pay a fee into the treasury (e.g. routed by LaborEscrow / Marketplace).
    function depositFee() external payable {
        emit FeeDeposited(msg.sender, msg.value);
    }

    /// @notice Bare transfers are treated as fee deposits.
    receive() external payable {
        emit FeeDeposited(msg.sender, msg.value);
    }

    /// @notice The message a Polis authorization must sign, bound to this contract + chain.
    function disbursementDigest(
        address to,
        uint256 amount,
        uint256 nonce,
        bytes32 legislationRefHash
    ) public view returns (bytes32) {
        bytes32 inner = keccak256(
            abi.encode(block.chainid, address(this), to, amount, nonce, legislationRefHash)
        );
        // EIP-191 personal-sign prefix.
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
    }

    /// @notice Disburse `amount` to `to`, authorized by a Polis-signed legislation reference.
    /// @param legislationRefHash hash of the enacting bill (the Grid keeps the plaintext off-chain).
    /// @param sig authorizer's signature over `disbursementDigest(...)`.
    function disburse(
        address to,
        uint256 amount,
        uint256 nonce,
        bytes32 legislationRefHash,
        bytes calldata sig
    ) external {
        if (usedNonce[nonce]) revert NonceUsed();
        if (address(this).balance < amount) revert InsufficientBalance();

        bytes32 digest = disbursementDigest(to, amount, nonce, legislationRefHash);
        if (_recover(digest, sig) != authorizer) revert BadSignature();

        usedNonce[nonce] = true;
        emit Disbursed(to, amount, nonce, legislationRefHash);

        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @dev Minimal ECDSA recover (65-byte r,s,v).
    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) revert BadSignature();
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
            revert BadSignature();
        }
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert BadSignature();
        return signer;
    }
}
