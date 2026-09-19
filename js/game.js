/* ============ 暴击企鹅 · 核心逻辑 ============ */
(function () {
  'use strict';
  const CFG = window.CONFIG;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  /* ---------- 存档 ---------- */
  const DEF = {
    coins: CFG.startCoins,
    table: 0,
    hits: 0,
    guessUnlocked: false,
    bet: CFG.defaultBet,
    betPage: 0,
    winChance: 50,
    drawMs: 3000,
    // 默认音效2（视频原声）；用户在设置里切换后会被记住。
    sound: { on: true, vol: 80, pack: 'sample' },
    log: [],
    stats: { bet: 0, gain: 0, hits: 0, guessN: 0, guessW: 0 },
  };
  let S = load();
  function load() {
    const s = Object.assign({}, DEF, {
      sound: Object.assign({}, DEF.sound),
      stats: Object.assign({}, DEF.stats),
      log: [],
    });
    try {
      const raw = localStorage.getItem(CFG.saveKey);
      if (raw) {
        const p = JSON.parse(raw);
        Object.assign(s, p);
        s.sound = Object.assign({}, DEF.sound, p.sound || {});
        s.stats = Object.assign({}, DEF.stats, p.stats || {});
        s.log = Array.isArray(p.log) ? p.log : [];
      }
    } catch (e) { /* ignore */ }
    return s;
  }
  function save() { try { localStorage.setItem(CFG.saveKey, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  /* ---------- SVG：台球桌 ---------- */
  function tableSVG() {
    return '<img src="assets/prototype/table.svg" alt="" draggable="false">';
  }

  /* ---------- SVG：企鹅（图10 姿态） ---------- */
  function penguinSVG(id) {
    const p = 'penguin-' + id;
    return `<svg class="hd-penguin" viewBox="0 0 240 230" role="img" aria-label="戴礼帽、穿红球鞋的台球企鹅">
      <defs>
        <linearGradient id="${p}-black" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#596268"/><stop offset=".23" stop-color="#252c2c"/><stop offset=".7" stop-color="#101718"/><stop offset="1" stop-color="#303936"/></linearGradient>
        <radialGradient id="${p}-white" cx=".35" cy=".3" r=".85"><stop stop-color="#fffef5"/><stop offset=".66" stop-color="#eeefe7"/><stop offset="1" stop-color="#a8b2a7"/></radialGradient>
        <linearGradient id="${p}-hat"><stop stop-color="#121919"/><stop offset=".28" stop-color="#424c4c"/><stop offset=".55" stop-color="#1c2526"/><stop offset="1" stop-color="#070f10"/></linearGradient>
        <linearGradient id="${p}-band"><stop stop-color="#b9c1c0"/><stop offset=".35" stop-color="#fffef7"/><stop offset="1" stop-color="#818f91"/></linearGradient>
        <linearGradient id="${p}-beak" x2="0" y2="1"><stop stop-color="#fff088"/><stop offset=".4" stop-color="#ffc127"/><stop offset="1" stop-color="#cc790b"/></linearGradient>
        <linearGradient id="${p}-shoe" x2="0" y2="1"><stop stop-color="#ff7070"/><stop offset=".5" stop-color="#c82035"/><stop offset="1" stop-color="#701a29"/></linearGradient>
      </defs>
      <ellipse cx="122" cy="222" rx="76" ry="6" fill="#08120b" opacity=".35"/>
      <g stroke="#4c2827" stroke-width="1.1">
        <path d="M82 203Q95 201 101 216L104 221Q82 228 65 222Q64 214 82 203Z" fill="url(#${p}-shoe)"/>
        <path d="M141 205Q155 202 170 216L174 222Q151 228 137 221Z" fill="url(#${p}-shoe)"/>
        <path d="M65 218Q84 224 103 218V223Q81 230 64 223Z" fill="#f3f2e7"/>
        <path d="M138 217Q153 223 173 217L175 223Q153 229 136 223Z" fill="#f3f2e7"/>
      </g>
      <path d="M78 209L91 214M75 213L89 218M147 210L160 215M146 214L160 218" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
      <g class="penguin-body">
        <path class="arm-l-idle" d="M65 111C35 113 15 126 29 145L61 165L72 132Z" fill="url(#${p}-black)" stroke="#1a2525" stroke-width="1.5"/>
        <path d="M115 58C156 52 177 82 182 111C191 126 201 152 190 175C180 204 158 216 123 217C85 218 57 204 50 177C44 155 56 130 63 108C67 78 86 60 115 58Z" fill="url(#${p}-black)" stroke="#172022" stroke-width="1.5"/>
        <path d="M109 75Q121 84 132 75C156 76 167 96 166 115C171 133 183 152 177 172C171 196 149 205 123 206C94 206 73 192 70 171C66 150 77 131 79 113C79 92 89 77 109 75Z" fill="url(#${p}-white)" stroke="#879389" stroke-width="1.2"/>
        <path d="M71 141C60 165 68 192 88 201" fill="none" stroke="#6d7670" stroke-width="2" opacity=".6"/>
        <g class="penguin-head">
          <g class="penguin-eyes">
            <ellipse cx="99" cy="101" rx="13" ry="13" fill="#fffef7" stroke="#73817a" stroke-width="1.2"/>
            <ellipse cx="144" cy="101" rx="13" ry="13" fill="#fffef7" stroke="#73817a" stroke-width="1.2"/>
            <ellipse cx="102" cy="105" rx="4.2" ry="5" fill="#111c1d"/><ellipse cx="141" cy="105" rx="4.2" ry="5" fill="#111c1d"/>
            <path d="M86 100Q99 96 112 100M131 100Q144 96 157 100" stroke="#34413d" stroke-width="3" fill="none"/>
            <path d="M89 85Q99 79 107 85M135 85Q145 78 153 85" stroke="#25332f" stroke-width="4" fill="none" stroke-linecap="round"/>
            <circle cx="103" cy="103" r="1.3" fill="#fff"/><circle cx="142" cy="103" r="1.3" fill="#fff"/>
          </g>
          <g class="dizzy-eyes" fill="none" stroke="#111c1d" stroke-width="3.2" stroke-linecap="round">
            <path d="M92.5 94.5L105.5 107.5M105.5 94.5L92.5 107.5"/>
            <path d="M137.5 94.5L150.5 107.5M150.5 94.5L137.5 107.5"/>
          </g>
          <path d="M111 119Q121 112 132 119L128 128Q121 133 113 127Z" fill="url(#${p}-beak)" stroke="#ba850d" stroke-width="1"/>
          <path d="M112 122Q122 126 131 121" fill="none" stroke="#8d6311" stroke-width="1.2"/>
          <g class="penguin-hat" transform="rotate(-9 119 59)">
            <ellipse cx="119" cy="62" rx="43" ry="9" fill="#111a1a" stroke="#5d6966" stroke-width="1.2"/>
            <path d="M88 9Q119 3 150 9L146 59Q120 70 92 58Z" fill="url(#${p}-hat)" stroke="#667270" stroke-width="1.2"/>
            <ellipse cx="119" cy="9" rx="31" ry="5" fill="#202d2c" stroke="#73817a" stroke-width="1"/>
            <path d="M91 43Q121 50 147 43L146 54Q120 62 92 54Z" fill="url(#${p}-band)"/>
            <path d="M96 14L98 39" stroke="#c3ccca" stroke-width="1.3" opacity=".2"/>
          </g>
          <path d="M154 74L159 70L164 74L161 78Z" fill="#eac557" stroke="#9e7c1a" stroke-width=".8"/>
        </g>
        <path class="arm-l-reach" d="M60 111C41 115 35 135 53 153L89 175Q103 176 102 164L73 143Q60 128 67 124Z" fill="url(#${p}-black)" stroke="#1a2525" stroke-width="1.4"/>
        <path class="arm-l-akimbo" d="M66 107C44 108 27 118 26 136C25 146 34 154 46 153L70 151Q77 149 74 143L56 136C52 132 50 118 60 113Z" fill="url(#${p}-black)" stroke="#1a2525" stroke-width="1.4"/>
        <path class="arm-r-reach" d="M180 111C199 115 205 135 187 153L151 175Q137 176 138 164L167 143Q180 128 173 124Z" fill="url(#${p}-black)" stroke="#1a2525" stroke-width="1.4"/>
        <g class="pouch-group">
          <ellipse cx="123" cy="155" rx="40" ry="10" fill="#757b74"/>
          <g class="pouch-balls" stroke="#7d8274" stroke-width=".6">
            <circle cx="94" cy="151" r="7" fill="#ffd637"/><circle cx="107" cy="145" r="8" fill="#d43a42"/><circle cx="122" cy="149" r="8" fill="#356fe9"/><circle cx="138" cy="146" r="7" fill="#60c447"/><circle cx="151" cy="153" r="7" fill="#a65cd9"/>
            <circle cx="103" cy="158" r="7" fill="#1ba0ca"/><circle cx="131" cy="158" r="8" fill="#292e32"/><circle cx="145" cy="159" r="7" fill="#e26d26"/>
          </g>
          <g fill="#fffff1"><circle cx="94" cy="149" r="3"/><circle cx="107" cy="143" r="3.5"/><circle cx="122" cy="147" r="3.5"/><circle cx="138" cy="144" r="3"/><circle cx="151" cy="151" r="3"/><circle cx="131" cy="156" r="3.5"/></g>
          <g font-family="Arial,sans-serif" font-size="5" text-anchor="middle" fill="#2e302c"><text x="94" y="151">1</text><text x="107" y="145">3</text><text x="122" y="149">2</text><text x="138" y="146">6</text><text x="151" y="153">4</text><text x="131" y="158">8</text></g>
          <path d="M83 157Q122 174 163 157C163 180 148 194 124 195C100 194 85 181 83 157Z" fill="url(#${p}-white)" stroke="#a9b4a5" stroke-width="1.3"/>
          <path d="M86 159Q124 174 160 159" fill="none" stroke="#fffef8" stroke-width="2"/>
          <path d="M91 166Q99 187 124 190Q148 189 156 166" fill="none" stroke="#c1c7bc" stroke-width=".8" stroke-dasharray="2 2"/>
          <text x="123" y="186" text-anchor="middle" font-size="19" font-family="Georgia,serif" fill="#b0b8ac" stroke="#fff" stroke-width=".3">8</text>
        </g>
        <path class="arm-r-idle" d="M177 109C194 113 226 111 224 127C222 141 201 150 190 165L178 157Q190 135 171 127Z" fill="url(#${p}-black)" stroke="#1a2525" stroke-width="1.4"/>
        <g class="arm-r-up" fill="url(#${p}-black)" stroke="#172323" stroke-width="1.5"><path d="M177 113Q199 107 202 131L191 148L176 143Q192 129 177 123Z"/><path d="M193 127L193 109Q196 101 201 107L205 121Q220 118 220 126L216 145Q202 151 192 142Z"/></g>
        <g class="arm-r-down" fill="url(#${p}-black)" stroke="#172323" stroke-width="1.5"><path d="M177 116Q204 118 202 141L191 153L176 141Z"/><path d="M192 135Q206 128 218 136L221 149Q218 158 208 151L204 168Q198 173 195 165L196 149Z"/></g>
        <g class="held-ball" transform="translate(210 120)"><circle r="11" fill="#ffd21f"/><circle r="5.5" fill="#fff"/><text y="3.5" text-anchor="middle" font-size="8" fill="#111"></text></g>
      </g>
      <g class="penguin-cue"><path d="M28 93L39 222" stroke="#614a24" stroke-width="3"/><path d="M28 93L39 222" stroke="#e6cb7d" stroke-width="1"/><circle cx="28" cy="93" r="2.5" fill="#f4df93"/></g>
    </svg>`;
  }

  /* ---------- 球元素 ---------- */
  function ballEl(ball, size) {
    const el = document.createElement('i');
    el.className = 'ball sz' + (size || 34) + (ball.type === 'stripe' ? ' stripe' : '');
    el.style.setProperty('--bc', ball.color);
    if (ball.num != null) el.innerHTML = `<span class="num">${ball.num}</span>`;
    else if (ball.key === 'star') el.innerHTML = `<span class="num" style="background:none;color:#fff;font-size:1.1em">★</span>`;
    else if (ball.key === 'cue') el.innerHTML = `<span class="num" style="background:none"></span>`;
    else el.innerHTML = `<span class="num" style="background:none;color:#fff;font-size:1em">✕</span>`;
    return el;
  }

  /* ---------- 权重抽球 ---------- */
  function drawBall() {
    const total = CFG.balls.reduce((s, b) => s + b.weight, 0);
    let r = Math.random() * total;
    for (const b of CFG.balls) { r -= b.weight; if (r <= 0) return b; }
    return CFG.balls[CFG.balls.length - 1];
  }
  function drawGuessBall(pick, chance) {
    // 先按胜率判定输赢，再从对应花色池抽球（全色1-7 / 花色9-15）
    const win = Math.random() * 100 < chance;
    const want = win ? pick : (pick === 'solid' ? 'stripe' : 'solid');
    const pool = CFG.balls.filter((b) => b.type === want && b.num != null && b.num !== 8);
    return pool[ri(0, pool.length - 1)];
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 1800);
  }

  /* ---------- 流水日志 ---------- */
  function addLog(delta, note) {
    S.log.unshift({ t: Date.now(), d: delta, n: note });
    if (S.log.length > 60) S.log.length = 60;
  }

  /* ---------- 特效 ---------- */
  function fxText(layer, text, neg, x, y) {
    const el = document.createElement('div');
    el.className = 'fx-text' + (neg ? ' neg' : '');
    el.textContent = text;
    el.style.left = (x != null ? x : rnd(30, 60)) + '%';
    el.style.top = (y != null ? y : rnd(30, 50)) + '%';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
  function fxBall(layer, ball, x, y) {
    const wrap = document.createElement('div');
    wrap.className = 'fx-ball';
    wrap.style.left = x + '%';
    wrap.style.top = y + '%';
    wrap.style.setProperty('--dx', rnd(16, 37) + 'cqw');
    wrap.style.setProperty('--dy', rnd(-20, -11) + 'cqw');
    wrap.appendChild(ballEl(ball, 34));
    layer.appendChild(wrap);
    setTimeout(() => wrap.remove(), 1000);
  }

  /* ---------- 渲染 ---------- */
  function renderLedger(el, value) {
    el.textContent = fmt(value);
    el.setAttribute('aria-label', fmt(value));
    const digits = String(Math.max(0, Math.round(value)));
    const segments = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
    const lines = { a: [2, 1, 8, 1], b: [9, 2, 9, 8], c: [9, 10, 9, 16], d: [2, 17, 8, 17], e: [1, 10, 1, 16], f: [1, 2, 1, 8], g: [2, 9, 8, 9] };
    const glyphs = [...digits].map((digit, i) => `<g transform="translate(${i * 12},1)">${[...segments[+digit]].map((key) => {
      const [x1, y1, x2, y2] = lines[key];
      return `<path d="M${x1} ${y1}L${x2} ${y2}"/>`;
    }).join('')}</g>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${digits.length * 12}" height="20" viewBox="0 0 ${digits.length * 12} 20"><g fill="none" stroke="#aaffd7" stroke-width="1.1" stroke-linecap="square">${glyphs}</g></svg>`;
    el.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    el.style.backgroundSize = digits.length > 8 ? '100% 100%' : 'auto 100%';
  }
  function renderCoins() {
    renderLedger($('#coins-text'), S.coins);
    renderLedger($('#table-text'), S.table);
    const nc = $('#nav-coins');
    if (nc) nc.textContent = fmt(S.coins);
  }
  function renderHits() {
    $('#hits-text').textContent = `${S.hits}/${CFG.hitsTarget}`;
    const p = Math.min(100, (S.hits / CFG.hitsTarget) * 100);
    $('#progress-fill').style.width = p + '%';
    const bar = $('.progress');
    bar.classList.toggle('full', S.guessUnlocked);
    const btn = $('#guess-btn');
    btn.setAttribute('aria-label', S.guessUnlocked ? '猜球，已解锁' : `猜球，击球满${CFG.hitsTarget}次解锁`);
    btn.classList.toggle('unlocked', S.guessUnlocked);
    btn.classList.toggle('locked', !S.guessUnlocked);
  }
  function renderBet() {
    const page = CFG.betPages[S.betPage];
    const box = $('#bet-chips');
    box.innerHTML = '';
    page.forEach((v) => {
      const b = document.createElement('button');
      b.className = 'bet-chip' + (S.bet === v ? ' sel' : '');
      b.textContent = String(v);
      b.setAttribute('aria-pressed', String(S.bet === v));
      b.onclick = () => { S.bet = v; save(); renderBet(); };
      box.appendChild(b);
    });
    $('#bet-prev').disabled = S.betPage === 0;
    $('#bet-next').disabled = S.betPage === CFG.betPages.length - 1;
  }
  function renderPile() {
    const pile = $('#coin-pile');
    // 金币数与铺开范围都随桌面金额增长：单次击球只掉一小撮（下注100时约6枚），
    // 击球1/10/100次（约6/14/36枚）不仅枚数不同，占据的台面也明显变大；
    // 金额到展示上限（约30万）后转为整体放大+外扩（对数增长），长时间击球也不会“不再增加”。
    const t = Math.max(0, S.table);
    const wanted = t > 0 ? Math.max(1, Math.round(.9 * Math.pow(t, .4))) : 0;
    const count = Math.min(140, wanted);
    const overflow = Math.max(0, wanted - 140);
    const boost = 1 + Math.min(.6, .28 * Math.log10(1 + overflow / 14));
    // 满载后只小幅外扩，避免金币越出台面。
    const spread = 1 + Math.min(.2, (boost - 1) * .45);
    // 散布半径按 √数量 增长（覆盖面积与枚数成正比），并夹在已验证的台面安全范围内。
    const rx = Math.min(100, 20 * Math.sqrt(count)) * spread;
    const ry = Math.min(45, rx * .523);
    const coinPos = (i) => {
      // 黄金角 + 均匀面积半径铺满椭圆，再加确定性位置抖动，避免“同椭圆里挤成一团”。
      const angle = i * 2.39996 + (((i * 37) % 13) / 13 - .5) * .3;
      const radius = count < 2 ? 0 : Math.sqrt((i + .5) / count) * (1 + (((i * 29) % 11) / 11 - .5) * .16);
      return {
        x: i === 0 ? 299 : 310 + Math.cos(angle) * radius * rx,
        y: i === 0 ? 221 : 238 + Math.sin(angle) * radius * ry,
      };
    };
    while (pile.children.length > count) pile.lastElementChild.remove();
    const previous = pile.children.length;
    for (let i = previous; i < count; i++) {
      const { x, y } = coinPos(i);
      const c = document.createElement('div');
      c.className = 'pile-coin';
      c.style.setProperty('--tilt', ((i * 17 % 49) - 24) + 'deg');
      c.style.setProperty('--from-x', ((160 - x) / 556 * 100) + 'cqw');
      c.style.setProperty('--from-y', ((176 - y) / 556 * 100) + 'cqw');
      c.style.animationDelay = Math.min((i - previous) * .025, .4) + 's';
      pile.appendChild(c);
    }
    // 统一刷新全部金币的位置与大小：金额继续变大时，已有金币同步外扩/放大，不会中途冻结。
    [...pile.children].forEach((c, i) => {
      const { x, y } = coinPos(i);
      const scale = (.88 + (i * 11 % 21) / 100) * boost;
      c.style.left = (x / 556 * 100) + '%';
      c.style.top = (y / 540 * 100) + '%';
      c.style.zIndex = Math.round(y);
      c.style.width = (7.554 * scale) + '%';
      c.style.height = (5.926 * scale) + '%';
    });
    pile.setAttribute('aria-label', `桌面金币 ${fmt(S.table)}`);
  }
  function renderAll() { renderCoins(); renderHits(); renderBet(); renderPile(); }

  /* ---------- 屏幕切换 ---------- */
  function show(id) {
    $$('.screen').forEach((s) => s.classList.remove('active'));
    $(id).classList.add('active');
    // 主界面、猜球和结果共用同一尺寸，不再切换录屏覆盖层。
  }

  /* ---------- 击球 ---------- */
  let busy = false;
  function doHit(n) {
    if (busy) return;
    const cost = S.bet * n;
    if (S.coins < cost) { toast('金币不足，无法击球'); return; }
    busy = true;
    S.coins -= cost;
    S.stats.bet += cost;
    S.stats.hits += n;
    addLog(-cost, `击球${n}次下注`);
    renderCoins();

    const penguin = $('#main-penguin');
    const stick = $('#cue-stick');
    const cue = $('#cue-ball');
    const layer = $('#fx-layer');

    const strikeSound = () => { if (n > 1) Sound.burst(); else Sound.hit(); };
    if (Sound.getPack() === 'sample') setTimeout(() => { if (Sound.getPack() === 'sample') strikeSound(); }, 160);
    else strikeSound();
    stick.classList.remove('strike'); void stick.offsetWidth; stick.classList.add('strike');
    setTimeout(() => {
      cue.classList.remove('rolled'); void cue.offsetWidth; cue.classList.add('rolled');
      penguin.classList.remove('hop'); void penguin.offsetWidth; penguin.classList.add('hop');
      // 击球眩晕：头部摇摆 + X 眼圈短暂替换，像真的被打了一下。
      penguin.classList.remove('hit-dizzy'); void penguin.offsetWidth; penguin.classList.add('hit-dizzy');
      setTimeout(() => penguin.classList.remove('hit-dizzy'), 620);
    }, 160);

    let gain = 0;
    const balls = [];
    for (let i = 0; i < Math.min(n, 6); i++) balls.push(drawBall());
    if (n > 6) for (let i = 6; i < n; i++) gain += Math.round(S.bet * drawBall().mult);
    balls.forEach((b) => { gain += Math.round(S.bet * b.mult); });

    setTimeout(() => {
      balls.forEach((b, i) => setTimeout(() => fxBall(layer, b, rnd(29, 38), rnd(29, 35)), i * 90));
      setTimeout(() => {
        S.table += gain;
        S.stats.gain += gain;
        addLog(gain, `击球${n}次返还`);
        S.hits = Math.min(CFG.hitsTarget, S.hits + n);
        if (S.hits >= CFG.hitsTarget && !S.guessUnlocked) {
          S.guessUnlocked = true;
          toast('猜球机会已解锁！');
          Sound.jingle();
        }
        if (n === 1) Sound.coin(); else Sound.coins();
        fxText(layer, '+' + fmt(gain), false, 56, 43);
        renderAll(); save();
        busy = false;
      }, balls.length * 90 + 250);
    }, 260);
  }

  /* ---------- 领取 ---------- */
  function doClaim() {
    if (S.table <= 0) { toast('桌面上还没有金币'); return; }
    const v = S.table;
    S.coins += v;
    S.table = 0;
    addLog(v, '领取桌面金币');
    Sound.coins();
    toast('已领取 ' + fmt(v) + ' 金币');
    renderAll(); save();
  }

  /* ---------- 猜球 ---------- */
  // phase: idle=待选择 drawing=掏球中 won=已猜对 lost=已猜错
  let phase = 'idle';
  let pendingReward = 0;
  let pendingLose = 0;
  function enterGuess() {
    if (!S.guessUnlocked) { toast(`击球满${CFG.hitsTarget}次解锁猜球`); return; }
    phase = 'idle';
    $('#screen-guess').dataset.state = 'idle';
    show('#screen-guess');
    $('#guess-title').className = 'guess-title';
    $('#guess-title').textContent = '';
    $('#guess-hint').textContent = `选择一种球，企鹅将掏出一颗球判定（当前胜率 ${S.winChance}%）`;
    $('#guess-hold').textContent = fmt(S.coins);
    $('#guess-bet').textContent = fmt(S.table);
    $('#draw-slot').innerHTML = '';
    setPose($('#guess-penguin'), '');
    $$('.pick-btn').forEach((b) => { b.disabled = false; b.classList.remove('selected'); });
    $('#guess-close').disabled = false;
    Sound.guessIn();
  }
  function setPose(el, pose) {
    if (pose) el.setAttribute('data-pose', pose);
    else el.removeAttribute('data-pose');
  }
  /** 猜对结算：翻倍金币入当前金币，清空桌面与次数，回主界面 */
  function finishWin() {
    const r = pendingReward;
    S.coins += r;
    if (r > 0) addLog(r, '猜对翻倍奖励');
    pendingReward = 0;
    resetRound();
    show('#screen-main');
  }
  /** 猜错结算：清空桌面金币与次数，回主界面 */
  function finishLose() {
    if (pendingLose > 0) addLog(-pendingLose, '猜错桌面清空');
    pendingLose = 0;
    resetRound();
    show('#screen-main');
  }
  function resetRound() {
    S.table = 0;
    S.hits = 0;
    S.guessUnlocked = false;
    phase = 'idle';
    renderAll(); save();
  }
  function doPick(type) {
    if (phase !== 'idle') return;
    phase = 'drawing';
    $('#screen-guess').dataset.state = 'drawing';
    $$('.pick-btn').forEach((b) => { b.disabled = true; b.classList.toggle('selected', b.dataset.type === type); });
    $('#guess-close').disabled = true;
    $('#guess-hint').textContent = '企鹅掏球中…';

    const drawMs = S.drawMs || CFG.guessDrawMs;
    const penguin = $('#guess-penguin');
    const slot = $('#draw-slot');
    slot.innerHTML = '<span class="qmark">?</span>';
    $('#screen-guess').style.setProperty('--draw-duration', drawMs + 'ms');
    setPose(penguin, 'reach');
    Sound.pick();
    setTimeout(() => Sound.suspense(drawMs), 180);

    const result = drawGuessBall(type, S.winChance);
    setTimeout(() => {
      slot.innerHTML = '';
      const el = ballEl(result, 48);
      el.classList.add('reveal');
      slot.appendChild(el);
      Sound.reveal();
      setPose(penguin, 'reveal');
      setHeld(penguin, result);
      $('#screen-guess').dataset.state = 'revealed';

      const win = (type === 'solid' && result.type === 'solid') || (type === 'stripe' && result.type === 'stripe');
      const title = $('#guess-title');
      S.stats.guessN++;
      setTimeout(() => {
        setPose(penguin, win ? 'up' : 'down');
        $('#screen-guess').dataset.state = win ? 'won' : 'lost';
        if (win) {
          S.stats.guessW++;
          // 桌面金币×2，待结算弹窗关闭后入当前金币（图8→图9）
          pendingReward = S.table * 2;
          title.textContent = '真棒';
          title.className = 'guess-title win';
          $('#guess-hint').textContent = '猜对了！桌面金币翻倍';
          Sound.win();
          setTimeout(() => {
            $('#prize-amount').textContent = '×' + fmt(pendingReward);
            $('#popup-prize').classList.remove('hidden');
            phase = 'won';
          }, 900);
        } else {
          pendingLose = S.table;
          title.textContent = '猜错了';
          title.className = 'guess-title lose';
          $('#guess-hint').textContent = '点击任意处返回主界面';
          Sound.lose();
          phase = 'lost';
          $('#guess-close').disabled = false;
        }
      }, 600);
    }, drawMs);
  }
  function setHeld(el, ball) {
    const g = el.querySelector('.held-ball');
    if (!g) return;
    g.querySelector('circle').setAttribute('fill', ball.color);
    const t = g.querySelector('text');
    t.textContent = ball.num != null ? ball.num : '';
  }

  /* ---------- 钱包页 ---------- */
  let prevScreen = '#screen-entry';
  function navBlocked() {
    if ($('#screen-guess').classList.contains('active') &&
        (phase === 'drawing' || (phase === 'won' && !$('#popup-prize').classList.contains('hidden')))) {
      toast('结算中，请稍候…');
      return true;
    }
    return false;
  }
  function closePopups() { $$('.popup').forEach((p) => p.classList.add('hidden')); }
  /** 仅当当前处于游戏类页面时记录返回目标，避免面板页之间互相覆盖导致回不到游戏 */
  function markPrev() {
    const cur = document.querySelector('.screen.active');
    if (cur && !cur.classList.contains('screen-panel')) prevScreen = '#' + cur.id;
  }
  function openWallet() {
    markPrev();
    renderWallet();
    show('#screen-wallet');
  }
  function openSettings() {
    markPrev();
    syncSettings();
    show('#screen-settings');
  }
  function renderWallet() {
    $('#w-balance').textContent = fmt(S.coins);
    $('#w-table').textContent = fmt(S.table);
    const st = S.stats;
    const rate = st.guessN ? Math.round((st.guessW / st.guessN) * 100) + '%' : '--';
    $('#w-stats').innerHTML =
      `<div class="ws-cell"><span>累计下注</span><b>${fmt(st.bet)}</b></div>` +
      `<div class="ws-cell"><span>击球返还</span><b>${fmt(st.gain)}</b></div>` +
      `<div class="ws-cell"><span>击球次数</span><b>${st.hits}</b></div>` +
      `<div class="ws-cell"><span>猜球次数</span><b>${st.guessN}</b></div>` +
      `<div class="ws-cell"><span>猜对次数</span><b>${st.guessW}</b></div>` +
      `<div class="ws-cell"><span>猜球胜率</span><b>${rate}</b></div>`;
    const list = S.log.slice(0, 30);
    $('#w-log').innerHTML = list.length ? list.map((e) => {
      const d = new Date(e.t);
      const p = (x) => String(x).padStart(2, '0');
      return `<li><span class="t">${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}</span>` +
        `<span class="n">${e.n}</span>` +
        `<span class="d ${e.d >= 0 ? 'plus' : 'minus'}">${e.d >= 0 ? '+' : ''}${fmt(e.d)}</span></li>`;
    }).join('') : '<li><span class="n">暂无流水</span></li>';
  }
  function walletAdjust(delta) {
    const v = Math.abs(delta || 0);
    if (!v) { toast('请输入有效金额'); return; }
    if (delta < 0 && v > S.coins) { toast('余额不足'); return; }
    S.coins = Math.max(0, S.coins + delta);
    addLog(delta, delta > 0 ? '钱包增加' : '钱包减少');
    Sound.coins();
    save(); renderWallet(); renderCoins();
  }
  function walletSet(target) {
    if (isNaN(target) || target < 0) { toast('请输入有效目标余额'); return; }
    const delta = target - S.coins;
    S.coins = target;
    addLog(delta, '设置余额');
    save(); renderWallet(); renderCoins();
    toast('余额已设置为 ' + fmt(target));
  }
  function walletReset() {
    if (!confirm('重置账户？余额回到初始值，桌面与统计清零')) return;
    S.coins = CFG.startCoins; S.table = 0; S.hits = 0; S.guessUnlocked = false;
    S.log = []; S.stats = Object.assign({}, DEF.stats);
    save(); renderWallet(); renderAll();
    toast('账户已重置');
  }

  /* ---------- 设置页 ---------- */
  function syncSettings() {
    $('#s-chance').value = S.winChance;
    $('#s-chance-val').textContent = S.winChance + '%';
    $('#s-draw').value = S.drawMs / 1000;
    $('#s-draw-val').textContent = (S.drawMs / 1000) + 's';
    $('#s-vol').value = S.sound.vol;
    $('#s-vol-val').textContent = S.sound.vol + '%';
    $('#s-on').checked = !!S.sound.on;
    $('#pk-synth').classList.toggle('on', S.sound.pack !== 'sample');
    $('#pk-sample').classList.toggle('on', S.sound.pack === 'sample');
  }
  function setChance(v) {
    S.winChance = Math.max(0, Math.min(100, v));
    syncSettings(); save();
    toast('猜球胜率已设为 ' + S.winChance + '%');
  }
  function testSound(kind) {
    Sound.unlock();
    if (kind === 'suspense') Sound.suspense(1500);
    else if (Sound[kind]) Sound[kind]();
  }

  /* ---------- 奖励弹框 ---------- */
  function openReward() {
    const grid = $('#reward-grid');
    grid.innerHTML = '';
    CFG.balls.forEach((b) => {
      const cell = document.createElement('div');
      cell.className = 'rw-cell';
      cell.appendChild(ballEl(b, 26));
      const x1 = document.createElement('span'); x1.className = 'x1'; x1.textContent = '×1';
      const m = document.createElement('span'); m.className = 'mult'; m.textContent = '×' + b.mult;
      cell.appendChild(x1); cell.appendChild(m);
      grid.appendChild(cell);
    });
    $('#popup-reward').classList.remove('hidden');
  }

  /* ---------- 关于作者 ---------- */
  const ABOUT_THANKS = [
    '作者接住了，顺手塞进口袋。',
    '企鹅替你鞠了一躬。',
    '作者说：够意思，祝你猜球必中。',
    '金币已入库，作者请你云喝奶茶。',
  ];
  let tossCount = 0;
  function tossForAuthor() {
    tossCount++;
    Sound.coins();
    const tip = $('#about-tip');
    tip.textContent = tossCount >= 10
      ? '……你居然扔了 ' + tossCount + ' 把。作者说够了，金币留着自己花。'
      : ABOUT_THANKS[(tossCount - 1) % ABOUT_THANKS.length];
    tip.classList.remove('pop');
    void tip.offsetWidth; // 强制回流，保证同一句文案也能重播弹入动画
    tip.classList.add('pop');
  }

  /* ---------- 初始化 ---------- */
  function init() {
    $$('[data-table]').forEach((el) => { el.innerHTML = tableSVG(); });
    $$('[data-penguin]').forEach((el, i) => { el.innerHTML = penguinSVG(i); });

    $('#bet-prev').onclick = () => { if (S.betPage > 0) { S.betPage--; save(); renderBet(); } };
    $('#bet-next').onclick = () => { if (S.betPage < CFG.betPages.length - 1) { S.betPage++; save(); renderBet(); } };

    document.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return; // 空白点击统一由下方监听处理
      Sound.unlock();
      const a = act.getAttribute('data-act');
      if (Sound.getPack() !== 'sample' || !['hit', 'pick', 'enter-guess', 's-test', 'about-toss'].includes(a)) Sound.click();
      if (a === 'entry-close' || a === 'exit-main') show('#screen-entry');
      else if (a === 'enter-game') { show('#screen-main'); renderAll(); }
      else if (a === 'open-reward') openReward();
      else if (a === 'open-help') $('#popup-help').classList.remove('hidden');
      else if (a === 'close-help') $('#popup-help').classList.add('hidden');
      else if (a === 'open-about') $('#popup-about').classList.remove('hidden');
      else if (a === 'close-about') $('#popup-about').classList.add('hidden');
      else if (a === 'about-toss') tossForAuthor();
      else if (a === 'claim') doClaim();
      else if (a === 'enter-guess') enterGuess();
      else if (a === 'exit-guess') { if (phase === 'lost') finishLose(); else if (phase === 'idle') show('#screen-main'); }
      else if (a === 'hit') doHit(parseInt(act.getAttribute('data-n'), 10));
      else if (a === 'pick') doPick(act.getAttribute('data-type'));
      else if (a === 'open-wallet') { if (!navBlocked()) { closePopups(); openWallet(); } }
      else if (a === 'open-settings') { if (!navBlocked()) { closePopups(); openSettings(); } }
      else if (a === 'go-back') show(prevScreen || '#screen-entry');
      else if (a === 'w-add') walletAdjust(parseInt($('#w-amount').value, 10));
      else if (a === 'w-sub') walletAdjust(-parseInt($('#w-amount').value, 10));
      else if (a === 'w-quick') walletAdjust(parseInt(act.getAttribute('data-v'), 10));
      else if (a === 'w-set') walletSet(parseInt($('#w-set').value, 10));
      else if (a === 'w-reset') walletReset();
      else if (a === 's-chance') setChance(parseInt(act.getAttribute('data-v'), 10));
      else if (a === 's-test') testSound(act.getAttribute('data-s'));
      else if (a === 's-pack') {
        S.sound.pack = act.getAttribute('data-p') === 'sample' ? 'sample' : 'synth';
        Sound.setPack(S.sound.pack);
        syncSettings(); save();
        toast(S.sound.pack === 'sample' ? '已切换为音效2 · 游戏原声' : '已切换为音效1 · 合成音效');
      }
      else if (a === 's-wipe') {
        if (confirm('清空所有存档数据并重启游戏？')) {
          localStorage.removeItem(CFG.saveKey);
          location.reload();
        }
      }
    });

    // 点击空白：关闭弹窗 / 猜错后返回主界面
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-act]') || e.target.closest('.popup-panel')) return;
      const prize = $('#popup-prize');
      if (!prize.classList.contains('hidden')) {
        prize.classList.add('hidden');
        if (phase === 'won') finishWin();
        return;
      }
      $$('.popup').forEach((p) => p.classList.add('hidden'));
      if ($('#screen-guess').classList.contains('active') && phase === 'lost') finishLose();
    });

    // 设置项实时绑定
    $('#s-chance').addEventListener('input', (e) => { S.winChance = +e.target.value; $('#s-chance-val').textContent = S.winChance + '%'; save(); });
    $('#s-draw').addEventListener('input', (e) => { S.drawMs = Math.round(+e.target.value * 1000); $('#s-draw-val').textContent = e.target.value + 's'; save(); });
    $('#s-vol').addEventListener('input', (e) => { S.sound.vol = +e.target.value; $('#s-vol-val').textContent = S.sound.vol + '%'; Sound.setVolume(S.sound.vol / 100); save(); });
    $('#s-on').addEventListener('change', (e) => { S.sound.on = e.target.checked; Sound.setOn(S.sound.on); save(); });
    Sound.setVolume(S.sound.vol / 100);
    Sound.setOn(S.sound.on);
    Sound.setPack(S.sound.pack);

    renderAll();
  }
  init();
})();
