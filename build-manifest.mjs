// build-manifest.mjs
import { promises as fs } from "node:fs";
import { execSync } from "node:child_process";
import * as path from "node:path";

const GALLERY_DIR = "gallery";
const exts = /\.(jpe?g|png|gif|webp|avif|bmp|heic|tiff?)$/i;
const nowISO = new Date().toISOString();

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (exts.test(e.name)) out.push(p);
  }
  return out;
}

function gitTimeOrNull(file) {
  try {
    const s = execSync(`git log -1 --format=%ct -- "${file}"`, { stdio: ["ignore","pipe","ignore"] })
      .toString().trim();
    return s ? Number(s) * 1000 : null;
  } catch { return null; }
}

function toUrlRel(file) {
  // file like "gallery/2025/trip/IMG.jpg" -> "2025/trip/IMG.jpg"
  const rel = path.relative(GALLERY_DIR, file);
  return rel.split(path.sep).join("/"); // force forward slashes
}

async function main() {
  await fs.access(GALLERY_DIR);               // throws if missing (good signal)
  const files = await walk(GALLERY_DIR);

  const rows = [];
  for (const file of files) {
    let t = gitTimeOrNull(file);
    if (!t) {
      const st = await fs.stat(file);
      t = st.mtimeMs || st.ctimeMs || Date.now();
    }
    rows.push({ name: path.basename(file), path: toUrlRel(file), t });
  }

  rows.sort((a,b) => b.t - a.t);

  const manifest = { generatedAt: nowISO, count: rows.length, sort: "uploaded-desc", files: rows };

  await fs.writeFile(path.join(GALLERY_DIR, "photos.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(`Wrote gallery/photos.json with ${rows.length} items.`);
}

main().catch(err => { console.error("[manifest] build failed:", err); process.exit(1); });