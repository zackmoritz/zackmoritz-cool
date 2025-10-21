<?php
// /gallery/index.php (drop this file into your gallery folder)
$dir = __DIR__;
$baseUrl = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$allowed = ['jpg','jpeg','png','gif','webp','avif','bmp'];
$files = [];
foreach (scandir($dir) as $f) {
  if ($f[0]==='.') continue;
  $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
  if (in_array($ext, $allowed)) $files[] = $f;
}
natsort($files);
$files = array_values($files);
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Gallery</title>
<style>
  :root { --gap:12px; }
  body { margin:24px; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  header { display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom:16px; }
  input[type="search"] { padding:8px 10px; min-width:240px; }
  .grid { display:grid; gap:var(--gap); grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); }
  figure { margin:0; background:#f7f7f7; border:1px solid #e5e5e5; border-radius:8px; overflow:hidden; }
  img { display:block; width:100%; height:160px; object-fit:cover; }
  figcaption { font-size:12px; padding:6px 8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .meta { color:#666; font-size:14px; }
  a.raw { text-decoration:none; color:#06f; }
</style>
</head>
<body>
<header>
  <strong><?= count($files) ?> image<?= count($files)===1?'':'s' ?></strong>
  <input id="q" type="search" placeholder="Filter by filename…">
  <span class="meta">Folder: <code><?= htmlspecialchars($baseUrl) ?>/</code></span>
  <a class="raw" href="./" title="Direct folder listing">Raw listing</a>
</header>

<div class="grid" id="grid">
<?php foreach ($files as $f): ?>
  <figure data-name="<?= htmlspecialchars(strtolower($f)) ?>">
    <a href="<?= htmlspecialchars($f) ?>" target="_blank" rel="noopener">
      <img loading="lazy" decoding="async" src="<?= htmlspecialchars($f) ?>" alt="<?= htmlspecialchars($f) ?>">
    </a>
    <figcaption><?= htmlspecialchars($f) ?></figcaption>
  </figure>
<?php endforeach; ?>
</div>

<script>
  const q = document.getElementById('q');
  const grid = document.getElementById('grid');
  q.addEventListener('input', () => {
    const needle = q.value.trim().toLowerCase();
    for (const fig of grid.children) {
      fig.style.display = (!needle || fig.dataset.name.includes(needle)) ? '' : 'none';
    }
  });
</script>
</body>
</html>