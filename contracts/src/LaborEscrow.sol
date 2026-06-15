// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICivicTreasury {
    function depositFee() external payable;
}

/// @title LaborEscrow — per-job inter-Nous settlement (D-MONEY-02)
/// @notice A payer funds a job in ETH; the worker is paid when the Grid (the
///         completion oracle) attests "done", with the civic fee routed to the
///         treasury. If no attestation arrives by the deadline, the payer reclaims
///         the funds. The Grid never holds the funds — only this contract does,
///         released solely on the oracle's signature or the timeout.
/// @dev    Testnet-first (Sepolia). Verified with `forge test`.
contract LaborEscrow {
    enum State { None, Funded, Released, Refunded }

    struct Job {
        address payer;
        address payable worker;
        uint256 amount;     // total escrowed (worker payout + fee)
        uint64  deadline;   // unix ts; after this the payer may refund
        State   state;
    }

    /// @notice Grid completion-oracle address (signs "job done" attestations).
    address public immutable oracle;
    /// @notice Civic treasury that receives the fee.
    address payable public immutable treasury;
    /// @notice Fee in basis points (e.g. 200 = 2%).
    uint16 public immutable feeBps;

    uint256 public nextJobId = 1;
    mapping(uint256 => Job) public jobs;

    event JobFunded(uint256 indexed jobId, address indexed payer, address indexed worker, uint256 amount, uint64 deadline);
    event JobReleased(uint256 indexed jobId, uint256 toWorker, uint256 fee);
    event JobRefunded(uint256 indexed jobId, uint256 amount);

    error BadParams();
    error NotFunded();
    error NotPayer();
    error DeadlinePassed();
    error DeadlineNotReached();
    error BadSignature();
    error TransferFailed();

    constructor(address _oracle, address payable _treasury, uint16 _feeBps) {
        if (_oracle == address(0) || _treasury == address(0) || _feeBps > 10_000) revert BadParams();
        oracle = _oracle;
        treasury = _treasury;
        feeBps = _feeBps;
    }

    /// @notice Fund a new job for `worker`, reclaimable after `deadline`.
    function fundJob(address payable worker, uint64 deadline) external payable returns (uint256 jobId) {
        if (worker == address(0) || msg.value == 0 || deadline <= block.timestamp) revert BadParams();
        jobId = nextJobId++;
        jobs[jobId] = Job({payer: msg.sender, worker: worker, amount: msg.value, deadline: deadline, state: State.Funded});
        emit JobFunded(jobId, msg.sender, worker, msg.value, deadline);
    }

    /// @notice Digest the oracle signs to attest completion (bound to chain + contract + job).
    function completionDigest(uint256 jobId) public view returns (bytes32) {
        bytes32 inner = keccak256(abi.encode(block.chainid, address(this), jobId));
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
    }

    /// @notice Release a funded job to the worker on the oracle's completion attestation.
    function confirmCompletion(uint256 jobId, bytes calldata oracleSig) external {
        Job storage j = jobs[jobId];
        if (j.state != State.Funded) revert NotFunded();
        if (block.timestamp > j.deadline) revert DeadlinePassed();
        if (_recover(completionDigest(jobId), oracleSig) != oracle) revert BadSignature();

        uint256 fee = (j.amount * feeBps) / 10_000;
        uint256 toWorker = j.amount - fee;
        j.state = State.Released;
        emit JobReleased(jobId, toWorker, fee);

        if (fee > 0) ICivicTreasury(treasury).depositFee{value: fee}();
        (bool ok, ) = j.worker.call{value: toWorker}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice After the deadline, the payer reclaims an unreleased job.
    function refund(uint256 jobId) external {
        Job storage j = jobs[jobId];
        if (j.state != State.Funded) revert NotFunded();
        if (msg.sender != j.payer) revert NotPayer();
        if (block.timestamp <= j.deadline) revert DeadlineNotReached();

        uint256 amount = j.amount;
        j.state = State.Refunded;
        emit JobRefunded(jobId, amount);

        (bool ok, ) = j.payer.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

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
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert BadSignature();
        }
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert BadSignature();
        return signer;
    }
}
