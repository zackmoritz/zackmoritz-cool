// build-manifest.mjs — writes /gallery/photos.json with real per-photo timestamps
import { promises as fs } from "node:fs";
import { execSync } from "node:child_process";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as exifr from "exifr"; // npm i exifr

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

function filenameTimeOrNull(name) {
  // Try common patterns like 2025-10-24, 20251024_153012, 2025-10-24 15.30.12, etc.
  const s = name;
  const m1 = s.match(/(20\d{2})[-_\.]?(0[1-9]|1[0-2])[-_\.]?(0[1-9]|[12]\d|3[01])[ T_-]?(?:([01]\d|2[0-3])[:\-\.]?([0-5]\d)[:\-\.]?([0-5]\d))?/);
  if (!m1) return null;
  const [ , Y, M, D, h="00", m="00", sec="00" ] = m1;
  const iso = `${Y}-${M}-${D}T${h}:${m}:${sec}Z`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

async function exifTimeOrNull(file) {
  try {
    const meta = await exifr.parse(file, { pick: ["DateTimeOriginal","CreateDate"] });
    const d = meta?.DateTimeOriginal || meta?.CreateDate;
    return d ? +d : null;
  } catch { return null; }
}

function statTime(file, st) {
  // prefer birthtime if present; else mtime
  return st.birthtimeMs && st.birthtimeMs > 0 ? st.birthtimeMs : (st.mtimeMs || Date.now());
}

function stableTiebreakNumber(file) {
  // deterministic small number to keep order stable even if times tie
  const h = crypto.createHash("md5").update(file).digest();
  return h.readUInt32BE(0); // 0..2^32-1
}

function toUrlRel(file) {
  // "gallery/a/b.jpg" -> "a/b.jpg" with forward slashes
  return path.relative(GALLERY_DIR, file).split(path.sep).join("/");
}

async function main() {
  await fs.access(GALLERY_DIR);
  const files = await walk(GALLERY_DIR);

  const rows = [];
  for (const file of files) {
    const st = await fs.stat(file);

    // choose best timestamp: EXIF > filename > git > stat
    const tExif  = await exifTimeOrNull(file);
    const tName  = filenameTimeOrNull(path.basename(file));
    const tGit   = gitTimeOrNull(file);
    const tStat  = statTime(file, st);
    const tBest  = tExif ?? tName ?? tGit ?? tStat;

    rows.push({
      name: path.basename(file),
      path: toUrlRel(file),
      t: tBest,
      // optional extra to ensure final strict ordering if many share same second:
      tb: stableTiebreakNumber(file)
    });
  }

  // newest → oldest; break ties by tb, then path for determinism
  rows.sort((a,b) => (b.t ?? 0) - (a.t ?? 0) || (b.tb - a.tb) || a.path.localeCompare(b.path));

  const manifest = {
    generatedAt: nowISO,
    count: rows.length,
    sort: "date-desc (EXIF/filename/git/stat)",
    files: rows.map(({tb, ...rest}) => rest) // don’t expose tb
  };

  await fs.writeFile(path.join(GALLERY_DIR, "photos.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(`Wrote gallery/photos.json with ${rows.length} items.`);
}

main().catch(err => { console.error("[manifest] build failed:", err); process.exit(1); });