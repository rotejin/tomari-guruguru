// 音声エンジン — マイクと音声ファイルの音量を測る（トーク版で使う）
// ブラウザの API（getUserMedia・AudioContext）は、呼ばれた時に読む。
// そのため、tests/ から偽物に差し替えて動かせる。

// マイクを始められなかった時に、画面に出す文（エラーの種類ごと）
export function micErrorMessage(e) {
  switch (e && e.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'マイクの使用が許可されていません（アドレスバーの左のボタンから、マイクを許可してください）';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'マイクが見つかりません（つながっているか、OS の設定で使えるようになっているか確かめてください）';
    case 'NotReadableError':
    case 'AbortError':
      return 'マイクを開けません（ほかのアプリが使っていないか確かめてください）';
    case 'NotSupportedError':
      return 'このページではマイクを使えません（https か 127.0.0.1 で開いてください）';
    default:
      return 'マイクを使用できません（権限と、マイクのつながりを確かめてください）';
  }
}

// onMicEnded: 動いているマイクが、ブラウザや OS の側で切れた時（抜いた・ほかのアプリに取られた・
// 権限を取り消した など）に呼ぶ。その時、エンジンの側ではもうマイクを止めてある。
export function makeAudioEngine({ onMicEnded } = {}) {
  const st = {
    ctx: null, micAnalyser: null, micStream: null, micSource: null,
    fileAnalyser: null, fileSourceMade: false, buf: null,
    // マイクを始めている途中か（許可を待つ間など）と、開始の世代。
    // stopMic() で世代を進めると、途中の開始は自分で取ったマイクを止めて抜ける。
    micStarting: false, micGeneration: 0,
  };
  function ctx() {
    if (!st.ctx) st.ctx = new (window.AudioContext || window.webkitAudioContext)();
    return st.ctx;
  }
  function levelOf(analyser) {
    if (!analyser) return 0;
    if (!st.buf || st.buf.length !== analyser.fftSize) st.buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(st.buf);
    let sum = 0;
    for (let i = 0; i < st.buf.length; i++) sum += st.buf[i] * st.buf[i];
    return Math.sqrt(sum / st.buf.length);
  }
  function stopTracks(stream) {
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }
  const api = {
    // マイクを始める。始めたら true、もう動いている・始めている途中・途中で止められた時は false。
    // （許可を待つ間に押し直すと 2 本目のマイクを取り、1 本目が止められなくなっていた）
    async startMic() {
      if (st.micStream || st.micStarting) return false;
      // https でも 127.0.0.1 でもないページでは、navigator.mediaDevices が無い
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        throw new DOMException('getUserMedia is not available on this page', 'NotSupportedError');
      }
      st.micStarting = true;
      const generation = ++st.micGeneration;
      const cancelled = () => generation !== st.micGeneration;
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled()) {
          stopTracks(stream);
          return false;
        }
        const c = ctx();
        await c.resume();
        if (cancelled()) {
          stopTracks(stream);
          return false;
        }
        const src = c.createMediaStreamSource(stream);
        const an = c.createAnalyser();
        an.fftSize = 1024;
        src.connect(an);
        st.micStream = stream;
        st.micSource = src;
        st.micAnalyser = an;
        // マイクが向こうの都合で切れたら、止めて知らせる（そのままだと「マイク停止」の表示が残る）。
        // stop() で止めた時は ended は起きない決まりだが、念のため、今のマイクの時だけ扱う。
        for (const track of stream.getTracks()) {
          track.addEventListener('ended', () => {
            if (st.micStream !== stream) return;
            api.stopMic();
            if (onMicEnded) onMicEnded();
          }, { once: true });
        }
        return true;
      } catch (e) {
        // 取ったマイクは止める（許可の後の準備で失敗しても、マイクを残さない）
        stopTracks(stream);
        if (cancelled()) return false;
        throw e;
      } finally {
        if (!cancelled()) st.micStarting = false;
      }
    },
    stopMic() {
      // 始めている途中なら取り消す
      st.micGeneration += 1;
      st.micStarting = false;
      if (st.micSource) {
        try { st.micSource.disconnect(); } catch { /* もう外れている */ }
      }
      stopTracks(st.micStream);
      st.micStream = null;
      st.micSource = null;
      st.micAnalyser = null;
    },
    attachAudioEl(el) {
      if (st.fileSourceMade) return;
      const c = ctx();
      const src = c.createMediaElementSource(el);
      const an = c.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      an.connect(c.destination);
      st.fileAnalyser = an;
      st.fileSourceMade = true;
    },
    resume() {
      // 失敗しても（閉じた後など）、音が出ないだけで続ける。受け止めないと、未処理の失敗になる
      if (st.ctx) st.ctx.resume().catch(() => {});
    },
    level() { return Math.max(levelOf(st.micAnalyser), levelOf(st.fileAnalyser)); },
    micOn() { return !!st.micAnalyser; }
  };
  return api;
}
