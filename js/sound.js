/* ============ 暴击企鹅 · 音效模块 ============
 * 音效1（synth）：WebAudio 实时合成，风格参考赌场/下注类游戏：击球脆响、金币叮当、
 *   轮盘式悬念滴答、猜对上扬金币雨琶音、猜错下滑低音闷响。
 * 音效2（sample）：从真实游戏视频中抓取的原声素材（assets/sfx/*.mp3），
 *   击球、落币、掏球与猜错均按录像时序重切；录像未包含的猜对音保留原素材。
 *   音效2使用独立缓存与总线；http 下直接 fetch，file:// 双击打开时自动改用内嵌副本
 *   （js/sfx-data.js，按需注入）；两者均不可用才回退音效一。
 */
window.Sound = (function () {
  let ctx = null, master = null;
  let on = true, vol = 0.8;
  let pack = 'sample'; // 默认音效2；game.js 初始化时会用存档值 setPack 同步

  /* 音效2 素材表：方法名 -> 文件名（相对 assets/sfx/） */
  const SAMPLES = {
    click: 'click', hit: 'hit', burst: 'burst', coin: 'coin', coins: 'coins',
    jingle: 'jingle', guessIn: 'guessin', pick: 'pick', draw: 'draw',
    reveal: 'reveal', win: 'win', lose: 'lose',
  };
  // 音效二独立音频总线：预解码、统一增益、可取消，不改变音效一的合成参数。
  let sampleCtx = null, sampleMaster = null, sampleEpoch = 0;
  const sampleBuffers = new Map(), sampleVoices = new Set(), sampleVersions = new Map();
  const sampleLevels = { click: .5, pick: .6, guessIn: .6, coin: .95, coins: .8, jingle: .9, draw: .75 };
  function ensureSample() {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!sampleCtx) {
      try {
        sampleCtx = new AC();
        sampleMaster = sampleCtx.createGain();
        sampleMaster.gain.value = on ? vol : 0;
        if (sampleCtx.createDynamicsCompressor) {
          const limiter = sampleCtx.createDynamicsCompressor();
          limiter.threshold.value = -3; limiter.knee.value = 3; limiter.ratio.value = 12;
          limiter.attack.value = .002; limiter.release.value = .08;
          sampleMaster.connect(limiter); limiter.connect(sampleCtx.destination);
        } else sampleMaster.connect(sampleCtx.destination);
      } catch (e) { return null; }
    }
    return sampleCtx;
  }
  // 掏球为无缝延长素材，版本号用于令浏览器重新拉取缓存。
  const SAMPLE_VERSIONS = { draw: '4' };
  const failedSamples = new Set(); // 素材加载失败的音效 -> 自动回退音效一
  /** file:// 双击打开或无 fetch 的环境：浏览器禁止抓取本地音频，改用按需注入的内嵌副本 */
  function needEmbedded() {
    if (typeof fetch !== 'function') return true;
    return !!(typeof window !== 'undefined' && window.location && window.location.protocol === 'file:');
  }
  let embeddedPromise = null, embeddedWarned = false;
  function loadEmbedded() {
    if (embeddedPromise) return embeddedPromise;
    embeddedPromise = new Promise((resolve) => {
      if (typeof window === 'undefined') { resolve(null); return; }
      if (window.SFX_DATA) { resolve(window.SFX_DATA); return; }
      if (typeof document === 'undefined') { resolve(null); return; }
      const script = document.createElement('script');
      script.src = 'js/sfx-data.js'; // base64 内嵌副本，由 _sfx_work/gen_embedded.js 生成
      script.onload = () => resolve(window.SFX_DATA || null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
    return embeddedPromise;
  }
  function base64ToBuffer(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  function failSample(name) {
    failedSamples.add(name);
    if (!embeddedWarned && needEmbedded()) {
      embeddedWarned = true;
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Sound] 内嵌素材不可用，音效2已自动回退为音效1。');
      }
    }
  }
  function loadEmbeddedSample(name) {
    return loadEmbedded().then((data) => {
      if (!data || !data[name]) { failSample(name); return null; }
      try {
        return sampleCtx.decodeAudioData(base64ToBuffer(data[name])).catch(() => { failSample(name); return null; });
      } catch (e) { failSample(name); return null; }
    }).catch(() => { failSample(name); return null; });
  }
  function markAllFailed() {
    Object.keys(SAMPLES).forEach((n) => failedSamples.add(n));
  }
  function loadSample(name) {
    if (!sampleBuffers.has(name)) {
      if (needEmbedded()) {
        sampleBuffers.set(name, loadEmbeddedSample(name));
      } else {
        const promise = fetch('assets/sfx/' + SAMPLES[name] + '.mp3?v=' + (SAMPLE_VERSIONS[name] || '2'))
          .then((response) => { if (!response.ok) throw new Error('音效加载失败'); return response.arrayBuffer(); })
          .then((data) => sampleCtx.decodeAudioData(data))
          .catch(() => { failSample(name); sampleBuffers.delete(name); return null; });
        sampleBuffers.set(name, promise);
      }
    }
    return sampleBuffers.get(name);
  }
  function stopSamples(name) {
    if (name) sampleVersions.set(name, (sampleVersions.get(name) || 0) + 1);
    else sampleEpoch++;
    for (const voice of [...sampleVoices]) {
      if (!name || voice.name === name) {
        try { voice.source.stop(); } catch (e) { /* 已自然结束 */ }
        voice.source.disconnect(); voice.gain.disconnect(); sampleVoices.delete(voice);
      }
    }
  }
  function preloadSamples() {
    if (!ensureSample()) { markAllFailed(); return; }
    Object.keys(SAMPLES).forEach(loadSample);
  }
  function playSample(name, scale, duration) {
    if (!SAMPLES[name]) return false;
    if (!on) return true; // 开关关闭时静默吞掉，不再回退合成音
    if (failedSamples.has(name) || !ensureSample()) return false; // 素材不可用：同步回退音效一
    const epoch = sampleEpoch, version = sampleVersions.get(name) || 0;
    const requestedAt = sampleCtx.currentTime;
    const limit = duration ? requestedAt + duration : Infinity;
    const ready = sampleCtx.state === 'suspended' ? sampleCtx.resume().catch(() => {}) : Promise.resolve();
    Promise.all([loadSample(name), ready]).then(([buffer]) => {
      if (!buffer) { failedSamples.add(name); return; }
      if (!on || pack !== 'sample' || epoch !== sampleEpoch || version !== (sampleVersions.get(name) || 0)) return;
      // 首次网络加载过慢时丢弃过期击球，避免动作结束后补播。
      const elapsed = sampleCtx.currentTime - requestedAt;
      if (elapsed > (duration ? duration - .02 : .6) || sampleCtx.state !== 'running') return;
      if (sampleVoices.size >= 12) {
        const oldest = sampleVoices.values().next().value;
        oldest.source.stop(); oldest.source.disconnect(); oldest.gain.disconnect(); sampleVoices.delete(oldest);
      }
      const source = sampleCtx.createBufferSource(), gain = sampleCtx.createGain();
      source.buffer = buffer;
      // 掏球已是保音高延长的完整素材，与其他音效一样仅播放一次。
      source.loop = false;
      source.connect(gain); gain.connect(sampleMaster);
      const now = sampleCtx.currentTime;
      const level = (scale == null ? 1 : scale) * (sampleLevels[name] || 1);
      gain.gain.setValueAtTime(duration ? 0 : level, now);
      if (duration) gain.gain.linearRampToValueAtTime(level, now + Math.min(.012, (limit - now) / 4));
      const voice = { name, source, gain };
      sampleVoices.add(voice);
      source.onended = () => { source.disconnect(); gain.disconnect(); sampleVoices.delete(voice); };
      // 解码稍晚时从对应位置接续，不能重新播开头，也不能越过揭球时刻。
      source.start(now, duration ? elapsed : 0);
      if (duration) {
        const end = Math.max(now + .01, limit);
        gain.gain.setValueAtTime(level, Math.max(now + .012, end - .09));
        gain.gain.linearRampToValueAtTime(0, end);
        source.stop(end);
      }
    });
    return true;
  }

  function ensure() {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = on ? vol : 0;
        master.connect(ctx.destination);
      } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(o) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + (o.at || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + o.dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.peak || 0.2, t0 + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + o.dur + 0.05);
  }
  function noise(o) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + (o.at || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * o.dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'highpass';
    f.frequency.value = o.freq || 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.peak || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }
  function coin(at) {
    tone({ f: 1568, f2: 2093, at: at, dur: 0.09, type: 'square', peak: 0.1 });
    noise({ at: at, dur: 0.05, freq: 7000, peak: 0.07 });
  }

  return {
    /** 需在用户手势中调用以解锁 AudioContext */
    unlock: function () {
      if (pack === 'synth') ensure();
      else if (ensureSample()) {
        if (sampleCtx.state === 'suspended') sampleCtx.resume().catch(() => {});
        preloadSamples();
      }
    },
    setOn: function (v) {
      on = !!v; if (master) master.gain.value = on ? vol : 0;
      if (sampleMaster) sampleMaster.gain.value = on ? vol : 0;
      if (!on) stopSamples();
    },
    setVolume: function (v) {
      vol = Math.max(0, Math.min(1, v)); if (master && on) master.gain.value = vol;
      if (sampleMaster) sampleMaster.gain.value = on ? vol : 0;
    },
    /** 切换音效包：'synth'=音效1(合成) 'sample'=音效2(视频原声) */
    setPack: function (p) {
      stopSamples();
      pack = p === 'sample' ? 'sample' : 'synth';
      if (pack === 'sample') preloadSamples();
    },
    getPack: function () { return pack; },

    /** UI 点击 */
    click: function () {
      if (pack === 'sample' && playSample('click', 0.9)) return;
      tone({ f: 720, dur: 0.05, type: 'square', peak: 0.07 });
    },

    /** 击球：球杆撞击 + 台球脆碰 + 低闷回响 */
    hit: function () {
      if (pack === 'sample' && playSample('hit')) return;
      noise({ dur: 0.04, freq: 2600, peak: 0.3 });
      tone({ f: 950, f2: 190, dur: 0.1, type: 'triangle', peak: 0.3 });
      tone({ f: 210, f2: 90, dur: 0.12, type: 'sine', peak: 0.25, at: 0.01 });
    },

    /** 连击爆铃（10/100 次群击） */
    burst: function () {
      if (pack === 'sample' && playSample('burst')) return;
      for (let i = 0; i < 4; i++) {
        tone({ f: 900 + Math.random() * 200, f2: 200, dur: 0.09, type: 'triangle', peak: 0.22, at: i * 0.07 });
        coin(i * 0.07 + 0.03);
      }
    },

    /** 单枚金币入袋 */
    coin: function () {
      if (pack === 'sample' && playSample('coin')) return;
      coin(0);
    },
    /** 金币雨（领取桌面） */
    coins: function () {
      if (pack === 'sample' && playSample('coins')) return;
      for (let i = 0; i < 7; i++) coin(i * 0.07 + Math.random() * 0.02);
    },

    /** 20 次集满/猜球解锁提示音 */
    jingle: function () {
      if (pack === 'sample' && playSample('jingle')) return;
      [784, 988, 1319].forEach(function (f, i) { tone({ f: f, dur: 0.14, type: 'square', peak: 0.14, at: i * 0.11 }); });
      for (let i = 0; i < 5; i++) coin(0.3 + i * 0.06);
    },

    /** 进入猜球页 */
    guessIn: function () {
      if (pack === 'sample' && playSample('guessIn')) return;
      tone({ f: 440, f2: 880, dur: 0.18, type: 'sine', peak: 0.15 });
    },

    /** 选定花色/全色 */
    pick: function () {
      if (pack === 'sample' && playSample('pick')) return;
      tone({ f: 660, dur: 0.06, type: 'square', peak: 0.1 });
    },

    /** 掏球悬念：音效2 为保音高延长原声，单次播放并淡出；音效1 保持原有滴答与垫音 */
    suspense: function (ms) {
      if (pack === 'sample') {
        stopSamples('draw');
        if (playSample('draw', 1, Math.max(.1, ms / 1000 - .2))) return;
      }
      if (!ensure()) return;
      let t = 0, gap = 0.16;
      const total = ms / 1000;
      while (t < total - 0.2) {
        tone({ f: 1150 + Math.random() * 120, dur: 0.035, type: 'square', peak: 0.09, at: t });
        t += gap; gap = Math.max(0.06, gap * 0.93);
      }
      tone({ f: 70, f2: 115, dur: total, type: 'sine', peak: 0.15, attack: total / 2 });
    },

    /** 开球揭示：上扬弹跳音 */
    reveal: function () {
      if (pack === 'sample') {
        stopSamples('draw');
        if (playSample('reveal')) return;
      }
      tone({ f: 320, f2: 980, dur: 0.14, type: 'sine', peak: 0.25 });
      noise({ dur: 0.06, freq: 4000, peak: 0.1, at: 0.02 });
    },

    /** 猜对结算：赌场上扬琶音 + 和弦 + 金币雨 */
    win: function () {
      if (pack === 'sample' && playSample('win')) return;
      [523, 659, 784, 1047].forEach(function (f, i) { tone({ f: f, dur: 0.12, type: 'square', peak: 0.15, at: i * 0.1 }); });
      [1047, 1319, 1568].forEach(function (f) { tone({ f: f, dur: 0.5, type: 'triangle', peak: 0.11, at: 0.45 }); });
      for (let i = 0; i < 10; i++) coin(0.45 + i * 0.06);
      noise({ at: 0.45, dur: 0.5, freq: 8000, peak: 0.05 });
    },

    /** 猜错结算：下行滑音 + 低音闷响 */
    lose: function () {
      if (pack === 'sample' && playSample('lose')) return;
      [392, 311, 247, 165].forEach(function (f, i) { tone({ f: f, f2: f * 0.9, dur: 0.2, type: 'sawtooth', peak: 0.11, at: i * 0.17 }); });
      tone({ f: 75, f2: 50, dur: 0.4, type: 'sine', peak: 0.3, at: 0.7 });
    },
  };
})();
