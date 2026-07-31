import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = walk(root).filter(file => file.endsWith(".html"));
const errors = [];

for (const file of htmlFiles) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  exactlyOne(source, /<title>/g, "title", relative);
  exactlyOne(source, /<meta name="description"/g, "meta description", relative);
  exactlyOne(source, /<link rel="canonical"/g, "canonical URL", relative);
  exactlyOne(source, /<meta property="og:title"/g, "Open Graph title", relative);
  exactlyOne(source, /<meta name="twitter:card"/g, "Twitter card", relative);

  for (const match of source.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(match[1]);
    } catch (error) {
      errors.push(`${relative}: invalid JSON-LD (${error.message})`);
    }
  }

  for (const match of source.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|#)/.test(reference)) continue;
    const clean = reference.split("#")[0].split("?")[0];
    if (!clean) continue;
    const target = clean.startsWith("/")
      ? path.join(root, clean)
      : path.resolve(path.dirname(file), clean);
    const resolved = fs.existsSync(target)
      ? target
      : fs.existsSync(path.join(target, "index.html"))
        ? path.join(target, "index.html")
        : null;
    if (!resolved) errors.push(`${relative}: missing local reference ${reference}`);
  }

  if (/data-asset=|assets\/(?:raven|vegvisir|norway)\.js/.test(source)) {
    errors.push(`${relative}: legacy JavaScript image asset reference`);
  }
}

const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
if (urls.length !== new Set(urls).size) errors.push("sitemap.xml: duplicate URL");
for (const url of urls) {
  const pathname = new URL(url).pathname;
  const local = pathname === "/"
    ? path.join(root, "index.html")
    : path.join(root, pathname, "index.html");
  if (!fs.existsSync(local)) errors.push(`sitemap.xml: page not found for ${url}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${htmlFiles.length} HTML files and ${urls.length} sitemap URLs.`);

function exactlyOne(source, pattern, label, file) {
  const count = (source.match(pattern) || []).length;
  if (count !== 1) errors.push(`${file}: expected one ${label}, found ${count}`);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    if (entry.name === ".git") return [];
    return entry.isDirectory() ? walk(full) : [full];
  });
}
