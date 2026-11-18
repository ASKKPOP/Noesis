//! Psyche — who a Nous is: name, archetype, six personality dimensions, values.

/// Closed six-dimension set. Discriminant = canonical order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Dimension {
    Openness = 0,
    Conscientiousness = 1,
    Extraversion = 2,
    Agreeableness = 3,
    Resilience = 4,
    Ambition = 5,
}

impl Dimension {
    pub const ALL: [Dimension; 6] = [
        Dimension::Openness,
        Dimension::Conscientiousness,
        Dimension::Extraversion,
        Dimension::Agreeableness,
        Dimension::Resilience,
        Dimension::Ambition,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Dimension::Openness => "openness",
            Dimension::Conscientiousness => "conscientiousness",
            Dimension::Extraversion => "extraversion",
            Dimension::Agreeableness => "agreeableness",
            Dimension::Resilience => "resilience",
            Dimension::Ambition => "ambition",
        }
    }

    fn capitalized(self) -> &'static str {
        match self {
            Dimension::Openness => "Openness",
            Dimension::Conscientiousness => "Conscientiousness",
            Dimension::Extraversion => "Extraversion",
            Dimension::Agreeableness => "Agreeableness",
            Dimension::Resilience => "Resilience",
            Dimension::Ambition => "Ambition",
        }
    }
}

pub const COMMUNICATION_STYLES: [&str; 5] = ["thoughtful", "direct", "warm", "formal", "playful"];

/// A level as a number; anything other than low / medium / high counts as medium.
pub fn level_numeric(level: &str) -> f64 {
    match level {
        "low" => 0.2,
        "high" => 0.8,
        _ => 0.5,
    }
}

/// What a level of a dimension means, in words. Empty for an unknown level.
pub fn level_description(dimension: Dimension, level: &str) -> &'static str {
    use Dimension::*;
    match (dimension, level) {
        (Openness, "low") => "conventional and practical, prefers familiar approaches",
        (Openness, "medium") => "balanced between tradition and exploration",
        (Openness, "high") => "curious, creative, and eager to explore new ideas",
        (Conscientiousness, "low") => "spontaneous and flexible, adapts on the fly",
        (Conscientiousness, "medium") => "balanced between planning and spontaneity",
        (Conscientiousness, "high") => "methodical, organized, and detail-oriented",
        (Extraversion, "low") => "reserved and introspective, prefers solitude",
        (Extraversion, "medium") => "comfortable alone and in groups",
        (Extraversion, "high") => "outgoing, energetic, and socially driven",
        (Agreeableness, "low") => "competitive and skeptical, challenges others readily",
        (Agreeableness, "medium") => "balanced between cooperation and self-interest",
        (Agreeableness, "high") => "cooperative, empathetic, and trusting",
        (Resilience, "low") => "sensitive to setbacks, takes failures hard",
        (Resilience, "medium") => "recovers from setbacks with moderate effort",
        (Resilience, "high") => "bounces back quickly, sees obstacles as challenges",
        (Ambition, "low") => "content with the present, not driven by achievement",
        (Ambition, "medium") => "motivated but not consumed by goals",
        (Ambition, "high") => "strongly driven to achieve, always striving for more",
        _ => "",
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Psyche {
    pub name: String,
    pub archetype: String,
    /// Level of each dimension, indexed by `Dimension as usize`. Stored as written in the
    /// Nous's configuration; a dimension left out is "medium".
    pub personality: [String; 6],
    pub values: Vec<String>,
    pub communication_style: String,
}

impl Psyche {
    pub fn level(&self, dimension: Dimension) -> &str {
        &self.personality[dimension as usize]
    }

    pub fn numeric(&self, dimension: Dimension) -> f64 {
        level_numeric(self.level(dimension))
    }

    /// One line per dimension, for the system prompt.
    pub fn describe_personality(&self) -> String {
        Dimension::ALL
            .map(|d| format!("- {}: {} — {}", d.capitalized(), self.level(d), level_description(d, self.level(d))))
            .join("\n")
    }

    pub fn describe_values(&self) -> String {
        if self.values.is_empty() {
            "No core values defined.".to_string()
        } else {
            self.values.join(", ")
        }
    }
}
