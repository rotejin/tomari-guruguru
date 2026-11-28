import React from 'react';
import ReactDOM from 'react-dom/client';
import charConfig from './character-config';
import { makeAudioEngine, micErrorMessage } from './audio-engine.js';

const { useState, useEffect, useRef, useMemo } = React;

const TALK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "followRange": 340,
  "smoothing": 0.3,
  "charSize": 64,
  "bgColor": "#FFF8EE",
  "micGain": 1.6,
  "thHalf": 0.07,
  "thFull": 0.2,
  "release": 0.12,
  "autoBlink": true
}/*EDITMODE-END*/;

const { rows: ROWS, cols: COLS } = charConfig;
// シート: 目開け×口[とじ/中間/開け] = A/B/C, 目閉じ×口[とじ/中間/開け] = D/E/F
const SHEETS = [
  charConfig.sheets.eyesOpen.close,   // A
  charConfig.sheets.eyesOpen.half,    // B
  charConfig.sheets.eyesOpen.open,    // C
  charConfig.sheets.eyesClosed.close, // D
  charConfig.sheets.eyesClosed.half,  // E
  charConfig.sheets.eyesClosed.open,  // F
];
const sheetFor = (eyesClosed, mouth) => SHEETS[(eyesClosed ? 3 : 0) + mouth];
const SRC = (sheet, r, c) => charConfig.src(sheet, r, c);
// 最後のグリーンは、OBS などのクロマキーで背景を抜くため（トマリの絵には緑を使っていない）
const BG_OPTIONS = ['#FFF8EE', '#FDEFEF', '#EEF4FB', '#2B2926', '#00FF00'];

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
// しきい値の刻み（0.005）で足し引きした時の、小数の誤差を消す
const round3 = (v) => Math.round(v * 1000) / 1000;

function App() {
  const [t, setTweak] = useTweaks(TALK_DEFAULTS);
  const [cell, setCell] = useState({ r: 2, c: 2 });
  const [mouth, setMouth] = useState(0);        // 0:とじ 1:中間 2:開け
  const [blink, setBlink] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [micPending, setMicPending] = useState(false); // マイクの許可を待つ間など（ボタンの表示用）
  const micBusyRef = useRef(false); // 同じ理由の、すぐに効く印（描き直しを待たない）
  const [micErr, setMicErr] = useState('');
  const [fileName, setFileName] = useState('');

  const charRef = useRef(null);
  const audioElRef = useRef(null);
  const fileUrlRef = useRef(null); // 今、再生バーに渡している音声ファイルの URL
  const fileInputRef = useRef(null);
  const meterRef = useRef(null);
  const engine = useMemo(() => makeAudioEngine({
    // マイクが向こうの都合で切れたら（抜いた・ほかのアプリに取られた など）、「マイク開始」に戻す
    onMicEnded: () => {
      setMicOn(false);
      setMicErr('マイクが切れました（抜けた・ほかのアプリに取られた など）。もう一度「マイク開始」を押してください');
    },
  }), []);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const env = useRef(0);
  const tweaksRef = useRef(t);
  tweaksRef.current = t;

  // マウス追従
  useEffect(() => {
    function onMove(e) {
      const el = charRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.45;
      const range = tweaksRef.current.followRange;
      target.current.x = clamp((e.clientX - cx) / range, -1, 1);
      target.current.y = clamp((e.clientY - cy) / range, -1, 1);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
    };
  }, []);

  // メインループ: 追従 + 音声レベル → 口段階
  useEffect(() => {
    let raf;
    let last = { r: 2, c: 2 };
    let lastMouth = 0;
    let lastSwitch = 0;
    function tick(now) {
      const tw = tweaksRef.current;
      current.current.x += (target.current.x - current.current.x) * tw.smoothing;
      current.current.y += (target.current.y - current.current.y) * tw.smoothing;
      const c = clamp(Math.round((current.current.x + 1) / 2 * (COLS - 1)), 0, COLS - 1);
      const r = clamp(Math.round((current.current.y + 1) / 2 * (ROWS - 1)), 0, ROWS - 1);
      if (r !== last.r || c !== last.c) { last = { r, c }; setCell(last); }
      const raw = engine.level() * tw.micGain;
      if (raw > env.current) env.current += (raw - env.current) * 0.6;
      else env.current += (raw - env.current) * tw.release;
      if (meterRef.current) {
        meterRef.current.style.width = `${clamp(env.current / 0.4, 0, 1) * 100}%`;
      }
      const lv = env.current;
      const m = lv >= tw.thFull ? 2 : lv >= tw.thHalf ? 1 : 0;
      if (m !== lastMouth && now - lastSwitch > 70) {
        lastMouth = m; lastSwitch = now; setMouth(m);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  // 自動まばたき（自然なゆらぎ: 不規則な間隔 + 二度瞬き + ゆっくり瞬き）
  useEffect(() => {
    if (!t.autoBlink) { setBlink(false); return; }
    let alive = true;
    let timer;
    const rand = (a, b) => a + Math.random() * (b - a);
    function blinkOnce(dur, after) {
      setBlink(true);
      timer = setTimeout(() => {
        if (!alive) return;
        setBlink(false);
        timer = setTimeout(after, rand(120, 220));
      }, dur);
    }
    function doBlink() {
      if (!alive) return;
      const roll = Math.random();
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
      const u = Math.random();
      let wait;
      if (u < 0.12) wait = rand(700, 1500);        // たまに間隔が詰まる
      else if (u < 0.82) wait = rand(1800, 4500);  // 通常
      else wait = rand(4500, 9000);                // ぼーっとする間
      timer = setTimeout(doBlink, wait);
    }
    schedule();
    return () => { alive = false; clearTimeout(timer); };
  }, [t.autoBlink]);

  async function toggleMic() {
    if (micBusyRef.current) return; // 許可を待つ間の押し直しは無視する（ボタンも無効にしてある）
    setMicErr('');
    if (micOn) { engine.stopMic(); setMicOn(false); return; }
    micBusyRef.current = true;
    setMicPending(true);
    try {
      // 本当に始まった時だけ「マイク停止」にする
      if (await engine.startMic()) setMicOn(true);
    } catch (e) {
      // 原因を追えるよう、コンソールにも出す（SUPPORT.md は、コンソールのエラーを頼んでいる）
      console.error('[トマリトーク] マイクを始められませんでした:', e);
      setMicErr(micErrorMessage(e));
    } finally {
      micBusyRef.current = false;
      setMicPending(false);
    }
  }

  function onFilePick(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const el = audioElRef.current;
    engine.attachAudioEl(el);
    engine.resume();
    // 前に選んだファイルの URL は、もう使わないので放す（残すと、閉じるまでメモリに残る）
    const prevUrl = fileUrlRef.current;
    el.src = fileUrlRef.current = URL.createObjectURL(f);
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    el.play().catch(() => {});
    setFileName(f.name);
    // 選んだ物を空にしておく（同じファイルをもう一度選んでも、読み込み直せるように）
    e.target.value = '';
  }

  const allFrames = useMemo(() => {
    const arr = [];
    for (const s of SHEETS) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) arr.push({ s, r, c });
    return arr;
  }, []);
  const activeSheet = sheetFor(blink, mouth);

  const dark = t.bgColor === '#2B2926';
  const inkColor = dark ? 'rgba(255,248,238,0.85)' : 'rgba(60,48,38,0.8)';
  const subColor = dark ? 'rgba(255,248,238,0.45)' : 'rgba(60,48,38,0.45)';
  const panelBg = dark ? 'rgba(48,45,42,0.92)' : 'rgba(255,255,255,0.88)';
  const lineColor = dark ? 'rgba(255,248,238,0.14)' : 'rgba(60,48,38,0.12)';

  const sizeVmin = t.charSize * 4 / 3;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: t.bgColor,
      overflow: 'hidden', transition: 'background 0.4s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'crosshair', fontFamily: "'Zen Maru Gothic', sans-serif"
    }}>
      <div ref={charRef} className="bob" style={{
        position: 'relative',
        width: `${sizeVmin}vmin`, height: `${sizeVmin}vmin`,
        maxWidth: 1200, maxHeight: 1200,
        userSelect: 'none', touchAction: 'none'
      }}>
        {allFrames.map(({ s, r, c }) => (
          <img key={`${s}${r}${c}`} src={SRC(s, r, c)} alt="" draggable="false" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: s === activeSheet && r === cell.r && c === cell.c ? 1 : 0,
            pointerEvents: 'none'
          }}></img>
        ))}
      </div>

      <div style={{ position: 'absolute', top: '3.5vh', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: 'clamp(18px, 2.4vmin, 26px)', fontWeight: 700, color: inkColor, letterSpacing: '0.18em' }}>トマリトーク</div>
        <div style={{ fontSize: 'clamp(12px, 1.6vmin, 16px)', color: subColor, marginTop: 4, letterSpacing: '0.08em' }}>音声に合わせて口パク・まばたきするよ</div>
      </div>

      {/* 下の中央に、上から エラーの文・音声ファイルの再生バー・操作バー の順に積む。
          （再生バーを右下に置くと、右下の Tweaks のボタン・パネルと重なっていた） */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10
      }}>
        {micErr ? (
          // 暗い背景では、明るい赤にする（#B3261E のままだとコントラスト比が 2.2:1 で読みにくい）
          <div role="alert" style={{ color: dark ? '#FF8A80' : '#B3261E', fontSize: 13, fontWeight: 700 }}>{micErr}</div>
        ) : null}
        {/* 再生バーから再生した時も、音の処理（AudioContext）を動かす（止まっていると、音も口パクも出ない） */}
        <audio ref={audioElRef} controls onPlay={() => engine.resume()} style={{
          width: 260, display: fileName ? 'block' : 'none', cursor: 'default'
        }}></audio>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: panelBg, backdropFilter: 'blur(10px)',
          border: `1px solid ${lineColor}`, borderRadius: 18,
          padding: '12px 18px', cursor: 'default',
          boxShadow: '0 6px 24px rgba(60,48,38,0.10)'
        }}>
          <button onClick={toggleMic} disabled={micPending} aria-busy={micPending} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            color: micOn ? '#fff' : inkColor,
            background: micOn ? '#D96C4F' : 'transparent',
            border: `1.5px solid ${micOn ? '#D96C4F' : lineColor}`,
            borderRadius: 12, padding: '9px 16px', cursor: micPending ? 'wait' : 'pointer',
            minHeight: 44, opacity: micPending ? 0.6 : 1
          }}>
            <span style={{
              width: 9, height: 9, borderRadius: '50%',
              background: micOn ? '#fff' : '#D96C4F',
              animation: micOn ? 'pulse 1.2s ease-in-out infinite' : 'none'
            }}></span>
            {micOn ? 'マイク停止' : 'マイク開始'}
          </button>

          {/* ボタンにして、キーボード（Tab・Enter・Space）でも選べるようにする（前は label で、Tab で届かなかった） */}
          <button type="button" onClick={() => fileInputRef.current && fileInputRef.current.click()} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'inherit', fontWeight: 700, fontSize: 14, color: inkColor,
            background: 'transparent',
            border: `1.5px solid ${lineColor}`, borderRadius: 12,
            padding: '9px 16px', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box'
          }}>
            ♪ 音声ファイル
          </button>
          <input ref={fileInputRef} type="file" accept="audio/*" onChange={onFilePick} style={{ display: 'none' }}></input>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 150 }}>
            <div style={{ fontSize: 11, color: subColor, letterSpacing: '0.06em', display: 'flex', justifyContent: 'space-between' }}>
              <span>音量</span>
              <span>{['とじ', 'はんびらき', 'ぜんかい'][mouth]}</span>
            </div>
            <div style={{ position: 'relative', height: 10, borderRadius: 5, background: lineColor, overflow: 'hidden' }}>
              <div ref={meterRef} style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '0%',
                borderRadius: 5, background: 'linear-gradient(90deg, #8FBC8F, #E8B04B, #D96C4F)'
              }}></div>
              <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: inkColor, opacity: 0.5, left: `${clamp(t.thHalf / 0.4, 0, 1) * 100}%` }}></div>
              <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: inkColor, opacity: 0.5, left: `${clamp(t.thFull / 0.4, 0, 1) * 100}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <a href="guruguru.html" style={{
        position: 'absolute', top: 18, left: 18, fontSize: 13, fontWeight: 700,
        color: subColor, textDecoration: 'none', letterSpacing: '0.06em'
      }}>← ぐるぐる版</a>

      <TweaksPanel>
        <TweakSection label="口パク"></TweakSection>
        <TweakSlider label="マイク感度" value={t.micGain} min={0.3} max={5} step={0.1}
          onChange={(v) => setTweak('micGain', v)}></TweakSlider>
        {/* はんびらき < ぜんかい を保つ（逆になると、はんびらきの口が一度も出なくなる） */}
        <TweakSlider label="しきい値（はんびらき）" value={t.thHalf} min={0.01} max={0.3} step={0.005}
          onChange={(v) => setTweak(v >= t.thFull ? { thHalf: v, thFull: round3(v + 0.005) } : { thHalf: v })}></TweakSlider>
        <TweakSlider label="しきい値（ぜんかい）" value={t.thFull} min={0.05} max={0.4} step={0.005}
          onChange={(v) => setTweak(v <= t.thHalf ? { thFull: v, thHalf: round3(v - 0.005) } : { thFull: v })}></TweakSlider>
        <TweakSlider label="口を閉じる速さ" value={t.release} min={0.03} max={0.4} step={0.01}
          onChange={(v) => setTweak('release', v)}></TweakSlider>
        <TweakToggle label="自動まばたき" value={t.autoBlink}
          onChange={(v) => setTweak('autoBlink', v)}></TweakToggle>
        <TweakSection label="動き"></TweakSection>
        <TweakSlider label="追従範囲" value={t.followRange} min={120} max={1200} step={10} unit="px"
          onChange={(v) => setTweak('followRange', v)}></TweakSlider>
        <TweakSlider label="追従速度" value={t.smoothing} min={0.04} max={0.5} step={0.01}
          onChange={(v) => setTweak('smoothing', v)}></TweakSlider>
        <TweakSection label="見た目"></TweakSection>
        <TweakSlider label="キャラサイズ" value={t.charSize} min={30} max={92} unit="vmin"
          onChange={(v) => setTweak('charSize', v)}></TweakSlider>
        <TweakColor label="背景色" value={t.bgColor} options={BG_OPTIONS}
          onChange={(v) => setTweak('bgColor', v)}></TweakColor>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App></App>);
