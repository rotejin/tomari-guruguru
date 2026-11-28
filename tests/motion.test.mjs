// 両方のページの動きの計算（src/motion.js）の検査。
//
//   npm test
//
// 追加のパッケージは使わず、node の node:test だけで動く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRAME_MS, clamp, frameDt, stepToward, pointerTarget, gridCell, startAutoBlink } from '../src/motion.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} と ${b} が違う`);

// 一定の間隔（dt）で、n フレーム近づける
function run(k, dt, n, from = 0, to = 1) {
  let v = from;
  for (let i = 0; i < n; i += 1) v = stepToward(v, to, k, dt);
  return v;
}

test('60fps（16.67ms）では、前の計算（毎フレーム k ずつ近づく）と同じ', () => {
  for (const k of [0.04, 0.12, 0.3, 0.5, 0.6]) {
    let old = 0;
    for (let i = 0; i < 6; i += 1) old += (1 - old) * k;
    close(run(k, FRAME_MS, 6), old, 1e-12);
  }
});

test('120Hz・144Hz・240Hz でも、同じ時間の後には 60Hz と同じ所まで近づく（速くならない）', () => {
  const k = 0.3;
  const at60 = run(k, FRAME_MS, 6);            // 100ms
  close(run(k, 1000 / 120, 12), at60, 1e-12);  // 120Hz × 12 = 100ms
  close(run(k, 1000 / 240, 24), at60, 1e-12);  // 240Hz × 24 = 100ms
  close(run(k, 1000 / 144, 72), run(k, FRAME_MS, 30), 1e-12); // 144Hz × 72 = 500ms = 60Hz × 30
  // 前の計算（フレームごとに k）だと、144Hz の 100ms（14.4 フレーム）で、ほぼ着いてしまっていた
  let old144 = 0;
  for (let i = 0; i < 14; i += 1) old144 += (1 - old144) * k;
  assert.ok(old144 > 0.99 && at60 < 0.89, `前の 144Hz ${old144}・60Hz ${at60}`);
});

test('フレームの間隔: 最初は 60fps とみなし、戻り・大きすぎる間隔は 0〜100ms に収める', () => {
  close(frameDt(1000, null), FRAME_MS);
  close(frameDt(1016.7, 1000), 16.7, 1e-9);
  assert.equal(frameDt(900, 1000), 0);
  assert.equal(frameDt(6000, 1000), 100);
});

test('マウスの位置 → 向き（-1〜1）。キャラの中心は、高さの 45% の所', () => {
  const rect = { left: 100, top: 100, width: 400, height: 400 };
  assert.deepEqual(pointerTarget(300, 280, rect, 340), { x: 0, y: 0 });
  assert.deepEqual(pointerTarget(300 + 170, 280 - 170, rect, 340), { x: 0.5, y: -0.5 });
  assert.deepEqual(pointerTarget(-5000, 5000, rect, 340), { x: -1, y: 1 });
});

test('向き → 5×5 のコマ（前の式と同じ）', () => {
  const old = (x, y) => ({
    r: clamp(Math.round((y + 1) / 2 * 4), 0, 4),
    c: clamp(Math.round((x + 1) / 2 * 4), 0, 4),
  });
  for (let x = -1; x <= 1.0001; x += 0.05) {
    for (let y = -1; y <= 1.0001; y += 0.05) {
      assert.deepEqual(gridCell(x, y, 5, 5), old(x, y));
    }
  }
  assert.deepEqual(gridCell(0, 0, 5, 5), { r: 2, c: 2 });
  assert.deepEqual(gridCell(-1, 1, 5, 5), { r: 4, c: 0 });
});

// 偽のタイマー: 登録された順に、待ち時間を記録して手で進める
function fakeTimers() {
  const queue = [];
  let id = 0;
  return {
    queue,
    setTimer(fn, ms) { id += 1; queue.push({ id, fn, ms }); return id; },
    clearTimer(which) { const i = queue.findIndex((q) => q.id === which); if (i >= 0) queue.splice(i, 1); },
    next() { const q = queue.shift(); q.fn(); return q.ms; },
  };
}

test('自動まばたき: ふつうのまばたき（待つ → 閉じる 90〜150ms → 開く → 120〜220ms 後に次の予定）', () => {
  const timers = fakeTimers();
  const states = [];
  // 乱数: 待ち時間の種類 0.5（通常）・待ち 0.5・まばたきの種類 0.9（ふつう）・長さ 0.5・開いた後 0.5 …
  const seq = [0.5, 0.5, 0.9, 0.5, 0.5, 0.5, 0.5];
  let i = 0;
  startAutoBlink((v) => states.push(v), { random: () => seq[i++ % seq.length], setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  assert.equal(timers.queue.length, 1);
  const wait = timers.next();
  assert.ok(wait >= 1800 && wait <= 4500, `待ち ${wait}`);
  assert.deepEqual(states, [true]);
  const shut = timers.next();
  assert.ok(shut >= 90 && shut <= 150, `閉じている間 ${shut}`);
  assert.deepEqual(states, [true, false]);
  const gap = timers.next();
  assert.ok(gap >= 120 && gap <= 220, `開いてから次の予定まで ${gap}`);
  assert.equal(timers.queue.length, 1, '次の待ちが予定されている');
});

test('自動まばたき: 二度瞬き（0.22 未満）は、閉じる・開く・閉じる・開く', () => {
  const timers = fakeTimers();
  const states = [];
  const seq = [0.5, 0.5, 0.1, 0.5, 0.5, 0.5, 0.5, 0.5];
  let i = 0;
  startAutoBlink((v) => states.push(v), { random: () => seq[i++ % seq.length], setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  timers.next(); // 待ち
  const first = timers.next();
  assert.ok(first >= 80 && first <= 120, `1 回目 ${first}`);
  timers.next(); // 開いた後の間
  const second = timers.next();
  assert.ok(second >= 70 && second <= 110, `2 回目 ${second}`);
  assert.deepEqual(states, [true, false, true, false]);
});

test('自動まばたき: 止めたら、それ以上は閉じも開きもしない', () => {
  const timers = fakeTimers();
  const states = [];
  const stop = startAutoBlink((v) => states.push(v), { random: () => 0.5, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  timers.next(); // 閉じる
  stop();
  assert.equal(timers.queue.length, 0, '予定は取り消された');
  assert.deepEqual(states, [true]);
});
