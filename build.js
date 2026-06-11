/**
 * Build script — Minifies JS and CSS for production.
 * Run: node build.js
 * Output: dist/ folder with minified assets.
 */
import { build } from "esbuild";
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DIST = "dist";

// Clean and create dist
mkdirSync(DIST, { recursive: true });
mkdirSync(join(DIST, "js"), { recursive: true });
mkdirSync(join(DIST, "css"), { recursive: true });

// 1. Minify all JS files (keep as individual modules for HTTP/2 multiplexing)
const jsFiles = readdirSync("js").filter((f) => f.endsWith(".js"));
for (const file of jsFiles) {
  await build({
    entryPoints: [join("js", file)],
    outfile: join(DIST, "js", file),
    minify: true,
    format: "esm",
    target: "es2022",
    sourcemap: false,
    // Don't bundle — keep external imports as-is for module loading
    bundle: false,
  });
}

// 2. Minify CSS
await build({
  entryPoints: ["css/styles.css"],
  outfile: join(DIST, "css", "styles.css"),
  minify: true,
  sourcemap: false,
});

// 3. Copy HTML files (strip whitespace between tags)
const htmlFiles = readdirSync(".").filter((f) => f.endsWith(".html"));
for (const file of htmlFiles) {
  let html = readFileSync(file, "utf-8");
  // Collapse whitespace between tags
  html = html.replace(/>\s+</g, "><");
  // Remove HTML comments (except IE conditionals)
  html = html.replace(/<!--(?!\[if).*?-->/gs, "");
  // Collapse multiple spaces/newlines
  html = html.replace(/\s{2,}/g, " ");
  writeFileSync(join(DIST, file), html);
}

// 4. Copy static assets
const staticFiles = ["favicon.png", "netlify.toml", "firestore.rules"];
for (const file of staticFiles) {
  try {
    cpSync(file, join(DIST, file));
  } catch {
    // File might not exist
  }
}

// 5. Copy service worker to dist root
try {
  cpSync("sw.js", join(DIST, "sw.js"));
} catch {
  // sw.js might not exist yet
}

// Report savings
let originalSize = 0;
let minifiedSize = 0;

for (const file of jsFiles) {
  originalSize += readFileSync(join("js", file)).length;
  minifiedSize += readFileSync(join(DIST, "js", file)).length;
}
originalSize += readFileSync("css/styles.css").length;
minifiedSize += readFileSync(join(DIST, "css", "styles.css")).length;

const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
console.log(`\n✅ Build complete → ${DIST}/`);
console.log(`   JS + CSS: ${(originalSize / 1024).toFixed(1)}KB → ${(minifiedSize / 1024).toFixed(1)}KB (${savings}% smaller)\n`);
