//! Thymos — the six emotions and the mood derived from them.

pub const EMOTION_COUNT: usize = 6;
/// Intensity lost by every emotion per cycle.
pub const DECAY_RATE: f64 = 0.05;

/// Closed six-emotion set. Discriminant = canonical iteration order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Emotion {
    Joy = 0,
    Sadness = 1,
    Anger = 2,
    Fear = 3,
    Trust = 4,
    Curiosity = 5,
}

impl Emotion {
    pub const ALL: [Emotion; EMOTION_COUNT] =
        [Emotion::Joy, Emotion::Sadness, Emotion::Anger, Emotion::Fear, Emotion::Trust, Emotion::Curiosity];

    pub fn as_str(self) -> &'static str {
        match self {
            Emotion::Joy => "joy",
            Emotion::Sadness => "sadness",
            Emotion::Anger => "anger",
            Emotion::Fear => "fear",
            Emotion::Trust => "trust",
            Emotion::Curiosity => "curiosity",
        }
    }

    pub fn parse(s: &str) -> Option<Emotion> {
        Emotion::ALL.into_iter().find(|e| e.as_str() == s)
    }
}

/// How strongly a Nous feels: scales every `feel`. Unknown settings feel at 1.0.
pub fn intensity_multiplier(setting: &str) -> f64 {
    match setting {
        "low" => 0.5,
        "high" => 1.5,
        _ => 1.0,
    }
}

#[derive(Debug, Clone)]
pub struct ThymosTracker {
    pub baseline_mood: String,
    pub emotional_intensity: String,
    /// Indexed by `Emotion as usize`.
    pub intensities: [f64; EMOTION_COUNT],
    /// What last caused each emotion.
    pub last_trigger: [String; EMOTION_COUNT],
    /// `(emotion name, trigger words)` in configured order. Names that are not emotions
    /// are kept and ignored when matching.
    triggers: Vec<(String, Vec<String>)>,
    multiplier: f64,
}

impl ThymosTracker {
    pub fn new(baseline_mood: &str, emotional_intensity: &str, triggers: Vec<(String, Vec<String>)>) -> Self {
        ThymosTracker {
            baseline_mood: baseline_mood.to_string(),
            emotional_intensity: emotional_intensity.to_string(),
            intensities: [0.0; EMOTION_COUNT],
            last_trigger: Default::default(),
            triggers,
            multiplier: intensity_multiplier(emotional_intensity),
        }
    }

    /// Add an emotion, scaled by the Nous's emotional intensity, capped at 1.0.
    pub fn feel(&mut self, emotion: Emotion, intensity: f64, trigger: &str) {
        let i = emotion as usize;
        let raised = 1.0_f64.min(self.intensities[i] + intensity * self.multiplier);
        self.intensities[i] = 0.0_f64.max(1.0_f64.min(raised));
        if !trigger.is_empty() {
            self.last_trigger[i] = trigger.to_string();
        }
    }

    /// Every emotion fades toward zero by `DECAY_RATE`.
    pub fn decay(&mut self) {
        for v in &mut self.intensities {
            *v = 0.0_f64.max(*v - DECAY_RATE);
        }
    }

    /// Configured triggers found in `text` (case-insensitive substring), in configured order.
    pub fn check_triggers(&self, text: &str) -> Vec<(Emotion, String)> {
        let text = text.to_lowercase();
        let mut matches = Vec::new();
        for (name, words) in &self.triggers {
            let Some(emotion) = Emotion::parse(name) else { continue };
            for word in words {
                if text.contains(&word.to_lowercase()) {
                    matches.push((emotion, word.clone()));
                }
            }
        }
        matches
    }

    /// Match triggers and feel each one at `base_intensity`.
    pub fn apply_triggers(&mut self, text: &str, base_intensity: f64) -> Vec<(Emotion, String)> {
        let matches = self.check_triggers(text);
        for (emotion, word) in &matches {
            self.feel(*emotion, base_intensity, word);
        }
        matches
    }

    /// The strongest emotion; on a tie, the first in canonical order.
    pub fn dominant(&self) -> (Emotion, f64) {
        let mut best = Emotion::ALL[0];
        for e in Emotion::ALL {
            if self.intensities[e as usize] > self.intensities[best as usize] {
                best = e;
            }
        }
        (best, self.intensities[best as usize])
    }

    /// The dominant emotion's name, or the baseline mood when nothing is felt strongly.
    pub fn current_mood(&self) -> &str {
        let (emotion, intensity) = self.dominant();
        if intensity < 0.2 {
            &self.baseline_mood
        } else {
            emotion.as_str()
        }
    }
}
