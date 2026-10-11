// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {LevelConfig} from "./generated/LevelConfig.sol";
import {RunnerSim} from "./RunnerSim.sol";

/// @title GhostSprint — onchain speedrun verification, leaderboard and ghost data
/// @notice Players submit a recorded input log for the "Ghost Sprint" level.
///         The contract re-simulates the entire run with deterministic integer
///         physics (RunnerSim) against the generated level configuration
///         (LevelConfig) and only records runs that genuinely reach the goal.
///
///         Security model:
///           - No caller-supplied completion time: the time is computed from the
///             contract's own simulation (`ticks * 1000 / TICK_RATE`).
///           - No owner/admin: there is no privileged role able to assign, edit
///             or override any recorded time. The contract is fully permissionless.
///           - No signatures, no trusted backend: the contract is the sole judge.
///           - Input logs are length-checked BEFORE any simulation work and
///             byte-validated before the first tick.
///           - Personal bests improve strictly only (`timeMs < previous`, with
///             `previous == 0` meaning "no best yet").
///           - Only fully completed runs are written to storage; failed
///             submissions revert and persist nothing.
contract GhostSprint {
    /// @notice Maximum number of input ticks accepted for one run.
    uint256 public constant MAX_INPUT_LENGTH = LevelConfig.MAX_INPUT_LENGTH;

    /// @notice Tick rate of the deterministic simulation (ticks per second).
    uint256 public constant TICK_RATE = LevelConfig.TICK_RATE;

    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    struct Run {
        address player;
        uint64 tick; // completion tick, from the contract simulation
        uint64 timeMs; // authoritative time, from the contract simulation
        uint64 submittedAt; // block timestamp (metadata only, never used for time)
        uint32 inputLength;
        bytes32 inputsHash; // keccak256 of the stored input log
    }

    /// @dev Convenience projection used by the paged read API.
    struct RunView {
        uint256 runId;
        address player;
        uint64 tick;
        uint64 timeMs;
        uint64 submittedAt;
        uint32 inputLength;
        bytes32 inputsHash;
    }

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error EmptyInputLog();
    error InputLogTooLong(uint256 length, uint256 maxLength);
    error InvalidInputByte(uint256 tick, uint8 inputByte);
    error RunNotVerified(uint8 status, uint256 ticks);
    error UnknownRun(uint256 runId);
    error ChunkOutOfBounds(uint256 offset, uint256 length);

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    /// @notice Emitted for every verified run. `inputs` is the complete input
    ///         log, so the run can be replayed from chain logs alone.
    event RunVerified(
        uint256 indexed runId,
        address indexed player,
        uint64 tick,
        uint64 timeMs,
        uint32 inputLength,
        bytes inputs
    );

    /// @notice Emitted when a player's personal best improves (strictly faster).
    event PersonalBestImproved(
        address indexed player, uint256 indexed runId, uint64 previousTimeMs, uint64 newTimeMs
    );

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    Run[] private _runs; // runId = index + 1 (runId 0 means "no run")
    mapping(uint256 runId => bytes) private _inputs;

    /// @notice Personal best time in milliseconds for a player (0 = none).
    mapping(address player => uint256) public bestTime;

    /// @notice runId of the run that set the personal best (0 = none).
    mapping(address player => uint256) public bestRunId;

    /// @notice Number of verified runs submitted by a player.
    mapping(address player => uint256) public playerRunCount;

    // ------------------------------------------------------------------
    // Writes
    // ------------------------------------------------------------------

    /// @notice Verify a run by fully re-simulating it onchain and record it if
    ///         the player genuinely reached the goal.
    /// @param inputs One uint8 per tick (see LevelConfig input encoding).
    ///               Never contains a completion time — the contract derives it.
    /// @return runId Unique 1-based identifier of the recorded run.
    function submitRun(bytes calldata inputs) external returns (uint256 runId) {
        // ---- cheap bounds checks on calldata, before any simulation work ----
        uint256 len = inputs.length;
        if (len == 0) revert EmptyInputLog();
        if (len > MAX_INPUT_LENGTH) revert InputLogTooLong(len, MAX_INPUT_LENGTH);
        for (uint256 i = 0; i < len; i++) {
            uint8 b = uint8(inputs[i]);
            if (!RunnerSim.isValidInputByte(b)) revert InvalidInputByte(i, b);
        }

        // ---- full deterministic simulation (the contract is the judge) ----
        RunnerSim.RunOutcome memory out = RunnerSim.run(inputs);
        if (out.status != RunnerSim.Status.Won) {
            revert RunNotVerified(uint8(out.status), out.ticks);
        }

        uint64 tick = uint64(out.ticks);
        // ticks <= MAX_INPUT_LENGTH, so this cast is always safe.
        uint64 timeMs = uint64(RunnerSim.timeMsFromTicks(out.ticks));

        // ---- record only after verification succeeded (no partial writes) ----
        _runs.push(
            Run({
                player: msg.sender,
                tick: tick,
                timeMs: timeMs,
                submittedAt: uint64(block.timestamp),
                inputLength: uint32(len),
                inputsHash: keccak256(inputs)
            })
        );
        runId = _runs.length;
        _inputs[runId] = inputs;
        playerRunCount[msg.sender] += 1;

        emit RunVerified(runId, msg.sender, tick, timeMs, uint32(len), inputs);

        uint256 previous = bestTime[msg.sender];
        if (previous == 0 || timeMs < previous) {
            bestTime[msg.sender] = timeMs;
            bestRunId[msg.sender] = runId;
            emit PersonalBestImproved(msg.sender, runId, uint64(previous), timeMs);
        }
    }

    // ------------------------------------------------------------------
    // Reads — run records
    // ------------------------------------------------------------------

    /// @notice Number of verified runs recorded so far.
    function runCount() external view returns (uint256) {
        return _runs.length;
    }

    /// @notice Metadata for a single verified run. Reverts for unknown ids.
    function getRun(uint256 runId) external view returns (Run memory) {
        if (runId == 0 || runId > _runs.length) revert UnknownRun(runId);
        return _runs[runId - 1];
    }

    /// @notice Paged enumeration of run records (leaderboard discovery).
    /// @param offset 0-based index into the run list (not the runId).
    /// @param limit  Maximum number of entries returned (bounded by runCount).
    function getRuns(uint256 offset, uint256 limit) external view returns (RunView[] memory page) {
        uint256 total = _runs.length;
        if (offset >= total || limit == 0) return new RunView[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new RunView[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            Run storage r = _runs[i];
            page[i - offset] = RunView({
                runId: i + 1,
                player: r.player,
                tick: r.tick,
                timeMs: r.timeMs,
                submittedAt: r.submittedAt,
                inputLength: r.inputLength,
                inputsHash: r.inputsHash
            });
        }
    }

    // ------------------------------------------------------------------
    // Reads — ghost input logs
    // ------------------------------------------------------------------

    /// @notice Complete input log of a verified run (for ghost replay).
    function getRunInputs(uint256 runId) external view returns (bytes memory) {
        if (runId == 0 || runId > _runs.length) revert UnknownRun(runId);
        return _inputs[runId];
    }

    /// @notice Length of a stored input log without copying the whole log.
    function getRunInputsLength(uint256 runId) external view returns (uint256) {
        if (runId == 0 || runId > _runs.length) revert UnknownRun(runId);
        return _inputs[runId].length;
    }

    /// @notice Bounded chunk read for cheap frontend reconstruction of a log.
    function getRunInputsChunk(uint256 runId, uint256 offset, uint256 len)
        external
        view
        returns (bytes memory chunk)
    {
        if (runId == 0 || runId > _runs.length) revert UnknownRun(runId);
        bytes storage all = _inputs[runId];
        uint256 total = all.length;
        if (offset > total || offset + len > total) {
            revert ChunkOutOfBounds(offset + len, total);
        }
        chunk = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            chunk[i] = all[offset + i];
        }
    }

    // ------------------------------------------------------------------
    // Reads — configuration & transparency
    // ------------------------------------------------------------------

    /// @notice Identifier of the level this contract verifies against.
    function levelId() external pure returns (string memory) {
        return LevelConfig.LEVEL_ID;
    }

    /// @notice The authoritative time formula, exposed for transparency:
    ///         trunc(ticks * 1000 / TICK_RATE).
    function computeTimeMs(uint256 ticks) external pure returns (uint256) {
        return RunnerSim.timeMsFromTicks(ticks);
    }

    /// @notice Contract version string.
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}
