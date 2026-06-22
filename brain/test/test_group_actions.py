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
