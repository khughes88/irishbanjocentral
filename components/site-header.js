const headerScript = document.currentScript
  || [...document.scripts].find((script) => script.src.includes("/components/site-header.js"));
const siteRoot = headerScript
  ? new URL("../", headerScript.src)
  : new URL("./", window.location.href);
let tuneIndexPromise;

class SiteHeader extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          position: absolute;
          z-index: 10;
          top: 0;
          left: 0;
          display: block;
          width: 100%;
          color: #fffaf0;
          pointer-events: auto;
        }

        :host([solid]) {
          position: relative;
          background: #153a32;
        }

        * { box-sizing: border-box; }

        nav {
          display: grid;
          width: min(1120px, calc(100% - 48px));
          grid-template-columns: minmax(0, 1fr) auto;
          grid-template-areas:
            "brand links"
            "search search";
          align-items: center;
          gap: 12px 24px;
          margin-inline: auto;
          padding-block: 14px;
          border-bottom: 1px solid rgb(255 250 240 / 20%);
        }

        .brand {
          grid-area: brand;
          display: inline-flex;
          align-items: center;
          gap: 11px;
          color: #fffaf0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 19px;
          font-weight: 700;
          letter-spacing: -.03em;
          text-decoration: none;
        }

        .brand-mark {
          display: block;
          width: 34px;
          height: 34px;
          border: 1px solid rgb(255 250 240 / 55%);
          border-radius: 50%;
          object-fit: cover;
          object-position: 82% center;
        }

        .links {
          grid-area: links;
          display: flex;
          align-items: center;
          gap: 34px;
          font-family: "Avenir Next", Avenir, "Segoe UI", sans-serif;
          font-size: 13px;
          font-weight: 600;
        }

        .links a {
          color: rgb(255 250 240 / 82%);
          text-decoration: none;
          transition: color .2s ease;
        }

        .links a:hover { color: #fff; }

        form {
          position: relative;
          grid-area: search;
          display: flex;
          width: min(100%, 560px);
          justify-self: end;
        }

        label {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          clip-path: inset(50%);
        }

        input {
          width: 100%;
          min-width: 0;
          min-height: 42px;
          padding: 0 12px;
          border: 1px solid rgb(255 250 240 / 48%);
          border-radius: 3px;
          background: rgb(255 250 240 / 96%);
          color: #20342c;
          cursor: text;
          font: 14px "Avenir Next", Avenir, "Segoe UI", sans-serif;
        }

        input:focus-visible,
        .suggestion:focus-visible {
          outline: 3px solid #e8834d;
          outline-offset: 2px;
        }

        .suggestions {
          position: absolute;
          z-index: 20;
          top: calc(100% + 6px);
          right: 0;
          left: 0;
          max-height: min(55vh, 360px);
          overflow-y: auto;
          padding: 6px;
          border: 1px solid #d5cdbd;
          border-radius: 3px;
          background: #fffdf8;
          box-shadow: 0 12px 28px rgb(0 0 0 / 24%);
          color: #20342c;
        }

        .suggestions[hidden] { display: none; }

        .suggestion {
          display: grid;
          width: 100%;
          min-height: 0;
          gap: 3px;
          padding: 10px 12px;
          border: 0;
          border-radius: 2px;
          background: transparent;
          color: #20342c;
          cursor: pointer;
          font: inherit;
          text-align: left;
        }

        .suggestion:hover,
        .suggestion:focus-visible { background: #eee7d7; }

        .suggestion-name {
          font: 17px Georgia, "Times New Roman", serif;
        }

        .suggestion-meta {
          color: #6d756c;
          font: 11px/1.5 "Avenir Next", Avenir, "Segoe UI", sans-serif;
        }

        .suggestion-empty {
          margin: 0;
          padding: 11px 12px;
          color: #6d756c;
          font: 13px/1.5 "Avenir Next", Avenir, "Segoe UI", sans-serif;
        }

        @media (max-width: 760px) {
          nav {
            width: min(100% - 36px, 560px);
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 12px;
          }
          .brand { font-size: 17px; }
          .links { gap: 18px; }
          .links a { font-size: 12px; }
        }

        @media (max-width: 420px) {
          .links { gap: 12px; }
          .links a:first-child { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { transition-duration: .01ms !important; }
        }
      </style>
      <header>
        <nav aria-label="Main navigation">
          <a class="brand" href="${siteRoot.href}">
            <img class="brand-mark" src="${new URL("banjo.png", siteRoot)}" alt="" aria-hidden="true">
            Irish Banjo Central
          </a>
          <div class="links">
            <a href="${siteRoot.href}#about">About</a>
            <a href="${siteRoot.href}#explore">How to read tablature</a>
          </div>
          <form role="search">
            <label for="tune-query">Search tunes by name</label>
            <input id="tune-query" type="search" name="q" placeholder="Search tunes by name" autocomplete="off" aria-controls="tune-suggestions" aria-expanded="false">
            <div class="suggestions" id="tune-suggestions" role="listbox" aria-label="Tune suggestions" hidden></div>
          </form>
        </nav>
      </header>`;

    const form = root.querySelector("form");
    const input = root.querySelector("#tune-query");
    const suggestions = root.querySelector(".suggestions");
    input.value = new URL(window.location.href).searchParams.get("q") || "";
    input.addEventListener("input", () => {
      this.searchTunes(input.value, suggestions, input);
    });
    input.addEventListener("focus", () => {
      if (input.value.trim()) {
        this.searchTunes(input.value, suggestions, input);
      }
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        const firstSuggestion = suggestions.querySelector(".suggestion");
        if (firstSuggestion) {
          event.preventDefault();
          firstSuggestion.focus();
        }
      } else if (event.key === "Escape") {
        suggestions.hidden = true;
        input.setAttribute("aria-expanded", "false");
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const firstSuggestion = suggestions.querySelector(".suggestion");
      if (firstSuggestion) firstSuggestion.click();
    });

    if (input.value.trim()) this.searchTunes(input.value, suggestions, input);
  }

  async searchTunes(query, container, input) {
    const currentQuery = query.trim();
    if (!currentQuery) {
      container.replaceChildren();
      container.hidden = true;
      input.setAttribute("aria-expanded", "false");
      return;
    }

    container.hidden = false;
    input.setAttribute("aria-expanded", "true");
    try {
      const tunes = await this.loadTuneIndex();
      const normalizedQuery = this.normalize(currentQuery);
      const matches = tunes.filter((tune) =>
        this.normalize(tune.name).includes(normalizedQuery)
      );
      matches.sort((a, b) => {
        const nameA = this.normalize(a.name);
        const nameB = this.normalize(b.name);
        return Number(nameB.includes(normalizedQuery)) - Number(nameA.includes(normalizedQuery))
          || nameA.length - nameB.length
          || nameA.localeCompare(nameB);
      });
      if (input.value.trim() !== currentQuery) return;
      this.renderSuggestions(matches.slice(0, 10), container, input, matches.length);
    } catch (error) {
      console.error("Unable to load tune suggestions.", error);
      container.replaceChildren();
      const message = document.createElement("p");
      message.className = "suggestion-empty";
      message.textContent = "Unable to load tune suggestions.";
      container.append(message);
      container.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
  }

  async loadTuneIndex() {
    if (!tuneIndexPromise) {
      tuneIndexPromise = Promise.all([
        fetch(new URL("tunes.json", siteRoot)),
        fetch(new URL("tunes/manifest.json", siteRoot))
      ])
        .then(async ([tunesResponse, manifestResponse]) => {
          if (!tunesResponse.ok) throw new Error(`The tune file returned ${tunesResponse.status}.`);
          if (!manifestResponse.ok) throw new Error(`The tune page manifest returned ${manifestResponse.status}.`);
          const [source, manifest] = await Promise.all([
            tunesResponse.text(),
            manifestResponse.json()
          ]);
          const trimmed = source.trim();
          const arrayStart = trimmed.indexOf("[");
          if (arrayStart < 0 || !["", "iterate"].includes(trimmed.slice(0, arrayStart).trim())) {
            throw new Error("The tune file does not have the expected format.");
          }
          const rows = JSON.parse(trimmed.slice(arrayStart));
          if (!Array.isArray(rows)) throw new Error("The tune file must contain a list of settings.");
          if (!Array.isArray(manifest) || manifest.some((id) => typeof id !== "string")) {
            throw new Error("The generated tune page manifest has an invalid format.");
          }
          const availableTuneIds = new Set(manifest);
          const firstSettingById = new Map();
          for (const setting of rows) {
            if (!setting || setting.tune_id == null || !setting.name || typeof setting.abc !== "string") {
              throw new Error("A tune setting is missing its tune ID, name, or ABC notation.");
            }
            if (availableTuneIds.has(String(setting.tune_id)) && !firstSettingById.has(String(setting.tune_id))) {
              firstSettingById.set(String(setting.tune_id), setting);
            }
          }
          return [...firstSettingById.values()];
        })
        .catch((error) => {
          tuneIndexPromise = null;
          throw error;
        });
    }
    return tuneIndexPromise;
  }

  normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  }

  renderSuggestions(tunes, container, input, total = tunes.length) {
    container.replaceChildren();
    if (!input.value.trim()) {
      container.hidden = true;
      input.setAttribute("aria-expanded", "false");
      return;
    }

    if (!tunes.length) {
      const message = document.createElement("p");
      message.className = "suggestion-empty";
      message.textContent = "No matching tunes.";
      container.append(message);
      container.hidden = false;
      input.setAttribute("aria-expanded", "true");
      return;
    }

    for (const tune of tunes) {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "suggestion";
      option.setAttribute("role", "option");

      const name = document.createElement("span");
      name.className = "suggestion-name";
      name.textContent = tune.name;
      option.append(name);

      const meta = document.createElement("span");
      meta.className = "suggestion-meta";
      meta.textContent = [tune.type, tune.meter, tune.mode].filter(Boolean).join(" · ");
      option.append(meta);

      option.addEventListener("click", () => this.openTune(tune));
      container.append(option);
    }

    if (total > tunes.length) {
      const message = document.createElement("p");
      message.className = "suggestion-empty";
      message.textContent = `Showing ${tunes.length} of ${total.toLocaleString()} matches. Refine your search to see more.`;
      container.append(message);
    }
    container.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  openTune(tune) {
    const filename = `${this.slugify(String(tune.tune_id))}-${this.slugify(tune.name)}.html`;
    window.location.assign(new URL(`tunes/${filename}`, siteRoot));
  }

  slugify(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tune";
  }
}

customElements.define("site-header", SiteHeader);
