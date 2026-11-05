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
Its tune search shows selectable tune suggestions directly below the field. On the home page, suggestions come from the tune browser; on generated tune pages, the shared header loads the catalogue and submits selections back to the home page.

## Generate tune pages

Generate a static HTML page for every unique tune in `tunes.json`:

```sh
node scripts/generate-tune-pages.js
```

Each generated page lives in `tunes/`, includes the shared header and footer, embeds the tune's ABC notation, and renders standard notation with GDAE tablature using the local abcjs library. Filenames start with the tune ID, followed by a tune-name slug, matching the links in the shared header's search suggestions. Existing pages are skipped and never overwritten, so rerunning the generator does not create duplicates. To generate only a subset, pass `--limit`:

```sh
node scripts/generate-tune-pages.js --limit 10
```

Generated filenames use the tune name and tune ID to avoid collisions between tunes with the same name.