"""Tests for Thymos — emotion and mood tracking."""

from noesis_brain.thymos import Emotion, EmotionState, MoodState, ThymosTracker


class TestEmotionState:
    def test_clamp_upper(self):
        state = EmotionState(emotion=Emotion.JOY, intensity=1.5)
        state.clamp()
        assert state.intensity == 1.0

    def test_clamp_lower(self):
        state = EmotionState(emotion=Emotion.SADNESS, intensity=-0.3)
        state.clamp()
        assert state.intensity == 0.0


class TestMoodState:
    def test_defaults_all_emotions(self):
        mood = MoodState()
        assert len(mood.emotions) == 6
        for e in Emotion:
            assert e in mood.emotions

    def test_dominant_emotion(self):
        mood = MoodState()
        mood.emotions[Emotion.JOY].intensity = 0.8
        mood.emotions[Emotion.CURIOSITY].intensity = 0.3
        assert mood.dominant_emotion().emotion == Emotion.JOY

    def test_current_mood_baseline_when_calm(self):
        mood = MoodState(baseline_mood="curious")
        assert mood.current_mood() == "curious"

    def test_current_mood_follows_dominant(self):
        mood = MoodState(baseline_mood="neutral")
        mood.emotions[Emotion.ANGER].intensity = 0.7
        assert mood.current_mood() == "anger"

    def test_active_emotions(self):
        mood = MoodState()
        mood.emotions[Emotion.JOY].intensity = 0.5
        mood.emotions[Emotion.CURIOSITY].intensity = 0.4
        mood.emotions[Emotion.FEAR].intensity = 0.1
        active = mood.active_emotions(threshold=0.3)
        assert len(active) == 2
        emotions = {s.emotion for s in active}
        assert Emotion.JOY in emotions
        assert Emotion.CURIOSITY in emotions

    def test_describe_calm(self):
        mood = MoodState(baseline_mood="curious")
        desc = mood.describe()
        assert "curious" in desc
        assert "calm" in desc

    def test_describe_active(self):
        mood = MoodState()
        mood.emotions[Emotion.ANGER].intensity = 0.7
        desc = mood.describe()
        assert "anger" in desc
        assert "0.7" in desc


class TestThymosTracker:
    def test_feel_basic(self):
        tracker = ThymosTracker()
        tracker.feel(Emotion.JOY, 0.5, trigger="good trade")
        assert tracker.mood.emotions[Emotion.JOY].intensity == 0.5
        assert tracker.mood.emotions[Emotion.JOY].trigger == "good trade"

    def test_feel_accumulates(self):
        tracker = ThymosTracker()
        tracker.feel(Emotion.JOY, 0.3)
        tracker.feel(Emotion.JOY, 0.3)
        assert tracker.mood.emotions[Emotion.JOY].intensity == 0.6

    def test_feel_caps_at_one(self):
        tracker = ThymosTracker()
        tracker.feel(Emotion.JOY, 0.7)
        tracker.feel(Emotion.JOY, 0.7)
        assert tracker.mood.emotions[Emotion.JOY].intensity == 1.0

    def test_feel_intensity_multiplier_high(self):
        tracker = ThymosTracker({"emotional_intensity": "high"})
        tracker.feel(Emotion.ANGER, 0.3)
        # 0.3 * 1.5 = 0.45
        assert abs(tracker.mood.emotions[Emotion.ANGER].intensity - 0.45) < 0.01

    def test_feel_intensity_multiplier_low(self):
        tracker = ThymosTracker({"emotional_intensity": "low"})
        tracker.feel(Emotion.ANGER, 0.6)
        # 0.6 * 0.5 = 0.3
        assert abs(tracker.mood.emotions[Emotion.ANGER].intensity - 0.3) < 0.01

    def test_decay(self):
        tracker = ThymosTracker()
        tracker.feel(Emotion.JOY, 0.5)
        tracker.decay()
        assert tracker.mood.emotions[Emotion.JOY].intensity < 0.5
        assert tracker.mood.emotions[Emotion.JOY].intensity > 0.0

    def test_decay_to_zero(self):
        tracker = ThymosTracker()
        tracker.feel(Emotion.FEAR, 0.03)
        tracker.decay()
        assert tracker.mood.emotions[Emotion.FEAR].intensity == 0.0

    def test_check_triggers(self):
        tracker = ThymosTracker({
            "triggers": {
                "joy": ["learning something new", "helping others"],
                "anger": ["dishonesty"],
            },
        })
        matches = tracker.check_triggers("I am learning something new today!")
        assert len(matches) == 1
        assert matches[0][0] == Emotion.JOY
        assert "learning something new" in matches[0][1]

    def test_check_triggers_no_match(self):
        tracker = ThymosTracker({
            "triggers": {"joy": ["specific phrase"]},
        })
        assert tracker.check_triggers("unrelated text") == []

    def test_apply_triggers(self):
        tracker = ThymosTracker({
            "triggers": {
                "anger": ["dishonesty", "willful ignorance"],
            },
        })
        matches = tracker.apply_triggers("That was pure dishonesty!")
        assert len(matches) == 1
        assert tracker.mood.emotions[Emotion.ANGER].intensity > 0.0

    def test_reset(self):
        tracker = ThymosTracker()
        tracker.feel(Emotion.JOY, 0.8)
        tracker.feel(Emotion.ANGER, 0.6)
        tracker.reset()
        for state in tracker.mood.emotions.values():
            assert state.intensity == 0.0

    def test_from_yaml_sophia(self):
        config = {
            "baseline_mood": "curious",
            "emotional_intensity": "medium",
            "triggers": {
                "joy": ["learning something new", "helping others understand"],
                "anger": ["dishonesty", "willful ignorance"],
                "curiosity": ["encountering unknown concepts", "meeting new Nous"],
            },
        }
        tracker = ThymosTracker.from_yaml(config)
        assert tracker.mood.baseline_mood == "curious"
        assert tracker.mood.current_mood() == "curious"

        # Trigger curiosity
        matches = tracker.apply_triggers("I am encountering unknown concepts right now!")
        assert len(matches) >= 1
        assert tracker.mood.emotions[Emotion.CURIOSITY].intensity > 0.0

    def test_from_yaml_hermes(self):
        config = {
            "baseline_mood": "confident",
            "emotional_intensity": "low",
            "triggers": {
                "joy": ["closing a deal", "outsmarting competitors"],
                "anger": ["being cheated", "wasted time"],
            },
        }
        tracker = ThymosTracker.from_yaml(config)
        assert tracker.mood.baseline_mood == "confident"

        # Hermes feels less intensely (low multiplier)
        tracker.feel(Emotion.JOY, 0.4)
        assert tracker.mood.emotions[Emotion.JOY].intensity == 0.2  # 0.4 * 0.5
