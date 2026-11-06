# Irish Banjo Central

This is a static site. Tune notation and GDAE tablature are rendered in the browser with the locally vendored abcjs library in `vendor/`; no build step or external runtime CDN is required. The abcjs license is included alongside the library.

## Shared page components

Reuse the site header and footer on other pages by adding the component scripts in the page `<head>` and their custom elements where they should appear:

```html
<script type="module" src="./components/site-header.js"></script>
<script type="module" src="./components/site-footer.js"></script>
```

```html
<site-header></site-header>
<!-- Page content -->
<site-footer></site-footer>
```

The header links back to the corresponding sections on the home page.
Its tune search shows selectable tune suggestions directly below the field. Suggestions are limited to tunes with generated pages, and selecting one opens that page.
The footer links to a generated A–Z tune index. The index has a small landing page and separate static pages per initial, listing only tunes with generated pages; the generator refreshes the index, search manifest, and `sitemap.xml` together. `robots.txt` points crawlers to the sitemap.
The shared footer links to `privacy.html`. Configure and publish the Google-certified consent message in AdSense before enabling ads for visitors in the EEA, UK, or Switzerland.

## Generate tune pages

The generator uses the Gemini Developer API to write a short, three-sentence tune overview. Create an API key in [Google AI Studio](https://aistudio.google.com/api-keys), then set it in your shell before running the generator:

```sh
export GEMINI_API_KEY="your-api-key"
```

The default model is `gemini-3.5-flash-lite`; set `GEMINI_MODEL` to use another model available to your API key. Free-tier model access and quotas depend on Google's current availability. The key is read from the environment and is never written to generated pages. Gemini's free tier may use submitted prompts to improve Google products, so review Google's terms and fact-check generated historical details before publishing.

Generate static HTML pages for the first 10 unique tunes in `tunes.json`:

```sh
node scripts/generate-tune-pages.js
```

Each generated page lives in `tunes/`, includes the shared header and footer, embeds the tune's ABC notation, and renders standard notation with GDAE tablature using the local abcjs library. The generated overview covers the tune's background, rhythm, and character; the prompt instructs Gemini not to invent historical claims, but fact-check the text before publishing. Existing pages without an overview receive one without replacing their other content; completed pages are skipped. Filenames start with the tune ID, followed by a tune-name slug, matching the links in the shared header's search suggestions. The generator writes a manifest so search only offers tunes with generated pages. To generate a different-sized subset, pass `--limit`:

```sh
node scripts/generate-tune-pages.js --limit 100
```

Tune index pages are split by initial and paginated in groups of 250 entries, so the directory remains manageable as the library grows. To refresh the index, search manifest, and sitemap without generating tune pages or calling Gemini:

```sh
node scripts/generate-tune-pages.js --index-only
```