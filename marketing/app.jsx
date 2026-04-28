/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakSlider, TweakToggle */
/* global TopNav, Hero, Philosophy, Pillars, Architecture, Closing */

const { useEffect: useAppEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "aegean",
  "density": "default",
  "greek": "core",
  "showTweaks": true
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useAppEffect(() => {
    const b = document.body;
    b.dataset.palette = tweaks.palette === "aegean" ? "" : tweaks.palette;
    b.dataset.density = tweaks.density === "default" ? "" : tweaks.density;
    b.dataset.greek = tweaks.greek === "core" ? "" : tweaks.greek;
  }, [tweaks]);

  return (
    <>
      <TopNav />
      <main>
        <Hero />
        <Philosophy />
        <Pillars />
        <Architecture />
        <Closing />
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Palette">
          <TweakRadio
            label="Theme"
            value={tweaks.palette}
            onChange={(v) => setTweak("palette", v)}
            options={[
              { value: "aegean", label: "Aegean" },
              { value: "ink", label: "Ink" },
              { value: "marble", label: "Marble" },
            ]}
          />
        </TweakSection>
        <TweakSection title="Layout">
          <TweakRadio
            label="Density"
            value={tweaks.density}
            onChange={(v) => setTweak("density", v)}
            options={[
              { value: "tight", label: "Tight" },
              { value: "default", label: "Default" },
              { value: "airy", label: "Airy" },
            ]}
          />
          <TweakRadio
            label="Greek prominence"
            value={tweaks.greek}
            onChange={(v) => setTweak("greek", v)}
            options={[
              { value: "subtle", label: "Subtle" },
              { value: "core", label: "Core" },
              { value: "bold", label: "Bold" },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
