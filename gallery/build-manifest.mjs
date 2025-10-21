// build-manifest.mjs
// Scans /gallery for images, gets each file's last git commit time (fallback: mtime),
// and writes /gallery/photos.json sorted by newest first.

import { promises as fs } from "fs";
import { execSync } from "child_process";
import path from "path";
const GALLERY_DIR = "gallery"; // your folder at site root

const exts = /\.(jpe?g|png|gif|webp|avif|bmp|heic|tiff?)$/i;
const nowISO = new Date().toISOString();

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (exts.test(e.name)) out.push(p);
  }
  return out;
}

function gitTimeOrNull(file) {
  try {
    // Unix seconds of last commit touching this file
    const s = execSync(`git log -1 --format=%ct -- "${file}"`, { stdio: ["ignore","pipe","ignore"] })
      .toString()
      .trim();
    return s ? Number(s) * 1000 : null;
  } catch {
    return null;
  }
}

async function main() {
  // Ensure gallery exists
  await fs.access(GALLERY_DIR);
  const files = await walk(GALLERY_DIR);

  const rows = [];
  for (const file of files) {
    let t = gitTimeOrNull(file);
    if (!t) {
      const st = await fs.stat(file);
      t = st.mtimeMs || st.ctimeMs || Date.now();
    }
    rows.push({
      name: path.basename(file),
      path: file.replace(/^gallery\//, ""), // relative under /gallery
      t
    });
  }

  // Sort newest → oldest
  rows.sort((a, b) => b.t - a.t);

  const manifest = {
    generatedAt: nowISO,
    count: rows.length,
    sort: "uploaded-desc",
    files: rows
  };

  await fs.writeFile(
    path.join(GALLERY_DIR, "photos.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  console.log(`Wrote gallery/photos.json with ${rows.length} items.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});