// 両方のページで使う、動きの計算（マウス追従・5×5 の向き・自動まばたき）
// React もブラウザの API も使わないので、tests/ から node だけで確かめられる。

export function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

// 毎フレームの「近づき方」（追従速度・口を閉じる速さなど）は、60fps の 1 フレームあたりの割合で決めてある。
// 実際のフレームの間隔（dtMs）に合わせて直すので、120Hz・144Hz のモニターでも、60Hz と同じ速さで動く。
// 60fps（dtMs = FRAME_MS）なら、割合は k のまま（前と同じ計算）になる。
export const FRAME_MS = 1000 / 60;

export function stepToward(current, target, k, dtMs) {
  const f = 1 - Math.pow(1 - k, dtMs / FRAME_MS);
  return current + (target - current) * f;
}

// requestAnimationFrame の時刻から、前のフレームとの間隔を出す。
// 最初のフレームは 60fps とみなす。タブを隠していた後などの大きな間隔は 100ms までにする
// （戻った瞬間に、一気に飛ばないように）。
export function frameDt(now, last) {
  if (last == null) return FRAME_MS;
  return clamp(now - last, 0, 100);
}

// マウスの位置から、キャラの中心（高さは 45% の所）に対する向き（-1〜1）を出す
export function pointerTarget(clientX, clientY, rect, range) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height * 0.45;
  return {
    x: clamp((clientX - cx) / range, -1, 1),
    y: clamp((clientY - cy) / range, -1, 1),
  };
}

// 向き（-1〜1）を、5×5 のどのコマにするか
export function gridCell(x, y, rows, cols) {
  return {
    r: clamp(Math.round((y + 1) / 2 * (rows - 1)), 0, rows - 1),
    c: clamp(Math.round((x + 1) / 2 * (cols - 1)), 0, cols - 1),
  };
}

// 自動まばたき（自然なゆらぎ: 不規則な間隔 + 二度瞬き + ゆっくり瞬き）。止める関数を返す。
// random・タイマーは、検査で差し替えられるようにしてある。
export function startAutoBlink(setBlink, { random = Math.random, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let alive = true;
  let timer;
  const rand = (a, b) => a + random() * (b - a);
  function blinkOnce(dur, after) {
    setBlink(true);
    timer = setTimer(() => {
      if (!alive) return;
      setBlink(false);
      timer = setTimer(after, rand(120, 220));
    }, dur);
  }
  function doBlink() {
    if (!alive) return;
    const roll = random();
    if (roll < 0.22) {
      // 二度瞬き（パチパチ）
      blinkOnce(rand(80, 120), () => { if (alive) blinkOnce(rand(70, 110), schedule); });
    } else if (roll < 0.28) {
      // ゆっくり瞬き
      blinkOnce(rand(260, 420), schedule);
    } else {
      blinkOnce(rand(90, 150), schedule);
    }
  }
  function schedule() {
    if (!alive) return;
    const u = random();
    let wait;
    if (u < 0.12) wait = rand(700, 1500);        // たまに間隔が詰まる
    else if (u < 0.82) wait = rand(1800, 4500);  // 通常
    else wait = rand(4500, 9000);                // ぼーっとする間
    timer = setTimer(doBlink, wait);
  }
  schedule();
  return () => { alive = false; clearTimer(timer); };
}
