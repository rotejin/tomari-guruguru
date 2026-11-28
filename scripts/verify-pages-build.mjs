import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import charConfig from '../src/character-config.js';

const DIST = 'dist';
const BASE = '/tomari-guruguru/';
const HTML_FILES = ['index.html', 'talk.html', 'guruguru.html'];
// キャラの画像の置き場所・形式・枚数は、ページと同じ src/character-config.js から読む
// （basePath や ext を変えた時に、古い slices2 を見て合格にしないため）
const { basePath: SLICES, ext: EXT, rows: ROWS, cols: COLS } = charConfig;
const SHEETS = [...Object.values(charConfig.sheets.eyesOpen), ...Object.values(charConfig.sheets.eyesClosed)];

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
  const expected = ROWS * COLS;
  for (const sheet of SHEETS) {
    const dir = join(DIST, ...SLICES.split('/'), sheet);
    assertFile(dir);
    const frames = readdirSync(dir).filter((name) => name.endsWith(`.${EXT}`));
    if (frames.length !== expected) {
      fail(`${posix.join('dist', SLICES, sheet)} should contain ${expected} ${EXT} files, found ${frames.length}`);
    }
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        // ページが使うのと同じ名前（character-config.js の src()）で確かめる
        assertFile(join(DIST, ...charConfig.src(sheet, r, c).split('/')));
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
