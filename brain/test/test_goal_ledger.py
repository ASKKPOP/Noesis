"""W-A2 — GoalLedger: persistent goal→task decomposition.

The ledger is the external state that makes goal pursuit ceaseless: the goal
stack survives restarts, and every tick the fast actor can ask "what is the
next concrete task?" without re-deriving a plan. SQLite when a db_dir is
given (BRAIN_DATA_DIR pattern), in-memory otherwise.
"""
from noesis_brain.telos.ledger import GoalLedger

GOAL = "Map the energy needs of the residential ring"


def test_empty_ledger_has_no_next_task():
    led = GoalLedger()
    assert led.next_task(GOAL) is None
    assert led.pending_count(GOAL) == 0
    assert led.total_count(GOAL) == 0


def test_add_tasks_and_next_returns_oldest_pending():
    led = GoalLedger()
    led.add_tasks(GOAL, ["survey parcels", "estimate demand"], tick=10)
    task = led.next_task(GOAL)
    assert task is not None
    assert task.description == "survey parcels"
    assert task.status == "pending"
    assert led.pending_count(GOAL) == 2
    assert led.total_count(GOAL) == 2


def test_mark_done_advances_to_next_task():
    led = GoalLedger()
    led.add_tasks(GOAL, ["a", "b"], tick=1)
    first = led.next_task(GOAL)
    led.mark_done(first.task_id, tick=2)
    nxt = led.next_task(GOAL)
    assert nxt.description == "b"
    assert led.pending_count(GOAL) == 1
    assert led.total_count(GOAL) == 2


def test_mark_attempt_increments_and_fails_at_three():
    led = GoalLedger()
    led.add_tasks(GOAL, ["hard task"], tick=1)
    t = led.next_task(GOAL)
    t1 = led.mark_attempt(t.task_id, tick=2)
    assert t1.attempts == 1 and t1.status == "pending"
    t2 = led.mark_attempt(t.task_id, tick=3)
    assert t2.attempts == 2 and t2.status == "pending"
    t3 = led.mark_attempt(t.task_id, tick=4)
    assert t3.attempts == 3 and t3.status == "failed"
    assert led.next_task(GOAL) is None  # failed tasks are not offered again


def test_goals_are_isolated():
    led = GoalLedger()
    led.add_tasks(GOAL, ["a"], tick=1)
    led.add_tasks("other goal", ["x"], tick=1)
    assert led.next_task("other goal").description == "x"
    led.clear_goal(GOAL)
    assert led.next_task(GOAL) is None
    assert led.next_task("other goal") is not None


def test_done_tasks_returns_completed_in_order():
    led = GoalLedger()
    led.add_tasks(GOAL, ["a", "b", "c"], tick=1)
    t1 = led.next_task(GOAL)
    led.mark_done(t1.task_id, tick=2)
    t2 = led.next_task(GOAL)
    led.mark_done(t2.task_id, tick=3)
    done = led.done_tasks(GOAL)
    assert [t.description for t in done] == ["a", "b"]
    assert all(t.status == "done" for t in done)


def test_persistence_roundtrip(tmp_path):
    did = "did:civic:noesis:sophia"
    led = GoalLedger(db_dir=tmp_path, did=did)
    led.add_tasks(GOAL, ["survive restart"], tick=5)
    led.close()

    reopened = GoalLedger(db_dir=tmp_path, did=did)
    task = reopened.next_task(GOAL)
    assert task is not None
    assert task.description == "survive restart"
    reopened.close()
