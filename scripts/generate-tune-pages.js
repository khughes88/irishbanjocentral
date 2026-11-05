import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(SCRIPT_DIR, "..");
const DATA_FILE = path.join(SITE_DIR, "tunes.json");
const OUTPUT_DIR = path.join(SITE_DIR, "tunes");
const DEFAULT_PAGE_LIMIT = 10;

function getPageLimit(args) {
  const limitIndex = args.findIndex((arg) => arg === "--limit" || arg.startsWith("--limit="));
  if (limitIndex < 0) return DEFAULT_PAGE_LIMIT;

  const value = args[limitIndex] === "--limit"
    ? args[limitIndex + 1]
    : args[limitIndex].slice("--limit=".length);
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("The --limit value must be a positive whole number.");
  }
  return limit;
}

function parseTuneRows(source) {
  const trimmed = source.trim();
  const arrayStart = trimmed.indexOf("[");
  if (arrayStart < 0 || !["", "iterate"].includes(trimmed.slice(0, arrayStart).trim())) {
    throw new Error("tunes.json does not have the expected JSON array format.");
  }

  const rows = JSON.parse(trimmed.slice(arrayStart));
  if (!Array.isArray(rows)) throw new Error("tunes.json must contain a list of tune settings.");
  return rows;
}

function uniqueTunesInSourceOrder(rows) {
  const firstSettingByTune = new Map();
  for (const setting of rows) {
    if (!setting || setting.tune_id == null || !setting.name || typeof setting.abc !== "string") {
      throw new Error("A tune setting is missing its tune ID, name, or ABC notation.");
    }
    const tuneId = String(setting.tune_id);
    if (!firstSettingByTune.has(tuneId)) firstSettingByTune.set(tuneId, setting);
  }
  return [...firstSettingByTune.values()];
}

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tune";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function abcKey(mode) {
  const match = /^([A-G])(major|minor|dorian|mixolydian)$/.exec(mode || "");
  if (!match) return "C";
  const [, tonic, quality] = match;
  return tonic + ({
    major: "",
    minor: "m",
    dorian: "dor",
    mixolydian: "mix"
  })[quality];
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function createTunePage(tune) {
  const title = escapeHtml(tune.name);
  const description = escapeHtml(
    `${tune.name} — ${[tune.type, tune.meter, tune.mode].filter(Boolean).join(", ")}. Music notation and GDAE tenor banjo tablature.`
  );
  const metadata = [tune.type, tune.meter, tune.mode]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");
  const abc = [
    "X:1",
    `T:${String(tune.name).replace(/[\r\n]/g, " ").trim()}`,
    `M:${String(tune.meter || "4/4").replace(/[\r\n]/g, " ").trim()}`,
    `K:${abcKey(tune.mode)}`,
    tune.abc
  ].join("\n");
  const embeddedTune = safeJson({
    name: tune.name,
    abc,
    settingId: String(tune.setting_id ?? ""),
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${description}">
  <meta name="theme-color" content="#153a32">
  <title>${title} — Irish Banjo Central</title>
  <script defer src="../components/site-header.js"></script>
  <script defer src="../components/site-footer.js"></script>
  <style>
    :root {
      color-scheme: light;
      --ink: #20342c;
      --paper: #f7f3e9;
      --paper-deep: #eee7d7;
      --muted: #6d756c;
      --serif: Georgia, "Times New Roman", serif;
      --sans: "Avenir Next", Avenir, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); }
    .tune-page { width: min(1120px, calc(100% - 48px)); min-height: 65vh; margin-inline: auto; padding-block: 54px 80px; }
    h1 { margin: 0 0 10px; font-family: var(--serif); font-size: clamp(36px, 5vw, 56px); font-weight: 400; letter-spacing: -.045em; }
    .metadata { margin: 0 0 28px; color: var(--muted); font-size: 14px; line-height: 1.6; }
    .music { min-width: 0; overflow-x: auto; padding: 22px 18px; background: #fffdf8; }
    .music svg { display: block; width: 100%; max-width: 100%; height: auto; }
    .status { min-height: 1.5em; margin: 12px 0 0; color: var(--muted); font-size: 13px; }
    details { margin-top: 20px; font-size: 13px; }
    summary { width: fit-content; color: var(--muted); cursor: pointer; }
    pre { max-height: 400px; overflow: auto; padding: 16px; background: #fffdf8; font: 12px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
    @media (max-width: 760px) {
      .tune-page { width: min(100% - 36px, 560px); padding-block: 36px 64px; }
      .music { padding: 16px 10px; }
    }
  </style>
</head>
<body>
  <site-header solid></site-header>
  <main class="tune-page">
    <h1>${title}</h1>
    <p class="metadata">${metadata}</p>
    <div class="music" id="tune-music" role="img" aria-label="${title} in standard notation and GDAE tablature"></div>
    <p class="status" id="render-status" role="status" aria-live="polite">Rendering music notation and GDAE tablature...</p>
  </main>
  <site-footer></site-footer>
  <script type="application/json" id="tune-data">${embeddedTune}</script>
  <script src="../vendor/abcjs-basic-min.js"></script>
  <script>
    const tune = JSON.parse(document.querySelector("#tune-data").textContent);
    const music = document.querySelector("#tune-music");
    const status = document.querySelector("#render-status");

    try {
      if (!window.ABCJS?.renderAbc) throw new Error("The local abcjs renderer could not be loaded.");
      window.ABCJS.renderAbc(music, tune.abc, {
        staffwidth: Math.max(320, music.clientWidth - 36),
        responsive: "resize",
        scale: 1,
        tablature: [{
          instrument: "mandolin",
          label: "GDAE",
          tuning: ["G,", "D", "A", "e"]
        }]
      });
      status.textContent = "";
    } catch (error) {
      console.error("Unable to render tune notation.", error);
      status.textContent = \`Unable to render notation: \${error.message}\`;
    }
  </script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9338474555539130"
       crossorigin="anonymous"></script>
</body>
</html>
`;
}

async function main() {
  const pageLimit = getPageLimit(process.argv.slice(2));
  const source = await readFile(DATA_FILE, "utf8");
  const rows = parseTuneRows(source);
  const tunes = uniqueTunesInSourceOrder(rows).slice(0, pageLimit);
  if (!tunes.length) throw new Error("No tunes were found in tunes.json.");

  await mkdir(OUTPUT_DIR, { recursive: true });

  let generated = 0;
  let skipped = 0;
  for (const tune of tunes) {
    const filename = `${slugify(String(tune.tune_id))}-${slugify(tune.name)}.html`;
    try {
      await writeFile(path.join(OUTPUT_DIR, filename), createTunePage(tune), {
        encoding: "utf8",
        flag: "wx"
      });
      generated += 1;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      skipped += 1;
    }
  }

  const existingFiles = new Set(await readdir(OUTPUT_DIR));
  const availableTuneIds = uniqueTunesInSourceOrder(rows)
    .filter((tune) => existingFiles.has(`${slugify(String(tune.tune_id))}-${slugify(tune.name)}.html`))
    .map((tune) => String(tune.tune_id));
  await writeFile(
    path.join(OUTPUT_DIR, "manifest.json"),
    `${JSON.stringify(availableTuneIds)}\n`,
    "utf8"
  );

  console.log(`Generated ${generated} page${generated === 1 ? "" : "s"}; skipped ${skipped} existing.`);
}

main().catch((error) => {
  console.error(`Unable to generate tune pages: ${error.message}`);
  process.exitCode = 1;
});
