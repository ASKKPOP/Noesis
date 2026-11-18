//! Telos — a Nous's goals and how they evolve.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GoalType {
    ShortTerm,
    MediumTerm,
    LongTerm,
}

impl GoalType {
    pub const ALL: [GoalType; 3] = [GoalType::ShortTerm, GoalType::MediumTerm, GoalType::LongTerm];

    pub fn as_str(self) -> &'static str {
        match self {
            GoalType::ShortTerm => "short_term",
            GoalType::MediumTerm => "medium_term",
            GoalType::LongTerm => "long_term",
        }
    }

    pub fn parse(s: &str) -> Option<GoalType> {
        GoalType::ALL.into_iter().find(|t| t.as_str() == s)
    }

    /// The heading used in prompts.
    fn label(self) -> &'static str {
        match self {
            GoalType::ShortTerm => "short-term",
            GoalType::MediumTerm => "medium-term",
            GoalType::LongTerm => "long-term",
        }
    }

    /// Priority of the first goal of this type in a Nous's configuration.
    fn base_priority(self) -> f64 {
        match self {
            GoalType::ShortTerm => 0.8,
            GoalType::MediumTerm => 0.5,
            GoalType::LongTerm => 0.3,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GoalStatus {
    Active,
    Completed,
    Abandoned,
    Blocked,
}

impl GoalStatus {
    pub const ALL: [GoalStatus; 4] =
        [GoalStatus::Active, GoalStatus::Completed, GoalStatus::Abandoned, GoalStatus::Blocked];

    pub fn as_str(self) -> &'static str {
        match self {
            GoalStatus::Active => "active",
            GoalStatus::Completed => "completed",
            GoalStatus::Abandoned => "abandoned",
            GoalStatus::Blocked => "blocked",
        }
    }

    pub fn parse(s: &str) -> Option<GoalStatus> {
        GoalStatus::ALL.into_iter().find(|t| t.as_str() == s)
    }
}

/// What a goal is about — separate from its time horizon.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GoalDomain {
    General,
    /// Earning a living through compute-labor (D-MONEY-01). A standing target.
    Economic,
}

impl GoalDomain {
    pub const ALL: [GoalDomain; 2] = [GoalDomain::General, GoalDomain::Economic];

    pub fn as_str(self) -> &'static str {
        match self {
            GoalDomain::General => "general",
            GoalDomain::Economic => "economic",
        }
    }

    pub fn parse(s: &str) -> Option<GoalDomain> {
        GoalDomain::ALL.into_iter().find(|t| t.as_str() == s)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Goal {
    pub description: String,
    pub goal_type: GoalType,
    pub status: GoalStatus,
    /// 0–1.
    pub priority: f64,
    /// 0–1.
    pub progress: f64,
    pub domain: GoalDomain,
    /// Drives time-based evolution. Not part of the Telos hash.
    pub last_advanced_tick: i64,
}

impl Goal {
    pub fn is_active(&self) -> bool {
        self.status == GoalStatus::Active
    }

    /// Add progress; a goal that reaches 1.0 is completed.
    pub fn advance(&mut self, amount: f64, tick: Option<i64>) {
        self.progress = 1.0_f64.min(self.progress + amount);
        if let Some(tick) = tick {
            self.last_advanced_tick = tick;
        }
        if self.progress >= 1.0 {
            self.status = GoalStatus::Completed;
        }
    }

    pub fn abandon(&mut self) {
        self.status = GoalStatus::Abandoned;
    }

    pub fn block(&mut self) {
        self.status = GoalStatus::Blocked;
    }

    pub fn unblock(&mut self) {
        if self.status == GoalStatus::Blocked {
            self.status = GoalStatus::Active;
        }
    }
}

pub const ECONOMIC_GOAL_TEXT: &str = "Earn a living through compute-labor — do useful work for other Nous.";
pub const ECONOMIC_GOAL_PRIORITY: f64 = 0.4;
pub const DEFAULT_STALE_TICKS: i64 = 500;
pub const DEFAULT_PRIORITY_FLOOR: f64 = 0.1;

#[derive(Debug, Clone, Default, PartialEq)]
pub struct TelosManager {
    pub goals: Vec<Goal>,
}

impl TelosManager {
    /// Rebuild from a Nous's configured goals, given per type in the order
    /// short / medium / long. Earlier goals of a type get higher priority. Does not seed
    /// the economic goal — that happens once, at spawn.
    pub fn from_config(short_term: &[&str], medium_term: &[&str], long_term: &[&str]) -> Self {
        let mut manager = TelosManager::default();
        for (goal_type, goals) in GoalType::ALL.into_iter().zip([short_term, medium_term, long_term]) {
            for (i, description) in goals.iter().enumerate() {
                let priority = goal_type.base_priority() - (i as f64 * 0.05);
                manager.add_goal(description, goal_type, 0.1_f64.max(priority), GoalDomain::General, 0);
            }
        }
        manager
    }

    pub fn add_goal(&mut self, description: &str, goal_type: GoalType, priority: f64, domain: GoalDomain, tick: i64) -> &mut Goal {
        self.goals.push(Goal {
            description: description.to_string(),
            goal_type,
            status: GoalStatus::Active,
            priority,
            progress: 0.0,
            domain,
            last_advanced_tick: tick,
        });
        self.goals.last_mut().expect("just pushed")
    }

    /// The standing "earn a living" target: long-term, never auto-completes.
    pub fn seed_economic_goal(&mut self) -> &mut Goal {
        self.add_goal(ECONOMIC_GOAL_TEXT, GoalType::LongTerm, ECONOMIC_GOAL_PRIORITY, GoalDomain::Economic, 0)
    }

    /// A general goal left untouched with no progress for `stale_ticks` drops to the
    /// priority floor, so attention moves to fresher goals. Economic goals are exempt.
    /// Returns whether anything changed.
    pub fn evolve(&mut self, current_tick: i64, stale_ticks: i64, floor: f64) -> bool {
        let mut changed = false;
        for g in &mut self.goals {
            if g.is_active()
                && g.domain == GoalDomain::General
                && g.progress == 0.0
                && g.priority > floor
                && (current_tick - g.last_advanced_tick) >= stale_ticks
            {
                g.priority = floor;
                changed = true;
            }
        }
        changed
    }

    pub fn active_goals(&self) -> Vec<&Goal> {
        self.goals.iter().filter(|g| g.is_active()).collect()
    }

    pub fn economic_goals(&self) -> Vec<&Goal> {
        self.goals.iter().filter(|g| g.domain == GoalDomain::Economic && g.is_active()).collect()
    }

    /// The `n` active goals of highest priority; ties keep insertion order.
    pub fn top_priority(&self, n: usize) -> Vec<&Goal> {
        let mut active = self.active_goals();
        active.sort_by(|a, b| b.priority.total_cmp(&a.priority));
        active.truncate(n);
        active
    }

    /// The goals block of the system prompt.
    pub fn describe(&self) -> String {
        let mut lines = Vec::new();
        for goal_type in GoalType::ALL {
            let mut goals: Vec<&Goal> = self.goals.iter().filter(|g| g.goal_type == goal_type && g.is_active()).collect();
            if goals.is_empty() {
                continue;
            }
            goals.sort_by(|a, b| b.priority.total_cmp(&a.priority));
            lines.push(format!("{}:", goal_type.label()));
            for g in goals {
                let progress = if g.progress > 0.0 { format!(" [{:.0}%]", g.progress * 100.0) } else { String::new() };
                let mark = if g.domain == GoalDomain::Economic { " (standing economic target)" } else { "" };
                lines.push(format!("  - {}{progress}{mark}", g.description));
            }
        }
        if lines.is_empty() {
            "No active goals.".to_string()
        } else {
            lines.join("\n")
        }
    }
}
