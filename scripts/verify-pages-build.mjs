import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';

const DIST = 'dist';
const BASE = '/tomari-guruguru/';
const HTML_FILES = ['index.html', 'talk.html', 'guruguru.html'];
const SHEETS = ['A', 'B', 'C', 'D', 'E', 'F'];

function fail(message) {
  console.error(`Pages build verification failed: ${message}`);
  process.exit(1);
}

function assertFile(path) {
  if (!existsSync(path)) fail(`missing file: ${path}`);
}

function readDistHtml(file) {
  const path = join(DIST, file);
  assertFile(path);
  return readFileSync(path, 'utf8');
}

function assertNoRootAssetReference(file, html) {
  const badPatterns = ['src="/assets/', 'href="/assets/'];
  for (const pattern of badPatterns) {
    if (html.includes(pattern)) {
      fail(`${file} contains root asset reference: ${pattern}`);
    }
  }
}

function assertBaseAssetReference(file, html) {
  if (!html.includes(`${BASE}assets/`)) {
    fail(`${file} does not reference ${BASE}assets/`);
  }
}

function assertReferencedBaseAssetsExist(file, html) {
  const attrPattern = /\b(?:src|href)="(\/tomari-guruguru\/[^"]+)"/g;
  for (const match of html.matchAll(attrPattern)) {
    const urlPath = match[1];
    if (!urlPath.startsWith(BASE)) continue;
    const relative = urlPath.slice(BASE.length);
    assertFile(join(DIST, ...relative.split('/')));
  }
}

function assertSliceImages() {
  for (const sheet of SHEETS) {
    const dir = join(DIST, 'slices2', sheet);
    assertFile(dir);
    const webpFiles = readdirSync(dir).filter((name) => name.endsWith('.webp'));
    if (webpFiles.length !== 25) {
      fail(`${posix.join('dist', 'slices2', sheet)} should contain 25 webp files, found ${webpFiles.length}`);
    }
    for (let r = 0; r < 5; r += 1) {
      for (let c = 0; c < 5; c += 1) {
        assertFile(join(dir, `r${r}c${c}.webp`));
      }
    }
  }
}

for (const file of HTML_FILES) {
  const html = readDistHtml(file);
  assertNoRootAssetReference(file, html);
  assertReferencedBaseAssetsExist(file, html);
  if (file !== 'index.html') assertBaseAssetReference(file, html);
}

assertSliceImages();

console.log('Pages build verification passed.');
