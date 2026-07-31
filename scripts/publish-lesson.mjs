import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : null;

if (!inputPath) {
  fail("Usage: node scripts/publish-lesson.mjs path/to/lesson.json");
}

const lesson = JSON.parse(fs.readFileSync(inputPath, "utf8"));
validateLesson(lesson);

const number = String(lesson.number).padStart(2, "0");
const canonical = `https://r3xstudio.com/old-code/${lesson.slug}/`;
const articleDir = path.join(root, "old-code", lesson.slug);
const articlePath = path.join(articleDir, "index.html");
const archivePath = path.join(root, "old-code", "index.html");
const sitemapPath = path.join(root, "sitemap.xml");
const previousPath = path.join(root, "old-code", lesson.previous.slug, "index.html");

if (fs.existsSync(articlePath)) fail(`Article already exists: ${articlePath}`);
if (!fs.existsSync(previousPath)) fail(`Previous article not found: ${previousPath}`);

const coverPath = path.join(root, "assets", lesson.cover.file);
if (!fs.existsSync(coverPath)) fail(`Cover image not found: ${coverPath}`);

const articleHtml = renderArticle(lesson, number, canonical);
const archiveHtml = updateArchive(
  fs.readFileSync(archivePath, "utf8"),
  lesson,
  number
);
const previousHtml = updatePreviousArticle(
  fs.readFileSync(previousPath, "utf8"),
  lesson,
  number
);
const sitemapXml = updateSitemap(
  fs.readFileSync(sitemapPath, "utf8"),
  lesson,
  canonical
);

fs.mkdirSync(articleDir, { recursive: false });
fs.writeFileSync(articlePath, articleHtml);
fs.writeFileSync(archivePath, archiveHtml);
fs.writeFileSync(previousPath, previousHtml);
fs.writeFileSync(sitemapPath, sitemapXml);

console.log(`Published lesson ${number}: ${lesson.title}`);
console.log(`Created ${path.relative(root, articlePath)}`);
console.log("Updated archive, previous/next navigation and sitemap.xml");

function validateLesson(value) {
  const requiredStrings = [
    "slug", "title", "seoTitle", "description", "category", "cardCategory",
    "cardSummary", "readTime", "date", "deck", "intro"
  ];

  if (!Number.isInteger(value.number) || value.number < 1) {
    fail("number must be a positive integer");
  }
  for (const key of requiredStrings) {
    if (typeof value[key] !== "string" || !value[key].trim()) {
      fail(`${key} must be a non-empty string`);
    }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) {
    fail("slug must contain lowercase letters, numbers and hyphens only");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
    fail("date must use YYYY-MM-DD");
  }
  if (!Array.isArray(value.sections) || value.sections.length < 2) {
    fail("sections must contain at least two sections");
  }
  for (const section of value.sections) {
    if (!section.id || !section.title || !Array.isArray(section.paragraphs) || !section.paragraphs.length) {
      fail("each section needs id, title and at least one paragraph");
    }
    if (!/^[a-z0-9-]+$/.test(section.id)) fail(`invalid section id: ${section.id}`);
  }
  if (!Array.isArray(value.sources) || value.sources.length < 2 || value.sources.length > 4) {
    fail("sources must contain 2–4 entries");
  }
  for (const source of value.sources) {
    if (!source.title || !/^https:\/\//.test(source.url)) {
      fail("each source needs a title and an https URL");
    }
  }
  if (!value.previous || !Number.isInteger(value.previous.number) || !value.previous.slug || !value.previous.title) {
    fail("previous must contain number, slug and title");
  }
  if (!value.cover || !value.cover.file || !value.cover.alt || !value.cover.caption) {
    fail("cover must contain file, alt and caption");
  }
  if (!Number.isInteger(value.cover.width) || !Number.isInteger(value.cover.height)) {
    fail("cover width and height must be integers");
  }
}

function renderArticle(value, lessonNumber, url) {
  const titleLines = Array.isArray(value.h1Lines) && value.h1Lines.length
    ? value.h1Lines
    : [value.title];
  const socialImage = value.socialImage || "assets/social-card.png";
  const socialUrl = `https://r3xstudio.com/${socialImage}`;
  const monthYear = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value.date}T12:00:00Z`));
  const sectionLinks = value.sections
    .map(section => `<a href="#${attr(section.id)}">${html(section.title)}</a>`)
    .join("");
  const sections = value.sections.map(section => {
    const paragraphs = section.paragraphs.map(text => `<p>${html(text)}</p>`).join("\n");
    const quote = section.quote ? `\n<blockquote>${html(section.quote)}</blockquote>` : "";
    return `<h2 id="${attr(section.id)}">${html(section.title)}</h2>\n${paragraphs}${quote}`;
  }).join("\n");
  const sources = value.sources
    .map(source => `<li><a href="${attr(source.url)}">${html(source.title)} ↗</a></li>`)
    .join("\n");
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(`${value.title} — The Old Code`);
  const articleSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: value.title,
    description: value.description,
    url,
    mainEntityOfPage: url,
    datePublished: value.date,
    dateModified: value.date,
    articleSection: value.category,
    image: socialUrl,
    author: { "@type": "Organization", name: "R3X Studio", url: "https://r3xstudio.com/" },
    publisher: {
      "@type": "Organization",
      name: "R3X Studio",
      url: "https://r3xstudio.com/",
      logo: { "@type": "ImageObject", url: "https://r3xstudio.com/assets/favicon-64.png" }
    },
    inLanguage: "en"
  }).replaceAll("<", "\\u003c");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${attr(value.description)}">
<title>${html(value.seoTitle)} — The Old Code</title>
<link rel="canonical" href="${url}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="icon" href="/assets/favicon-64.png" sizes="64x64" type="image/png"><meta name="theme-color" content="#0d0f10">
<meta property="og:type" content="article"><meta property="og:site_name" content="R3X Studio"><meta property="og:locale" content="en_US">
<meta property="og:title" content="${attr(value.seoTitle)}"><meta property="og:description" content="${attr(value.description)}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${socialUrl}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${attr(value.title)} — The Old Code">
<meta property="article:published_time" content="${value.date}"><meta property="article:modified_time" content="${value.date}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${attr(value.seoTitle)}"><meta name="twitter:description" content="${attr(value.description)}"><meta name="twitter:image" content="${socialUrl}">
<script type="application/ld+json">${articleSchema}</script>
<link rel="stylesheet" href="../../styles.css"><link rel="stylesheet" href="../../archive.css"></head>
<body><main><header class="site-header"><a class="brand" href="../../"><span class="brand-mark">R</span><span>R3X Studio</span></a>
<nav class="desktop-nav"><a href="../">The Old Code</a>${sectionLinks}<a href="#sources">Sources</a></nav><a class="header-etsy" href="../">Archive</a></header>
<article class="article-shell"><header class="article-hero"><p class="eyebrow">Lesson ${lessonNumber} / ${html(value.category)}</p><h1>${titleLines.map(html).join("<br>")}</h1>
<p class="article-deck">${html(value.deck)}</p><div class="article-byline"><span>R3X Studio</span><span>${html(value.readTime)} read</span><span>Updated ${monthYear}</span></div></header>
<figure class="article-cover${value.cover.className ? ` ${attr(value.cover.className)}` : ""}"><img src="../../assets/${attr(value.cover.file)}" width="${value.cover.width}" height="${value.cover.height}" fetchpriority="high" decoding="async" alt="${attr(value.cover.alt)}"><figcaption>${html(value.cover.caption)}</figcaption></figure>
<div class="article-layout"><aside><p class="eyebrow">In this lesson</p>${sectionLinks}<a href="#sources">Source trail</a></aside>
<div class="article-body"><p class="article-intro">${html(value.intro)}</p>
${sections}
<section class="source-box" id="sources"><p class="eyebrow">Source trail</p><h2>Continue with the institutions</h2><ul>
${sources}</ul></section>
<section class="share-lesson" aria-labelledby="share-title"><h2 id="share-title">Share this lesson</h2><p>Send the history onward.</p><div class="share-actions">
<a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer">Facebook</a>
<a href="https://x.com/intent/post?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener noreferrer">X</a>
<a href="https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}" target="_blank" rel="noopener noreferrer">Pinterest</a>
<button type="button" data-copy-link="${url}">Copy link</button></div><p class="copy-status" aria-live="polite"></p></section>
<nav class="lesson-pager"><a href="../${attr(value.previous.slug)}/"><span>Previous lesson</span><strong>${html(value.previous.title)}</strong></a><a href="../"><span>Back to</span><strong>The Old Code archive</strong></a></nav>
</div></div></article>
${footer()}
</main><script>document.querySelectorAll("[data-copy-link]").forEach(b=>b.addEventListener("click",async()=>{const s=b.closest(".share-lesson").querySelector(".copy-status");try{await navigator.clipboard.writeText(b.dataset.copyLink);s.textContent="Link copied."}catch(e){s.textContent="Copy this link: "+b.dataset.copyLink}}))</script></body></html>
`;
}

function updateArchive(source, value, lessonNumber) {
  if (!source.includes("<!-- LESSON_GRID_START -->") || !source.includes("<!-- LESSON_GRID_END -->")) {
    fail("Archive lesson-grid markers are missing");
  }
  const card = `<a href="./${attr(value.slug)}/"><span>${lessonNumber} / ${html(value.cardCategory)}</span><h2>${html(value.title)}</h2><p>${html(value.cardSummary)}</p><small>${html(value.readTime)} read →</small></a>\n`;
  let output = source.replace("<!-- LESSON_GRID_END -->", `${card}<!-- LESSON_GRID_END -->`);
  output = output.replace(/The Old Code \/ Lessons 01–\d+/, `The Old Code / Lessons 01–${lessonNumber}`);

  const latest = `<!-- LATEST_LESSON_START -->
<section class="latest-lesson" id="latest"><div class="lesson-image"><img src="../assets/${attr(value.cover.file)}" width="${value.cover.width}" height="${value.cover.height}" loading="lazy" decoding="async" alt="${attr(value.cover.alt)}"></div><article>
<p class="eyebrow">Lesson ${lessonNumber} / ${html(value.category)}</p><h2>${html(value.title)}</h2><p>${html(value.cardSummary)}</p>
<div class="lesson-meta"><span>${html(value.readTime)} read</span><span>${html(value.category)}</span><span>Source notes</span></div>
<a class="button button-primary" href="./${attr(value.slug)}/">Read the latest lesson <span>→</span></a>
<a class="previous-lesson-link" href="./${attr(value.previous.slug)}/">Lesson ${String(value.previous.number).padStart(2, "0")} — ${html(value.previous.title)} →</a></article></section>
<!-- LATEST_LESSON_END -->`;

  if (!/<!-- LATEST_LESSON_START -->[\s\S]*?<!-- LATEST_LESSON_END -->/.test(output)) {
    fail("Archive latest-lesson markers are missing");
  }
  return output.replace(/<!-- LATEST_LESSON_START -->[\s\S]*?<!-- LATEST_LESSON_END -->/, latest);
}

function updatePreviousArticle(source, value, lessonNumber) {
  const nextLink = `<a href="../${attr(value.slug)}/"><span>Next lesson</span><strong>${html(value.title)}</strong></a>`;
  const pager = source.match(/<nav class="lesson-pager">([\s\S]*?)<\/nav>/);
  if (!pager) fail(`Previous article has no lesson pager: ${value.previous.slug}`);
  const firstLink = pager[1].match(/<a[\s\S]*?<\/a>/);
  if (!firstLink) fail(`Previous article pager is invalid: ${value.previous.slug}`);
  return source.replace(pager[0], `<nav class="lesson-pager">${firstLink[0]}${nextLink}</nav>`);
}

function updateSitemap(source, value, url) {
  if (source.includes(`<loc>${url}</loc>`)) fail(`Sitemap already contains ${url}`);
  let output = source.replace(
    /(<loc>https:\/\/r3xstudio\.com\/old-code\/<\/loc>\s*<lastmod>)[^<]+/,
    `$1${value.date}`
  );
  const entry = `  <url>
    <loc>${url}</loc>
    <lastmod>${value.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  return output.replace("</urlset>", `${entry}</urlset>`);
}

function footer() {
  return `<footer><a class="brand footer-brand" href="../../"><span class="brand-mark">R</span><span>R3X Studio</span></a><p>Old Blood. New Code.</p><div><a href="../">The Old Code</a><a href="https://r3bootxstudio.etsy.com">Etsy</a></div><div class="social-links" aria-label="Follow R3X Studio"><a href="https://www.instagram.com/r3bootstudio/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="https://www.facebook.com/profile.php?id=61584413465191" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="https://pl.pinterest.com/R3XStudio/" target="_blank" rel="noopener noreferrer">Pinterest ↗</a><a href="https://x.com/marcin_rietz" target="_blank" rel="noopener noreferrer">X ↗</a></div><small>© 2026 R3X Studio. Sources before legends.</small></footer>`;
}

function html(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function attr(value) {
  return html(value);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
