/* Run with node --test billiards.test.js. No external dependencies. */
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('./js/billiards-physics');
const isolate=(world,ids)=>world.balls.forEach(b=>b.pocketed=!ids.includes(b.id));
const stop=world=>{for(let i=0;i<7200&&world.moving;i++)world.step();assert.equal(world.moving,false,'shot should settle');};
test('normal guide ends at the fourth actual cushion while full prediction reaches rest',()=>{
  const contacts=[],w=new P.World((type,id,point)=>{if(type==='rail-contact'&&id===0)contacts.push(point);});
  isolate(w,[0]);Object.assign(w.balls[0],{x:390,y:1200});
  const preview=P.predict(w.snapshot(),.05,800);
  w.shoot(.05,800);stop(w);
  assert.ok(contacts.length>4);assert.equal(preview.normalCue.cushions,4);
  assert.equal(preview.normalCue.end,'four-cushions');
  assert.deepEqual(preview.normalCue.points.at(-1),contacts[3]);
  assert.notDeepEqual(preview.paths[0].points.at(-1),contacts[3]);
  assert.deepEqual(preview.final,w.snapshot());
});
test('normal guide ends at first object contact or a real short stop, without changing full prediction',()=>{
  const contacts=[],w=new P.World((type,id,point)=>{if(type==='cue-contact')contacts.push(point);});
  isolate(w,[0,1]);Object.assign(w.balls[0],{x:390,y:1200});Object.assign(w.balls.find(b=>b.id===1),{x:390,y:900});
  const preview=P.predict(w.snapshot(),-Math.PI/2,800);
  assert.equal(preview.normalCue.end,'ball');assert.equal(preview.normalCue.cushions,0);
  w.shoot(-Math.PI/2,800);stop(w);assert.deepEqual(preview.normalCue.points.at(-1),{x:contacts[0].x,y:contacts[0].y});
  assert.deepEqual(preview.final,w.snapshot());
  const short=new P.World();isolate(short,[0]);
  const low=P.predict(short.snapshot(),0,80);
  assert.equal(low.normalCue.end,'stop');assert.equal(low.normalCue.cushions,0);
  assert.deepEqual(low.normalCue.points.at(-1),low.paths[0].points.at(-1));
});
test('rack has all 16 non-overlapping balls, eight in the middle',()=>{
  const balls=P.rack();assert.equal(new Set(balls.map(b=>b.id)).size,16);
  for(const a of balls)for(const b of balls)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=P.R*2);
  assert.equal(balls.find(b=>b.id===8).x,390);
});
test('normal assist shows the first target and cue separation using actual cut-shot directions',()=>{
  const w=new P.World();isolate(w,[0,1]);Object.assign(w.balls[0],{x:390,y:1200});Object.assign(w.balls.find(b=>b.id===1),{x:410,y:1000});
  const full=P.predict(w.snapshot(),-Math.PI/2,800),local=full.normalContact;
  assert.equal(local.target.id,1);assert.equal(local.cue.id,0);
  assert.ok(local.target.points.at(-1).x>410);assert.ok(local.cue.points.at(-1).x<local.point.x);
  const pathLength=track=>track.points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-track.points[i].x,p.y-track.points[i].y),0);
  assert.ok(pathLength(local.target)<=550.001);assert.ok(pathLength(local.cue)<=190.001);
  const low=P.predict(w.snapshot(),-Math.PI/2,80);
  assert.equal(low.normalContact,null,'insufficient force must not draw an imaginary collision');
  const medium=P.predict(w.snapshot(),-Math.PI/2,200);
  assert.ok(pathLength(medium.normalContact.target)<pathLength(local.target));
  w.shoot(-Math.PI/2,800);while(!w.contact)w.step();
  for(const track of [local.target,local.cue]){
    const b=w.balls.find(b=>b.id===track.id),p=track.points[0],q=track.points[1];
    const direction=P.unit(q.x-p.x,q.y-p.y),velocity=P.unit(b.vx,b.vy);
    assert.ok(direction.x*velocity.x+direction.y*velocity.y>.9999,'branch follows the live outgoing velocity');
  }
  stop(w);assert.deepEqual(full.final,w.snapshot());
});
test('local target guide stops at the next ball; backspin separation follows the real reversal',()=>{
  const w=new P.World();isolate(w,[0,1,2]);Object.assign(w.balls[0],{x:390,y:1200});Object.assign(w.balls.find(b=>b.id===1),{x:390,y:1000});Object.assign(w.balls.find(b=>b.id===2),{x:390,y:800});
  const p=P.predict(w.snapshot(),-Math.PI/2,800,{x:0,y:.85});
  assert.equal(p.normalContact.target.id,1);assert.ok(p.normalContact.target.points.at(-1).y>835);
  assert.ok(p.normalContact.cue.points.at(-1).y>p.normalContact.point.y,'draw shot shows cue moving backwards');
  assert.ok(p.paths.some(t=>t.id===2),'full helper retains the secondary ball path');
});
test('break transfers momentum, stays finite and eventually settles',()=>{
  const w=new P.World();assert.ok(w.shoot(-Math.PI/2,800));
  let movingObjects=false;for(let i=0;i<7200&&w.moving;i++){w.step();movingObjects ||= w.balls.some(b=>b.id&&Math.hypot(b.vx,b.vy)>10);}
  assert.ok(movingObjects);assert.equal(w.moving,false);assert.ok(w.balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)));
  assert.equal(w.shots,1);assert.ok(w.balls.every(b=>b.pocketed||(b.x>40&&b.x<740&&b.y>340&&b.y<1660)));
});
test('one head-on hit transfers forward motion and prediction identifies the target',()=>{
  const w=new P.World();isolate(w,[0,1]);Object.assign(w.balls[0],{x:390,y:1000});const target=w.balls.find(b=>b.id===1);Object.assign(target,{x:390,y:800});
  const path=P.trace(w.balls,w.balls[0],{x:0,y:-1});assert.equal(path[0].ball.id,1);assert.equal(path[0].end.y,838);
  w.shoot(-Math.PI/2,320);for(let i=0;i<120;i++)w.step();assert.ok(target.vy<0);stop(w);
});
test('cushion prediction and live rebound agree',()=>{
  const w=new P.World();isolate(w,[0]);Object.assign(w.balls[0],{x:390,y:1200});
  const path=P.trace(w.balls,w.balls[0],{x:1,y:0},1);assert.equal(path[0].type,'rail');assert.equal(path[0].end.x,677);assert.ok(path[1].end.x<677);
  w.shoot(0,480);let bounced=false;for(let i=0;i<300;i++){w.step();if(w.balls[0].vx<0){bounced=true;break;}}assert.ok(bounced);stop(w);
});
test('side pocket accepts a ball, scratch respawns without overlap',()=>{
  const events=[];const w=new P.World((...args)=>events.push(args));isolate(w,[0]);Object.assign(w.balls[0],{x:390,y:1000});
  const path=P.trace(w.balls,w.balls[0],{x:1,y:0});assert.equal(path[0].type,'pocket');
  w.shoot(0,400);stop(w);assert.ok(events.some(e=>e[0]==='pocket'&&e[1]===0));assert.equal(w.balls[0].pocketed,false);assert.equal(w.balls[0].x,294);
});
test('all six pockets admit a centre-directed object ball',()=>{
  for(const p of P.POCKETS){const w=new P.World();isolate(w,[1]);const b=w.balls.find(b=>b.id===1),d=P.unit(p.x-390,p.y-1000);Object.assign(b,{x:p.x-d.x*150,y:p.y-d.y*150,vx:d.x*700,vy:d.y*700});w.moving=true;stop(w);assert.ok(b.pocketed,JSON.stringify(p));assert.deepEqual(w.potted,[1]);}
});
test('undo snapshot restores positions, pocketed state and counters',()=>{
  const w=new P.World(),before=w.snapshot();w.shoot(-Math.PI/2,560);stop(w);w.restore(before);assert.deepEqual(w.snapshot(),before);assert.equal(w.moving,false);
});
test('placement refuses overlap, rails and moving shots',()=>{
  const w=new P.World(),other=w.balls.find(b=>b.id===1);assert.equal(w.place(0,other.x,other.y),false);assert.equal(w.place(0,20,500),false);assert.ok(w.place(0,390,1200));w.shoot(-Math.PI/2,240);assert.equal(w.place(0,400,1200),false);assert.equal(w.shoot(0,400),false);
});
test('backspin pulls the cue back after object contact',()=>{
  const w=new P.World();isolate(w,[0,1]);Object.assign(w.balls[0],{x:390,y:1000});Object.assign(w.balls.find(b=>b.id===1),{x:390,y:870});w.shoot(-Math.PI/2,520,{x:0,y:.85});let pulled=false;for(let i=0;i<200;i++){w.step();if(w.contact&&w.balls[0].vy>10){pulled=true;break;}}assert.ok(pulled);
});

test('new racks centre the cue, randomize legally and produce varied breaks',()=>{
  let seed=19;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  const layouts=new Set(),breaks=new Set();
  for(let i=0;i<20;i++){
    const balls=P.rack(random);assert.equal(balls[0].x,390);assert.equal(balls[0].y,1315);
    assert.equal(balls[5].id,8);assert.ok((balls[11].id<8)!==(balls[15].id<8));
    assert.equal(new Set(balls.map(b=>b.id)).size,16);
    for(let a=0;a<balls.length;a++)for(let b=a+1;b<balls.length;b++)assert.ok(Math.hypot(balls[a].x-balls[b].x,balls[a].y-balls[b].y)>=2*P.R);
    layouts.add(balls.map(b=>b.id).join(','));
    const w=new P.World(()=>{},{balls,shots:0,potted:[]});w.shoot(-Math.PI/2,800);stop(w);breaks.add(JSON.stringify(w.snapshot().balls.map(b=>[b.id,b.x,b.y])));
  }
  assert.equal(layouts.size,20);assert.equal(breaks.size,20);
});

function verifyPrediction(w,angle,force,english={x:0,y:0}){
  const before=w.snapshot(),prediction=P.predict(before,angle,force,english);
  assert.ok(prediction.complete);assert.deepEqual(w.snapshot(),before,'preview must not mutate live state');
  w.shoot(angle,force,english);stop(w);
  assert.deepEqual(w.snapshot(),prediction.final,'every ball and pocket result must be identical');
  return prediction;
}
test('preview matches live play across powers, multi-cushion routes, spins and full racks',()=>{
  for(const force of [1,80,200,400,600,800])for(const [x,y,angle] of [[528,560,1.76],[140,1125,.96],[390,1315,-Math.PI/2]]){
    const w=new P.World();w.place(0,x,y);
    verifyPrediction(w,angle,force,{x:.7,y:-.85});
  }
  for(const y of [-1.275,0,1.275])verifyPrediction(new P.World(),-Math.PI/2,800,{x:-.8,y});
});
test('long preview has no 2050-unit cutoff; lower force ends at its actual stop',()=>{
  const w=new P.World();isolate(w,[0]);Object.assign(w.balls[0],{x:535,y:540});
  const high=P.predict(w.snapshot(),1.76,800),low=P.predict(w.snapshot(),1.76,200);
  const length=p=>p.paths[0].points.slice(1).reduce((sum,q,i)=>sum+Math.hypot(q.x-p.paths[0].points[i].x,q.y-p.paths[0].points[i].y),0);
  assert.ok(length(high)>2050);assert.ok(length(low)<length(high));
  assert.deepEqual(high.paths[0].points.at(-1),{x:high.final.balls[0].x,y:high.final.balls[0].y});
  verifyPrediction(w,1.76,800);
});
test('all six pocket predictions agree with actual capture, including scratch respawn',()=>{
  for(const pocket of P.POCKETS){
    const w=new P.World();isolate(w,[0]);const d=P.unit(pocket.x-390,pocket.y-1000);
    Object.assign(w.balls[0],{x:pocket.x-d.x*160,y:pocket.y-d.y*160});
    const p=verifyPrediction(w,Math.atan2(d.y,d.x),400);
    assert.ok(p.scratch);assert.equal(p.paths[0].pocket.x,pocket.x);assert.equal(p.paths[0].pocket.y,pocket.y);
    assert.notDeepEqual(p.paths[0].points.at(-1),{x:p.final.balls[0].x,y:p.final.balls[0].y},'pocket path must not include the respawn teleport');
  }
});
test('force is clamped to 800 and zero never shoots',()=>{
  const w=new P.World(),snap=w.snapshot();assert.equal(w.shoot(0,0),false);
  const a=P.predict(snap,0,800),b=P.predict(snap,0,1600);assert.deepEqual(a.final,b.final);
});
test('raised side spin bends left/right progressively through 90 degrees; centre and flat cue stay straight',()=>{
  function travel(x,elevation){const w=new P.World();isolate(w,[0]);Object.assign(w.balls[0],{x:390,y:1200});w.shoot(-Math.PI/2,200,{x,y:0,elevation});for(let i=0;i<120;i++)w.step();return w.balls[0];}
  assert.ok(Math.abs(travel(1,0).x-390)<1e-8);assert.ok(Math.abs(travel(0,90).x-390)<1e-8);
  let previous=0;for(const elevation of [30,60,90]){const right=travel(1,elevation),left=travel(-1,elevation);assert.ok(right.x-390>previous);previous=right.x-390;assert.ok(Math.abs(right.x+left.x-780)<1e-7);assert.ok(Math.abs(right.y-left.y)<1e-7);}
  assert.ok(previous>40,'maximum raised side spin should produce a visibly curved route');
});
test('full high/low spin is stronger than half spin and reverses/follows after contact',()=>{
  function contact(y){const w=new P.World();isolate(w,[0,1]);Object.assign(w.balls[0],{x:390,y:1200});Object.assign(w.balls.find(b=>b.id===1),{x:390,y:1000});w.shoot(-Math.PI/2,600,{x:0,y});for(let i=0;i<7200&&!w.contact;i++)w.step();assert.ok(w.contact);return {velocity:w.balls[0].vy,launch:w.launchSpeed};}
  for(const sign of [-1,1]){const full=contact(sign),half=contact(sign*.5);assert.ok(full.velocity*sign>0);assert.ok(Math.abs(full.velocity)>(sign>0?.48:.33)*full.launch);assert.ok(Math.abs(full.velocity)>1.6*Math.abs(half.velocity));}
});
test('draw contribution keeps the previous force-700 strength and cannot increase above it',()=>{
  for(const elevation of [0,60,90]){
    const contributions=[];
    for(const force of [600,700,750,800]){
      let afterCollision=0;const w=new P.World(type=>{if(type==='cue-contact')afterCollision=w.balls[0].vy;});
      isolate(w,[0,1]);Object.assign(w.balls[0],{x:390,y:1200});Object.assign(w.balls.find(b=>b.id===1),{x:390,y:1000});
      w.shoot(-Math.PI/2,force,{x:0,y:1,elevation});for(let i=0;i<7200&&!w.contact;i++)w.step();assert.ok(w.contact);
      const contribution=w.balls[0].vy+250*P.STEP-afterCollision;contributions.push(contribution);
      if(force===700)assert.ok(Math.abs(contribution-w.launchSpeed*.55)<1e-7,'existing 700-force draw strength must be preserved');
    }
    assert.ok(contributions[0]<contributions[1]);assert.ok(Math.abs(contributions[2]-contributions[1])<1e-7);assert.ok(Math.abs(contributions[3]-contributions[1])<1e-7);
  }
});
test('topspin absorbs cushion rebound without losing the along-cushion direction or adding energy',()=>{
  function rebound(y){let hit=null;const w=new P.World(type=>{if(type==='rail-contact'&&!hit)hit={vx:w.balls[0].vx,vy:w.balls[0].vy};});
    isolate(w,[0]);Object.assign(w.balls[0],{x:550,y:1300});const preview=P.predict(w.snapshot(),-Math.PI/6,500,{x:0,y});
    w.shoot(-Math.PI/6,500,{x:0,y});for(let i=0;i<7200&&!hit&&w.moving;i++)w.step();assert.ok(hit);stop(w);assert.deepEqual(w.snapshot(),preview.final);return hit;}
  const neutral=rebound(0),half=rebound(-.5),high=rebound(-1);
  assert.ok(high.vx<0);assert.ok(Math.abs(high.vx)<Math.abs(neutral.vx)*.3);
  assert.ok(Math.abs(high.vx)<Math.abs(half.vx));assert.ok(Math.abs(half.vx)<Math.abs(neutral.vx));
  assert.ok(Math.abs(high.vy-neutral.vy)<1e-7,'retain motion parallel to the cushion');assert.ok(Math.hypot(high.vx,high.vy)<Math.hypot(neutral.vx,neutral.vy));
});
test('elevated curved previews settle exactly like live shots and select the first actual target',()=>{
  for(const elevation of [30,60,90])for(const x of [-.8,.8])for(const force of [200,400,800]){
    const w=new P.World();verifyPrediction(w,-Math.PI/2,force,{x,y:.4,elevation});
  }
  const w=new P.World();isolate(w,[0,1,2]);Object.assign(w.balls[0],{x:390,y:1200});Object.assign(w.balls.find(b=>b.id===1),{x:390,y:1000});Object.assign(w.balls.find(b=>b.id===2),{x:390,y:800});
  const p=P.predict(w.snapshot(),-Math.PI/2,800);assert.equal(p.firstTargetId,1);assert.ok(p.paths.some(t=>t.id===2));assert.equal(P.predict(w.snapshot(),-Math.PI/2,80).firstTargetId,null);
});

test('every live step stays on the rendered preview, including pocket jaws and spin',()=>{
  const distance=(p,a,b)=>{
    const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
    return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
  };
  for(const [x,y,angle,force,spin] of [[535,540,1.76,800,{x:0,y:0}],[140,1125,.96,640,{x:.7,y:1.1}],[390,1315,-Math.PI/2,800,{x:0,y:0}],[390,1315,-Math.PI/2,800,{x:.8,y:.4,elevation:90}],[390,1315,-Math.PI/2,400,{x:-.8,y:-.4,elevation:60}]]){
    const captured=new Set(),w=new P.World((type,id)=>{if(type==='pocket')captured.add(id);});w.place(0,x,y);
    const p=P.predict(w.snapshot(),angle,force,spin),tracks=new Map(p.paths.map(t=>[t.id,t.points]));
    w.shoot(angle,force,spin);
    for(let i=0;i<7200&&w.moving;i++){
      w.step();
      for(const b of w.balls){
        const points=tracks.get(b.id);if(!points||captured.has(b.id))continue;
        let error=Infinity;for(let j=1;j<points.length;j++)error=Math.min(error,distance(b,points[j-1],points[j]));
        assert.ok(error<=.120001,`ball ${b.id}, step ${i}, drawing error ${error}`);
      }
    }
    assert.equal(w.moving,false);assert.deepEqual(w.snapshot(),p.final);
  }
});
