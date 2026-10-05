(function () {
  'use strict';
  const P=window.BilliardsPhysics,$=s=>document.querySelector(s);
  const screen=$('#screen-billiards'),scene=$('#billiards-scene'),canvas=$('#billiards-canvas'),ctx=canvas.getContext('2d');
  if(!ctx)return;
  const images={},colors=['#eee9da','#debc00','#075d99','#b20b1c','#5c2295','#d47015','#14772a','#701924','#151717'];
  const world=new P.World(event);
  let active=false,paused=false,assist=false,moveMode=false,rotated=false,angle=-Math.PI/2,power=0;
  let previewPower=P.MAX_POWER,prediction=null,predictionKey='',lastShotPrediction=null;
  const helper={positions:false,target:false,multi:false,expanded:false};
  let helperDrag=null,helperDragged=false;
  let scale=1,raf=0,last=0,accumulator=0,elapsed=0,clockSecond=-1,history=[],undoCount=999;
  let pointer=null,dragBall=null,english={x:0,y:0},elevation=0,shotAnimation=null,pocketFX=[],toastTimer=0,keyboardCharge=0,modalFocus=null;
  let audioContext=null,master=null,audioBuffers={},audioVoices=new Set(),audioReady=null,lastSound={};
  let mute=false,volume=.8,fineSensitivity=20;
  try{const saved=JSON.parse(localStorage.getItem('classic-eight-preferences')||'{}');assist=!!saved.assist;mute=!!saved.mute;volume=typeof saved.volume==='number'?Math.max(0,Math.min(1,saved.volume)):.8;if(Number.isFinite(saved.fineSensitivity))fineSensitivity=Math.max(1,Math.min(100,Math.round(saved.fineSensitivity)));}catch(e){}
  function savePreferences(){try{localStorage.setItem('classic-eight-preferences',JSON.stringify({assist,mute,volume,fineSensitivity}));}catch(e){}}
  const spriteNames=['cue','ruler',...Array.from({length:16},(_,i)=>'ball-'+i).filter(n=>!['ball-4','ball-11'].includes(n))];
  for(const name of spriteNames){const im=new Image();im.src='assets/billiards/'+name+'.png';im.onload=draw;images[name]=im;}
  function initAudio(){
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    if(!audioContext){audioContext=new AC();master=audioContext.createGain();master.connect(audioContext.destination);}
    audioContext.resume().catch(()=>{});
    if(!audioReady)audioReady=Promise.all(Object.entries(window.BILLIARDS_AUDIO_DATA||{}).map(async([name,b64])=>{
      try{const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));audioBuffers[name]=await audioContext.decodeAudioData(bytes.buffer);}catch(e){}
    }));
  }
  function sound(name,strength=.6){
    if(!active||paused||mute||!audioContext)return;
    if($('#s-on')&&!$('#s-on').checked)return;
    const now=audioContext.currentTime;if(now-(lastSound[name]||-1)<.045)return;lastSound[name]=now;
    master.gain.value=volume*(($('#s-vol')?+$('#s-vol').value:80)/100);
    if(audioBuffers[name]){
      const source=audioContext.createBufferSource(),gain=audioContext.createGain();source.buffer=audioBuffers[name];
      gain.gain.value=.24+Math.max(0,Math.min(1,strength))*.72;source.connect(gain);gain.connect(master);audioVoices.add(source);
      source.onended=()=>{audioVoices.delete(source);gain.disconnect();};source.start();
    }else{
      const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='triangle';o.frequency.setValueAtTime(name==='pocket'?170:1700,now);o.frequency.exponentialRampToValueAtTime(90,now+.055);
      g.gain.setValueAtTime(.2*strength,now);g.gain.exponentialRampToValueAtTime(.0001,now+.08);o.connect(g);g.connect(master);o.start();o.stop(now+.09);
    }
  }
  function stopAudio(){for(const voice of audioVoices){try{voice.stop();}catch(e){}}audioVoices.clear();}
  function rulerTick(){
    if(!active||paused||mute||!audioContext||($('#s-on')&&!$('#s-on').checked))return;
    const now=audioContext.currentTime;if(now-(lastSound.ruler??-1)<.035)return;lastSound.ruler=now;
    master.gain.value=volume*(($('#s-vol')?+$('#s-vol').value:80)/100);
    const tick=audioContext.createOscillator(),gain=audioContext.createGain();tick.type='triangle';
    tick.frequency.setValueAtTime(1600,now);tick.frequency.exponentialRampToValueAtTime(650,now+.018);
    gain.gain.setValueAtTime(.065,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.027);
    tick.connect(gain);gain.connect(master);audioVoices.add(tick);tick.onended=()=>{audioVoices.delete(tick);tick.disconnect();gain.disconnect();};tick.start();tick.stop(now+.03);
  }
  function syncSensitivity(){
    for(const id of ['pool-fine-sensitivity','s-pool-fine']){const input=$('#'+id);if(input)input.value=fineSensitivity;}
    for(const id of ['pool-fine-sensitivity-value','s-pool-fine-val']){const label=$('#'+id);if(label)label.textContent=fineSensitivity;}
  }
  function setSensitivity(value){fineSensitivity=Math.max(1,Math.min(100,Math.round(Number(value)||20)));savePreferences();syncSensitivity();}
  function shotEnglish(){return {x:english.x,y:english.y,elevation};}
  function getPrediction(force=previewPower){
    const snapshot=world.snapshot(),spin=shotEnglish();
    const key=JSON.stringify([snapshot,angle,force,spin]);
    if(key!==predictionKey){prediction=P.predict(snapshot,angle,force,spin);predictionKey=key;}
    return prediction;
  }
  function toast(message){$('#pool-toast').textContent=message;$('#pool-toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#pool-toast').classList.remove('show'),2200);}
  function event(type,value,extra){
    if(type==='strike'||type==='collision'||type==='cushion')sound(type,value);
    if(type==='pocket'){sound('pocket',.8);pocketFX.push({id:value,x:extra.x,y:extra.y,pocket:extra.pocket,life:1});}
    if(type==='settled'){
      english={x:0,y:0};elevation=0;sync();
      if(value)toast('母球落袋，已放回 · 可开启挪球调整');
      $('#pool-status').textContent='经典八球 · 已进 '+world.potted.length+'/15 球 · '+world.shots+' 杆';
      if(world.potted.length===15){openModal('清台完成',`<p class="pool-score">${world.shots} 杆清台 · 用时 ${formatTime(elapsed)}</p><p>漂亮！再来一局，挑战更少杆数。</p><button class="primary" data-pool="new-game">再来一局</button><button data-act="exit-billiards">返回大厅</button>`);}
    }
  }
  function formatTime(seconds){return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(Math.floor(seconds%60)).padStart(2,'0');}
  function resize(){
    const rect=screen.getBoundingClientRect();if(!rect.width||!rect.height)return;
    scale=Math.min(rect.width/(rotated?2000:900),rect.height/(rotated?900:2000));
    scene.style.left=(rect.width-900)/2+'px';scene.style.top=(rect.height-2000)/2+'px';
    scene.style.transform=`scale(${scale}) rotate(${rotated?90:0}deg)`;
    const ratio=Math.max(1,Math.min(2,scale*(window.devicePixelRatio||1)));
    canvas.width=Math.round(900*ratio);canvas.height=Math.round(2000*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);draw();
  }
  function coordinates(e){const r=scene.getBoundingClientRect();return rotated?{x:(e.clientY-r.top)/scale,y:2000-(e.clientX-r.left)/scale}:{x:(e.clientX-r.left)/scale,y:(e.clientY-r.top)/scale};}
  function sync(){
    $('[data-pool="assist"]').setAttribute('aria-pressed',String(assist));$('[data-pool="move"]').setAttribute('aria-pressed',String(moveMode));
    $('#pool-undo-count').textContent=undoCount;
    $('[data-pool="undo"]').setAttribute('aria-disabled',String(!history.length||world.moving||!!shotAnimation));
    $('#pool-fine').setAttribute('aria-valuenow',String(Math.round(angle*180/Math.PI)));
    $('#pool-power').setAttribute('aria-valuenow',String(previewPower));
    $('#pool-power').setAttribute('aria-valuetext',`击球力度 ${previewPower}，最大 ${P.MAX_POWER}`);
    $('#pool-power-fill').style.height=(power/P.MAX_POWER*510)+'px';$('#pool-power-number').textContent=String(previewPower);
    const advanced=helper.positions||helper.target||helper.multi;
    $('#pool-aim-note').classList.toggle('hidden',(!assist&&!advanced)||world.moving||moveMode||!!shotAnimation);
    $('#pool-aim-note').textContent=`力度 ${previewPower} / ${P.MAX_POWER} · ${advanced?'台球助手 · 圆点为停点，袋口标注进袋':'母球辅助线最多四库'}`;
    $('#pool-power').classList.toggle('charging',power>0);syncSpin();
  }
  function syncSpin(){
    $('#pool-spin-dot').style.transform=`translate(${english.x*28}px,${english.y*28}px)`;$('#pool-spin-angle').textContent=elevation+'°';
    const dot=$('#spin-picker-dot');if(dot)dot.style.transform=`translate(${english.x*128}px,${english.y*128}px)`;
    const picker=$('#spin-picker');if(picker){picker.setAttribute('aria-valuenow',String(Math.round(-english.y*100)));picker.setAttribute('aria-valuetext',`左右 ${Math.round(english.x*100)}，高低 ${Math.round(-english.y*100)}`);}
  }
  function setEnglish(x,y){const length=Math.max(1,Math.hypot(x,y));english={x:x/length,y:y/length};}
  function reset(){world.reset();history=[];elapsed=0;clockSecond=-1;angle=-Math.PI/2;moveMode=false;english={x:0,y:0};elevation=0;power=0;previewPower=P.MAX_POWER;predictionKey='';lastShotPrediction=null;shotAnimation=null;pocketFX=[];accumulator=0;undoCount=999;closeModal();sync();$('#pool-status').textContent='经典八球 · 拖动瞄准，向下拉杆击球';toast('拖动球桌瞄准 · 右侧向下拉杆，松开击球');}
  function referenceLayout(){
    reset();const positions={0:[294,1315],1:[547,584],2:[490,538],3:[615,484],4:[410,750],5:[604,715],6:[181,556],7:[602,807],8:[660,426],9:[364,425],10:[440,532],11:[390,680],12:[440,441],13:[537,455],14:[354,519],15:[637,549]};
    world.balls.forEach(b=>{[b.x,b.y]=positions[b.id];if(b.id===4||b.id===11){b.pocketed=true;world.potted.push(b.id);}});
    angle=Math.atan2(589-1315,201-294);sync();$('#pool-status').textContent='经典八球 · 已进 2/15 球 · 0 杆';toast('已摆好参考球局');
  }
  function canInteract(){return active&&!paused&&!world.moving&&!shotAnimation;}
  function shoot(value){
    value=Math.max(0,Math.min(P.MAX_POWER,Math.round(value)));
    if(!canInteract()||moveMode||value<1){power=0;sync();return;}
    initAudio();previewPower=value;lastShotPrediction=(assist||helper.positions||helper.target||helper.multi)?getPrediction(value):null;
    history.push({world:world.snapshot(),angle,english:{...english},elevation,power:value});if(history.length>50)history.shift();
    shotAnimation={age:0,power:value,angle,english:shotEnglish()};sync();
  }
  function undo(){
    if(world.moving||shotAnimation){toast('请等球停稳后悔球');return;}
    if(!history.length){toast('还没有可以撤回的击球');return;}
    const state=history.pop();world.restore(state.world);angle=state.angle;english={...state.english};elevation=state.elevation;previewPower=state.power;predictionKey='';
    undoCount=Math.max(0,undoCount-1);pocketFX=[];sync();toast('已恢复上一杆球位');$('#pool-status').textContent='经典八球 · 已进 '+world.potted.length+'/15 球 · '+world.shots+' 杆';
  }
  function openModal(title,body){
    cancelGesture();paused=true;stopAudio();modalFocus=document.activeElement;
    $('#pool-dialog-title').textContent=title;$('#pool-dialog-body').innerHTML=body;$('#pool-modal').classList.remove('hidden');
    const button=$('#pool-dialog-body button');if(button)button.focus({preventScroll:true});
  }
  function closeModal(){setSpinAdjusting(false);paused=false;$('#pool-modal').classList.add('hidden');last=performance.now();if(modalFocus&&modalFocus.isConnected)modalFocus.focus({preventScroll:true});modalFocus=null;}
  function pauseMenu(){openModal('经典八球',`<p class="pool-score">已进 ${world.potted.length}/15 球 · ${world.shots} 杆</p><button class="primary" data-pool="resume">继续游戏</button><button data-pool="help">操作说明</button><button data-pool="reset">重新开局</button><button data-pool="reference">参考球局</button><button data-pool="settings">设置</button><button data-act="exit-billiards">返回大厅</button>`);}
  function settingsMenu(){openModal('设置',`<label>微调灵敏度 <input id="pool-fine-sensitivity" type="range" min="1" max="100" step="1" value="${fineSensitivity}" aria-label="微调尺灵敏度"><b id="pool-fine-sensitivity-value">${fineSensitivity}</b></label><p>数值越小，瞄准调整越精细。默认 20。</p><label>音量 <input id="pool-volume" type="range" min="0" max="100" value="${Math.round(volume*100)}" aria-label="台球音量"><button data-pool="mute" style="min-width:110px">${mute?'开启':'静音'}</button></label><p>滑动微调尺时播放刻度声，静音时关闭。</p><button class="primary" data-pool="resume">返回球桌</button>`);}
  function handle(action){
    initAudio();
    if(action==='helper-off'){helper.positions=helper.target=helper.multi=false;syncHelper();return;}
    if(action==='pause'){pauseMenu();return;}
    if(action==='settings'){settingsMenu();return;}
    if(action==='resume'){closeModal();return;}
    if(action==='new-game'){reset();return;}
    if(action==='reset'){openModal('重新开局',`<p>重新摆好 15 颗球，开始新的练习？</p><button class="primary" data-pool="new-game">重新开局</button><button data-pool="resume">继续当前球局</button>`);return;}
    if(action==='grid'||action==='table'){toast(action==='grid'?'网格功能待开放':'球桌切换待开放');return;}
    if(action==='assist'){assist=!assist;savePreferences();sync();toast(assist?'辅助线已开启':'辅助线已关闭');return;}
    if(action==='undo'){undo();return;}
    if(action==='rotate'){cancelGesture();rotated=!rotated;resize();return;}
    if(action==='reference'){referenceLayout();return;}
    if(action==='move'){if(!canInteract()){toast('请等球停稳后挪球');return;}moveMode=!moveMode;sync();toast(moveMode?'拖动任意球调整位置 · 再点挪球结束':'挪球结束，可以击球');return;}
    if(action==='spin'){
      if(!canInteract()){toast('请等球停稳后调整击球点');return;}
      openModal('击球点',`<p>上部高杆 · 下部低杆 · 左右加塞</p><div class="spin-picker" id="spin-picker" role="slider" tabindex="0" aria-label="击球点，可拖动或使用方向键" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0"><i id="spin-picker-dot"></i></div><label>抬杆角度 <input id="pool-elevation" type="range" min="0" max="90" value="${elevation}" aria-label="抬杆角度"><span id="elevation-value">${elevation}°</span></label><p>左右加塞决定弧线方向，抬杆越高弯曲越明显。</p><button data-pool="spin-center">回到中心</button><button class="primary" data-pool="resume">确定</button>`);syncSpin();return;
    }
    if(action==='spin-center'){english={x:0,y:0};elevation=0;$('#pool-elevation').value=0;$('#elevation-value').textContent='0°';syncSpin();return;}
    if(action==='cues'){openModal('当前球杆',`<img class="cue-preview" src="assets/billiards/cue.png" alt="火焰球杆"><p>烈焰 · 已装备</p><button class="primary" data-pool="resume">返回球桌</button>`);return;}
    if(action==='help'){openModal('操作说明',`<div class="pool-help"><p><b>瞄准：</b>拖动球桌，底部刻度尺微调；设置中可调灵敏度。</p><p><b>击球：</b>向下拉杆蓄力，松手出杆；力度 0–800。空格也可蓄力。</p><p><b>辅助线：</b>普通辅助线最多四库，同时显示首颗目标球的绿色路线和母球碰撞后的白色分离线。台球助手可独立开启各球精准预测与母球完整多库路径，蓄力时实时更新；点击助手标题展开或收起，拖动标题移动。</p><p><b>练习：</b>母球开局居中，每局随机摆球。清空球桌完成练习，母球落袋自动放回。</p><p><b>挪球 / 悔球：</b>调整球位或恢复上一杆；Esc 暂停。</p></div><button class="primary" data-pool="resume">开始练习</button>`);return;}
    if(action==='mute'){mute=!mute;savePreferences();settingsMenu();}
  }
  screen.addEventListener('click',e=>{const button=e.target.closest('[data-pool]');if(button){e.preventDefault();handle(button.dataset.pool);}});
  screen.addEventListener('input',e=>{if(e.target.id==='pool-fine-sensitivity')setSensitivity(e.target.value);if(e.target.id==='pool-volume'){volume=+e.target.value/100;savePreferences();}if(e.target.id==='pool-elevation'){elevation=+e.target.value;$('#elevation-value').textContent=elevation+'°';syncSpin();}});
  $('#s-pool-fine').addEventListener('input',e=>setSensitivity(e.target.value));syncSensitivity();
  function clampHelper(){
    const panel=$('#pool-helper');
    panel.style.left=Math.max(0,Math.min(900-panel.offsetWidth,panel.offsetLeft))+'px';
    panel.style.top=Math.max(60,Math.min(2000-panel.offsetHeight,panel.offsetTop))+'px';
  }
  function syncHelper(){
    $('#pool-helper').classList.toggle('expanded',helper.expanded);
    $('#pool-helper').classList.toggle('enabled',helper.positions||helper.target||helper.multi);
    $('#pool-helper-body').classList.toggle('hidden',!helper.expanded);
    $('#pool-helper-handle').setAttribute('aria-expanded',String(helper.expanded));
    $('#pool-helper-arrow').textContent=helper.expanded?'−':'＋';
    $('#pool-helper-positions').checked=helper.positions;$('#pool-helper-target').checked=helper.target;$('#pool-helper-multi').checked=helper.multi;
    clampHelper();sync();
  }
  for(const key of ['positions','target','multi'])$('#pool-helper-'+key).addEventListener('change',e=>{helper[key]=e.target.checked;if(helper[key]&&key==='target')helper.positions=false;if(helper[key]&&key==='positions')helper.target=false;syncHelper();});
  const helperHandle=$('#pool-helper-handle');
  helperHandle.addEventListener('click',e=>{e.stopPropagation();if(helperDragged){helperDragged=false;return;}helper.expanded=!helper.expanded;syncHelper();});
  helperHandle.addEventListener('pointerdown',e=>{
    if(e.button>0||pointer)return;e.stopPropagation();
    const p=coordinates(e),panel=$('#pool-helper');helperDragged=false;
    helperDrag={id:e.pointerId,start:p,x:panel.offsetLeft,y:panel.offsetTop};helperHandle.setPointerCapture(e.pointerId);
  });
  helperHandle.addEventListener('pointermove',e=>{
    if(!helperDrag||helperDrag.id!==e.pointerId)return;e.stopPropagation();
    const p=coordinates(e),dx=p.x-helperDrag.start.x,dy=p.y-helperDrag.start.y;
    if(Math.hypot(dx,dy)>8)helperDragged=true;
    if(helperDragged){$('#pool-helper').style.left=helperDrag.x+dx+'px';$('#pool-helper').style.top=helperDrag.y+dy+'px';clampHelper();}
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])helperHandle.addEventListener(name,e=>{if(helperDrag?.id===e.pointerId){e.stopPropagation();helperDrag=null;}});
  function setSpinAdjusting(value){$('#pool-modal').classList.toggle('spin-adjusting',value);}
  function cancelGesture(){
    setSpinAdjusting(false);
    if(pointer){try{pointer.el.releasePointerCapture(pointer.id);}catch(e){}if(dragBall){dragBall.ball.x=dragBall.x;dragBall.ball.y=dragBall.y;}pointer=null;dragBall=null;}
    power=0;keyboardCharge=0;sync();
  }
  function down(e){
    if(pointer||e.button>0)return;
    const el=e.target,point=coordinates(e),picker=el.closest('#spin-picker');
    if(picker){e.preventDefault();pointer={type:'spin',id:e.pointerId,el:picker};picker.setPointerCapture(e.pointerId);setSpinAdjusting(true);updateSpin(e);return;}
    if(!canInteract())return;
    let type=el.id==='pool-power'?'power':el.id==='pool-fine'?'fine':el===canvas?'aim':null;
    if(!type)return;
    if(type==='power'&&moveMode){toast('请先结束挪球');return;}
    if(type==='aim'&&(point.x<45||point.x>735||point.y<350||point.y>1650))return;
    if(moveMode&&type==='aim'){
      const ball=world.balls.filter(b=>!b.pocketed&&Math.hypot(b.x-point.x,b.y-point.y)<P.R+22).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y))[0];if(!ball)return;
      type='move';dragBall={ball,x:ball.x,y:ball.y,offset:{x:ball.x-point.x,y:ball.y-point.y},valid:true};
    }
    e.preventDefault();el.focus({preventScroll:true});initAudio();pointer={type,id:e.pointerId,el,start:point,last:point,angle};el.setPointerCapture(e.pointerId);
    if(type==='aim')aim(point);if(type==='power'){power=0;previewPower=0;sync();}
  }
  function aim(p){const cue=world.balls[0];if(Math.hypot(p.x-cue.x,p.y-cue.y)>28){angle=Math.atan2(p.y-cue.y,p.x-cue.x);sync();}}
  function updateSpin(e){const picker=$('#spin-picker');if(!picker)return;const r=picker.getBoundingClientRect();let x,y;if(rotated){x=(e.clientY-r.top)/r.height*2-1;y=1-(e.clientX-r.left)/r.width*2;}else{x=(e.clientX-r.left)/r.width*2-1;y=(e.clientY-r.top)/r.height*2-1;}setEnglish(x,y);picker.setAttribute('aria-valuetext',`左右 ${Math.round(english.x*100)}，高低 ${Math.round(-english.y*100)}`);syncSpin();}
  function move(e){
    if(!pointer||e.pointerId!==pointer.id)return;e.preventDefault();const p=coordinates(e);
    if(pointer.type==='spin'){updateSpin(e);return;}
    if(pointer.type==='aim')aim(p);
    if(pointer.type==='fine'){angle=pointer.angle+(p.x-pointer.start.x)*.0009*fineSensitivity/100;if(Math.abs(p.x-(pointer.tickX??pointer.start.x))>=5){rulerTick();pointer.tickX=p.x;}sync();}
    if(pointer.type==='power'){power=Math.round(Math.max(0,Math.min(P.MAX_POWER,(p.y-pointer.start.y)/420*P.MAX_POWER)));previewPower=power;sync();}
    if(pointer.type==='move'&&dragBall){const x=Math.max(103,Math.min(677,p.x+dragBall.offset.x)),y=Math.max(410,Math.min(1589,p.y+dragBall.offset.y));dragBall.valid=world.canPlace(dragBall.ball.id,x,y);dragBall.ball.x=x;dragBall.ball.y=y;}
    pointer.last=p;
  }
  function up(e){
    if(!pointer||e.pointerId!==pointer.id)return;const type=pointer.type;pointer=null;if(type==='spin')setSpinAdjusting(false);
    if(type==='move'&&dragBall){if(!dragBall.valid){dragBall.ball.x=dragBall.x;dragBall.ball.y=dragBall.y;toast('球不能重叠，请换个位置');}else history=[];dragBall=null;sync();}
    if(type==='power'){const value=power;shoot(value);power=0;sync();}
  }
  // Children in power / ruler controls do not intercept the drag target.
  $('#pool-power').querySelectorAll('*').forEach(el=>el.style.pointerEvents='none');
  screen.addEventListener('pointerdown',down);screen.addEventListener('pointermove',move);screen.addEventListener('pointerup',up);
  screen.addEventListener('pointercancel',cancelGesture);screen.addEventListener('lostpointercapture',()=>{if(pointer)cancelGesture();});
  screen.addEventListener('pointerdown',e=>{if(e.target.id==='pool-elevation')setSpinAdjusting(true);});
  window.addEventListener('pointerup',()=>setSpinAdjusting(false));
  document.addEventListener('keydown',e=>{
    if(!active)return;
    if(e.key==='Tab'&&paused){const nodes=[...$('#pool-dialog-body').querySelectorAll('button,input,[tabindex="0"]')];if(nodes.length){const first=nodes[0],end=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus();}}return;}
    if(e.key==='Escape'){e.preventDefault();if(paused)closeModal();else pauseMenu();return;}
    if(paused){if(document.activeElement?.id==='spin-picker'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setEnglish(english.x+(e.key==='ArrowLeft'?-.05:e.key==='ArrowRight'?.05:0),english.y+(e.key==='ArrowUp'?-.05:e.key==='ArrowDown'?.05:0));setSpinAdjusting(true);syncSpin();}return;}
    if(!canInteract()||e.target.tagName==='INPUT'||e.target.tagName==='BUTTON')return;
    if(e.code==='Space'){e.preventDefault();if(!e.repeat&&!keyboardCharge&&!moveMode){initAudio();power=previewPower=0;keyboardCharge=performance.now();sync();}return;}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();initAudio();angle+=(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)*(e.shiftKey?.0005:.003)*fineSensitivity/100;rulerTick();sync();}
  });
  document.addEventListener('keyup',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))setSpinAdjusting(false);if(e.code==='Space'&&keyboardCharge){e.preventDefault();const value=power;keyboardCharge=0;shoot(value);power=0;sync();}});
  window.addEventListener('blur',()=>{if(active&&!paused)pauseMenu();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&active&&!paused)pauseMenu();});
  function ballArt(b,r=P.R,alpha=1){
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(b.x,b.y);ctx.shadowColor='#00180fc0';ctx.shadowBlur=8;ctx.shadowOffsetY=4;ctx.shadowOffsetX=2;
    const image=images['ball-'+b.id];
    if(image?.complete&&image.naturalWidth){ctx.rotate(Math.sin(b.roll||0)*.45);ctx.drawImage(image,-r-2,-r-2,(r+2)*2,(r+2)*2);}
    else{
      const color=colors[b.id>8?b.id-8:b.id],g=ctx.createRadialGradient(-r*.35,-r*.45,1,0,0,r);g.addColorStop(0,'#fff');g.addColorStop(.22,color);g.addColorStop(.7,color);g.addColorStop(1,'#101c14');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.shadowColor='transparent';
      if(b.id>8){ctx.save();ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.clip();ctx.fillStyle='#e8ece1';ctx.fillRect(-r,-r,2*r,r*.53);ctx.fillRect(-r,r*.47,2*r,r*.53);ctx.restore();}
      if(b.id){ctx.fillStyle='#f8f4e9';ctx.beginPath();ctx.arc(2,2,r*.45,0,Math.PI*2);ctx.fill();ctx.fillStyle='#161a19';ctx.font='bold '+r*.66+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(b.id,2,3);}
    }
    ctx.restore();
  }
  function line(path,color,broad){
    const a=path.start,b=path.end,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<.1)return;
    ctx.save();ctx.lineCap='round';
    if(broad){
      ctx.strokeStyle=color==='green'?'#8fff6550':'#e5fff557';ctx.lineWidth=38;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      ctx.strokeStyle=color==='green'?'#86fb79a0':'#edfff0c7';ctx.lineWidth=3;const nx=-dy/length*19,ny=dx/length*19;
      ctx.beginPath();ctx.moveTo(a.x+nx,a.y+ny);ctx.lineTo(b.x+nx,b.y+ny);ctx.moveTo(a.x-nx,a.y-ny);ctx.lineTo(b.x-nx,b.y-ny);ctx.stroke();
      ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(dy,dx));ctx.fillStyle=color==='green'?'#70f151b0':'#e6ffedb9';
      for(let at=40;at<length-10;at+=76){ctx.beginPath();ctx.moveTo(at-24,-17);ctx.lineTo(at,-17);ctx.lineTo(at+19,0);ctx.lineTo(at,17);ctx.lineTo(at-24,17);ctx.lineTo(at-5,0);ctx.closePath();ctx.fill();}
    }else{
      ctx.lineWidth=7;ctx.strokeStyle='#0a30296a';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.lineWidth=2.8;ctx.strokeStyle=color==='green'?'#c9efb7':'#d6e9cb';ctx.stroke();
    }ctx.restore();
  }
  function trajectory(points,color,broad=true){
    if(points.length<2)return;
    if(!broad){for(let i=1;i<points.length;i++)line({start:points[i-1],end:points[i]},color,false);return;}
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
    ctx.strokeStyle=color==='green'?'#8fff6550':'#e5fff557';ctx.lineWidth=38;
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();
    ctx.strokeStyle=color==='green'?'#86fb79a0':'#edfff0c7';ctx.lineWidth=3;
    for(const side of [-1,1]){
      ctx.beginPath();for(let i=0;i<points.length;i++){
        const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=P.unit(b.x-a.x,b.y-a.y),p=points[i];
        const x=p.x-d.y*19*side,y=p.y+d.x*19*side;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }ctx.stroke();
    }
    // Place arrowheads by travelled distance, so curved paths retain the same
    // direction marks as straight paths regardless of polyline vertex density.
    let travelled=0,next=40;ctx.fillStyle=color==='green'?'#70f151b0':'#e6ffedb9';
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);
      while(length>0&&next<travelled+length){
        const t=(next-travelled)/length;
        ctx.save();ctx.translate(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));
        ctx.beginPath();ctx.moveTo(-24,-17);ctx.lineTo(0,-17);ctx.lineTo(19,0);ctx.lineTo(0,17);ctx.lineTo(-24,17);ctx.lineTo(-5,0);ctx.closePath();ctx.fill();ctx.restore();next+=76;
      }
      travelled+=length;
    }
    ctx.restore();
  }
  function drawPrediction(){
    const preview=getPrediction();
    if(helper.target)$('#pool-helper-target-note').textContent=preview.firstTargetId===null?'当前力度下未碰到目标球':`${preview.firstTargetId}号球路线 · 双球落点`;
    if(!preview.complete){$('#pool-aim-note').textContent='当前球局预测未完成';return;}
    ctx.save();ctx.beginPath();ctx.rect(38,338,704,1330);ctx.clip();
    const tracks=preview.paths.filter(t=>t.id===0||helper.positions||(helper.target&&t.id===preview.firstTargetId)).sort((a,b)=>(a.id===0)-(b.id===0));
    for(const track of tracks){
      const isCue=track.id===0,points=isCue&&!helper.multi?preview.normalCue.points:track.points;
      if(isCue)trajectory(points,'white');
      else{
        ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);
        ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#92ffa8a0';ctx.lineWidth=5;ctx.stroke();
      }
      if(!helper.positions&&!helper.target&&!(isCue&&helper.multi))continue;
      const end=track.points[track.points.length-1];ctx.lineWidth=2.5;
      ctx.strokeStyle=isCue?'#f6fff2':'#a5ffb1';ctx.fillStyle=isCue?'#ecffef26':'#7bff9826';
      ctx.beginPath();ctx.arc(end.x,end.y,isCue?P.R:13,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle=isCue?'#fffde5':'#b8ffc2';ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
      if(!isCue)ctx.fillText(track.id,end.x,end.y);
      if(isCue||track.pocket){
        const label=track.pocket?(isCue?'母球落袋':`${track.id}号进袋`):(helper.target?'母球停点':'停点');
        const x=Math.max(140,Math.min(640,end.x)),y=Math.max(441,Math.min(1563,end.y-35));
        const width=ctx.measureText(label).width+16;ctx.fillStyle='#10392ddd';ctx.beginPath();ctx.roundRect(x-width/2,y-14,width,28,7);ctx.fill();ctx.fillStyle=track.pocket?'#ffe38a':'#f3ffee';ctx.fillText(label,x,y);
      }
    }
    if(assist&&preview.normalContact){
      const contact=preview.normalContact;
      const drawBranch=(track,color)=>trajectory(track.points,color);
      if(!helper.positions&&!helper.target)drawBranch(contact.target,'green');
      if(!helper.multi)drawBranch(contact.cue,'white');
      ctx.strokeStyle='#edfff1ce';ctx.lineWidth=3;ctx.beginPath();ctx.arc(contact.point.x,contact.point.y,P.R,0,Math.PI*2);ctx.stroke();
    }
    // A zero-strength preview has no travel path, but still shows the stop point.
    if(!tracks.length&&(helper.positions||helper.target||helper.multi)){const cue=world.balls[0];ctx.strokeStyle='#ecfff2';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cue.x,cue.y,P.R+5,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  function drawAim(){
    if(assist||helper.positions||helper.target||helper.multi){drawPrediction();return;}
    if(elevation>0&&Math.abs(english.x)>.001){
      const preview=getPrediction();if(!preview.complete)return;
      ctx.save();ctx.beginPath();ctx.rect(38,338,704,1330);ctx.clip();trajectory(preview.normalCue.points,'white',false);
      if(preview.normalContact){trajectory(preview.normalContact.target.points,'green',false);trajectory(preview.normalContact.cue.points,'white',false);}ctx.restore();return;
    }
    const cue=world.balls[0],direction={x:Math.cos(angle),y:Math.sin(angle)};
    const path=P.trace(world.balls,cue,direction,0,0,2400);
    ctx.save();ctx.beginPath();ctx.rect(49,349,683,1306);ctx.clip();path.forEach(s=>line(s,'white',assist));
    const end=path[path.length-1];
    if(end){
      ctx.strokeStyle=assist?'#edfff1ce':'#dcf0d5';ctx.lineWidth=assist?3:2;ctx.beginPath();ctx.arc(end.end.x,end.end.y,P.R,0,Math.PI*2);ctx.stroke();
      if(end.type==='ball'){
        const target=end.ball,n=P.unit(target.x-end.end.x,target.y-end.end.y),paths=P.trace(world.balls,target,n,assist?1:0,target.id,assist?550:170);paths.forEach(s=>line(s,'green',assist));
        const dot=end.direction.x*n.x+end.direction.y*n.y,tangent={x:end.direction.x-dot*n.x,y:end.direction.y-dot*n.y};
        if(Math.hypot(tangent.x,tangent.y)>.1){const t=P.unit(tangent.x,tangent.y);line({start:end.end,end:{x:end.end.x+t.x*(assist?190:45),y:end.end.y+t.y*(assist?190:45)}},'white',assist);}
        if(!assist){ctx.beginPath();for(let k=0;k<4;k++){const a=k*Math.PI/2;ctx.ellipse(end.end.x+Math.cos(a)*10,end.end.y+Math.sin(a)*10,5,10,a,0,Math.PI*2);}ctx.stroke();}
      }
      if(assist)for(const s of path.slice(0,-1)){ctx.beginPath();ctx.arc(s.end.x,s.end.y,P.R,0,Math.PI*2);ctx.stroke();}
    }ctx.restore();
  }
  function drawCue(){
    const cue=world.balls[0],image=images.cue;if(!image?.complete||!image.naturalWidth||cue.pocketed)return;
    let pull=power/P.MAX_POWER*100;if(shotAnimation)pull=shotAnimation.power/P.MAX_POWER*100*(1-Math.min(1,shotAnimation.age/.12));
    const distance=P.R+10+pull;ctx.save();ctx.translate(cue.x-Math.cos(angle)*distance,cue.y-Math.sin(angle)*distance);ctx.rotate(angle+Math.PI/2);
    ctx.drawImage(image,-75,0,150,660);
    // A restrained warm shimmer follows the extracted flame, without obscuring the cloth.
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){ctx.globalAlpha=.12+.04*Math.sin(performance.now()/160);ctx.globalCompositeOperation='screen';ctx.drawImage(image,-75,0,150,660);}
    ctx.restore();
  }
  function draw(){
    ctx.clearRect(0,0,900,2000);
    if(images.ruler?.complete&&images.ruler.naturalWidth)ctx.drawImage(images.ruler,140,1690,500,75);
    if(!world.moving&&!moveMode&&!shotAnimation)drawAim();
    if(assist&&!world.moving&&!moveMode){for(const b of world.balls){if(b.id===0||b.pocketed)continue;ctx.save();ctx.shadowBlur=14;ctx.shadowColor='#ffd600';ctx.strokeStyle='#ffdf00';ctx.lineWidth=4;ctx.beginPath();ctx.arc(b.x,b.y,26,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#e4c50b';ctx.beginPath();ctx.roundRect(b.x-26,b.y-56,52,25,6);ctx.fill();ctx.fillStyle='#635915';ctx.font='23px Arial';ctx.textAlign='center';ctx.fillText(b.id,b.x,b.y-36);ctx.restore();}}
    for(const b of world.balls)if(!b.pocketed)ballArt(b);
    for(const fx of pocketFX){const t=1-fx.life;ballArt({id:fx.id,x:fx.x+(fx.pocket.x-fx.x)*t,y:fx.y+(fx.pocket.y-fx.y)*t},P.R*Math.max(.15,fx.life),fx.life);}
    if(moveMode){ctx.save();ctx.strokeStyle=dragBall&&!dragBall.valid?'#ff7766':'#cbffe4';ctx.lineWidth=2;ctx.setLineDash([6,5]);for(const b of world.balls)if(!b.pocketed){ctx.beginPath();ctx.arc(b.x,b.y,27,0,Math.PI*2);ctx.stroke();}ctx.restore();}
    if(!world.moving&&!moveMode)drawCue();
  }
  function frame(now){
    if(!active){raf=0;return;}
    const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
    if(!paused){
      elapsed+=dt;if(Math.floor(elapsed)!==clockSecond){clockSecond=Math.floor(elapsed);$('#pool-clock').textContent=formatTime(elapsed);}
      if(keyboardCharge){power=Math.round(Math.min(P.MAX_POWER,(now-keyboardCharge)/1300*P.MAX_POWER));previewPower=power;sync();}
      if(shotAnimation){shotAnimation.age+=dt;if(shotAnimation.age>=.12){const shot=shotAnimation;shotAnimation=null;world.shoot(shot.angle,shot.power,shot.english);power=0;sync();}}
      if(world.moving){accumulator+=dt;while(accumulator>=P.STEP){world.step();accumulator-=P.STEP;}}else accumulator=0;
      pocketFX.forEach(fx=>fx.life-=dt*3.8);pocketFX=pocketFX.filter(fx=>fx.life>0);
    }
    draw();raf=requestAnimationFrame(frame);
  }
  let initialized=false;
  function setActive(value){
    active=value;
    if(value){initAudio();if(!initialized){initialized=true;reset();}last=performance.now();if(!raf)raf=requestAnimationFrame(frame);requestAnimationFrame(resize);}
    else{cancelGesture();stopAudio();if(raf)cancelAnimationFrame(raf);raf=0;if(shotAnimation){shotAnimation=null;history.pop();}paused=false;$('#pool-modal').classList.add('hidden');helper.positions=helper.target=helper.multi=helper.expanded=false;helperDrag=null;syncHelper();}
  }
  window.addEventListener('resize',resize);document.addEventListener('game-screen-change',resize);
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(screen);
  window.Billiards={setActive,getPrediction:()=>structuredClone(getPrediction()),getLastShotPrediction:()=>structuredClone(lastShotPrediction),getState:()=>({balls:world.balls.map(b=>({...b})),shots:world.shots,potted:[...world.potted],moving:world.moving,paused,active,assist,moveMode,angle,power,previewPower,fineSensitivity,english:{...english},elevation,helper:{...helper},history:history.length,audioLoaded:Object.keys(audioBuffers)})};
  sync();
})();
