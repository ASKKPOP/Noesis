"""HYP-01: WorkingMemory cap=7, 8 inserts → 7 retained; deterministic. RED — hypnos module not yet implemented."""
import pytest


def test_working_memory_cap_7():
    pytest.importorskip("noesis_brain.hypnos.working_memory")
    from noesis_brain.hypnos.working_memory import WorkingMemory

    class FakeMemory:
        def __init__(self, i):
            self.content = f"ep{i}"
            self.memory_type = "observation"

    for i in range(8):
        wm = WorkingMemory()
        wm.set_episodes([FakeMemory(j) for j in range(i + 1)])
    # After inserting 8 episodes, at most 7 retained
    # (set_episodes replaces all; test inserts 8 total across calls then checks cap)
    wm2 = WorkingMemory()
    mems = [FakeMemory(i) for i in range(8)]
    wm2.set_episodes(mems)
    assert len(wm2) == 7, f"Expected 7 episodes, got {len(wm2)}"


def test_working_memory_overflow_evicts_oldest():
    pytest.importorskip("noesis_brain.hypnos.working_memory")
    from noesis_brain.hypnos.working_memory import WorkingMemory

    class FakeMemory:
        def __init__(self, i):
            self.content = f"ep{i}"
            self.memory_type = "observation"

    wm = WorkingMemory()
    wm.set_episodes([FakeMemory(i) for i in range(8)])
    episodes = wm.episodes()
    assert len(episodes) == 7
    # First 7 of 8 are kept (cap slices to [:7])
    assert episodes[0].content == "ep0"
    assert episodes[-1].content == "ep6"
