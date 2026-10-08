"""O1b — scheduler handler-hookup integration.

Proves the wiring in BrainHandler.on_tick: at most ONE due task is popped per
tick and dispatched by kind; unknown kinds fail without raising; get_state
surfaces a compact snapshot. Disabled (no db dir) → behaviour identical to today.
"""

from pathlib import Path

import pytest
import yaml

from noesis_brain.llm.types import LLMResponse
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.stream import MemoryStream
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"


class QuietLLM:
    async def generate(self, prompt, options=None):
        return LLMResponse(text='{"action": "none"}', model="scripted", provider="test", usage={})


def _handler(mem, scheduler_db_dir=None):
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    return BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=QuietLLM(),
        did="did:noesis:sophia",
        memory=mem,
        scheduler_db_dir=scheduler_db_dir,
    )


def _contents(mem):
    return [m.content for m in mem.recent(limit=50)]


@pytest.mark.asyncio
async def test_disabled_without_db_dir_is_noop():
    h = _handler(MemoryStream(MemoryStore(":memory:")))
    assert h._task_queue is None
    await h.on_tick({"tick": 1})
    assert h.get_state()["scheduler"] == {"counts": {}, "next_due_tick": None}


@pytest.mark.asyncio
async def test_remember_task_records_to_memory_when_due(tmp_path):
    mem = MemoryStream(MemoryStore(":memory:"))
    h = _handler(mem, scheduler_db_dir=str(tmp_path))
    tid = h._task_queue.enqueue("remember", {"note": "water the garden"}, due_tick=5)

    await h.on_tick({"tick": 4})
    assert h._task_queue.get(tid).status == "pending"
    assert "Scheduled task: water the garden" not in _contents(mem)

    await h.on_tick({"tick": 5})
    assert h._task_queue.get(tid).status == "done"
    assert "Scheduled task: water the garden" in _contents(mem)


@pytest.mark.asyncio
async def test_at_most_one_task_per_tick_in_priority_order(tmp_path):
    mem = MemoryStream(MemoryStore(":memory:"))
    h = _handler(mem, scheduler_db_dir=str(tmp_path))
    low = h._task_queue.enqueue("remember", {"note": "low"}, due_tick=1, priority=0)
    high = h._task_queue.enqueue("remember", {"note": "high"}, due_tick=1, priority=9)

    await h.on_tick({"tick": 2})
    assert h._task_queue.get(high).status == "done"
    assert h._task_queue.get(low).status == "pending"

    await h.on_tick({"tick": 3})
    assert h._task_queue.get(low).status == "done"


@pytest.mark.asyncio
async def test_reminder_task_reenqueues_into_reminder_store(tmp_path):
    mem = MemoryStream(MemoryStore(":memory:"))
    h = _handler(mem, scheduler_db_dir=str(tmp_path))
    tid = h._task_queue.enqueue("reminder", {"note": "call Themis", "due_tick": 9}, due_tick=3)

    await h.on_tick({"tick": 3})
    assert h._task_queue.get(tid).status == "done"
    [r] = h._reminders.pending()
    assert (r.note, r.due_tick) == ("call Themis", 9)

    await h.on_tick({"tick": 9})
    assert h._reminders.pending() == []
    assert "Reminder: call Themis" in _contents(mem)


@pytest.mark.asyncio
async def test_unknown_kind_and_bad_payload_fail_without_raising(tmp_path):
    h = _handler(MemoryStream(MemoryStore(":memory:")), scheduler_db_dir=str(tmp_path))
    unknown = h._task_queue.enqueue("launch_rocket", {}, due_tick=1, priority=1)
    empty = h._task_queue.enqueue("remember", {}, due_tick=1)

    await h.on_tick({"tick": 1})
    await h.on_tick({"tick": 2})

    assert h._task_queue.get(unknown).status == "failed"
    assert h._task_queue.get(unknown).reason == "unknown_kind:launch_rocket"
    assert h._task_queue.get(empty).status == "failed"
    assert h._task_queue.get(empty).reason == "empty_note"


@pytest.mark.asyncio
async def test_get_state_snapshot_and_restart(tmp_path):
    mem = MemoryStream(MemoryStore(":memory:"))
    h = _handler(mem, scheduler_db_dir=str(tmp_path))
    h._task_queue.enqueue("remember", {"note": "soon"}, due_tick=2)
    h._task_queue.enqueue("remember", {"note": "after restart"}, due_tick=40)
    await h.on_tick({"tick": 2})

    assert h.get_state()["scheduler"] == {
        "counts": {"pending": 1, "started": 0, "done": 1, "failed": 0},
        "next_due_tick": 40,
    }

    # Brain restart: a new handler on the same data dir still holds the pending task.
    h2 = _handler(mem, scheduler_db_dir=str(tmp_path))
    assert h2.get_state()["scheduler"]["next_due_tick"] == 40
    await h2.on_tick({"tick": 40})
    assert "Scheduled task: after restart" in _contents(mem)


@pytest.mark.asyncio
async def test_schedule_task_rpc_enqueues_and_runs(tmp_path):
    mem = MemoryStream(MemoryStore(":memory:"))
    h = _handler(mem, scheduler_db_dir=str(tmp_path))
    result = h.schedule_task({"kind": "remember", "due_tick": 3, "payload": {"note": "file the report"}})
    assert result["ok"] is True

    await h.on_tick({"tick": 3})
    assert h._task_queue.get(result["id"]).status == "done"
    assert "Scheduled task: file the report" in _contents(mem)


def test_schedule_task_rpc_rejects_bad_requests(tmp_path):
    mem = MemoryStream(MemoryStore(":memory:"))
    assert _handler(mem).schedule_task({"kind": "remember", "due_tick": 1})["error"] == "scheduler_disabled"
    h = _handler(mem, scheduler_db_dir=str(tmp_path))
    assert h.schedule_task({"kind": "trade", "due_tick": 1})["error"] == "unknown_kind"
    assert h.schedule_task({"kind": "remember"})["error"] == "no_due_tick"
