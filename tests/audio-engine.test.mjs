// トーク版の音声エンジン（src/audio-engine.js）の、マイクの開始・停止の検査。
//
//   npm test
//
// 追加のパッケージは使わず、node の node:test だけで動く。
// ブラウザのマイク（getUserMedia）と AudioContext を、偽物に差し替えて動かす。
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeAudioEngine, micErrorMessage } from '../src/audio-engine.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((ok, ng) => {
    resolve = ok;
    reject = ng;
  });
  return { promise, resolve, reject };
}

const settle = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((done) => setImmediate(done));
};

// 本物の MediaStreamTrack と同じく、stop() では ended を起こさない。
// 向こうの都合で切れた時（抜いた など）だけ、endByDevice() で ended を起こす。
class FakeTrack extends EventTarget {
  constructor() {
    super();
    this.readyState = 'live';
  }
  stop() {
    this.readyState = 'ended';
  }
  endByDevice() {
    this.readyState = 'ended';
    this.dispatchEvent(new Event('ended'));
  }
}

class FakeStream {
  constructor() {
    this.tracks = [new FakeTrack()];
  }
  getTracks() {
    return this.tracks;
  }
  get live() {
    return this.tracks.some((track) => track.readyState === 'live');
  }
}

let env;
const saved = {};

beforeEach(() => {
  env = { micRequests: [], resumes: [], sources: [] };
  class FakeNode {
    constructor() {
      this.connected = [];
      this.disconnected = false;
    }
    connect(next) {
      this.connected.push(next);
      return next;
    }
    disconnect() {
      this.disconnected = true;
    }
  }
  class FakeAudioContext {
    constructor() {
      this.destination = new FakeNode();
    }
    resume() {
      // 検査の側で待ちを入れていれば、それを使う。無ければ、すぐ終わる
      return env.resumes.length ? env.resumes.shift().promise : Promise.resolve();
    }
    createMediaStreamSource(stream) {
      const node = new FakeNode();
      node.stream = stream;
      env.sources.push(node);
      return node;
    }
    createAnalyser() {
      const node = new FakeNode();
      node.fftSize = 2048;
      return node;
    }
    createMediaElementSource(el) {
      const node = new FakeNode();
      node.element = el;
      return node;
    }
  }
  for (const key of ['navigator', 'window']) saved[key] = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: () => {
          const answer = deferred();
          env.micRequests.push(answer);
          return answer.promise;
        },
      },
    },
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { AudioContext: FakeAudioContext } });
});

afterEach(() => {
  for (const key of ['navigator', 'window']) {
    if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
    else delete globalThis[key];
  }
});

test('許可を待つ間に何度押しても、マイクは 1 本しか取らない。止めれば、そのマイクも止まる', async () => {
  const engine = makeAudioEngine();
  const first = engine.startMic();
  const second = engine.startMic();
  const third = engine.startMic();
  assert.equal(env.micRequests.length, 1);
  assert.equal(await second, false);
  assert.equal(await third, false);

  const stream = new FakeStream();
  env.micRequests[0].resolve(stream);
  assert.equal(await first, true);
  assert.equal(engine.micOn(), true);
  assert.equal(await engine.startMic(), false, '動いている間も、もう一度は取らない');
  assert.equal(env.micRequests.length, 1);

  engine.stopMic();
  assert.equal(stream.live, false);
  assert.equal(env.sources[0].disconnected, true);
  assert.equal(engine.micOn(), false);
});

test('許可を待つ間に止めると、後から届いたマイクもすぐ止め、動き出さない', async () => {
  const engine = makeAudioEngine();
  const started = engine.startMic();
  engine.stopMic();
  const stream = new FakeStream();
  env.micRequests[0].resolve(stream);
  assert.equal(await started, false);
  assert.equal(stream.live, false);
  assert.equal(engine.micOn(), false);
  assert.equal(env.sources.length, 0);
});

test('準備（resume）の途中で止めても、マイクを残さない。そのあと始め直せる', async () => {
  const engine = makeAudioEngine();
  const resume = deferred();
  env.resumes.push(resume);
  const started = engine.startMic();
  const first = new FakeStream();
  env.micRequests[0].resolve(first);
  await settle();
  engine.stopMic();
  resume.resolve();
  assert.equal(await started, false);
  assert.equal(first.live, false);
  assert.equal(engine.micOn(), false);

  const again = engine.startMic();
  assert.equal(env.micRequests.length, 2);
  const second = new FakeStream();
  env.micRequests[1].resolve(second);
  assert.equal(await again, true);
  assert.equal(second.live, true);
  assert.equal(engine.micOn(), true);
});

test('止めた後に始め直した時、前の開始が遅れて失敗しても、新しいマイクを壊さない', async () => {
  const engine = makeAudioEngine();
  const old = engine.startMic();
  engine.stopMic();
  const fresh = engine.startMic();
  assert.equal(env.micRequests.length, 2);
  const stream = new FakeStream();
  env.micRequests[1].resolve(stream);
  assert.equal(await fresh, true);
  env.micRequests[0].reject(new Error('NotReadableError'));
  assert.equal(await old, false, '止められた後の失敗は、知らせない');
  assert.equal(stream.live, true);
  assert.equal(engine.micOn(), true);
});

test('許可されなかった時は失敗を返し、もう一度始められる', async () => {
  const engine = makeAudioEngine();
  const started = engine.startMic();
  env.micRequests[0].reject(new Error('Permission denied'));
  await assert.rejects(started, /Permission denied/);
  assert.equal(engine.micOn(), false);
  engine.startMic();
  assert.equal(env.micRequests.length, 2);
});

test('許可の後の準備（resume）で失敗しても、取ったマイクを止める', async () => {
  const engine = makeAudioEngine();
  const resume = deferred();
  env.resumes.push(resume);
  const started = engine.startMic();
  const stream = new FakeStream();
  env.micRequests[0].resolve(stream);
  await settle();
  resume.reject(new Error('resume failed'));
  await assert.rejects(started, /resume failed/);
  assert.equal(stream.live, false);
  assert.equal(engine.micOn(), false);
});

test('動いているマイクが向こうの都合で切れたら、止めて知らせる（「マイク停止」のまま残さない）', async () => {
  let ended = 0;
  const engine = makeAudioEngine({ onMicEnded: () => { ended += 1; } });
  const started = engine.startMic();
  const stream = new FakeStream();
  env.micRequests[0].resolve(stream);
  assert.equal(await started, true);

  stream.tracks[0].endByDevice();
  assert.equal(ended, 1);
  assert.equal(engine.micOn(), false);
  assert.equal(env.sources[0].disconnected, true);

  // もう一度始められる
  const again = engine.startMic();
  env.micRequests[1].resolve(new FakeStream());
  assert.equal(await again, true);
});

test('自分で止めた時・前のマイクが後から切れた時は、知らせず、今のマイクも止めない', async () => {
  let ended = 0;
  const engine = makeAudioEngine({ onMicEnded: () => { ended += 1; } });
  const first = engine.startMic();
  const old = new FakeStream();
  env.micRequests[0].resolve(old);
  assert.equal(await first, true);
  engine.stopMic();
  assert.equal(ended, 0, '自分で止めた時は知らせない');

  const second = engine.startMic();
  const fresh = new FakeStream();
  env.micRequests[1].resolve(fresh);
  assert.equal(await second, true);
  old.tracks[0].endByDevice();
  assert.equal(ended, 0, '前のマイクが切れても知らせない');
  assert.equal(engine.micOn(), true);
  assert.equal(fresh.live, true);
});

test('マイクを使えないページ（navigator.mediaDevices が無い）では、何も始めずに NotSupportedError', async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  const engine = makeAudioEngine();
  await assert.rejects(engine.startMic(), (e) => e.name === 'NotSupportedError');
  assert.equal(engine.micOn(), false);
  assert.match(micErrorMessage(new DOMException('x', 'NotSupportedError')), /https か 127\.0\.0\.1/);
});

test('マイクのエラーの文は、種類ごとに分ける（何でも「権限」と言わない）', () => {
  const msg = (name) => micErrorMessage(new DOMException('x', name));
  assert.match(msg('NotAllowedError'), /許可されていません/);
  assert.match(msg('NotFoundError'), /見つかりません/);
  assert.match(msg('NotReadableError'), /ほかのアプリ/);
  assert.match(micErrorMessage(new Error('?')), /マイクを使用できません/);
  assert.match(micErrorMessage(undefined), /マイクを使用できません/);
});

test('resume() が失敗しても、未処理の失敗にしない', async () => {
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    const engine = makeAudioEngine();
    engine.attachAudioEl({});
    const resume = deferred();
    env.resumes.push(resume);
    engine.resume();
    resume.reject(new DOMException('closed', 'InvalidStateError'));
    await settle();
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});
