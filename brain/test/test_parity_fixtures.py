"""R0 contract freeze (D-V3-42): the recorded parity fixtures replay green against the
Python Brain. These JSON files are what the Rust Brain must reproduce exactly, so a
failure here means the Python behaviour moved — fix the regression, or, if the change is
intended, re-record with ``python -m scripts.record_parity_fixtures`` and review the diff.
"""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from scripts.record_parity_fixtures import FIXTURE_DIR, FIXTURES, build, serialize  # noqa: E402


@pytest.mark.parametrize("name", sorted(FIXTURES))
def test_fixture_replays_exactly(name: str) -> None:
    recorded = json.loads((FIXTURE_DIR / f"{name}.json").read_text(encoding="utf-8"))
    # Round-trip the live result through JSON so both sides are plain JSON values;
    # floats survive exactly (shortest round-trip form).
    live = json.loads(serialize(build(name)))
    assert live == recorded


@pytest.mark.parametrize("name", sorted(FIXTURES))
def test_fixture_file_is_byte_identical_to_a_fresh_recording(name: str) -> None:
    assert (FIXTURE_DIR / f"{name}.json").read_text(encoding="utf-8") == serialize(build(name))


def test_no_stray_or_missing_fixture_files() -> None:
    assert sorted(p.stem for p in FIXTURE_DIR.glob("*.json")) == sorted(FIXTURES)


def test_fixtures_exercise_the_behaviour_they_claim() -> None:
    """Guards against a fixture that replays green because it records nothing."""
    bios = json.loads((FIXTURE_DIR / "bios.json").read_text(encoding="utf-8"))
    by_name = {t["name"]: t for t in bios["trajectories"]}
    assert by_name["from_initial_state"]["crossings"], "needs must cross a threshold"
    assert by_name["to_starvation"]["terminal"] is True
    assert by_name["from_initial_state"]["terminal"] is False or by_name["from_initial_state"]["samples"]

    ananke = json.loads((FIXTURE_DIR / "ananke.json").read_text(encoding="utf-8"))
    runs = {t["name"]: t for t in ananke["trajectories"]}
    assert {c["direction"] for c in runs["from_initial_state_seed_0"]["crossings"]} >= {"rising"}
    # The drive update is seed-independent today — pinned as part of the contract.
    assert runs["from_initial_state_seed_0"]["samples"] == runs["from_initial_state_seed_7"]["samples"]

    hashing = json.loads((FIXTURE_DIR / "hashing.json").read_text(encoding="utf-8"))
    hashes = {c["name"]: c["hash"] for c in hashing["active_telos_hash"]}
    assert hashes["not_hashed_fields_ignored"] == hashes["not_hashed_fields_ignored_twin"]
    assert len(set(hashes.values())) == len(hashes) - 1
    assert all(len(h) == 64 for h in hashes.values())

    thymos = json.loads((FIXTURE_DIR / "thymos.json").read_text(encoding="utf-8"))
    assert any(step.get("matched") for run in thymos["runs"] for step in run["steps"])
