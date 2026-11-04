
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { marked } = require("marked");
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");

const BOOK_DIR = "book";
const OUTPUT = "output/book.pdf";

function getFiles(dir) {
    if (!fs.existsSync(dir)) {
        throw new Error(`Missing folder: ${dir}`);
    }

    return fs.readdirSync(dir, { withFileTypes: true })
        .flatMap(entry => {
            const file = path.join(dir, entry.name);

            if (entry.isDirectory()) return getFiles(file);

            return entry.name.endsWith(".md") ? [file] : [];
        })
        .sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true })
        );
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function embedImage(imagePath, markdownFile) {
    if (/^(https?:|data:)/i.test(imagePath)) {
        return imagePath;
    }

    const fullPath = path.resolve(
        path.dirname(markdownFile),
        imagePath.split(/[?#]/)[0]
    );

    if (!fs.existsSync(fullPath)) {
        console.warn("IMAGE NOT FOUND:", fullPath);
        return "";
    }

    const mimeTypes = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".svg": "image/svg+xml"
    };

    const mime = mimeTypes[path.extname(fullPath).toLowerCase()];

    if (!mime) {
        console.warn("Unsupported image:", fullPath);
        return "";
    }

    return `data:${mime};base64,${
        fs.readFileSync(fullPath).toString("base64")
    }`;
}

function getTitle(markdown, file) {
    // Prefer the first Markdown heading.
    const heading = markdown.match(/^#{1,3}\s+(.+)$/m);

    if (heading) {
        return heading[1].trim();
    }

    // Otherwise use the ABC tune title.
    const abcTitle = markdown.match(/^T:\s*(.+)$/m);

    if (abcTitle) {
        return abcTitle[1].trim();
    }

    // Fallback to filename.
    return path.basename(file, ".md")
        .replace(/^\d+[-_]?/, "")
        .replace(/[-_]/g, " ");
}

function createContents(entries, pageNumbers) {
    const rows = entries.map(entry => {
        const page = pageNumbers[entry.marker] ?? "—";

        return `
        <div class="contents-row">
            <span class="contents-title">
                ${escapeHtml(entry.title)}
            </span>
            <span class="contents-dots"></span>
            <span class="contents-page">${page}</span>
        </div>`;
    }).join("\n");

    return `
    <section class="contents chapter">
        <h1>Contents</h1>
        ${rows}
    </section>`;
}

function createHtml(chapters, entries, pageNumbers) {
    const cover = chapters[0].html;

    const contents = createContents(entries, pageNumbers);

    const remaining = chapters.slice(1)
        .map(chapter => chapter.html)
        .join("\n");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">

<style>
    @page {
        size: A4;
        margin: 18mm 16mm 20mm;
    }

    * {
        box-sizing: border-box;
    }

    body {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 11pt;
        line-height: 1.5;
        color: #111;
        margin: 0;
    }

    h1 {
        font-size: 25pt;
        line-height: 1.2;
        margin-top: 0;
        margin-bottom: 12mm;
    }

    h2 {
        font-size: 17pt;
    }

    h3 {
        font-size: 13pt;
    }

    h1, h2, h3 {
        break-after: avoid;
    }

    p {
        margin: 0 0 4mm;
    }

    /* Start each chapter on a new page. */
    .chapter {
        break-before: page;
    }

    /* Cover begins on page one. */
    .chapter.cover {
        break-before: auto;
    }

    /* Contents */
    .contents {
        break-before: page;
    }

    .contents h1 {
        margin-bottom: 12mm;
    }

    .contents-row {
        display: flex;
        align-items: baseline;
        margin-bottom: 3mm;
        font-size: 11pt;
        break-inside: avoid;
    }

    .contents-title {
        flex-shrink: 1;
    }

    .contents-dots {
        flex: 1;
        border-bottom: 1px dotted #aaa;
        margin: 0 3mm 3px;
        min-width: 5mm;
    }

    .contents-page {
        min-width: 10mm;
        text-align: right;
        font-variant-numeric: tabular-nums;
    }

    /* Internal page-location marker.
       Printed invisibly, but readable from PDF text. */
    .page-marker {
        color: white;
        font-size: 6pt;
        line-height: 1;
        height: 1px;
        overflow: hidden;
    }

    .chapter img {
        display: block;
        width: auto;
        max-width: 100%;
        height: auto;
        max-height: 250mm;
        object-fit: contain;
        margin: 4mm auto;
        break-inside: avoid;
    }

    .music {
        margin: 12px 0 20px;
        max-width: 100%;
    }

    .music svg {
        display: block;
        width: 100%;
        max-width: 100%;
        height: auto;
        overflow: visible;
    }

    pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-size: 9pt;
    }

    table {
        border-collapse: collapse;
        width: 100%;
    }

    th, td {
        padding: 5px;
        border-bottom: 1px solid #ccc;
    }
</style>
</head>

<body>
${cover}
${contents}
${remaining}
</body>
</html>`;
}

async function renderPdf(browser, chapters, entries, pageNumbers, tunes) {
    const page = await browser.newPage({
        viewport: {
            width: 1000,
            height: 1400
        }
    });

    try {
        const html = createHtml(chapters, entries, pageNumbers);

        await page.setContent(html, {
            waitUntil: "load"
        });

        await page.addScriptTag({
            path: require.resolve("abcjs/dist/abcjs-basic-min.js")
        });

        await page.evaluate(tunes => {
            for (const tune of tunes) {
                ABCJS.renderAbc(tune.id, tune.abc, {
                    staffwidth: 600,
                    scale: 0.85,
                    tablature: [{
                        instrument: "mandolin",
                        label: "GDAE"
                    }]
                });
            }
        }, tunes);

        await page.evaluate(async () => {
            await Promise.all(
                Array.from(document.images).map(img => {
                    if (img.complete) return Promise.resolve();

                    return new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = resolve;
                    });
                })
            );

            await document.fonts.ready;
        });

        return await page.pdf({
            format: "A4",
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: "<span></span>",
            footerTemplate: `
                <div style="
                    font-size:9px;
                    width:100%;
                    text-align:center;
                ">
                    <span class="pageNumber"></span>
                </div>`,
            margin: {
                top: "18mm",
                bottom: "20mm",
                left: "16mm",
                right: "16mm"
            }
        });

    } finally {
        await page.close();
    }
}

// Read the actual printed pages from the PDF.
async function findPageNumbers(pdfBuffer, entries) {
    const data = new Uint8Array(pdfBuffer);

    const pdf = await pdfjs.getDocument({
        data,
        disableFontFace: true,
        useSystemFonts: true
    }).promise;

    const numbers = {};

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const pdfPage = await pdf.getPage(pageNumber);
        const content = await pdfPage.getTextContent();

        const text = content.items
            .map(item => item.str)
            .join("")
            .replace(/\s/g, "");

        for (const entry of entries) {
            if (text.includes(entry.marker)) {
                numbers[entry.marker] = pageNumber;
            }
        }

        pdfPage.cleanup();
    }

    return numbers;
}

async function build() {
    const files = getFiles(BOOK_DIR);
    const tunes = [];
    const entries = [];

    const renderer = new marked.Renderer();

    renderer.code = function (token) {
        const code = token.text || "";
        const lang = (token.lang || "").trim().toLowerCase();

        if (lang === "abc") {
            const id = `tune-${tunes.length}`;

            tunes.push({ id, abc: code });

            return `<div id="${id}" class="music"></div>`;
        }

        return `<pre><code>${escapeHtml(code)}</code></pre>`;
    };

    marked.use({ renderer });

    const chapters = files.map((file, index) => {
        const markdown = fs.readFileSync(file, "utf8");

        console.log("Processing:", file);

        const tokens = marked.lexer(markdown);

        marked.walkTokens(tokens, token => {
            if (token.type === "image") {
                token.href = embedImage(token.href, file);
            }
        });

        const title = getTitle(markdown, file);
        const marker = `BOOKSECTION${String(index).padStart(5, "0")}`;

        // Cover is the first file and is not indexed.
        const isCover = index === 0;

        if (!isCover) {
            entries.push({ title, marker });
        }

        const markerHtml = isCover
            ? ""
            : `<div class="page-marker">${marker}</div>`;

        return {
            title,
            marker,
            html: `
                <section class="chapter ${isCover ? "cover" : ""}">
                    ${markerHtml}
                    ${marked.parser(tokens)}
                </section>`
        };
    });

    fs.mkdirSync(path.dirname(OUTPUT), {
        recursive: true
    });

    const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox"]
    });

    try {
        let pageNumbers = {};
        let pdfBuffer;

        // Rebuild until the contents page numbers settle.
        for (let pass = 1; pass <= 5; pass++) {
            console.log(`PDF build pass ${pass}`);

            pdfBuffer = await renderPdf(
                browser,
                chapters,
                entries,
                pageNumbers,
                tunes
            );

            const actualNumbers = await findPageNumbers(
                pdfBuffer,
                entries
            );

            const unchanged = entries.every(entry =>
                actualNumbers[entry.marker] ===
                pageNumbers[entry.marker]
            );

            if (unchanged) {
                console.log("Page numbers verified.");
                break;
            }

            pageNumbers = actualNumbers;

            if (pass === 5) {
                // Ensure the final PDF uses the latest numbers.
                pdfBuffer = await renderPdf(
                    browser,
                    chapters,
                    entries,
                    pageNumbers,
                    tunes
                );
            }
        }

        fs.writeFileSync(OUTPUT, pdfBuffer);

        console.log("");
        console.log("CONTENTS");
        console.log("----------------------------");

        for (const entry of entries) {
            console.log(
                `${entry.title} .... ${pageNumbers[entry.marker] ?? "NOT FOUND"}`
            );
        }

        console.log("----------------------------");
        console.log(`Created ${OUTPUT}`);
        console.log(`Rendered ${tunes.length} ABC tunes`);

        const missing = entries.filter(entry =>
            pageNumbers[entry.marker] === undefined
        );

        if (missing.length) {
            console.warn(
                "WARNING: Some page numbers could not be found:",
                missing.map(entry => entry.title)
            );
        }

    } finally {
        await browser.close();
    }
}

build().catch(error => {
    console.error(error);
    process.exit(1);
});
