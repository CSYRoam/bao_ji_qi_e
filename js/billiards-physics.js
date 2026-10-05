/* Classic eight-ball practice: deterministic fixed-step simulation and shared aim geometry. */
(function (root) {
  'use strict';
  const R = 19, STEP = 1 / 240, MAX_POWER = 800;
  const FIELD = { left: 84, right: 696, top: 391, bottom: 1608 };
  const POCKETS = [{x:73,y:375},{x:707,y:375},{x:63,y:1000},{x:717,y:1000},{x:73,y:1625},{x:707,y:1625}];
  const rails = [
    [132,391,648,391], [132,1608,648,1608],
    [84,431,84,955], [84,1045,84,1569], [696,431,696,955], [696,1045,696,1569],
    [110,368,132,391], [84,431,62,409], [648,391,670,368], [696,431,718,409],
    [84,955,63,971], [84,1045,63,1029], [696,955,717,971], [696,1045,717,1029],
    [84,1569,62,1591], [132,1608,110,1630], [696,1569,718,1591], [648,1608,670,1630]
  ].map(([ax,ay,bx,by]) => ({ax,ay,bx,by}));
  const dot = (a,b) => a.x*b.x+a.y*b.y;
  const unit = (x,y) => {const d=Math.hypot(x,y)||1; return {x:x/d,y:y/d};};
  const ball = (id,x,y) => ({id,x,y,vx:0,vy:0,pocketed:false,roll:0,spin:0,curve:0,topspin:0});
  function rack(random=Math.random) {
    const balls=[ball(0,390,1315)];
    // Apex faces the cue ball; eight in the centre, opposite groups in rear corners.
    const shuffle=items=>{for(let i=items.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items;};
    const solids=shuffle([1,2,3,4,5,6,7]),stripes=shuffle([9,10,11,12,13,14,15]);
    const corners=random()<.5?[solids.pop(),stripes.pop()]:[stripes.pop(),solids.pop()];
    const remaining=shuffle([...solids,...stripes]);
    const order=Array.from({length:15},(_,i)=>i===4?8:i===10?corners[0]:i===14?corners[1]:remaining.pop());
    // Small legal racking gaps vary each new rack. Once placed, all shot physics
    // remains deterministic, including prediction, play and undo.
    const spacing=2*R+.3+random()*.5;
    const rowSpacing=Math.sqrt(3)*(R+.4+random()*.25);
    let i=0;
    for(let row=0;row<5;row++) for(let col=0;col<=row;col++) {
      balls.push(ball(order[i++],390+(col-row/2)*spacing,696-row*rowSpacing));
    }
    return balls;
  }
  function nearestPoint(b,s) {
    const dx=s.bx-s.ax,dy=s.by-s.ay;
    const t=Math.max(0,Math.min(1,((b.x-s.ax)*dx+(b.y-s.ay)*dy)/(dx*dx+dy*dy)));
    return {x:s.ax+dx*t,y:s.ay+dy*t};
  }
  class World {
    constructor(onEvent=()=>{},snapshot=null) {this.onEvent=onEvent;if(snapshot)this.restore(snapshot);else this.reset();}
    reset() {this.balls=rack();this.shots=0;this.moving=false;this.scratch=false;this.contact=false;this.english={x:0,y:0};this.launchSpeed=0;this.potted=[];}
    snapshot() {return {balls:this.balls.map(b=>({...b})),shots:this.shots,potted:[...this.potted]};}
    restore(s) {this.balls=s.balls.map(b=>({...b,vx:0,vy:0}));this.shots=s.shots;this.potted=[...s.potted];this.moving=false;this.scratch=false;this.contact=false;}
    canPlace(id,x,y) {return x>=FIELD.left+R && x<=FIELD.right-R && y>=FIELD.top+R && y<=FIELD.bottom-R && this.balls.every(b=>b.id===id||b.pocketed||Math.hypot(x-b.x,y-b.y)>=2*R+.3);}
    place(id,x,y) {const b=this.balls.find(b=>b.id===id);if(this.moving||!b||!this.canPlace(id,x,y))return false;b.x=x;b.y=y;b.pocketed=false;b.vx=b.vy=0;return true;}
    shoot(angle,power,english={x:0,y:0}) {
      const cue=this.balls[0];
      if(this.moving||cue.pocketed||!Number.isFinite(angle)||!Number.isFinite(power)||power<=0)return false;
      const force=Math.max(1,Math.min(MAX_POWER,Math.round(power)));
      const x=Number.isFinite(english.x)?english.x:0,y=Number.isFinite(english.y)?english.y:0,length=Math.max(1,Math.hypot(x,y));
      const elevation=Math.max(0,Math.min(90,Number(english.elevation)||0)),lift=Math.sin(elevation*Math.PI/180)**2;
      const speed=2240*Math.pow(force/MAX_POWER,1.18)*(1-.32*lift);
      cue.vx=Math.cos(angle)*speed;cue.vy=Math.sin(angle)*speed;cue.spin=x/length;
      // Raised cue plus side spin bends the travelling cue ball. Integrating the
      // same turn in predict() and live play keeps every curved preview aligned.
      cue.curve=cue.spin*lift*2.4;
      cue.topspin=Math.max(0,-y/length);
      // Cap only the draw-back contribution; normal launch speed still reaches
      // force 800. Preserve the existing full-low, force-700 reference strength.
      this.drawSpeed=2240*Math.pow(Math.min(force,700)/MAX_POWER,1.18)*(1-.32*lift);
      this.launchSpeed=speed;this.english={x:x/length,y:y/length,elevation};this.contact=false;this.moving=true;this.scratch=false;this.shots++;
      this.onEvent('strike',force/MAX_POWER);return true;
    }
    step(dt=STEP) {
      if(!this.moving)return;
      for(const b of this.balls) {
        if(b.pocketed)continue;
        if(b.topspin)b.topspin*=Math.exp(-dt*.12);
        if(b.id===0&&b.curve){
          const turn=b.curve*dt*Math.min(1,Math.hypot(b.vx,b.vy)/180),c=Math.cos(turn),s=Math.sin(turn),vx=b.vx;
          b.vx=vx*c-b.vy*s;b.vy=vx*s+b.vy*c;b.curve*=Math.exp(-dt*.7);
        }
        b.x+=b.vx*dt;b.y+=b.vy*dt;b.roll+=Math.hypot(b.vx,b.vy)*dt/R;
        const pocket=POCKETS.find(p=>Math.hypot(b.x-p.x,b.y-p.y)<31);
        if(pocket) {
          b.pocketed=true;b.vx=b.vy=0;
          if(b.id===0)this.scratch=true;else this.potted.push(b.id);
          this.onEvent('pocket',b.id,{x:b.x,y:b.y,pocket});continue;
        }
        for(const s of rails) {
          const p=nearestPoint(b,s),dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy);
          if(d>=R||d<.0001)continue;
          const nx=dx/d,ny=dy/d,vn=b.vx*nx+b.vy*ny;
          b.x+=nx*(R-d+.005);b.y+=ny*(R-d+.005);
          if(vn<0) {
            // Topspin absorbs the velocity into the cushion while retaining
            // travel along it. Consume it on contact, never attract the ball.
            const restitution=.8*(1-.88*(b.topspin||0));
            b.vx-=(1+restitution)*vn*nx;b.vy-=(1+restitution)*vn*ny;
            b.topspin*=.35;
            const spin=(b.spin||0)*Math.min(100,Math.abs(vn)*.14);
            b.vx+=-ny*spin;b.vy+=nx*spin;b.spin*=.6;
            b.curve*=.45;
            this.onEvent('rail-contact',b.id,{x:b.x,y:b.y});
            if(vn < -40)this.onEvent('cushion',Math.min(1,-vn/1200));
          }
        }
        // Catch a ball beyond a pocket mouth, including rare numerical edge cases.
        if(b.x<28||b.x>752||b.y<333||b.y>1667) {
          b.pocketed=true;b.vx=b.vy=0;
          if(b.id===0)this.scratch=true;else this.potted.push(b.id);
          this.onEvent('pocket',b.id,{x:b.x,y:b.y,pocket:POCKETS.reduce((p,q)=>Math.hypot(b.x-p.x,b.y-p.y)<Math.hypot(b.x-q.x,b.y-q.y)?p:q)});
        }
      }
      for(let i=0;i<this.balls.length;i++)for(let j=i+1;j<this.balls.length;j++) {
        const a=this.balls[i],b=this.balls[j];if(a.pocketed||b.pocketed)continue;
        let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
        if(d>=2*R)continue;
        if(d<.00001){dx=.00001;dy=0;d=.00001;}
        const nx=dx/d,ny=dy/d,overlap=(2*R-d+.005)/2;
        a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
        const relative=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
        if(relative<=0)continue;
        const impulse=relative*.97;
        a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;
        this.onEvent('ball-contact',a.id,{a:{id:a.id,x:a.x,y:a.y},b:{id:b.id,x:b.x,y:b.y}});
        if(a.id===0||b.id===0){const cue=a.id===0?a:b,target=a.id===0?b:a;this.onEvent('cue-contact',0,{x:cue.x,y:cue.y,target:{id:target.id,x:target.x,y:target.y}});}
        if(!this.contact&&(a.id===0||b.id===0)) {
          const cue=a.id===0?a:b,sign=a.id===0?1:-1;
          const vertical=this.english.y||0;
          const follow=-vertical*(vertical>0?this.drawSpeed*.55:this.launchSpeed*.38);
          cue.curve*=.3;
          cue.vx+=nx*follow*sign;cue.vy+=ny*follow*sign;this.contact=true;
        }
        if(relative>35)this.onEvent('collision',Math.min(1,relative/1400));
      }
      let moving=false;
      for(const b of this.balls) {
        if(b.pocketed)continue;
        const speed=Math.hypot(b.vx,b.vy),next=Math.max(0,speed-250*dt);
        if(next<3){b.vx=b.vy=0;b.curve=0;b.topspin=0;}
        else {b.vx*=next/speed;b.vy*=next/speed;moving=true;}
      }
      this.moving=moving;
      if(!moving) {
        if(this.scratch) {
          const cue=this.balls[0];let done=false;
          for(let y=1315;y>=440&&!done;y-=42)for(let x=294;x<=665;x+=42) {
            if(this.canPlace(0,x,y)){cue.x=x;cue.y=y;cue.pocketed=false;done=true;break;}
          }
        }
        this.onEvent('settled',this.scratch);
      }
    }
  }
  function rayCircle(p,d,c,r) {
    const ox=p.x-c.x,oy=p.y-c.y,b=ox*d.x+oy*d.y,q=ox*ox+oy*oy-r*r,disc=b*b-q;
    if(disc<0)return Infinity;
    const t=-b-Math.sqrt(disc);return t>.02?t:Infinity;
  }
  function rayRail(p,d,s) {
    let result=null;
    const tangent=unit(s.bx-s.ax,s.by-s.ay),n={x:-tangent.y,y:tangent.x};
    const den=dot(d,n),length=Math.hypot(s.bx-s.ax,s.by-s.ay);
    if(Math.abs(den)>1e-7)for(const side of [-1,1]) {
      const t=(R*side-(p.x-s.ax)*n.x-(p.y-s.ay)*n.y)/den;
      const along=(p.x+d.x*t-s.ax)*tangent.x+(p.y+d.y*t-s.ay)*tangent.y;
      if(t>.02&&along>=0&&along<=length&&den*side<0&&(!result||t<result.t))result={t,n:{x:n.x*side,y:n.y*side}};
    }
    for(const c of [{x:s.ax,y:s.ay},{x:s.bx,y:s.by}]) {
      const t=rayCircle(p,d,c,R);
      if(Number.isFinite(t)&&(!result||t<result.t))result={t,n:unit(p.x+d.x*t-c.x,p.y+d.y*t-c.y)};
    }
    return result;
  }
  function trace(balls,origin,direction,maxBounces=0,ignore=0,maxLength=2400) {
    let p={...origin},d=unit(direction.x,direction.y),left=maxLength;const segments=[];
    for(let bounce=0;bounce<=maxBounces;bounce++) {
      let hit={t:left,type:'end'};
      for(const b of balls)if(!b.pocketed&&b.id!==ignore) {const t=rayCircle(p,d,b,2*R);if(t<hit.t)hit={t,type:'ball',ball:b};}
      for(const s of rails) {const h=rayRail(p,d,s);if(h&&h.t<hit.t)hit={...h,type:'rail'};}
      for(const pocket of POCKETS) {const t=rayCircle(p,d,pocket,26);if(t<hit.t)hit={t,type:'pocket',pocket};}
      const end={x:p.x+d.x*hit.t,y:p.y+d.y*hit.t};
      segments.push({start:{...p},end,...hit,direction:{...d}});left-=hit.t;
      if(hit.type!=='rail'||left<1)break;
      const vn=dot(d,hit.n);d={x:d.x-2*vn*hit.n.x,y:d.y-2*vn*hit.n.y};p={x:end.x+d.x*.1,y:end.y+d.y*.1};
    }
    return segments;
  }
  // Reduce only drawing vertices, with a sub-pixel tolerance; final positions and
  // pocket decisions are taken from the full fixed-step simulation unchanged.
  function simplify(points,tolerance=.12) {
    if(points.length<3)return points;
    const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];
    while(stack.length){
      const [first,last]=stack.pop(),a=points[first],b=points[last];
      const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;let best=tolerance*tolerance,index=-1;
      for(let i=first+1;i<last;i++){
        const p=points[i],t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
        const distance=(p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2;
        if(distance>best){best=distance;index=i;}
      }
      if(index!==-1){keep.add(index);stack.push([first,index],[index,last]);}
    }
    return [...keep].sort((a,b)=>a-b).map(i=>points[i]);
  }
  function predict(snapshot,angle,power,english={x:0,y:0}) {
    const tracks=new Map(snapshot.balls.filter(b=>!b.pocketed).map(b=>[b.id,{id:b.id,points:[{x:b.x,y:b.y}],pocket:null}]));
    const cue=snapshot.balls.find(b=>b.id===0),normalPoints=[{x:cue.x,y:cue.y}];
    let normalDone=false,normalCushions=0,normalEnd='stop';
    let normalContact=null,firstTargetId=null;
    // Keep only the first target and a short cue-ball separation branch. These
    // are sampled from the same simulation, including spin and speed loss.
    function branch(ball,maxLength,maxCushions){return {id:ball.id,points:[{x:ball.x,y:ball.y}],length:0,maxLength,cushions:0,maxCushions,done:false};}
    function appendBranch(track,p){
      if(track.done)return;
      const last=track.points[track.points.length-1],dx=p.x-last.x,dy=p.y-last.y,d=Math.hypot(dx,dy);
      if(d<1e-9)return;
      const remaining=track.maxLength-track.length,t=Math.min(1,remaining/d);
      track.points.push({x:last.x+dx*t,y:last.y+dy*t});track.length+=d*t;
      if(d>=remaining)track.done=true;
    }
    const events=[];
    const simulation=new World((type,value,extra)=>{
      if(type==='cue-contact'&&firstTargetId===null)firstTargetId=extra.target.id;
      if(normalContact)for(const track of [normalContact.target,normalContact.cue]){
        if(type==='ball-contact'){
          const ball=[extra.a,extra.b].find(b=>b.id===track.id);
          if(ball){appendBranch(track,ball);track.done=true;}
        }
        if(value===track.id&&(type==='rail-contact'||type==='pocket')){
          appendBranch(track,extra);
          if(type==='pocket'||++track.cushions>=track.maxCushions)track.done=true;
        }
      }
      if(!normalDone&&value===0){
        if(type==='rail-contact')normalCushions++;
        if(type==='cue-contact'||type==='pocket'||(type==='rail-contact'&&normalCushions===4)){
          normalPoints.push({x:extra.x,y:extra.y});normalDone=true;
          normalEnd=type==='cue-contact'?'ball':type==='pocket'?'pocket':'four-cushions';
          if(type==='cue-contact')normalContact={point:{x:extra.x,y:extra.y},target:branch(extra.target,550,2),cue:branch({id:0,x:extra.x,y:extra.y},190,4-normalCushions)};
        }
      }
      if(type==='pocket'){
        const track=tracks.get(value);track.points.push({x:extra.x,y:extra.y});track.pocket={...extra.pocket};
        events.push({type,id:value,x:extra.x,y:extra.y,pocket:{...extra.pocket}});
      }
    },snapshot);
    simulation.shoot(angle,power,english);
    let steps=0;
    while(simulation.moving&&steps<240*30){
      simulation.step();steps++;
      if(!normalDone){const b=simulation.balls.find(b=>b.id===0);normalPoints.push({x:b.x,y:b.y});}
      if(normalContact)for(const track of [normalContact.target,normalContact.cue]){
        const b=simulation.balls.find(b=>b.id===track.id);
        if(!b.pocketed){appendBranch(track,b);if(b.vx===0&&b.vy===0)track.done=true;}
      }
      for(const b of simulation.balls){
        const track=tracks.get(b.id);if(!track||track.pocket)continue;
        const previous=track.points[track.points.length-1];
        if(b.x!==previous.x||b.y!==previous.y)track.points.push({x:b.x,y:b.y});
      }
    }
    return {power:Math.max(0,Math.min(MAX_POWER,Math.round(power))),steps,complete:!simulation.moving,
      normalCue:{points:simplify(normalPoints),cushions:normalCushions,end:normalEnd},
      firstTargetId,
      normalContact:normalContact&&{point:normalContact.point,target:{id:normalContact.target.id,points:simplify(normalContact.target.points)},cue:{id:0,points:simplify(normalContact.cue.points)}},
      paths:[...tracks.values()].filter(t=>t.points.length>1).map(t=>({...t,points:simplify(t.points)})),
      final:simulation.snapshot(),scratch:simulation.scratch,events};
  }
  const api={World,R,STEP,MAX_POWER,FIELD,POCKETS,rails,rack,trace,predict,unit};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BilliardsPhysics=api;
})(typeof window==='object'?window:globalThis);
