//! The user-turn prompts of the mind's two timescales, plus the social and economic acts.
//! Wording is behaviour: these are tuned to small models and must match the Python Brain
//! character for character.

use crate::json::{get, Object};
use crate::pytext::py_str;

/// Slow planner: break one goal into 2–4 tasks.
pub fn build_planning_prompt(goal_desc: &str, memories_text: &str, reflections: &[&str]) -> String {
    let mut lines = vec![
        "You are planning how to pursue one of your goals.".to_string(),
        String::new(),
        format!("GOAL: {goal_desc}"),
    ];
    if !memories_text.is_empty() {
        lines.extend([String::new(), "Recent experiences:".to_string(), memories_text.to_string()]);
    }
    if !reflections.is_empty() {
        lines.extend([String::new(), "Your recent reflections:".to_string()]);
        lines.extend(reflections.iter().map(|r| format!("- {r}")));
    }
    lines.extend([
        String::new(),
        "Break this goal into 2-4 small, concrete tasks you can act on yourself,".to_string(),
        "in order. Respond with ONLY a JSON object:".to_string(),
        r#"{"tasks": ["first task", "second task"]}"#.to_string(),
    ]);
    lines.join("\n")
}

/// Fast actor: one small step now. `work_task` is offered only when there is a task.
pub fn build_decision_prompt(goal_desc: &str, task_desc: Option<&str>, lessons: &[&str]) -> String {
    let task_desc = task_desc.filter(|t| !t.is_empty());
    let mut lines = vec![
        "Decide what to do right now, in one small step.".to_string(),
        String::new(),
        format!("CURRENT GOAL: {goal_desc}"),
    ];
    if let Some(task) = task_desc {
        lines.push(format!("NEXT TASK: {task}"));
    }
    if !lessons.is_empty() {
        lines.extend([String::new(), "Lessons from past failures:".to_string()]);
        lines.extend(lessons.iter().map(|l| format!("- {l}")));
    }
    let speak_or_rest = concat!(
        r#"- {"action": "speak", "text": "<something short worth saying publicly>"}"#,
        "\n",
        r#"- {"action": "rest", "note": "<why>"}"#,
    );
    let options = if task_desc.is_some() {
        format!(
            "{}\n{speak_or_rest}",
            r#"- {"action": "work_task", "note": "<what you did / concluded>", "completed": <true if the task is now done>}"#
        )
    } else {
        speak_or_rest.to_string()
    };
    lines.extend([String::new(), "Choose exactly ONE and respond with ONLY that JSON object:".to_string(), options]);
    lines.join("\n")
}

/// Sleep-time: distill a completed goal's tasks into one reusable skill.
pub fn build_skill_distill_prompt(goal_desc: &str, done_tasks: &[&str]) -> String {
    let mut lines = vec![
        "You just completed a goal. Distill HOW you did it into one reusable skill".to_string(),
        "another future situation could reuse.".to_string(),
        String::new(),
        format!("COMPLETED GOAL: {goal_desc}"),
        "Tasks you completed, in order:".to_string(),
    ];
    lines.extend(done_tasks.iter().enumerate().map(|(i, t)| format!("{}. {t}", i + 1)));
    lines.extend([
        String::new(),
        "Respond with ONLY a JSON object:".to_string(),
        concat!(
            r#"{"name": "<short_snake_case_slug>", "description": "<≤200 chars, what this skill achieves>","#,
            r#" "instructions": "<≤1000 chars, how to do it step by step>", "triggers": ["<keyword>", "<keyword>"]}"#,
        )
        .to_string(),
    ]);
    lines.join("\n")
}

/// One small social or civic act. Only what exists is offered; lore is always offered.
pub fn build_social_prompt(peers: &[&str], skill_names: &[&str], proposals: &[Object], groups: &[Object]) -> String {
    let mut lines = vec!["You have a moment for social and civic life. Choose ONE small act, or none.".to_string()];
    let mut opts: Vec<&str> = Vec::new();
    if !peers.is_empty() {
        lines.extend([String::new(), "Peers you trust:".to_string()]);
        lines.extend(peers.iter().map(|p| format!("- {p}")));
        opts.push(r#"- {"action": "message_peer", "peer_did": "<one of the peers>", "text": "<short, useful or friendly>"}"#);
        if !skill_names.is_empty() {
            lines.extend([String::new(), "Skills you could teach a peer:".to_string()]);
            lines.extend(skill_names.iter().map(|s| format!("- {s}")));
            opts.push(r#"- {"action": "share_skill", "peer_did": "<peer>", "skill_name": "<one of your skills>"}"#);
        }
    }
    if !proposals.is_empty() {
        lines.extend([String::new(), "Open proposals awaiting your ballot:".to_string()]);
        lines.extend(proposals.iter().map(|p| {
            format!("- {} (voting closes at tick {})", py_str(get(p, "proposal_id")), py_str(get(p, "deadline_tick")))
        }));
        opts.push(r#"- {"action": "vote", "proposal_id": "<id>", "choice": "yes" | "no" | "abstain"}"#);
    }
    if !groups.is_empty() {
        lines.extend([String::new(), "Groups you could join (orbital anchor organizations):".to_string()]);
        lines.extend(groups.iter().map(|g| {
            format!("- {} — {} ({})", py_str(get(g, "group_id")), py_str(get(g, "display_name")), py_str(get(g, "domain")))
        }));
        opts.push(r#"- {"action": "join_group", "group_id": "<one of the groups>"}"#);
    }
    lines.extend([String::new(), "You may record knowledge for the commons:".to_string()]);
    opts.push(r#"- {"action": "contribute_lore", "title": "<short>", "content": "<the knowledge, a few sentences>", "category": "cultural" | "historical" | "observation" | "synthesis"}"#);
    opts.push(r#"- {"action": "none"}"#);
    lines.extend([String::new(), "Respond with ONLY one JSON object:".to_string()]);
    lines.extend(opts.into_iter().map(String::from));
    lines.join("\n")
}

/// The economic situation — balance, the one outstanding due, open RFPs — and the ask for
/// one JSON decision. An absent or empty `due` means nothing is owed.
pub fn build_economic_decision_prompt(account: &Object, due: Option<&Object>, rfps: &[Object]) -> String {
    let balance = match get(account, "balance_wei") {
        None => "0".to_string(),
        some => py_str(some),
    };
    let mut lines = vec![format!("Your wei balance: {balance}.")];
    match due.filter(|d| !d.is_empty()) {
        Some(due) => lines.push(format!(
            "You owe a civic due (id {}): {} wei OR {} labor-credit. Unpaid dues lead to sanction. You may pay it (method 'wei' or 'labor').",
            py_str(get(due, "due_id")),
            py_str(get(due, "amount_wei")),
            py_str(get(due, "amount_credit")),
        )),
        None => lines.push("You have no outstanding civic due.".to_string()),
    }
    if rfps.is_empty() {
        lines.push("There are no open RFPs to bid on right now.".to_string());
    } else {
        lines.push(
            "Open RFPs you could bid on (the treasury pays the winner — bidding costs you nothing up front):".to_string(),
        );
        lines.extend(rfps.iter().map(|r| {
            format!(
                "  - notice {}: a '{}' build, budget up to {} wei.",
                py_str(get(r, "notice_id")),
                py_str(get(r, "function_type")),
                py_str(get(r, "budget_wei")),
            )
        }));
    }
    lines.push(
        concat!(
            "\nDecide what to do, in character, guided by your goals. Reply with ONE JSON object only:\n",
            r#"{"action": "pay_due" | "bid_rfp" | "none", "#,
            r#""method": "wei" | "labor", "#,
            r#""notice_id": "<one of the notice ids above>", "#,
            r#""price_wei": "<digits, at most the budget>", "#,
            r#""artifact_spec": "<one short line describing what you would build>", "#,
            r#""reason": "<one sentence>"}"#,
            "\n",
            r#"Use "none" if you would rather do nothing this cycle. Include only the fields your action needs."#,
        )
        .to_string(),
    );
    lines.join("\n")
}
