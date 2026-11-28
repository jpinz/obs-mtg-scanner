import { createSignal } from "solid-js";

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

function SampleCard() {
  return (
    <img
      class="landing-card"
      src="https://cards.scryfall.io/normal/front/b/0/b0faa7f2-b547-42c4-a810-839da50dadfe.jpg?1783948669"
      alt="Black Lotus, a Magic: The Gathering card from Limited Edition Alpha"
      width="488"
      height="680"
    />
  );
}

export function Landing() {
  const [overlayVisible, setOverlayVisible] = createSignal(true);

  return (
    <div class="landing">
      <a class="landing-skip" href="#landing-main">Skip to content</a>
      <header class="landing-nav">
        <a class="landing-brand" href="./" aria-label="ManaCast home">
          <img src={`${import.meta.env.BASE_URL}manacast-mark.svg`} alt="" width="40" height="40" />
          <span>ManaCast</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#questions">Questions</a>
          <a class="landing-nav__launch" href="./app.html">Launch app <Arrow /></a>
        </nav>
      </header>

      <main id="landing-main">
        <section class="landing-hero" aria-labelledby="landing-title">
          <div class="landing-hero__intro">
            <h1 id="landing-title">Your cards.<br />On camera. <span>On stream.</span></h1>
            <div class="landing-hero__action">
              <p>Show the card. Share the details. Turn your webcam into an MTG card scanner, with an overlay made for OBS.</p>
              <a class="landing-launch" href="./app.html">Launch app <Arrow /></a>
              <span class="landing-hero__note">Runs in your browser. Video stays on your device.</span>
            </div>
          </div>

          <div class="landing-demo" aria-label="Illustrative camera-to-overlay demonstration">
            <div class="landing-demo__heading">
              <span>From your tabletop to their screen</span>
              <button type="button" aria-pressed={overlayVisible() ? "true" : "false"} aria-controls="demo-overlay"
                onClick={() => setOverlayVisible((visible) => !visible)}>
                {overlayVisible() ? "Hide example overlay" : "Show example overlay"}
                <span class={["landing-switch", { "landing-switch--on": overlayVisible() }]} aria-hidden="true" />
              </button>
            </div>
            <div class="landing-demo__table">
              <div class="landing-demo__camera">
                <div class="landing-demo__camera-label">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" />
                  </svg>
                  Camera view
                </div>
                <div class="landing-demo__card-zone">
                  <SampleCard />
                </div>
                <span class="landing-demo__caption">Illustrative preview. No camera is active.</span>
              </div>
              <div class="landing-demo__result">
                <div class="landing-demo__result-heading">What your viewers see <Arrow /></div>
                <div id="demo-overlay" class={["landing-demo__overlay", { "landing-demo__overlay--hidden": !overlayVisible() }]}
                  aria-hidden={overlayVisible() ? "false" : "true"}>
                  <span class="landing-demo__match">Card identified</span>
                  <strong>Black Lotus</strong>
                  <p>Limited Edition Alpha <span aria-hidden="true">/</span> Rare</p>
                  <div class="landing-demo__details">Card image, set, rarity<br />and available prices</div>
                  <span class="landing-demo__source">Real card details come from Scryfall.</span>
                </div>
                <p class="landing-demo__waiting" hidden={overlayVisible()}>Your camera, without the overlay.<br />Show the example to see the difference.</p>
                <p class="landing-demo__result-note">A separate, display-only Browser Source for OBS.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" class="landing-how" aria-labelledby="how-title">
          <div class="landing-section-intro">
            <h2 id="how-title">One camera.<br />A better view for everyone.</h2>
            <p>The scanner handles the cards. OBS handles the stream. Connect them once, then keep your attention on the tabletop.</p>
          </div>
          <ol class="landing-steps">
            <li>
              <span class="landing-steps__number" aria-hidden="true">1</span>
              <h3>Bring your camera</h3>
              <p>Launch the app in a desktop browser, choose a webcam, and start the preview. The first scan loads the recognition models and catalog.</p>
              <span class="landing-steps__where">In your browser</span>
            </li>
            <li>
              <span class="landing-steps__number" aria-hidden="true">2</span>
              <h3>Connect your stream</h3>
              <p>Enable OBS WebSocket, enter its port and password in OBS setup, then copy your overlay URL into an OBS Browser Source.</p>
              <span class="landing-steps__where">In OBS</span>
            </li>
            <li>
              <span class="landing-steps__number" aria-hidden="true">3</span>
              <h3>Let the cards do the talking</h3>
              <p>Hold a card up to the camera. Recognized card details appear in your preview and on your stream. Keep the scanner tab open while streaming.</p>
              <a href="./app.html">Start scanning <Arrow /></a>
            </li>
          </ol>
        </section>

        <section class="landing-control" aria-labelledby="control-title">
          <div class="landing-control__statement">
            <h2 id="control-title">Your tabletop.<br />Your way.</h2>
            <p>Keep the stream in view without keeping every setting on screen.</p>
            <a href="./app.html">Explore the workspace <Arrow /></a>
          </div>
          <dl class="landing-features">
            <div><dt>Make the overlay yours</dt><dd>Position card details, choose what to show, and adjust colors and text sizes.</dd></div>
            <div><dt>Focus the scanner</dt><dd>Filter by set or Scryfall query, tune matching, and mask areas you want ignored.</dd></div>
            <div><dt>Keep track of your finds</dt><dd>Review saved cards and their prices in History. Celebrate valuable finds with optional effects and sound.</dd></div>
            <div><dt>Keep your video local</dt><dd>Recognition runs in your browser. Card details and tracking go to local OBS; webcam video stays on your device.</dd></div>
          </dl>
        </section>

        <section id="questions" class="landing-questions" aria-labelledby="questions-title">
          <h2 id="questions-title">Before you go live.</h2>
          <div class="landing-faq">
            <details>
              <summary>Does OBS need access to my webcam?</summary>
              <p>No. This browser tab owns the camera. The OBS overlay is a display-only Browser Source that receives card information over the local OBS WebSocket.</p>
            </details>
            <details>
              <summary>What if OBS is already using my camera?</summary>
              <p>Select OBS Virtual Camera in the scanner, or release the webcam in the other application. A camera already in use may not be available to the browser.</p>
            </details>
            <details>
              <summary>Do I need an internet connection?</summary>
              <p>Yes. The scanner loads recognition models and checks the live card catalog. Card details and prices are retrieved from Scryfall. Recognition itself runs on your device.</p>
            </details>
            <details>
              <summary>Can I use the scanner without OBS?</summary>
              <p>Yes. Scan cards, see the preview, and review History in the browser. Connect OBS when you want the overlay on your stream.</p>
            </details>
          </div>
        </section>

        <section class="landing-close" aria-labelledby="close-title">
          <h2 id="close-title">Next card.<br />Better context.</h2>
          <a class="landing-launch" href="./app.html">Launch app <Arrow /></a>
        </section>
      </main>

      <footer class="landing-footer">
        <a class="landing-brand" href="./"><img src={`${import.meta.env.BASE_URL}manacast-mark.svg`} alt="" width="40" height="40" />ManaCast</a>
        <p>Open source under AGPL-3.0. Recognition powered by <a href="https://github.com/HanClinto/CollectorVision">CollectorVision</a>.<br />Card data and images via <a href="https://scryfall.com/">Scryfall</a>. Card content belongs to <a href="https://company.wizards.com/">Wizards of the Coast</a>.</p>
        <a href="https://github.com/jpinz/obs-mtg-scanner">View source <Arrow /></a>
      </footer>
    </div>
  );
}
