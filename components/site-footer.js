class SiteFooter extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { display: block; }

        * { box-sizing: border-box; }

        footer {
          padding-block: 28px;
          background: #153a32;
          color: rgb(255 250 240 / 70%);
          font-family: "Avenir Next", Avenir, "Segoe UI", sans-serif;
        }

        .inner {
          display: flex;
          width: min(1120px, calc(100% - 48px));
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-inline: auto;
          font-size: 12px;
        }

        .brand {
          color: #fffaf0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 16px;
        }

        p { margin: 0; }

        .attribution { flex-basis: 100%; font-size: 10px; }
        .privacy { color: #fffaf0; }

        a { color: inherit; }

        @media (max-width: 760px) {
          .inner { width: min(100% - 36px, 560px); }
        }

        @media (max-width: 420px) {
          .inner { align-items: flex-start; flex-direction: column; gap: 8px; }
        }
      </style>
      <footer>
        <div class="inner">
          <span class="brand">Irish Banjo Central</span>
          <p>Irish tenor banjo tablature archive</p>
          <p><a class="privacy" href="/tune-index.html">Browse tunes A–Z</a></p>
          <p>  &copy; ${new Date().getFullYear()}</p>
          <p><a class="privacy" href="/privacy.html">Privacy Policy</a></p>
          <p class="attribution">Contains information from <a href="https://github.com/adactio/TheSession-data">The Session</a>, made available under the <a href="https://opendatacommons.org/licenses/odbl/1-0/">Open Database License (ODbL)</a>.</p>
        </div>
      </footer>`;
  }
}

customElements.define("site-footer", SiteFooter);
