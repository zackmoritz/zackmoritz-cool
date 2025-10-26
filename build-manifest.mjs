// build-manifest.mjs — EXIF (default import) + fallbacks

import { promises as fs } from "node:fs";
import { execSync } from "node:child_process";
import * as path from "node:path";
import exifr from "exifr";                // <-- default import

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
  const m = name.match(/(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])[ T_-]?((?:[01]\d|2[0-3]))?[.:-]?([0-5]\d)?[.:-]?([0-5]\d)?/);
  if (!m) return null;
  const [ , Y,M,D,h="00",m2="00",s2="00"] = m;
  const t = Date.parse(`${Y}-${M}-${D}T${h}:${m2}:${s2}Z`);
  return Number.isFinite(t) ? t : null;
}

async function exifTimeOrNull(file) {
  try {
    const buf = await fs.readFile(file);        // pass Buffer
    const meta = await exifr.parse(buf, { pick: ["DateTimeOriginal","CreateDate","ModifyDate"] });
    const d = meta?.DateTimeOriginal || meta?.CreateDate || meta?.ModifyDate;
    return d ? +d : null;
  } catch (e) {
    // Uncomment to debug: console.error("EXIF fail:", file, e.message);
    return null;
  }
}

function statTime(st) {
  return st.birthtimeMs && st.birthtimeMs > 0 ? st.birthtimeMs : (st.mtimeMs || Date.now());
}

function toUrlRel(file) {
  return path.relative(GALLERY_DIR, file).split(path.sep).join("/");
}

async function bestTime(file) {
  const st = await fs.stat(file);
  const byExif = await exifTimeOrNull(file);
  if (byExif) return { t: byExif, dsrc: "exif" };
  const byName = filenameTimeOrNull(path.basename(file));
  if (byName) return { t: byName, dsrc: "filename" };
  const byGit = gitTimeOrNull(file);
  if (byGit) return { t: byGit, dsrc: "git" };
  return { t: statTime(st), dsrc: "stat" };
}

async function main() {
  await fs.access(GALLERY_DIR);
  const files = await walk(GALLERY_DIR);

  const rows = [];
  const counts = { exif:0, filename:0, git:0, stat:0 };

  for (const file of files) {
    const { t, dsrc } = await bestTime(file);
    counts[dsrc]++;
    rows.push({ name: path.basename(file), path: toUrlRel(file), t, dsrc });
  }

  rows.sort((a,b) => (b.t ?? 0) - (a.t ?? 0) || a.path.localeCompare(b.path));

  const manifest = { generatedAt: nowISO, count: rows.length, sort: "date-desc (EXIF preferred)", files: rows };
  await fs.writeFile(path.join(GALLERY_DIR, "photos.json"), JSON.stringify(manifest, null, 2), "utf8");

  console.log(`Wrote gallery/photos.json with ${rows.length} items.`);
  console.log(`Date sources → exif:${counts.exif} filename:${counts.filename} git:${counts.git} stat:${counts.stat}`);
}

main().catch(err => { console.error("[manifest] build failed:", err); process.exit(1); });