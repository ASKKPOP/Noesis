"""brain/test/whisper/test_key_directory.py

Phase 11 Wave 1 tests for brain/src/noesis_brain/whisper/key_directory.py.

Tests:
    - on_bios_birth registers a DID's public key
    - pub_for returns the bytes after birth
    - on_bios_death removes the entry
    - pub_for returns None for unknown DID
    - Multiple DIDs tracked independently
    - Double-evict (bios.death twice) is idempotent
"""
from noesis_brain.whisper.key_directory import KeyDirectory

ALICE_DID = "did:noesis:alice_test"
BOB_DID = "did:noesis:bob_test"

ALICE_PUB = bytes.fromhex("64d82bca2c149c01c3606a919b5d7ba0b75c1abe84717db3d2964742fffe407c")
BOB_PUB = bytes.fromhex("87bc47cd478f147d3e143b6e05f2a58c749bbde2734398dd10caecc2f5bb9617")


class TestKeyDirectoryBirth:
    def test_birth_registers_pub_bytes(self) -> None:
        kd = KeyDirectory()
        kd.on_bios_birth(ALICE_DID, ALICE_PUB)
        assert kd.pub_for(ALICE_DID) == ALICE_PUB

    def test_pub_for_unknown_did_returns_none(self) -> None:
        kd = KeyDirectory()
        assert kd.pub_for(ALICE_DID) is None

    def test_multiple_dids_tracked_independently(self) -> None:
        kd = KeyDirectory()
        kd.on_bios_birth(ALICE_DID, ALICE_PUB)
        kd.on_bios_birth(BOB_DID, BOB_PUB)
        assert kd.pub_for(ALICE_DID) == ALICE_PUB
        assert kd.pub_for(BOB_DID) == BOB_PUB

    def test_birth_updates_existing_entry(self) -> None:
        """Re-birth with new pub bytes updates the cache."""
        kd = KeyDirectory()
        kd.on_bios_birth(ALICE_DID, ALICE_PUB)
        new_pub = bytes(32)  # all zeros — different key
        kd.on_bios_birth(ALICE_DID, new_pub)
        assert kd.pub_for(ALICE_DID) == new_pub


class TestKeyDirectoryDeath:
    def test_death_removes_entry(self) -> None:
        kd = KeyDirectory()
        kd.on_bios_birth(ALICE_DID, ALICE_PUB)
        kd.on_bios_death(ALICE_DID)
        assert kd.pub_for(ALICE_DID) is None

    def test_death_does_not_remove_other_dids(self) -> None:
        kd = KeyDirectory()
        kd.on_bios_birth(ALICE_DID, ALICE_PUB)
        kd.on_bios_birth(BOB_DID, BOB_PUB)
        kd.on_bios_death(ALICE_DID)
        # Alice removed
        assert kd.pub_for(ALICE_DID) is None
        # Bob still present
        assert kd.pub_for(BOB_DID) == BOB_PUB

    def test_death_unknown_did_is_idempotent(self) -> None:
        """on_bios_death for unknown DID must not raise."""
        kd = KeyDirectory()
        kd.on_bios_death("did:noesis:never_seen")  # must not raise

    def test_double_death_is_idempotent(self) -> None:
        kd = KeyDirectory()
        kd.on_bios_birth(ALICE_DID, ALICE_PUB)
        kd.on_bios_death(ALICE_DID)
        kd.on_bios_death(ALICE_DID)  # second death — must not raise
        assert kd.pub_for(ALICE_DID) is None

    def test_birth_after_death_re_registers(self) -> None:
        kd = KeyDirectory()
        kd.on_bios_birth(ALICE_DID, ALICE_PUB)
        kd.on_bios_death(ALICE_DID)
        kd.on_bios_birth(ALICE_DID, ALICE_PUB)
        assert kd.pub_for(ALICE_DID) == ALICE_PUB
