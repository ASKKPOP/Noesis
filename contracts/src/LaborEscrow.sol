// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSALite} from "./lib/ECDSALite.sol";

interface ICivicTreasury {
    function depositFee() external payable;
}

/// @title LaborEscrow — per-job inter-Nous settlement with a dispute window (D-MONEY-02)
/// @notice A payer funds a job in ETH. The Grid (the completion **oracle**) attests "done",
///         which opens a **dispute window**: if no one challenges, anyone may `finalize` and
///         the worker is paid (the civic fee routes to the treasury); if the payer challenges
///         a bad attestation within the window, a separate **arbiter** (the Polis/court — never
///         the attesting oracle) resolves it to the worker or back to the payer. If the job is
///         never attested by its deadline, the payer reclaims the funds.
/// @dev    Zero-custody — only this contract + the oracle/arbiter signatures or the timeout move
///         funds; the Grid never holds them. Testnet-first. Verified with `forge test`.
contract LaborEscrow {
    enum State { None, Funded, Attested, Released, Refunded, Disputed }

    struct Job {
        address payer;
        address payable worker;
        uint256 amount;          // total escrowed (worker payout + fee)
        uint64  deadline;        // fund-by deadline; after it an un-attested job is refundable
        uint64  disputeDeadline; // set on attestation; after it an un-disputed job is finalizable
        State   state;
    }

    /// @notice Grid completion-oracle (signs "job done" attestations).
    address public immutable oracle;
    /// @notice Dispute arbiter — the Polis/court; resolves a challenged attestation.
    address public immutable arbiter;
    /// @notice Civic treasury that receives the fee.
    address payable public immutable treasury;
    /// @notice Fee in basis points (e.g. 200 = 2%).
    uint16 public immutable feeBps;
    /// @notice Seconds after an attestation before the job may be finalized.
    uint64 public immutable disputeWindow;

    uint256 public nextJobId = 1;
    mapping(uint256 => Job) public jobs;

    event JobFunded(uint256 indexed jobId, address indexed payer, address indexed worker, uint256 amount, uint64 deadline);
    event JobAttested(uint256 indexed jobId, uint64 disputeDeadline);
    event JobReleased(uint256 indexed jobId, uint256 toWorker, uint256 fee);
    event JobRefunded(uint256 indexed jobId, uint256 amount);
    event JobDisputed(uint256 indexed jobId, address indexed by);
    event JobResolved(uint256 indexed jobId, bool toWorker);

    error BadParams();
    error WrongState();
    error NotPayer();
    error DeadlinePassed();
    error DeadlineNotReached();
    error WindowClosed();
    error WindowOpen();
    error BadSignature();
    error TransferFailed();

    constructor(
        address _oracle,
        address _arbiter,
        address payable _treasury,
        uint16 _feeBps,
        uint64 _disputeWindow
    ) {
        if (_oracle == address(0) || _arbiter == address(0) || _treasury == address(0) || _feeBps > 10_000) {
            revert BadParams();
        }
        oracle = _oracle;
        arbiter = _arbiter;
        treasury = _treasury;
        feeBps = _feeBps;
        disputeWindow = _disputeWindow;
    }

    /// @notice Fund a new job for `worker`, reclaimable after `deadline` if never attested.
    function fundJob(address payable worker, uint64 deadline) external payable returns (uint256 jobId) {
        if (worker == address(0) || msg.value == 0 || deadline <= block.timestamp) revert BadParams();
        jobId = nextJobId++;
        jobs[jobId] = Job({
            payer: msg.sender,
            worker: worker,
            amount: msg.value,
            deadline: deadline,
            disputeDeadline: 0,
            state: State.Funded
        });
        emit JobFunded(jobId, msg.sender, worker, msg.value, deadline);
    }

    /// @notice Digest the oracle signs to attest completion (bound to chain + contract + job).
    function completionDigest(uint256 jobId) public view returns (bytes32) {
        return ECDSALite.toEthSignedMessageHash(keccak256(abi.encode(block.chainid, address(this), jobId)));
    }

    /// @notice Oracle attests completion → opens the dispute window (does NOT pay yet).
    function attestCompletion(uint256 jobId, bytes calldata oracleSig) external {
        Job storage j = jobs[jobId];
        if (j.state != State.Funded) revert WrongState();
        if (block.timestamp > j.deadline) revert DeadlinePassed();
        if (ECDSALite.recover(completionDigest(jobId), oracleSig) != oracle) revert BadSignature();

        j.state = State.Attested;
        j.disputeDeadline = uint64(block.timestamp) + disputeWindow;
        emit JobAttested(jobId, j.disputeDeadline);
    }

    /// @notice After the dispute window passes with no challenge, pay the worker.
    function finalize(uint256 jobId) external {
        Job storage j = jobs[jobId];
        if (j.state != State.Attested) revert WrongState();
        if (block.timestamp < j.disputeDeadline) revert WindowOpen();
        _release(jobId, j);
    }

    /// @notice The payer challenges a bad attestation within the dispute window.
    function disputeAttestation(uint256 jobId) external {
        Job storage j = jobs[jobId];
        if (j.state != State.Attested) revert WrongState();
        if (msg.sender != j.payer) revert NotPayer();
        if (block.timestamp >= j.disputeDeadline) revert WindowClosed();
        j.state = State.Disputed;
        emit JobDisputed(jobId, msg.sender);
    }

    /// @notice Digest the arbiter signs to resolve a dispute toward the worker or the payer.
    function resolutionDigest(uint256 jobId, bool toWorker) public view returns (bytes32) {
        return ECDSALite.toEthSignedMessageHash(
            keccak256(abi.encode(block.chainid, address(this), jobId, toWorker))
        );
    }

    /// @notice The arbiter resolves a disputed job — pay the worker, or refund the payer.
    function resolveDispute(uint256 jobId, bool toWorker, bytes calldata arbiterSig) external {
        Job storage j = jobs[jobId];
        if (j.state != State.Disputed) revert WrongState();
        if (ECDSALite.recover(resolutionDigest(jobId, toWorker), arbiterSig) != arbiter) revert BadSignature();
        emit JobResolved(jobId, toWorker);
        if (toWorker) {
            _release(jobId, j);
        } else {
            _refund(jobId, j);
        }
    }

    /// @notice After the deadline, the payer reclaims a job that was never attested.
    function refund(uint256 jobId) external {
        Job storage j = jobs[jobId];
        if (j.state != State.Funded) revert WrongState();
        if (msg.sender != j.payer) revert NotPayer();
        if (block.timestamp <= j.deadline) revert DeadlineNotReached();
        _refund(jobId, j);
    }

    function _release(uint256 jobId, Job storage j) private {
        uint256 fee = (j.amount * feeBps) / 10_000;
        uint256 toWorker = j.amount - fee;
        j.state = State.Released;
        emit JobReleased(jobId, toWorker, fee);
        if (fee > 0) ICivicTreasury(treasury).depositFee{value: fee}();
        (bool ok, ) = j.worker.call{value: toWorker}("");
        if (!ok) revert TransferFailed();
    }

    function _refund(uint256 jobId, Job storage j) private {
        uint256 amount = j.amount;
        j.state = State.Refunded;
        emit JobRefunded(jobId, amount);
        (bool ok, ) = j.payer.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
