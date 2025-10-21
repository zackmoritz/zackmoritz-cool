import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(projectRoot, 'Digital_Gratitude_List');
const outputDir = path.join(projectRoot, 'gallery');
const outputFile = path.join(outputDir, 'manifest.json');

function sortByName(a, b) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

async function readDirectory(currentPath, segments) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  const dirs = [];
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      const child = await readDirectory(fullPath, [...segments, entry.name]);
      dirs.push(child);
    } else if (entry.isFile()) {
      const stats = await fs.stat(fullPath);
      files.push({
        name: entry.name,
        segments: [...segments, entry.name],
        modified: stats.mtimeMs,
        size: stats.size
      });
    }
  }

  dirs.sort(sortByName);
  files.sort((a, b) => {
    const delta = (b.modified || 0) - (a.modified || 0);
    if (delta !== 0) return delta;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  return {
    name: segments.length ? segments[segments.length - 1] : path.basename(currentPath),
    segments,
    dirs,
    files
  };
}

function countFiles(node) {
  return node.files.length + node.dirs.reduce((total, dir) => total + countFiles(dir), 0);
}

async function buildManifest() {
  await fs.mkdir(outputDir, { recursive: true });
  const tree = await readDirectory(sourceRoot, []);
  const manifest = {
    name: 'Digital Gratitude List',
    rootDir: path.basename(sourceRoot),
    dirs: tree.dirs,
    files: tree.files
  };
  await fs.writeFile(outputFile, JSON.stringify(manifest, null, 2));
  const totalFiles = countFiles(manifest);
  console.log(`Wrote manifest with ${totalFiles} files to ${path.relative(projectRoot, outputFile)}`);
}

buildManifest().catch((error) => {
  console.error('Failed to generate gallery manifest');
  console.error(error);
  process.exitCode = 1;
});
