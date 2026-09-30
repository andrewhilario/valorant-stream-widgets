import { ObsFields } from "./ObsFields";

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Get a free HenrikDev key.",
    body: "It’s the service that supplies the rank data. Every streamer uses their own key, so your widget never shares a rate limit with anyone else’s. Paste it under Account; it stays in your browser and goes straight to HenrikDev.",
  },
  {
    title: "Copy the link.",
    body: "Every setting you chose is inside the link, including your key, so keep it private. Change a setting later and the link changes with it, so copy it again.",
  },
  {
    title: "Add a Browser Source and set the size.",
    body: "In OBS, press + under Sources and pick Browser. Paste the link into URL, then type the width and height from the boxes under the preview. In TikTok LIVE Studio, add a Link source instead and paste the same link. The widget resizes itself crisply, so use the Size setting rather than dragging the source bigger.",
  },
  {
    title: "Place it and go live.",
    body: "Drag the source where you want it. It refreshes by itself. If it ever sits blank, open the source’s properties and press Refresh cache of current page.",
  },
];

export function Steps() {
  return (
    <section className="section" id="setup" aria-labelledby="setup-title">
      <div className="section__inner">
        <h2 id="setup-title">Put it on stream</h2>
        <div className="setup">
          <ol className="steps">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <h3>
                  <span className="steps__n mono">{i + 1}</span>
                  {step.title}
                </h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <ObsFields />
        </div>
      </div>
    </section>
  );
}
