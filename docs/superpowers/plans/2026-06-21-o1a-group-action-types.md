# O1a — Group Action-Types (a Nous decides to join/leave a group) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Close the concrete gap the deep-scan found: a Nous's **Brain can decide to join or leave a group**, and that decision flows Brain → Grid → the existing `group-store` → the existing `group.member_joined`/`group.member_left` audit events. Today Groups are Grid-readable but **not Brain-writable** (no `ActionType`, no dispatch case). This is the smallest, cleanest first slice of O1 (Nous multitasking) — orthogonal to the larger persistent task-scheduler (O1b, later).

**Architecture:** Cross-codebase.
- **Brain (Python, `brain/`):** add `ActionType.JOIN_GROUP` / `LEAVE_GROUP` + a `build_group_action(...)` validator (mirrors `build_civic_land_action`). These flow through the **generic actions batch** (`/api/v1/brain/actions`), NOT the civic-land HTTP routes — so no `wire/client.py` route entry is needed (absence from `CIVIC_LAND_ROUTES` = generic dispatch).
- **Grid (TypeScript, `grid/`):** add `case 'join_group'` / `'leave_group'` to `NousRunner.executeActions()` → call the existing `GroupStore.joinGroup`/`leaveGroup` (which emit the audit events); inject `GroupStore` into `NousRunner`; wire it at the construction site.

**Allowlist +0** — `group.member_joined` (#102) and `group.member_left` (#103) already exist; this slice only adds a *new producer path* to them (a Brain action), not new event types. (Confirm the existing sole-producer/boundary tests for `group.member_*` still pass — `group-store` remains the sole producer; `NousRunner` calls `groupStore.joinGroup`, never `audit.append('group.*')` directly.)

**Tech Stack:** Python (Brain, `pytest` at `brain/test/`) + TypeScript (Grid, `vitest` at `grid/test/`). Run Brain tests: `cd brain && python -m pytest test/test_group_actions.py -q` (or the project's pytest invocation). Run Grid tests from `grid/`: `npx vitest run <target>` (**`vitest run` only, never watch; kill stray vitest first**).

**Invariants:** sole-producer preserved (`group-store` is the only `audit.append('group.*')`); `NousRunner` calls the store, not `audit.append`; malformed/invalid metadata → safe drop + warning log (never throw out of the dispatch loop); role ∈ {founder, member, affiliate}, reason ∈ {voluntary, removed}; optional `groupStore` injection (absent → warn + skip, so legacy NousRunner tests stay green).

---

## File Structure

| File | Action |
|---|---|
| `brain/src/noesis_brain/rpc/types.py` | **Modify** — add `JOIN_GROUP`/`LEAVE_GROUP` + `build_group_action` |
| `brain/test/test_group_actions.py` | **Create** — Brain action-builder tests |
| `grid/src/integration/nous-runner.ts` | **Modify** — `groupStore` injection + `join_group`/`leave_group` dispatch cases |
| `grid/test/integration/nous-runner-group.test.ts` | **Create** — Grid dispatch tests |
| (construction site, e.g. `grid/src/genesis/launcher.ts` or `server.ts`) | **Modify** — inject `groupStore` into `NousRunner` |

---

## Task 1: Brain — group action types

**Files:** `brain/src/noesis_brain/rpc/types.py` (modify), `brain/test/test_group_actions.py` (create).

Read `brain/src/noesis_brain/rpc/types.py` first — find the `ActionType` enum, the `Action` dataclass, and `build_civic_land_action` (the validator to mirror).

- [ ] **Step 1: Write the failing test** — `brain/test/test_group_actions.py`:

```python
"""O1a — Brain group actions (join/leave) as capabilities."""
import pytest
from noesis_brain.rpc.types import ActionType, build_group_action


def test_join_group_action():
    a = build_group_action(ActionType.JOIN_GROUP, group_id="g:aegis", role="member")
    assert a.action_type == ActionType.JOIN_GROUP
    assert a.metadata == {"group_id": "g:aegis", "role": "member"}


def test_join_group_missing_role_raises():
    with pytest.raises(ValueError):
        build_group_action(ActionType.JOIN_GROUP, group_id="g:aegis")


def test_leave_group_action():
    a = build_group_action(ActionType.LEAVE_GROUP, group_id="g:aegis", reason="voluntary")
    assert a.action_type == ActionType.LEAVE_GROUP
    assert a.metadata == {"group_id": "g:aegis", "reason": "voluntary"}


def test_non_group_verb_raises():
    with pytest.raises(ValueError):
        build_group_action(ActionType.SPEAK, group_id="g:aegis", role="member")
```

- [ ] **Step 2: Verify fail** — `cd brain && python -m pytest test/test_group_actions.py -q` → FAIL (no `JOIN_GROUP` / `build_group_action`).

- [ ] **Step 3: Add the enum members** — in the `ActionType` enum (after `NOOP`):

```python
    JOIN_GROUP = "join_group"    # O1a. Metadata: {group_id, role}
    LEAVE_GROUP = "leave_group"  # O1a. Metadata: {group_id, reason}
```

- [ ] **Step 4: Add the validator** — near `build_civic_land_action` (match its style; `Any` is already imported there):

```python
_GROUP_ACTION_REQUIRED_KEYS: dict[ActionType, tuple[str, ...]] = {
    ActionType.JOIN_GROUP: ("group_id", "role"),
    ActionType.LEAVE_GROUP: ("group_id", "reason"),
}


def build_group_action(action_type: ActionType, **metadata: Any) -> Action:
    """Build a validated group Action (O1a). Group verbs flow through the generic
    actions batch, not the civic-land HTTP routes."""
    required = _GROUP_ACTION_REQUIRED_KEYS.get(action_type)
    if required is None:
        raise ValueError(f"{action_type!r} is not a group verb")
    missing = [k for k in required if metadata.get(k) is None]
    if missing:
        raise ValueError(
            f"{action_type.value} action missing required metadata key(s): {', '.join(missing)}"
        )
    return Action(action_type=action_type, metadata=dict(metadata))
```

(If the local `Action` dataclass uses different field names than `action_type`/`metadata`, match `build_civic_land_action` exactly.)

- [ ] **Step 5: Verify pass** — `cd brain && python -m pytest test/test_group_actions.py -q` → all pass.
- [ ] **Step 6: Confirm no Brain regression** — run the Brain suite for the rpc types/handler (`python -m pytest test/test_rpc_handler.py -q` and the types tests) → green.

- [ ] **Step 7: Commit**

```bash
git add brain/src/noesis_brain/rpc/types.py brain/test/test_group_actions.py
git commit -m "feat(brain): O1a JOIN_GROUP/LEAVE_GROUP action types + build_group_action

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Task 2: Grid — NousRunner dispatches group actions

**Files:** `grid/src/integration/nous-runner.ts` (modify), `grid/test/integration/nous-runner-group.test.ts` (create), the construction site (modify).

Read `grid/src/integration/nous-runner.ts` first — the `NousRunnerConfig` interface, the class fields/constructor, and the `executeActions()` switch (the `case 'lore_response'` / `case 'noop'` tail). Read `grid/src/economy/group-store.ts` for the exact `joinGroup`/`leaveGroup` signatures and the role/reason unions. Read `grid/test/integration/` for the NousRunner test harness, and `grep -rn "new NousRunner" grid/src` for the construction site.

- [ ] **Step 1: Write the failing test** — `grid/test/integration/nous-runner-group.test.ts` (model on an existing `nous-runner-*.test.ts`; mock `GroupStore`):

```ts
import { describe, it, expect, vi } from 'vitest';
// ... import NousRunner + whatever its tests use to construct it ...
// Construct a runner with a mock groupStore = { joinGroup: vi.fn(), leaveGroup: vi.fn() }.

describe('NousRunner — group actions (O1a)', () => {
    it('join_group → groupStore.joinGroup with the Nous DID + role', async () => {
        // const { runner, groupStore, audit } = makeRunner();
        await runner.executeActions([{ action_type: 'join_group', metadata: { group_id: 'g:aegis', role: 'member' } } as never], 100);
        expect(groupStore.joinGroup).toHaveBeenCalledWith(expect.anything(),
            expect.objectContaining({ groupId: 'g:aegis', memberCivicDid: runner_did, role: 'member', tick: 100 }));
    });
    it('leave_group → groupStore.leaveGroup with reason', async () => {
        await runner.executeActions([{ action_type: 'leave_group', metadata: { group_id: 'g:aegis', reason: 'voluntary' } } as never], 101);
        expect(groupStore.leaveGroup).toHaveBeenCalledWith(expect.anything(),
            expect.objectContaining({ groupId: 'g:aegis', memberCivicDid: runner_did, reason: 'voluntary', tick: 101 }));
    });
    it('join_group with missing/invalid metadata → no store call (safe drop)', async () => {
        await runner.executeActions([{ action_type: 'join_group', metadata: { group_id: 'g:aegis' } } as never], 102); // missing role
        await runner.executeActions([{ action_type: 'join_group', metadata: { group_id: 'g:aegis', role: 'bogus' } } as never], 103); // invalid role
        expect(groupStore.joinGroup).not.toHaveBeenCalled();
    });
    it('no groupStore wired → safe no-op (legacy compatibility)', async () => {
        // const runner = makeRunner({ groupStore: undefined });
        await expect(runner.executeActions([{ action_type: 'join_group', metadata: { group_id: 'g', role: 'member' } } as never], 1)).resolves.toBeDefined();
    });
});
```
(Fill in `makeRunner`/`runner_did` to match the existing NousRunner test harness in `grid/test/integration/`.)

- [ ] **Step 2: Verify fail** — `npx vitest run test/integration/nous-runner-group.test.ts` → FAIL.

- [ ] **Step 3: Inject `GroupStore`** — in `nous-runner.ts`: import `GroupStore` (and its role/reason types if exported); add `groupStore?: GroupStore;` to `NousRunnerConfig`; add `private readonly groupStore: GroupStore | undefined;`; assign `this.groupStore = config.groupStore;` in the constructor.

- [ ] **Step 4: Add the dispatch cases** — in `executeActions()` switch, before `case 'noop'`, add `case 'join_group'` and `case 'leave_group'` that: read `metadata.group_id` + `role`/`reason`; if `groupStore` absent → warn + break; validate strings + `role ∈ {founder,member,affiliate}` / `reason ∈ {voluntary,removed}` (invalid → warn + break, no throw); `try { await this.groupStore.joinGroup(this.audit, { groupId, memberCivicDid: this.nousDid, role, tick }); } catch (err) { warn; }` (and `leaveGroup` symmetrically). Use the structured `console.warn(JSON.stringify({...}))` style already used in the file. (See the deep-scan's drafted handler bodies as the reference shape.)

- [ ] **Step 5: Wire the construction site** — at `new NousRunner({...})` (found via grep; likely `grid/src/genesis/launcher.ts` or `server.ts`), pass `groupStore: <the GroupStore instance available there>` (the same instance wired into `services`/the launcher). If no GroupStore is in scope there, thread it through (it is constructed at startup per the Groups phases).

- [ ] **Step 6: Verify** — `npx vitest run test/integration/nous-runner-group.test.ts` → pass; then `npx vitest run test/integration/ test/economy/ test/audit/` → no regressions (the `group.member_*` sole-producer/boundary tests stay green — group-store is still the only producer); `npm run typecheck 2>/dev/null || npx tsc --noEmit` → clean.

- [ ] **Step 7: Commit**

```bash
git add grid/src/integration/nous-runner.ts grid/test/integration/nous-runner-group.test.ts <construction-site-file>
git commit -m "feat(grid): O1a NousRunner dispatches join_group/leave_group → group-store

A Nous's Brain decision to join/leave a group now flows to group-store.joinGroup/
leaveGroup (existing group.member_* events). Sole-producer preserved; optional
groupStore injection (absent → safe no-op).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Self-Review

**1. Coverage:** Brain can emit JOIN_GROUP/LEAVE_GROUP (validated); Grid dispatches them to the existing group-store → existing audit events. The Brain-writable group gap is closed. ✓
**2. Sole-producer preserved:** NousRunner calls `groupStore.joinGroup` (the existing sole producer), never `audit.append('group.*')` directly → boundary tests stay green; allowlist +0. ✓
**3. Type/name consistency:** `JOIN_GROUP`/`LEAVE_GROUP` ↔ `'join_group'`/`'leave_group'`; role/reason unions match `group-store`; `build_group_action` mirrors `build_civic_land_action`. ✓
**4. Safety:** missing/invalid metadata → warn + skip (no throw escapes the dispatch loop); store error → caught + logged; absent groupStore → no-op (legacy tests unaffected). ✓
**5. Scope:** group-action slice only; the persistent task-scheduler / true concurrency (O1b) is explicitly out of scope here. ✓
