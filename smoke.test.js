/* 暴击企鹅 · 全流程冒烟测试（jsdom，临时文件） */
const { JSDOM } = require(process.env.TEMP + '/bjqetest/node_modules/jsdom');
const fs = require('fs');
const root = __dirname;
const crypto = require('crypto');
const vm = require('vm');

const html = fs.readFileSync(root + '/index.html', 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;
const { document } = window;
window.eval(fs.readFileSync(root + '/js/config.js', 'utf8'));
window.eval(fs.readFileSync(root + '/js/sound.js', 'utf8'));
window.eval(fs.readFileSync(root + '/js/game.js', 'utf8'));

const $ = (s) => document.querySelector(s);
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!cond) failed++;
}
const num = (s) => parseInt(String(s).replace(/,/g, ''), 10);

function checkProtectedViews() {
  const game = fs.readFileSync(root + '/js/game.js', 'utf8');
  const css = fs.readFileSync(root + '/css/style.css', 'utf8');
  const digest = (s) => crypto.createHash('sha256').update(s).digest('hex');
  // 本轮允许统一结算视觉，旧画面指纹改为高清资源与连续动画约束；音效一仍受保护。
  check('游戏运行时不再依赖低清录屏PNG', !/assets\/prototype\/[^'"\s]+\.png/.test(game + css + html));
  check('高清球桌与金币SVG齐全', ['table', 'coin'].every((name) => {
    const svg = fs.readFileSync(root + '/assets/prototype/' + name + '.svg', 'utf8');
    return svg.includes('viewBox=') && !/<image\b/.test(svg);
  }));
  const penguins = [...document.querySelectorAll('.hd-penguin')];
  check('入口、主界面、猜球统一矢量企鹅', penguins.length === 3);
  const ids = [...document.querySelectorAll('.hd-penguin [id]')].map((el) => el.id);
  check('多个企鹅渐变ID不冲突', new Set(ids).size === ids.length);
  check('掏球动画按设置时长单次播放', css.includes('pocketDraw var(--draw-duration, 3000ms) ease-in-out 1 forwards'));
  check('双手掏球展开时长一致', css.includes('pocketSupport var(--draw-duration, 3000ms) ease-in-out 1 forwards'));
  // 中段不得静止：双臂由固定节奏循环动作驱动，且循环不随设置时长拉伸。
  const digLoop = (name) => css.includes(`1 forwards, ${name} .46s ease-in-out calc(var(--draw-duration, 3000ms) * .22) infinite`);
  check('掏袋中段双臂持续交替动作', digLoop('digRight') && digLoop('digLeft'));
  check('掏袋循环节奏固定不被设置时长拉伸', !/dig(Right|Left) var\(--draw-duration/.test(css));
  check('拔出前先探底抓球再拔', css.includes('72% { transform: rotate(0); } 80% { transform: rotate(6deg); } 100% { transform: rotate(-112deg); }'));
  check('掏袋动作加大幅度更卖力', css.includes('22% { rotate: -14deg; }') && css.includes('headDig .46s'));
  check('口袋与身体随掏袋起伏', css.includes('pouchPump .46s') && css.includes('bodyBob .23s'));
  check('双手都有独立掏袋图层', !!$('#guess-penguin .arm-l-reach') && !!$('#guess-penguin .arm-r-reach'));
  check('主界面左手掏袋层默认隐藏', css.includes('.penguin .arm-l-reach { display: none; }'));
  check('出球后左手叉腰、右手举球图层齐全', !!$('#guess-penguin .arm-l-akimbo') && !!$('#guess-penguin .arm-r-up') && !!$('#guess-penguin .held-ball'));
  check('出球后叉腰举球姿态覆盖reveal/up/down', css.includes("']) .arm-l-akimbo { display: block;") && css.includes("']) .arm-r-up { display: block;"));
  check('手中球图层隐藏，举起的球只经答案球位呈现', css.includes('#guess-penguin .held-ball { display: none; }') && !css.includes("']) .held-ball { display: block;"));
  check('击球眩晕：头部摇摆+X眼替换', css.includes('.penguin.hit-dizzy .penguin-head {') && css.includes('headDizzy') && css.includes('.penguin.hit-dizzy .dizzy-eyes { display: block; }'));
  check('击球时触发眩晕反馈', game.includes("classList.add('hit-dizzy')"));
  check('不再循环播放录屏掏球图集', !css.includes('prototypeDraw') && !css.includes('guess-draw.png'));
  // 真实素材校验：掏球声为 6.5s 无缝延长版（覆盖 6s 动画上限），非旧 0.6s/5.3s 短素材。
  const drawBytes = fs.statSync(root + '/assets/sfx/draw.mp3').size;
  check('掏球声素材为6.5s连续延长版', drawBytes > 90000 && drawBytes < 160000);
  check('掏球动画由设置时长驱动', game.includes("setProperty('--draw-duration'") && game.includes("setPose(penguin, 'reveal')"));
  check('主界面猜球及获奖弹窗共用等比尺寸', css.includes('#screen-main, #screen-guess, #popup-prize {'));
  const sound = fs.readFileSync(root + '/js/sound.js', 'utf8');
  const marks = { click: '      tone(', hit: '      noise(', burst: '      for (', coin: '      coin(0)', coins: '      for (', jingle: '      [784', guessIn: '      tone(', pick: '      tone(', suspense: '      if (!ensure())', reveal: '      tone(', win: '      [523', lose: '      [392' };
  const synth = Object.entries(marks).map(([name, marker]) => {
    const start = sound.indexOf('    ' + name + ': function');
    return sound.slice(sound.indexOf(marker, start), sound.indexOf('\n    },', start));
  }).join('\n');
  check('音效一全部12种合成参数与实现保持不变', digest(synth) === 'deaf6b14f97c4d5b86115927d89268ece39fa21b26d3da066b9c38cb8835aa76');
}

async function checkSamplePlayback() {
  const starts = [], gains = [], fetched = [], contexts = [];
  const parameter = () => ({ value: 0, events: [], setValueAtTime(value, time) { this.events.push({ kind: 'set', value, time }); }, linearRampToValueAtTime(value, time) { this.events.push({ kind: 'ramp', value, time }); } });
  class AudioContextMock {
    constructor() { this.currentTime = 10; this.state = 'running'; this.destination = {}; contexts.push(this); }
    createGain() {
      const node = { gain: parameter(), connect() {}, disconnect() {} };
      gains.push(node); return node;
    }
    createBufferSource() {
      return { connect() {}, disconnect() {}, stopCount: 0, playbackRate: { value: 1 },
        start(at, offset) { this.startAt = at; this.offset = offset; starts.push(this); }, stop(at) { this.stopCount++; this.stopAt = at; } };
    }
    decodeAudioData() { return Promise.resolve({ duration: 6.4 }); }
    resume() { this.state = 'running'; return Promise.resolve(); }
  }
  const source = fs.readFileSync(root + '/js/sound.js', 'utf8');
  const sandbox = { window: { AudioContext: AudioContextMock }, fetch: (url) => {
    fetched.push(url);
    const result = { ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) };
    return Promise.resolve(result);
  } };
  vm.runInNewContext(source, sandbox);
  const sound = sandbox.window.Sound;
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  sound.setPack('sample'); sound.unlock(); await flush();
  check('音效二预加载12种素材', fetched.length === 12);
  sound.hit(); sound.hit(); await flush();
  check('重复击球复用解码缓存', fetched.length === 12 && starts.length === 2);
  sound.suspense(3000); await flush();
  const draw = starts[starts.length - 1];
  check('掏球只有一个非循环声源', draw.loop === false && draw.stopAt <= 13);
  check('掏球使用新版本无缝延长素材', fetched.some((url) => url.endsWith('/draw.mp3?v=4')));
  sound.reveal(); await flush();
  check('揭球立即终止掏球声', draw.stopCount === 2);
  sound.setVolume(.25);
  check('在播音效随总音量变化', gains[0].gain.value === .25);
  for (const ms of [1000, 1500, 3000, 4500, 6000]) {
    const before = starts.length;
    sound.suspense(ms); await flush();
    const voice = starts[starts.length - 1], envelope = gains[gains.length - 1].gain.events;
    check(ms + 'ms:掏球单次播放且不改变音高', starts.length === before + 1 && voice.loop === false && voice.playbackRate.value === 1);
    check(ms + 'ms:延长素材覆盖全程并准时结束', voice.buffer.duration >= ms / 1000 && Math.abs(voice.stopAt - (10 + ms / 1000 - .2)) < 1e-6);
    check(ms + 'ms:音频淡入淡出无硬切', envelope[0].value === 0 && envelope[1].kind === 'ramp' && envelope[envelope.length - 1].value === 0 && envelope[envelope.length - 1].time === voice.stopAt);
  }
  sound.setOn(false);
  check('静音停止所有在播原声', starts.every((s) => s.stopCount > 0));
  const beforeMute = starts.length;
  sound.coin(); await flush();
  check('静音不产生新原声', starts.length === beforeMute);
  sound.setOn(true);
  sound.suspense(6000); await flush();
  const lastDraw = starts[starts.length - 1];
  sound.setPack('synth'); await flush();
  check('切回音效一不会残留掏球原声', lastDraw.stopCount === 2);
  // 未解码完成时切换或揭球，异步回调不得再启动过期声音。
  const pendingSandbox = { ...sandbox, window: { AudioContext: AudioContextMock } };
  const resolvers = [];
  pendingSandbox.fetch = () => new Promise((resolve) => resolvers.push(() => resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) })));
  vm.runInNewContext(source, pendingSandbox);
  const pending = pendingSandbox.window.Sound;
  const previous = starts.length;
  pending.setPack('sample'); pending.suspense(3000); pending.setPack('synth');
  resolvers.forEach((resolve) => resolve()); await flush();
  check('取消尚未解码的音效二请求', starts.length === previous);
  for (const mode of ['late', 'expired', 'reveal', 'mute']) {
    const delayedResolvers = [];
    const delayedSandbox = { ...sandbox, window: { AudioContext: AudioContextMock }, fetch: () => new Promise((resolve) => delayedResolvers.push(() => resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }))) };
    vm.runInNewContext(source, delayedSandbox);
    const delayed = delayedSandbox.window.Sound;
    delayed.setPack('sample'); delayed.suspense(3000);
    const before = starts.length;
    contexts[contexts.length - 1].currentTime = mode === 'expired' ? 12.79 : 11;
    if (mode === 'reveal') delayed.reveal();
    if (mode === 'mute') delayed.setOn(false);
    delayedResolvers.forEach((resolve) => resolve()); await flush();
    if (mode === 'late') {
      const voice = starts[starts.length - 1];
      check('延迟解码从当前进度续播且不重播开头', starts.length === before + 1 && voice.offset === 1 && voice.loop === false && Math.abs(voice.stopAt - 12.8) < 1e-6);
    } else if (mode === 'reveal') {
      check('解码前已揭球只播放揭球声', starts.length === before + 1 && starts[starts.length - 1].stopCount === 0);
    } else check(mode === 'mute' ? '解码前静音不会补播' : '临近揭球的过期音频不再启动', starts.length === before);
    delayed.setOn(false);
  }
}

// 素材不可用（fetch 失败 / file:// 直接打开）时必须同步回退音效一，任何环境不允许整局静音。
async function checkSampleFallback() {
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const makeCtx = (stats) => {
    const param = () => ({ value: 0, setValueAtTime() { return this; }, linearRampToValueAtTime() { return this; }, exponentialRampToValueAtTime() { return this; } });
    const node = () => ({ connect() {}, disconnect() {} });
    return class FallbackCtx {
      constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = node(); }
      createGain() { return { ...node(), gain: param() }; }
      createOscillator() { stats.oscs++; return { ...node(), type: '', frequency: param(), start() {}, stop() {} }; }
      createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
      createBufferSource() { return { ...node(), buffer: null, loop: false, playbackRate: param(), start() { stats.starts++; }, stop() {}, onended: null }; }
      createBiquadFilter() { return { ...node(), type: '', frequency: param() }; }
      createDynamicsCompressor() { return { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; }
      resume() { this.state = 'running'; return Promise.resolve(); }
      decodeAudioData() { return Promise.resolve({ duration: 1 }); }
    };
  };
  const source = fs.readFileSync(root + '/js/sound.js', 'utf8');
  // A. fetch 全部失败：解码失败后击球仍必须发声（合成音顶替）。
  const statsA = { oscs: 0, starts: 0 };
  const sandboxA = { window: { AudioContext: makeCtx(statsA) }, fetch: () => Promise.reject(new Error('blocked')) };
  vm.runInNewContext(source, sandboxA);
  const a = sandboxA.window.Sound;
  a.setPack('sample'); a.unlock(); await flush(); await flush();
  a.hit();
  check('素材加载失败自动回退音效一', statsA.oscs >= 2 && a.getPack() === 'sample');
  // B. file:// 且无内嵌数据：不请求网络素材，直接合成音。
  const statsB = { oscs: 0, starts: 0 };
  const fetchedB = [];
  const quiet = { warn() {}, log() {} };
  const sandboxB = { window: { AudioContext: makeCtx(statsB), location: { protocol: 'file:' } }, console: quiet, fetch: (url) => { fetchedB.push(url); return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }); } };
  vm.runInNewContext(source, sandboxB);
  const b = sandboxB.window.Sound;
  b.setPack('sample'); b.unlock(); await flush(); await flush();
  check('file:// 且无内嵌数据时回退音效一', fetchedB.length === 0);
  b.hit();
  check('file:// 且无内嵌数据时击球仍发声', statsB.oscs >= 2);
  // C. file:// + 内嵌素材：音效二原声直接可用，不依赖 fetch。
  const statsC = { oscs: 0, starts: 0 };
  const fetchedC = [];
  const b64 = Buffer.from(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])).toString('base64');
  const sandboxC = {
    window: { AudioContext: makeCtx(statsC), location: { protocol: 'file:' }, SFX_DATA: { hit: b64 } },
    console: quiet,
    fetch: (url) => { fetchedC.push(url); return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }); },
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  };
  vm.runInNewContext(source, sandboxC);
  const c = sandboxC.window.Sound;
  c.setPack('sample'); c.unlock(); await flush(); await flush();
  c.hit(); await flush();
  check('file:// 下内嵌素材可直接播放音效二', fetchedC.length === 0 && statsC.starts >= 1 && statsC.oscs === 0);
  // D. 内嵌素材文件与 assets/sfx 保持同步（重新生成 mp3 后需重跑 gen_embedded.js）。
  const embeddedSrc = fs.readFileSync(root + '/js/sfx-data.js', 'utf8');
  const keyCount = (embeddedSrc.match(/^  \w+: '/gm) || []).length;
  check('内嵌素材含全部12种音效', keyCount === 12);
  const drawB64 = (embeddedSrc.match(/draw: '([^']+)'/) || [])[1];
  check('内嵌掏球素材与最新 draw.mp3 同步', !!drawB64 && Buffer.from(drawB64, 'base64').length === fs.statSync(root + '/assets/sfx/draw.mp3').size);
}

function checkGuessMotion() {
  [1000, 3000, 6000].forEach((duration) => {
    const isolated = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
    const w = isolated.window;
    let now = 0, nextId = 0;
    const timers = new Map();
    w.setTimeout = (fn, ms = 0) => { const id = ++nextId; timers.set(id, { fn, at: now + ms }); return id; };
    w.clearTimeout = (id) => timers.delete(id);
    const advance = (ms) => {
      const until = now + ms;
      while (true) {
        const next = [...timers].filter(([, task]) => task.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]); now = next[1].at; next[1].fn();
      }
      now = until;
    };
    w.eval(fs.readFileSync(root + '/js/config.js', 'utf8'));
    w.localStorage.setItem(w.CONFIG.saveKey, JSON.stringify({ coins: 10000, table: 1200, hits: 20, guessUnlocked: true, winChance: 100, drawMs: duration }));
    w.Sound = new Proxy({}, { get: (_, name) => name === 'getPack' ? () => 'synth' : () => {} });
    w.eval(fs.readFileSync(root + '/js/game.js', 'utf8'));
    const find = (selector) => w.document.querySelector(selector);
    const tap = (selector) => find(selector).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    tap('.game-card'); tap('#guess-btn'); tap('.pick-solid');
    const scene = find('#screen-guess'), penguin = find('#guess-penguin'), table = find('.gt-wrap img');
    check(duration + 'ms:动画时长同步', scene.style.getPropertyValue('--draw-duration') === duration + 'ms');
    const timerCount = timers.size;
    tap('.pick-stripe');
    check(duration + 'ms:重复选择不重启动画', timers.size === timerCount && find('.pick-solid').classList.contains('selected'));
    advance(duration - 1);
    check(duration + 'ms:完成前保持单次掏球状态', penguin.dataset.pose === 'reach' && scene.dataset.state === 'drawing' && !find('#draw-slot .ball'));
    advance(1);
    check(duration + 'ms:准时揭球并停止掏袋', penguin.dataset.pose === 'reveal' && scene.dataset.state === 'revealed' && !!find('#draw-slot .ball'));
    advance(600);
    check(duration + 'ms:结果不替换场景节点', scene.dataset.state === 'won' && find('#guess-penguin') === penguin && find('.gt-wrap img') === table);
    advance(900); tap('#popup-prize');
    check(duration + 'ms:结算仅入账一次', find('#coins-text').textContent === '12,400');
    isolated.window.close();
  });
}

/* 桌面金币堆：金额越大金币越多（击球1/10/100次档差异明显），超上限后继续放大而非冻结。 */
function checkCoinPileScaling() {
  const pileFor = (table) => {
    const isolated = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
    const w = isolated.window;
    w.eval(fs.readFileSync(root + '/js/config.js', 'utf8'));
    w.localStorage.setItem(w.CONFIG.saveKey, JSON.stringify({ coins: 10000, table, hits: 0, guessUnlocked: false }));
    w.Sound = new Proxy({}, { get: (_, name) => name === 'getPack' ? () => 'synth' : () => {} });
    w.eval(fs.readFileSync(root + '/js/game.js', 'utf8'));
    const coins = [...w.document.querySelectorAll('#coin-pile .pile-coin')];
    const lefts = coins.map((c) => parseFloat(c.style.left));
    const result = {
      count: coins.length,
      width: coins.length ? parseFloat(coins[0].style.width) : 0,
      reach: lefts.length > 1 ? Math.max(...lefts) - Math.min(...lefts) : 0,
    };
    isolated.window.close();
    return result;
  };
  const one = pileFor(100);
  const ten = pileFor(1000);
  const hundred = pileFor(10000);
  check('击球1/10/100次档位金币数量明显区分', one.count >= 5 && ten.count >= one.count * 2 && hundred.count >= ten.count * 2);
  check('击球一次只掉少量金币', one.count <= 8);
  check('金币铺开范围随数量同步增长', one.reach < ten.reach && ten.reach < hundred.reach);
  const big = pileFor(400000);
  const huge = pileFor(2000000);
  check('金额超展示上限后金币继续变大而非冻结', big.count === huge.count && huge.width > big.width && huge.reach > big.reach);
  check('大额桌面金币接近满载且无回落', huge.count >= 100 && huge.width > 7.5);
}

(async () => {
  checkProtectedViews();
  checkGuessMotion();
  await checkSamplePlayback();
  await checkSampleFallback();
  checkCoinPileScaling();
  // 1. 入口 → 主界面
  click($('.game-card'));
  check('进入游戏主界面', $('#screen-main').classList.contains('active'));
  check('初始金币 10,000', $('#coins-text').textContent === '10,000');
  check('导航栏余额同步', $('#nav-coins').textContent === '10,000');

  // 2. 钱包页
  click(document.querySelector('[data-act="open-wallet"]'));
  check('打开钱包页', $('#screen-wallet').classList.contains('active'));
  check('钱包余额显示', $('#w-balance').textContent === '10,000');
  click(document.querySelector('[data-act="w-quick"][data-v="5000"]'));
  check('快捷+5千', $('#w-balance').textContent === '15,000');
  $('#w-amount').value = '1000';
  click(document.querySelector('[data-act="w-sub"]'));
  check('输入减少1千', $('#w-balance').textContent === '14,000');
  $('#w-set').value = '20000';
  click(document.querySelector('[data-act="w-set"]'));
  check('设置余额2万', $('#w-balance').textContent === '20,000');
  check('流水已记录', $('#w-log').children.length >= 3);
  check('统计6格', $('#w-stats').children.length === 6);
  click(document.querySelector('[data-act="go-back"]'));
  check('返回主界面', $('#screen-main').classList.contains('active'));
  check('主界面余额同步2万', $('#coins-text').textContent === '20,000');

  // 3. 设置页：胜率100%（保证猜对分支）
  click(document.querySelector('[data-act="open-settings"]'));
  check('打开设置页', $('#screen-settings').classList.contains('active'));
  click(document.querySelector('[data-act="s-chance"][data-v="100"]'));
  check('胜率设为100%', $('#s-chance-val').textContent === '100%');

  // 3a. 音效包（默认音效2视频原声 / 可切音效1合成）
  const sfxFiles = ['click', 'hit', 'burst', 'coin', 'coins', 'jingle', 'guessin', 'pick', 'draw', 'reveal', 'win', 'lose'];
  check('音效2素材齐全(12个)', sfxFiles.every((n) => fs.existsSync(root + '/assets/sfx/' + n + '.mp3')));
  check('默认选中音效2', $('#pk-sample').classList.contains('on') && !$('#pk-synth').classList.contains('on'));
  check('Sound模块默认音效2', window.Sound.getPack() === 'sample');
  click(document.querySelector('[data-act="s-pack"][data-p="synth"]'));
  check('切换到音效1', $('#pk-synth').classList.contains('on') && !$('#pk-sample').classList.contains('on'));
  click(document.querySelector('[data-act="s-test"][data-s="hit"]'));
  click(document.querySelector('[data-act="s-pack"][data-p="sample"]'));
  check('切回音效2', $('#pk-sample').classList.contains('on') && !$('#pk-synth').classList.contains('on'));
  check('音效包选择会写入存档', JSON.parse(window.localStorage.getItem(window.CONFIG.saveKey)).sound.pack === 'sample');

  click(document.querySelector('[data-act="go-back"]'));

  // 3b. 回归：钱包→设置→返回，应直接回到游戏界面
  click(document.querySelector('[data-act="open-wallet"]'));
  click(document.querySelector('[data-act="open-settings"]'));
  click(document.querySelector('[data-act="go-back"]'));
  check('钱包→设置→返回回游戏界面', $('#screen-main').classList.contains('active'));

  // 4. 击球100次解锁（并校验击球眩晕短暂出现后消退）
  click(document.querySelector('[data-act="hit"][data-n="100"]'));
  await wait(320);
  check('击球时企鹅短暂眩晕', $('#main-penguin').classList.contains('hit-dizzy'));
  await wait(700);
  check('眩晕一闪即收，恢复正常', !$('#main-penguin').classList.contains('hit-dizzy'));
  await wait(580);
  check('扣费后余额', num($('#coins-text').textContent) === 10000);
  check('次数满20/20', $('#hits-text').textContent === '20/20');
  const table1 = num($('#table-text').textContent);
  check('桌面有金币', table1 > 0);
  const firstCoin = $('#coin-pile').firstElementChild;
  check('金币使用独立倾斜落地层', !!firstCoin && !!firstCoin.style.getPropertyValue('--tilt'));
  check('金币落点不超出台面', [...$('#coin-pile').children].every((coin) => parseFloat(coin.style.top) + parseFloat(coin.style.height) < 60));
  click(document.querySelector('[data-act="open-settings"]'));
  click(document.querySelector('[data-act="go-back"]'));
  check('面板切换不会重新生成已有金币', $('#coin-pile').firstElementChild === firstCoin);

  // 5. 猜球（胜率100% → 必猜对）
  click($('#guess-btn'));
  check('进入猜球页', $('#screen-guess').classList.contains('active'));
  check('选择阶段使用统一高清场景', $('#screen-guess').dataset.state === 'idle' && !!$('#guess-penguin .hd-penguin'));
  check('提示含胜率', $('#guess-hint').textContent.indexOf('100%') >= 0);
  click(document.querySelector('[data-act="pick"][data-type="solid"]'));
  await wait(4200);
  check('必猜对:真棒', $('#guess-title').textContent === '真棒');
  check('猜对在同一高清场景显示', $('#screen-guess').dataset.state === 'won' && $('#guess-penguin').dataset.pose === 'up');
  const drawn = $('#draw-slot .ball');
  check('掏出的球为全色', !!drawn && !drawn.classList.contains('stripe'));
  await wait(1100);
  check('恭喜获得弹窗', !$('#popup-prize').classList.contains('hidden'));
  check('弹窗金额=桌面x2', $('#prize-amount').textContent === '×' + (table1 * 2).toLocaleString('en-US'));
  click($('#popup-prize'));
  check('回主界面', $('#screen-main').classList.contains('active'));
  check('翻倍入账', num($('#coins-text').textContent) === 10000 + table1 * 2);

  // 6. 设置胜率0%（保证猜错分支）
  click(document.querySelector('[data-act="open-settings"]'));
  const rc = $('#s-chance');
  rc.value = '0';
  rc.dispatchEvent(new window.Event('input', { bubbles: true }));
  check('胜率设为0%', $('#s-chance-val').textContent === '0%');
  click(document.querySelector('[data-act="go-back"]'));
  const coins2 = num($('#coins-text').textContent);
  click(document.querySelector('[data-act="hit"][data-n="100"]'));
  await wait(1600);
  const table2 = num($('#table-text').textContent);
  check('二次桌面有金币', table2 > 0);
  click($('#guess-btn'));
  click(document.querySelector('[data-act="pick"][data-type="stripe"]'));
  await wait(4200);
  check('必猜错:猜错了', $('#guess-title').textContent === '猜错了');
  check('猜错在同一高清场景显示', $('#screen-guess').dataset.state === 'lost' && $('#guess-penguin').dataset.pose === 'down');
  click(document.querySelector('[data-act="open-wallet"]'));
  click(document.querySelector('[data-act="go-back"]'));
  check('从钱包返回猜错页仍保留结果', $('#screen-guess').dataset.state === 'lost' && $('#guess-penguin').dataset.pose === 'down');
  const drawn2 = $('#draw-slot .ball');
  check('掏出的球为全色(与猜花色相反)', !!drawn2 && !drawn2.classList.contains('stripe'));
  click($('#screen-guess'));
  check('猜错回主界面', $('#screen-main').classList.contains('active'));
  check('桌面清空', num($('#table-text').textContent) === 0);
  check('余额未变', num($('#coins-text').textContent) === coins2 - 10000);

  // 7. 钱包统计与流水校验
  click(document.querySelector('[data-act="open-wallet"]'));
  const stats = $('#w-stats').textContent;
  check('统计含猜球2次', stats.indexOf('猜球次数2') >= 0);
  check('统计含猜对1次', stats.indexOf('猜对次数1') >= 0);
  check('统计胜率50%', stats.indexOf('50%') >= 0);
  const logTxt = $('#w-log').textContent;
  check('流水含猜对奖励', logTxt.indexOf('猜对翻倍奖励') >= 0);
  check('流水含猜错清空', logTxt.indexOf('猜错桌面清空') >= 0);
  check('流水含下注记录', logTxt.indexOf('击球100次下注') >= 0);
  click(document.querySelector('[data-act="go-back"]'));

  // 8. 弹框与返回入口
  click($('.reward-btn'));
  check('奖励弹框18格', $('#reward-grid').children.length === 18);
  click($('#popup-reward'));
  check('空白关闭奖励弹框', $('#popup-reward').classList.contains('hidden'));
  click($('.close-x'));
  check('返回入口页', $('#screen-entry').classList.contains('active'));

  console.log(failed === 0 ? 'ALL_PASS' : 'HAS_FAIL:' + failed);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('ERROR', e); process.exit(2); });
