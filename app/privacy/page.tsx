export const dynamic = "force-static";

export default function PrivacyPage() {
  return (
    <main className="document-page">
      <article>
        <p className="eyebrow">opengorky</p>
        <h1>Privacy</h1>
        <p className="document-updated">Effective August 27, 2026</p>

        <h2>Your canvas data stays in your browser</h2>
        <p>
          opengorky has no account system or application backend. Canvases, pasted images,
          and link cards are saved in origin-private browser storage on the device where
          you use the app. We do not receive or sync that content.
        </p>

        <h2>Portable files</h2>
        <p>
          Exporting a canvas creates a JSON file that you control. Importing reads the file
          in your browser. You decide where exported files are stored and who receives them.
        </p>

        <h2>Hosting and external links</h2>
        <p>
          GitHub Pages serves the static application files and may process ordinary web
          request information under GitHub&apos;s own privacy terms. Following a link card
          opens that third-party site, which applies its own privacy practices.
        </p>

        <h2>Clearing data</h2>
        <p>
          Delete canvases inside opengorky or clear this site&apos;s browser storage. Export
          anything you want to keep first; clearing site data cannot be undone by opengorky.
        </p>

        <p className="document-actions">
          <a href="../">Return to your canvas</a>
          <a href="https://github.com/nostrapollo/opengorky" target="_blank" rel="noreferrer">
            View the source on GitHub
          </a>
        </p>
      </article>
    </main>
  );
}
