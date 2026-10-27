'use strict';
/* ================= Game state ================= */
const G={mode:'menu',flags:[],round:1,score:[0,0],timeLeft:900,waveT:[0,0],waveInt:[11,13],introT:0,endT:0,artyT:40,ambT:0,demo:false,paused:false,winner:-1,shipT:3,planeT:30};
const stats={shots:0};
const ROUND_TIME=900;

/* ---- flags ---- */
function flagCanvas(team,w,h){
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  if(team===0){for(let i=0;i<13;i++){g.fillStyle=i%2?'#ece5d6':'#a8232f';g.fillRect(0,i*h/13,w,h/13+1);}
    const cw=w*.42,ch=h*7/13;g.fillStyle='#283063';g.fillRect(0,0,cw,ch);g.fillStyle='#ece5d6';const r=Math.max(1,w/90);
    for(let row=0;row<6;row++)for(let col=0;col<8;col++){g.beginPath();g.arc(cw*(col+.5)/8,ch*(row+.5)/6,r,0,TAU);g.fill();}}
  else if(team===1){g.fillStyle='#6b6f63';g.fillRect(0,0,w,h);const cx=w/2,cy=h/2,s=h*.36;
    g.fillStyle='#fff';g.fillRect(cx-s,cy-s*.32,s*2,s*.64);g.fillRect(cx-s*.32,cy-s,s*.64,s*2);
    g.fillStyle='#111';g.fillRect(cx-s*.8,cy-s*.18,s*1.6,s*.36);g.fillRect(cx-s*.18,cy-s*.8,s*.36,s*1.6);}
  else{g.fillStyle='#e8e4da';g.fillRect(0,0,w,h);g.strokeStyle='rgba(0,0,0,.15)';g.strokeRect(1,1,w-2,h-2);}
  return c;
}
const FLAG_TEX=[0,1,-1].reduce((o,t)=>{const tx=new THREE.CanvasTexture(flagCanvas(t,256,168));tx.encoding=THREE.sRGBEncoding;o[t]=tx;return o;},{});
function buildFlags(){
  G.flags=FLAG_DEFS.map((d,i)=>{
    const y=groundAt(d.x,d.z,99,.1);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.06,7.5,8),MAT.metal);pole.position.set(d.x,y+3.75,d.z);pole.castShadow=true;scene.add(pole);
    const knob=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),MAT.metal);knob.position.set(d.x,y+7.55,d.z);scene.add(knob);
    const base=new THREE.Mesh(boxGeo(.7,.3,.7),MAT.concrete);base.position.set(d.x,y+.1,d.z);scene.add(base);
    const fg=new THREE.PlaneGeometry(1.7,1.12,14,9);fg.translate(.85,0,0);
    const cloth=new THREE.Mesh(fg,new THREE.MeshStandardMaterial({map:FLAG_TEX[d.start],side:THREE.DoubleSide,roughness:.9}));cloth.castShadow=true;scene.add(cloth);
    // ring on the ground showing the capture area
    const ring=new THREE.Mesh(new THREE.RingGeometry(d.r-.15,d.r,48),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.0,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(d.x,y+.2,d.z);scene.add(ring);
    return Object.assign({},d,{i,owner:d.start,prog:0,capTeam:-1,y,cloth,base:Float32Array.from(fg.attributes.position.array),height:1,ring,n:[0,0],shownTex:d.start});
  });
}
function resetFlags(){for(const f of G.flags){f.owner=f.start;f.prog=0;f.capTeam=-1;f.height=1;setFlagTex(f,f.owner);}}
function setFlagTex(f,t){if(f.shownTex!==t){f.shownTex=t;f.cloth.material.map=FLAG_TEX[t];f.cloth.material.needsUpdate=true;}}
function updateFlags(dt){
  for(const f of G.flags){
    const n=[0,0];const inside=[[],[]];
    for(const u of UNITS){if(!u.alive)continue;if(Math.hypot(u.pos.x-f.x,u.pos.z-f.z)<f.r&&Math.abs(u.pos.y-f.y)<6){n[u.team]++;inside[u.team].push(u);}}
    f.n=n;
    if((G.mode==='play'||G.mode==='demo')&&!Net.client){
      const t=n[0]&&!n[1]?0:n[1]&&!n[0]?1:-1;
      if(t>=0&&f.owner!==t){
        if(f.capTeam!==t&&f.prog>0)f.prog=Math.max(0,f.prog-dt/4);
        else{f.capTeam=t;const rate=(1/8)*Math.min(2.5,1+.5*(n[t]-1));f.prog+=dt*rate;
          if(f.prog>=1)captureFlag(f,t,inside[t]);}
      }else if(t<0&&n[0]&&n[1]){/* contested: hold */}
      else f.prog=Math.max(0,f.prog-dt*.12);
    }
    // the cloth slides down as it is being taken, then the new one goes up
    const target=f.prog>0?1-f.prog:1;f.height=lerp(f.height,target,1-Math.exp(-dt*6));
    const pos=f.cloth.geometry.attributes.position,b=f.base,T=GAME.time;
    for(let i=0;i<pos.count;i++){const x=b[i*3],y=b[i*3+1];const w=x/1.7;pos.setXYZ(i,x,y-w*w*.1,Math.sin(T*5-x*3.3+y*.8)*.13*w+Math.sin(T*2.1-x*1.4)*.06*w);}
    pos.needsUpdate=true;f.cloth.geometry.computeVertexNormals();
    f.cloth.position.set(f.x+.06,f.y+1.4+5.4*f.height,f.z);f.cloth.rotation.y=Math.atan2(-wind.z,wind.x);
    const near=PL.u&&PL.u.alive&&Math.hypot(PL.u.pos.x-f.x,PL.u.pos.z-f.z)<f.r+12;f.ring.material.opacity=lerp(f.ring.material.opacity,near?.25:0,dt*4);
  }
}
function captureFlag(f,t,who){
  if(Net.host)Net.event(['cap',f.i,t,who.map(u=>u.id)]);
  const was=f.owner;f.owner=t;f.prog=0;f.capTeam=-1;setFlagTex(f,t);f.height=0;
  for(const u of who){u.caps++;u.score+=3;}
  const mine=PL.u&&who.includes(PL.u);
  feedMsg(`${TEAM_NAME[t]} captured the ${f.name}`,t);
  if(G.mode==='play'){
    const ours=PL.u&&PL.u.team===t;
    center(ours?`${f.name.toUpperCase()} TAKEN`:`${f.name.toUpperCase()} LOST`,mine?'+3 for the capture':`${TEAM_NAME[t]} hold the ${f.name}`,2.6);
    say(t===0?pick(['Area secured!','The '+f.name+' is ours!']):pick(['Stellung gesichert!','Wir haben die Stellung!']),{de:t===1,force:true,vol:.8,pitch:.8});
    playStab(ours);
  }
  checkWin();
}
function playStab(good){if(!AU.ctx||!MUS.gain&&!AU.music)return;const ctx=AU.ctx;const t=ctx.currentTime+.05;
  const g=ctx.createGain();g.gain.value=1;g.connect(AU.music);const prev=MUS.gain;MUS.gain=g;
  (good?[60,64,67]:[60,63,66]).forEach((m,k)=>note(t+k*.12,m+12,.5,{vol:.05,cut:1600,brass:true,vib:3}));note(t+.36,good?72:66,1.2,{vol:.05,cut:1500,brass:true,vib:4});
  MUS.gain=prev;}
function checkWin(){
  if(Net.client)return;
  if(G.mode!=='play'&&G.mode!=='demo')return;
  if(G.flags.every(f=>f.owner===0))endRound(0,'The Allies hold every flag. The beachhead is secure.');
  else if(G.flags.every(f=>f.owner===1))endRound(1,'The Axis threw the landing back into the sea.');
}

/* ================= Units, teams, spawning ================= */
const COMPOSITION={0:['rifleman','rifleman','rifleman','rifleman','rifleman','rifleman','staffsgt','staffsgt','mastersgt','mastersgt','sergeant','sergeant','support','support','sniper','mg','rifleman','staffsgt','mastersgt','support'],
  1:['grenadier','grenadier','grenadier','grenadier','grenadier','stoss','stoss','unteroffizier','unteroffizier','unteroffizier','sturm','sturm','sniper','mg42','mg34','grenadier','stoss','unteroffizier','sturm','grenadier']};
function clsById(team,id){return CLASSES[team].find(c=>c.id===id);}
function makeTeams(size,playerTeam,playerCls){
  for(const u of UNITS)if(u.model)scene.remove(u.model.root);
  UNITS.length=0;for(const m of CORPSES)scene.remove(m.root);CORPSES.length=0;
  for(let t=0;t<2;t++){
    const names=NAMES[t].slice().sort(()=>Math.random()-.5);
    const nb=playerTeam===t?size-1:size;
    for(let i=0;i<nb;i++){const u=new Unit(t,false,names[i%names.length]);u.cls=clsById(t,COMPOSITION[t][i%COMPOSITION[t].length]);new Brain(u);UNITS.push(u);}
  }
  if(playerTeam>=0){const u=new Unit(playerTeam,true,SET.name||'You');u.cls=playerCls;UNITS.push(u);PL.u=u;}else PL.u=null;
}
function zonePoint(z){for(let k=0;k<40;k++){const x=rand(z.x0,z.x1),zz=rand(z.z0,z.z1);if(walkable(x,zz))return{x,z:zz};}return{x:(z.x0+z.x1)/2,z:(z.z0+z.z1)/2};}
let boatSlot=0;
function boatPos(i,k){const b=BOATS[i];const lx=-.8+(k%2)*1.6,lz=-4.2+Math.floor(k/2)*1.75;return{x:b.home.x+lx,z:b.home.z+lz,lx,lz,b:i};}
// at: a position chosen by the host (multiplayer clients only)
function spawnUnit(u,initial,at){
  if(at&&at.cls)u.cls=clsById(u.team,at.cls)||u.cls;
  if(u.nextCls){u.cls=u.nextCls;u.nextCls=null;}
  giveLoadout(u);u.hp=100;u.alive=true;u.stance='stand';u.deployed=false;u.vel.set(0,0,0);u.stam=100;u.slowT=0;u.reloadT=0;u.lastHurt=-99;
  u.spawnProt=G.mode==='intro'?999:2;
  // old body stays where it fell
  if(u.model&&!CORPSES.includes(u.model))scene.remove(u.model.root);
  u.model=buildModel(u);
  let p;u.boat=null;
  if(at){p={x:at.x,z:at.z};u.yaw=at.yaw;if(at.b>=0)u.boat={b:at.b,lx:at.lx,lz:at.lz};}
  else if(u.team===0){
    const fwd=(G.flags[1].owner===0||G.flags[2].owner===0)&&!initial;
    if(fwd)p=zonePoint(SPAWNS.alliesFwd);
    else{const i=boatSlot%4,k=(boatSlot>>2)%8;boatSlot++;p=boatPos(i,k);u.boat=p;}
    u.yaw=Math.PI+rand(-.2,.2);
  }else{
    if(initial&&u.brain){u.brain.reset();u.brain.forceDefend=true;u.brain.chooseGoal();u.brain.forceDefend=false;const g=u.brain.goalPoint();
      p={x:g.x+rand(-.6,.6),z:g.z+rand(-.6,.6)};if(!walkable(p.x,p.z))p={x:g.x,z:g.z};}
    else p=zonePoint(G.flags[3].owner===1?SPAWNS.axisFwd:SPAWNS.axis);
    if(initial&&(u.isPlayer||u.remote)){const opts=PERCHES.filter(q=>q.team===1&&G.flags[q.flag].owner===1&&q.flag>0&&q.flag<3);const q=pick(opts.filter(o=>(u.cls.id.startsWith('mg'))===(o.role==='mg')))||pick(opts);p={x:q.x,z:q.z};}
    u.yaw=rand(-.2,.2);
  }
  u.pos.set(p.x,0,p.z);u.pos.y=at&&at.b<0?at.y:u.boat?BOATS[u.boat.b].g.position.y-.1:groundAt(p.x,p.z,H(p.x,p.z)+.2,.3);
  u.net={x:u.pos.x,y:u.pos.y,z:u.pos.z,yaw:u.yaw,pitch:0};u.pitch=0;
  if(Net.host)Net.event(['sp',u.id,r2(u.pos.x),r2(u.pos.y),r2(u.pos.z),r2(u.yaw),u.cls.id,u.boat?u.boat.b:-1,u.boat?u.boat.lx:0,u.boat?u.boat.lz:0]);
  if(u.brain&&!initial)u.brain.reset();
  if(u.brain&&initial&&u.team===0)u.brain.reset();
  updateHitSpheres(u);
  if(u.isPlayer){
    u.model.root.visible=false;PL.yaw=u.yaw+Math.PI;PL.pitch=0;PL.targetStance='stand';PL.stanceT=0;PL.ads=0;PL.reloadT=0;PL.switchT=0;PL.pendingW=null;PL.kickP=PL.kickY=0;
    PL.nadeHold=null;PL.eyeH=1.62;PL.sprinting=false;PL.mantle=null;
    buildVM(u.weps.primary.id,u.team);VM.g.visible=true;FX.hurt=0;FX.blur=0;FX.dark=0;$('center').innerHTML='';
  }
}
function updateUnits(dt){
  for(const u of UNITS){
    if(!u.alive){animModel(u,dt);continue;}
    if(u.spawnProt>0&&G.mode!=='intro')u.spawnProt-=dt;
    if(u.remote||(Net.client&&!u.isPlayer)){netFollow(u,dt);updateHitSpheres(u);animModel(u,dt);continue;}
    if(G.mode==='intro'){
      if(u.boat){const b=BOATS[u.boat.b];u.pos.set(b.g.position.x+u.boat.lx,b.g.position.y-.1,b.g.position.z+u.boat.lz);u.vel.set(0,0,0);}
      else if(u.brain){u.brain.perceive();if(u.brain.target){const t=u.brain.target;u.yaw+=angDiff(u.yaw,Math.atan2(t.pos.x-u.pos.x,t.pos.z-u.pos.z))*Math.min(1,dt*3);}
        const wantS=u.brain.role()==='mg'&&u.brain.goal&&u.brain.goal.perch&&u.brain.goal.perch.deployY?u.brain.deployStance(u.brain.goal.perch.deployY):u.brain.role()==='rifle'?'crouch':'prone';u.stance=wantS;}
    }else if(u.brain)updateBot(u,dt);
    updateHitSpheres(u);
    animModel(u,dt);
  }
  if(PL.u)updatePlayer(dt);
}

/* ================= Round flow ================= */
function resetRoundVisuals(){
  clearNades();clearDecals();smoke.clear();chunks.clear();glow.clear();
  for(const m of CORPSES)scene.remove(m.root);CORPSES.length=0;
  resetFlags();
  for(const b of BOATS){b.g.position.copy(b.home);if(!G.demo)b.g.position.z+=70;b.rp.rotation.x=G.demo?-1.62:0;b.rampT=undefined;}
  $('roundend').hidden=true;
}
function introCue(){
  if(G.demo||!PL.u)return;
  setLoop('engine',PL.u.team===0?.35:.05);
  if(PL.u.team===0){say('Thirty seconds! Check your weapons. Clear the ramp and get off the beach!',{force:true,pitch:.7,rate:1.05});center('H-HOUR','The landing craft are going in',4);}
  else{say('Achtung! Landungsboote! Alle Mann auf Gefechtsstation!',{de:true,force:true,pitch:.7});center('THEY ARE COMING','Hold your fire until they hit the beach',4);}
  stopMusic(2);
}
function startRound(){
  resetRoundVisuals();boatSlot=0;
  G.timeLeft=ROUND_TIME;G.waveT=[G.waveInt[0],G.waveInt[1]];G.winner=-1;G.artyT=rand(35,55);
  G.mode=G.demo?'demo':'intro';G.introT=G.demo?0:11;
  if(Net.host)Net.event(['rs',G.round]);
  for(const u of UNITS){u.alive=false;if(u.brain)u.brain.reset();}
  for(const u of UNITS)if(u.team===1)spawnUnit(u,true);
  for(const u of UNITS)if(u.team===0)spawnUnit(u,true);
  if(G.demo)for(const u of UNITS)u.spawnProt=0;
  introCue();
}
function endIntro(){
  if(Net.host)Net.event(['ie']);
  G.mode='play';setLoop('engine',0,1.5);
  for(const b of BOATS)b.rampT=0;
  play('ramp',{vol:PL.u&&PL.u.team===0?1:.3});
  for(const u of UNITS){u.spawnProt=u.team===0?1.5:0;}
  if(PL.u&&PL.u.team===0)setTimeout(()=>say('Move! Move! Get off the ramp!',{force:true,pitch:.8,rate:1.2}),900);
  G.ambT=0;if(SET.music)playMusic('tension');
}
function endRound(winner,why){
  if(G.mode==='roundEnd')return;
  if(Net.host)Net.event(['re',winner,why]);
  G.winner=winner;G.score[winner]++;G.mode=G.demo?'demo':'roundEnd';G.endT=9;
  if(G.demo){setTimeout(()=>{if(G.demo)startRound();},6000);return;}
  const won=PL.u&&PL.u.team===winner;
  $('reEye').textContent=`ROUND ${G.round} · ALLIES ${G.score[0]} – ${G.score[1]} AXIS`;
  $('reTitle').textContent=`${TEAM_NAME[winner].toUpperCase()} WIN`;$('reSub').textContent=why;
  $('roundend').hidden=false;playMusic(won?'win':'lose');
  say(winner===0?'The Allies have won the battle!':'Die Achsenmächte haben gesiegt!',{de:winner===1,force:true,pitch:.75});
}

/* ================= Waves ================= */
function updateWaves(dt){
  if(G.mode!=='play'&&G.mode!=='demo'||Net.client)return;
  for(let t=0;t<2;t++){G.waveT[t]-=dt;if(G.waveT[t]<=0){G.waveT[t]=G.waveInt[t];
    let n=0;for(const u of UNITS)if(u.team===t&&!u.alive&&GAME.time-u.deadAt>3){spawnUnit(u,false);n++;}
    if(n&&PL.u&&PL.u.alive&&PL.u.team===t&&t===0&&Math.random()<.4)setTimeout(()=>say(pick(LINES[0].move),{pitch:.8}),300);}}
}

/* ================= Artillery, ships, planes, ambience ================= */
const PENDING=[];
function later(t,fn){PENDING.push({t:GAME.time+t,fn});}
function updatePending(){for(let i=PENDING.length-1;i>=0;i--)if(PENDING[i].t<=GAME.time){const p=PENDING[i];PENDING.splice(i,1);p.fn();}}
function barrage(){
  // naval guns shell the Axis-held bluffs, or German batteries shell the beach
  const naval=Math.random()<.55;let cx,cz;
  if(naval){const tg=G.flags.filter(f=>f.owner===1&&f.tier<=2);if(!tg.length)return;const f=pick(tg);cx=f.x+rand(-25,25);cz=f.z+rand(-6,14);}
  else{const allies=UNITS.filter(u=>u.alive&&u.team===0&&u.pos.z>20);const a=allies.length?pick(allies):null;cx=a?a.pos.x+rand(-15,15):rand(-80,80);cz=a?a.pos.z+rand(-10,10):rand(60,140);}
  const n=randi(6,10);
  if(PL.u&&PL.u.alive&&Math.hypot(PL.u.pos.x-cx,PL.u.pos.z-cz)<45){hint(naval?'Naval gunfire incoming! Take cover!':'Incoming artillery! Get down!',3);say(naval?'Incoming! Navy is shelling the bluff!':'Incoming!',{force:true,pitch:.8});}
  for(let k=0;k<n;k++){const t=1+k*rand(.4,.9);const x=cx+rand(-14,14),z=cz+rand(-12,12);
    later(t,()=>{const y=H(x,z);Net.event(['whis',r2(x),r2(y+20),r2(z)]);play('whistle',{pos:new V3(x,y+20,z),vol:.75,travel:false,ref:25});later(1.75,()=>explosion(new V3(x,Math.max(y,-.2)+.2,z),2.2,null,'arty'));});}
  if(naval)for(const s of FLEET)if(s.kind!=='lst'&&Math.random()<.5)s.next=rand(0,1);
}
const shipFlash=[];
for(let i=0;i<4;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffd29a,blending:THREE.AdditiveBlending,fog:false,depthWrite:false,transparent:true}));s.scale.set(60,60,1);s.visible=false;scene.add(s);shipFlash.push({s,t:0});}
let flashI=0;
const PLANES=[];
{
  const m=new THREE.MeshStandardMaterial({color:C(0x3e4235),roughness:.7});
  for(let i=0;i<3;i++){const g=new THREE.Group();
    const add=(geo,x,y,z,rx=0,rz=0)=>{const me=new THREE.Mesh(geo,m);me.position.set(x,y,z);me.rotation.x=rx;me.rotation.z=rz;g.add(me);};
    add(Cz(.7,10,10),0,0,0);add(new THREE.BoxGeometry(12,.18,2.2),0,-.2,-1.2);add(new THREE.BoxGeometry(4.4,.14,1.2),0,.2,4.4);add(new THREE.BoxGeometry(.14,1.8,1.4),0,1,4.4);
    add(new THREE.CylinderGeometry(.85,.75,.8,12),0,0,-5.1,Math.PI/2);
    for(const s of[-1,1]){const st=new THREE.Mesh(new THREE.BoxGeometry(.6,.62,1.6),new THREE.MeshBasicMaterial({color:0xe8e6dc}));st.position.set(s*3.8,-.2,-1.2);g.add(st);}
    g.visible=false;scene.add(g);PLANES.push({g,v:new V3(),on:false});}
}
function flyover(){
  const x0=rand(-120,120),dir=Math.random()<.5?1:-1;
  PLANES.forEach((p,i)=>{p.on=true;p.g.visible=true;p.g.position.set(x0+i*16-16,rand(70,90),dir>0?700+i*20:-500-i*20);p.v.set(rand(-6,6),0,-dir*105);p.g.lookAt(p.g.position.clone().sub(p.v));});
  if(AU.ctx){const s=play('engine',{pos:PLANES[0].g.position.clone(),vol:1.2,rate:2.6,ref:60,travel:false,lpf:6000});}
  PLANES.snd=GAME.time;
}
function updateAmbient(dt){
  // ships fire the whole time
  for(const s of FLEET){if(s.kind==='lst')continue;s.next-=dt;if(s.next<=0){s.next=s.kind==='bb'?rand(6,16):rand(3,10);
    const f=shipFlash[flashI++%4];f.s.position.set(s.x,s.len*.12,s.z);f.t=.18;f.s.visible=true;
    const d=Math.hypot(s.x-camera.position.x,s.z-camera.position.z);play('distant',{vol:s.kind==='bb'?.6:.35,lpf:300,delay:d/343,travel:false,rev:.6});}}
  for(const f of shipFlash){if(f.t>0){f.t-=dt;f.s.material.opacity=Math.max(0,f.t/.18);}else f.s.visible=false;}
  // distant battle noise on the flanks
  G.ambT-=dt;if(G.ambT<=0){G.ambT=rand(.08,.9);const a=rand(0,TAU);const far=new V3(camera.position.x+Math.cos(a)*120,camera.position.y,camera.position.z+Math.sin(a)*120);
    if(Math.random()<.12)play('distant',{pos:far,vol:.35,lpf:220,travel:false,rev:.7});
    else play('g_'+pick(['mg42','garand','k98','bar','mg42','thompson']),{pos:far,vol:rand(.05,.14),lpf:rand(500,900),travel:false,rev:.6});}
  G.planeT-=dt;if(G.planeT<=0){G.planeT=rand(60,120);flyover();}
  for(const p of PLANES){if(!p.on)continue;p.g.position.addScaledVector(p.v,dt);if(Math.abs(p.g.position.z)>900){p.on=false;p.g.visible=false;}}
  // surf and wind follow the camera
  const sea=clamp(1-(140-camera.position.z)/120,0,1);setLoop('waves',.05+sea*.35,.5);
}

/* ================= HUD ================= */
function buildFlagHUD(){
  const bar=$('flagsBar');bar.innerHTML='';
  for(const f of G.flags){const d=document.createElement('div');d.className='fl';
    d.innerHTML=`<div class="ic"></div><span>${f.short}</span>`;const ic=d.firstChild;
    f.hc={el:d,ic,canv:{}};for(const t of[0,1,-1]){const c=flagCanvas(t,88,60);c.hidden=true;ic.appendChild(c);f.hc.canv[t]=c;}
    const pr=document.createElement('div');pr.className='pr';ic.appendChild(pr);f.hc.pr=pr;bar.appendChild(d);}
}
function updateHUD(dt){
  const u=PL.u;if(!u)return;
  for(const f of G.flags){const h=f.hc;for(const t of[0,1,-1])h.canv[t].hidden=t!==f.owner;h.pr.style.width=(f.prog*100)+'%';h.pr.style.background=f.capTeam===0?'#c9d48c':'#c0c8d2';h.el.classList.toggle('hot',f.prog>0);}
  $('room').textContent=Net.on&&Net.code?`ROOM ${Net.code} · ${Net.host?Net.conns.filter(c=>c.unit).length+1:UNITS.filter(x=>x.human||x.isPlayer).length} PLAYERS`+(Net.host?' · ESC TO INVITE':''):'';
  const m=Math.max(0,Math.ceil(G.timeLeft));$('timer').innerHTML=`${(m/60|0)}:${String(m%60).padStart(2,'0')}<small>ROUND ${G.round} · ${G.score[0]}–${G.score[1]}</small>`;
  if(u.alive){
    const W=curWD(),w=curW();
    $('hp').innerHTML=`${Math.ceil(u.hp)}<small>HP</small>`;$('hp').style.color=u.hp<35?'#e06a50':'';
    $('stam').style.width=u.stam+'%';
    $('stance').textContent=(u.deployed?'DEPLOYED · ':'')+(u.stance==='prone'?'PRONE':u.stance==='crouch'?'CROUCHED':PL.sprinting?'SPRINTING':'STANDING');
    if(W.type==='melee')$('ammoN').innerHTML='—';else if(W.type==='nade')$('ammoN').innerHTML=`${u.weps.nade.count+(PL.nadeHold?1:0)}`;
    else $('ammoN').innerHTML=`${w.mag}<small> / ${w.res}</small>`;
    $('ammoW').textContent=(PL.nadeHold&&PL.nadeHold.nade?'Enemy grenade!':W.name)+(PL.reloadT>0?' · reloading':w.boltT>0?' · bolt':'');
    $('ammoG').textContent=`GRENADES ${u.weps.nade.count}`;
    // crosshair spread
    const xh=$('xh');const showX=PL.ads<.5&&!(W.scope)&&W.type!=='melee';xh.style.opacity=showX?(PL.sprinting?.2:1):0;
    if(showX){const px=playerSpread(W)*innerHeight/(2*Math.tan(camera.fov*Math.PI/360))+4;const s=xh.children;s[0].style.top=(-px-7)+'px';s[1].style.top=px+'px';s[2].style.left=(-px-7)+'px';s[3].style.left=px+'px';}
    // capture bar
    let capF=null;for(const f of G.flags)if(Math.hypot(u.pos.x-f.x,u.pos.z-f.z)<f.r&&(f.owner!==u.team||f.prog>0))capF=f;
    if(capF){$('cap').hidden=false;const contested=capF.n[0]&&capF.n[1];$('capT').textContent=contested?'CONTESTED':capF.owner===u.team?'DEFEND THE '+capF.short:'CAPTURING '+capF.short;$('capB').style.width=(capF.prog*100)+'%';}else $('cap').hidden=true;
    // teammate name under the crosshair
    camera.getWorldDirection(_f);let nm='';
    for(const o of UNITS){if(o===u||!o.alive||o.team!==u.team)continue;const c=o.center(_e);const dx=c.x-camera.position.x,dy=c.y-camera.position.y,dz=c.z-camera.position.z;const d=Math.hypot(dx,dy,dz);
      if(d<45&&(dx*_f.x+dy*_f.y+dz*_f.z)/d>.995){nm=o.name+' · '+o.cls.name;break;}}
    $('name').textContent=nm;
    post.mat.uniforms.lowHp.value=lerp(post.mat.uniforms.lowHp.value,u.hp<40?(1-u.hp/40):0,dt*3);
  }else{
    $('cap').hidden=true;$('name').textContent='';
    const wt=Math.ceil(G.waveT[u.team]);const sub=document.querySelector('#center small');
    if(sub&&PL.deathT>1.2)sub.textContent=`Reinforcements in ${wt}s · M to change class`;
  }
  if(G.mode==='intro'){center(u.team===0?'LANDING':'STAND BY',`${u.team===0?'Ramp down in':'They land in'} ${Math.ceil(G.introT)}`,.3);}
  // fade overlays
  for(const d of PL.dmgDirs){d.t-=dt;d.el.style.opacity=Math.max(0,d.t/1.2);d.el.style.transform=`rotate(${-(d.ang-PL.yaw-Math.PI)}rad)`;}
  PL.dmgDirs=PL.dmgDirs.filter(d=>{if(d.t<=0){d.el.remove();return false;}return true;});
}
let hintT=0;
function hint(text,dur=2.8){const el=$('msg');el.textContent=text;el.classList.add('on');clearTimeout(hintT);hintT=setTimeout(()=>el.classList.remove('on'),dur*1000);}
let centerT=0;
function center(title,sub,dur){const el=$('center');el.innerHTML=`<b>${title}</b>${sub?`<small>${sub}</small>`:''}`;clearTimeout(centerT);if(dur)centerT=setTimeout(()=>{el.innerHTML='';},dur*1000);}
function hitMarker(kill,head){const el=$('hitm');el.classList.toggle('kill',kill);el.classList.add('on');setTimeout(()=>el.classList.remove('on'),kill?140:70);if(kill&&head)hint('Headshot',1);}
function showDmgDir(ang){const el=document.createElement('div');el.className='dd';$('dmgdir').appendChild(el);PL.dmgDirs.push({el,ang,t:1.2});}
function addFeed(k,v,wid,zone){
  if(wid==='?')return;
  const W=WEAPONS[wid];const wn=wid==='arty'?'artillery':wid==='fall'?'fell':W?W.name:wid;
  const ks=k&&k!==v?`<span class="${k.team?'x':'a'}">${k.name}</span> `:'';
  const me=(k&&k.isPlayer)||v.isPlayer;
  feedHTML(`${ks}<span style="color:#d6b25e">[${wn}${zone==='head'?' · headshot':''}]</span> <span class="${v.team?'x':'a'}">${v.name}</span>`,me);
  if(k&&k.isPlayer&&v!==k)hint(`Killed ${v.name}`+(zone==='head'?' · headshot':''),1.6);
}
function feedMsg(text,t){feedHTML(`<span class="${t?'x':'a'}">${text}</span>`,false);}
function feedHTML(html,me){if(G.demo)return;const f=$('feed');const d=document.createElement('div');d.innerHTML=html;if(me)d.classList.add('me');f.prepend(d);while(f.children.length>6)f.lastChild.remove();setTimeout(()=>{d.style.opacity=0;setTimeout(()=>d.remove(),700);},6000);}
function updateBoard(){
  const b=$('board');let h='';
  for(const t of[0,1]){const us=UNITS.filter(u=>u.team===t).sort((a,c)=>c.score-a.score||c.kills-a.kills);
    const flags=G.flags.filter(f=>f.owner===t).length;
    h+=`<div><h3><span>${TEAM_NAME[t].toUpperCase()}</span><span>${G.score[t]} rounds · ${flags} flags</span></h3><table><tr><th>SOLDIER</th><th>CLASS</th><th class="n">SCORE</th><th class="n">K</th><th class="n">D</th></tr>`;
    for(const u of us)h+=`<tr class="${u.isPlayer?'me':''} ${u.alive?'':'dead'}"><td>${u.name}</td><td>${u.cls.name}</td><td class="n">${u.score}</td><td class="n">${u.kills}</td><td class="n">${u.deaths}</td></tr>`;
    h+='</table></div>';}
  b.innerHTML=h;
}

/* ================= Menus ================= */
let pickTeam=SET.team,pickCls=null;
function setPressed(sel,attr,val){for(const b of document.querySelectorAll(sel))b.setAttribute('aria-pressed',String(b.dataset[attr])===String(val)?'true':'false');}
setPressed('.teams .opt','team',pickTeam);setPressed('#diff .opt','d',SET.diff);
$('size').value=SET.size;$('sizeO').textContent=`${SET.size} v ${SET.size}`;
$('tMusic').checked=$('pMusic').checked=SET.music;$('tVoice').checked=$('pVoice').checked=SET.voice;
$('sens').value=Math.round(SET.sens*10);$('sensO').textContent=SET.sens.toFixed(1);
for(const b of document.querySelectorAll('.teams .opt'))b.onclick=()=>{pickTeam=+b.dataset.team;SET.team=pickTeam;setPressed('.teams .opt','team',pickTeam);saveSettings();};
for(const b of document.querySelectorAll('#diff .opt'))b.onclick=()=>{SET.diff=+b.dataset.d;setPressed('#diff .opt','d',SET.diff);saveSettings();};
$('size').oninput=()=>{SET.size=+$('size').value;$('sizeO').textContent=`${SET.size} v ${SET.size}`;saveSettings();};
$('tMusic').onchange=$('pMusic').onchange=e=>{$('tMusic').checked=$('pMusic').checked=e.target.checked;setMusicOn(e.target.checked);if(e.target.checked&&!MUS.on&&AU.ctx)playMusic(G.mode==='menu'||G.demo?'theme':'tension');};
$('tVoice').onchange=$('pVoice').onchange=e=>{$('tVoice').checked=$('pVoice').checked=e.target.checked;SET.voice=e.target.checked;saveSettings();if(!SET.voice&&window.speechSynthesis)speechSynthesis.cancel();};
$('tHigh').onchange=e=>{GAME.quality=e.target.checked?'high':'medium';renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,GAME.quality==='high'?1.5:1));resize();sun.shadow.mapSize.set(GAME.quality==='high'?2048:1024,GAME.quality==='high'?2048:1024);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}};
$('sens').oninput=()=>{SET.sens=$('sens').value/10;$('sensO').textContent=SET.sens.toFixed(1);saveSettings();};
let classTeam=0,classFromGame=false;
function classCount(team,id,except){if(Net.pendingRoster)return Net.pendingRoster.filter(r=>r[1]===team&&r[3]===id).length;let n=0;for(const u of UNITS){if(u.team!==team||u===except)continue;const c=u.nextCls||u.cls;if(c&&c.id===id)n++;}return n;}
function openClasses(team,fromGame){
  classTeam=team;classFromGame=fromGame;
  $('cTitle').textContent=`${TEAM_NAME[team].toUpperCase()} · CHOOSE YOUR CLASS`;
  $('cSub').textContent=team===0?'US Army, 29th and 1st Infantry Divisions. Sniper and machine gun slots are limited.':'Wehrmacht, 352nd Infantry Division. Sniper and machine gun slots are limited.';
  const grid=$('cgrid');grid.innerHTML='';
  const cur=fromGame&&PL.u?(PL.u.nextCls||PL.u.cls):null;
  if(!pickCls||pickCls.team!==team)pickCls=Object.assign({team},CLASSES[team][0]);
  if(cur)pickCls=Object.assign({team},cur);
  CLASSES[team].forEach((c,i)=>{
    const W=WEAPONS[c.wep];const dmg=Math.min(100,W.dmg/1.2),rate=Math.min(100,(1/W.rof)/20*100*(W.type==='bolt'?.4:1)),acc=Math.max(5,100-W.ads*1600-(W.mg?40:0));
    const used=classCount(team,c.id,PL.u);
    const b=document.createElement('button');b.className='card';b.setAttribute('aria-pressed',pickCls.id===c.id?'true':'false');
    b.innerHTML=`<span class="k">${i+1}</span><b>${c.name}</b><i>${W.name}${c.pistol?' · '+WEAPONS[c.pistol].name:''}</i><p>${c.desc}</p>
      <div class="bars"><em>DAMAGE</em><span style="--v:${dmg}%"></span><em>FIRE RATE</em><span style="--v:${rate}%"></span><em>ACCURACY</em><span style="--v:${acc}%"></span></div>
      <span class="cnt">${c.limit?`${Math.min(used,c.limit)} of ${c.limit} taken${used>=c.limit?' · a bot will swap out':''}`:`${used} on your side`} · ${c.nades} grenade${c.nades===1?'':'s'}</span>`;
    b.onclick=()=>{pickCls=Object.assign({team},c);for(const x of grid.children)x.setAttribute('aria-pressed',x===b?'true':'false');};
    b.ondblclick=()=>$('deploy').click();
    grid.appendChild(b);
  });
  $('cBack').textContent=fromGame?'CANCEL':'BACK';
  $('cNote').textContent=fromGame&&PL.u&&PL.u.alive?'Your new class takes effect when you next respawn.':'';
  $('classes').hidden=false;$('menu').hidden=true;
}
$('go').onclick=()=>{initAudio();const t=pickTeam<0?(Math.random()<.5?0:1):pickTeam;openClasses(t,false);};
$('cBack').onclick=()=>{if(Net.pendingJoin){netLeave(true);mpStatus('');}Net.wantHost=false;$('classes').hidden=true;if(!classFromGame){$('menu').hidden=false;}else resumeGame();};
$('deploy').onclick=()=>{
  const c=clsById(classTeam,pickCls.id);
  // take a limited slot from a bot if needed
  if(c.limit&&classCount(classTeam,c.id,PL.u)>=c.limit){const bot=UNITS.find(u=>u.team===classTeam&&!u.isPlayer&&(u.nextCls||u.cls).id===c.id);if(bot)bot.nextCls=CLASSES[classTeam][0];}
  $('classes').hidden=true;
  if(Net.pendingJoin){Net.joinTeam=classTeam;Net.joinCls=c;Net.send({t:'join',team:classTeam,cls:c.id});mpStatus('Joining…');$('menu').hidden=false;return;}
  if(classFromGame&&PL.u){
    if(c.id!==PL.u.cls.id){PL.u.nextCls=c;if(Net.client)Net.send({t:'cls',id:c.id});if(PL.u.alive)hint(`You will respawn as ${c.name}`,3);}
    resumeGame();return;
  }
  const host=Net.wantHost;Net.wantHost=false;
  startGame(classTeam,c);
  if(host)netHost();
};
document.addEventListener('keydown',e=>{if(!$('classes').hidden&&/^Digit[1-7]$/.test(e.code)){const i=+e.code.slice(5)-1;const cards=$('cgrid').children;if(cards[i])cards[i].click();}
  if(!$('classes').hidden&&e.code==='Enter')$('deploy').click();});
function startGame(team,cls){
  initAudio();G.demo=false;G.round=1;G.score=[0,0];
  makeTeams(SET.size,team,cls);
  $('menu').hidden=true;$('hud').hidden=false;
  buildFlagHUD();
  startRound();
  requestLock();canvas.focus();
}
function quitToMenu(){
  netLeave(true);
  G.paused=false;$('pause').hidden=true;$('hud').hidden=true;$('roundend').hidden=true;$('scope').hidden=true;
  if(document.pointerLockElement)document.exitPointerLock();
  startDemo();$('menu').hidden=false;if(SET.music&&AU.ctx)playMusic('theme');
  if(window.speechSynthesis)speechSynthesis.cancel();
}
function startDemo(){
  G.demo=true;G.round=1;makeTeams(16,-1,null);startRound();G.mode='demo';VM.g.visible=false;
}

/* ================= Input ================= */
function requestLock(){try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{PL.lockOK=false;});}catch(e){PL.lockOK=false;}}
function resumeGame(){G.paused=false;$('pause').hidden=true;if(PL.lockOK)requestLock();}
function pauseGame(){if(G.demo||G.mode==='menu')return;G.paused=true;$('pause').hidden=false;updateInvite();for(const k in PL.keys)PL.keys[k]=false;PL.fireHeld=false;PL.rmb=false;$('board').hidden=true;}
document.addEventListener('pointerlockchange',()=>{PL.locked=document.pointerLockElement===canvas;if(!PL.locked&&!G.demo&&$('classes').hidden&&!G.paused)pauseGame();});
document.addEventListener('pointerlockerror',()=>{PL.lockOK=false;});
document.addEventListener('mousemove',e=>{
  if(G.demo||G.paused||!PL.u||(!PL.locked&&PL.lockOK))return;if(!PL.u.alive)return;
  const zoom=camera.fov/75;const s=.0022*SET.sens/1.4*zoom*(PL.u.deployed?.8:1);
  PL.yaw-=e.movementX*s;PL.pitch-=e.movementY*s;PL.pitch=clamp(PL.pitch,-1.45,1.45);PL.lookVX+=e.movementX;PL.lookVY+=e.movementY;
});
canvas.addEventListener('mousedown',e=>{
  if(G.demo)return;
  if(!PL.locked&&PL.lockOK){requestLock();return;}
  if(G.paused||!PL.u)return;
  if(e.button===0){PL.fireHeld=true;if(PL.u.alive){const W=curWD();if(W.type!=='auto')playerFire();}}
  if(e.button===2){PL.rmb=true;const W=curWD();if(PL.u.alive&&(W.mg||(W.bipod&&(PL.u.stance!=='stand'||true)))){if(PL.u.deployed)undeploy();else if(!tryDeploy()&&W.mg)hint('Nothing to rest the gun on. Go prone (Z) or find sandbags or a wall.',2.5);}}
});
document.addEventListener('mouseup',e=>{if(e.button===0)PL.fireHeld=false;if(e.button===2)PL.rmb=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(G.demo||G.paused||!PL.u||!PL.u.alive)return;e.preventDefault();cycleWeapon(e.deltaY>0?1:-1);},{passive:false});
document.addEventListener('keydown',e=>{
  if(e.code==='Tab'){if(!G.demo&&PL.u){e.preventDefault();updateBoard();$('board').hidden=false;}return;}
  if(e.code==='Escape'&&!G.demo&&PL.u&&$('classes').hidden&&!PL.locked){if(G.paused)resumeGame();else pauseGame();return;}
  if(G.demo||!PL.u||!$('classes').hidden)return;
  if(['Space','KeyW','KeyA','KeyS','KeyD','KeyC','KeyZ','KeyQ','KeyE'].includes(e.code))e.preventDefault();
  if(G.paused)return;
  PL.keys[e.code]=true;if(e.repeat)return;
  const u=PL.u;
  if(e.code==='KeyM'||e.code==='Comma'){if(document.pointerLockElement)document.exitPointerLock();G.paused=true;openClasses(u.team,true);return;}
  if(!u.alive)return;
  switch(e.code){
    case'KeyR':startReload();break;
    case'Digit1':switchTo('melee');break;case'Digit2':switchTo('pistol');break;case'Digit3':switchTo('primary');break;case'Digit4':switchTo('nade');break;
    case'KeyQ':lastWeapon();break;
    case'KeyG':if(u.weps.nade.count>0&&!PL.nadeHold){const prev=u.cur;u.cur='nade';buildVM(u.weps.nade.id,u.team);pullPin();PL.nadeHold.armed=true;setTimeout(()=>{releaseNade();setTimeout(()=>{if(PL.u.alive&&PL.u.cur==='nade'){PL.u.cur=prev;buildVM(curW().id,PL.u.team);}},450);},250);}break;
    case'KeyF':doMelee();break;
    case'KeyE':pickupNade();break;
    case'KeyZ':setStance(u.stance==='prone'?'stand':'prone');break;
  }
});
document.addEventListener('keyup',e=>{PL.keys[e.code]=false;if(e.code==='Tab')$('board').hidden=true;});
window.addEventListener('blur',()=>{for(const k in PL.keys)PL.keys[k]=false;PL.fireHeld=false;});
$('resume').onclick=resumeGame;$('pClass').onclick=()=>{$('pause').hidden=true;openClasses(PL.u.team,true);};$('pQuit').onclick=quitToMenu;

/* ================= Demo camera ================= */
const DEMO={shot:0,t:0,u:null,a:0};
function demoCam(dt){
  DEMO.t-=dt;
  if(DEMO.t<=0||(DEMO.shot===1&&(!DEMO.u||!DEMO.u.alive))){DEMO.t=rand(8,12);DEMO.shot=(DEMO.shot+1)%3;DEMO.a=rand(0,TAU);
    const al=UNITS.filter(u=>u.alive&&u.team===(Math.random()<.65?0:1));DEMO.u=al.length?pick(al):null;}
  if(DEMO.shot===1&&DEMO.u){const u=DEMO.u;const fx=Math.sin(u.yaw),fz=Math.cos(u.yaw);
    const tx=u.pos.x-fx*4.2+fz*1.1,tz=u.pos.z-fz*4.2-fx*1.1;const ty=Math.max(H(tx,tz)+.6,u.pos.y+2.1);
    camera.position.lerp(_e.set(tx,ty,tz),1-Math.exp(-dt*3));camera.lookAt(u.pos.x+fx*8,u.pos.y+1.3,u.pos.z+fz*8);}
  else if(DEMO.shot===0){DEMO.a+=dt*.03;const x=Math.sin(DEMO.a)*60,z=95+Math.cos(DEMO.a*1.3)*20;camera.position.set(x,H(x,z)+3.2,z);camera.lookAt(x*.6,8,10);}
  else{const f=G.flags[1+((DEMO.a*10|0)%4)];DEMO.a+=dt*.04;const r=24;const x=f.x+Math.cos(DEMO.a)*r,z=f.z+Math.sin(DEMO.a)*r;camera.position.set(x,Math.max(H(x,z),f.y)+7,z);camera.lookAt(f.x,f.y+1.5,f.z);}
  if(camera.fov!==60){camera.fov=60;camera.updateProjectionMatrix();particleScale();}
}

/* ================= Main loop ================= */
function update(dt){
  GAME.time+=dt;updatePending();
  if(G.mode==='intro'){
    G.introT-=dt;const k=1-Math.max(0,G.introT)/11;const e=1-Math.pow(1-k,2);
    BOATS.forEach((b,i)=>{b.g.position.z=b.home.z+70*(1-e);b.g.position.y=b.home.y+Math.sin(GAME.time*1.6+i)*.12*(1-e*.7);b.g.rotation.x=Math.sin(GAME.time*1.3+i*2)*.025*(1-e);b.g.rotation.z=Math.sin(GAME.time*1.1+i)*.02*(1-e);
      if(Math.random()<dt*14)smoke.spawn(b.g.position.x+rand(-1.5,1.5),.3,b.g.position.z-5.5,rand(-2,2),rand(1.5,4),rand(-1,1),rand(.6,1.2),.3,1.4,.6,.85,.87,.88,1,9);});
    if(!Net.client&&Math.random()<dt*.9){const b=pick(BOATS);explosion(new V3(b.g.position.x+rand(-14,14),0,b.g.position.z+rand(-12,10)),1.6,null,'arty');}
    if(G.introT<=0&&!Net.client)endIntro();
  }
  if(G.mode==='play'||G.mode==='demo'||G.mode==='roundEnd'){
    for(const b of BOATS){if(b.rampT!==undefined&&b.rp.rotation.x>-1.62){b.rampT+=dt;b.rp.rotation.x=Math.max(-1.62,-Math.pow(b.rampT/.9,2)*1.62);}b.g.rotation.set(0,0,0);b.g.position.y=b.home.y;b.g.position.z=b.home.z;}
  }
  if(G.mode==='play'){G.timeLeft-=dt;if(G.timeLeft<=0&&!Net.client)endRound(1,'Time ran out. The Axis held the bluffs.');}
  if(G.mode==='roundEnd'){G.endT-=dt;if(G.endT<=0&&!Net.client){G.round++;startRound();}}
  if((G.mode==='play'||G.mode==='demo')&&!Net.client){G.artyT-=dt;if(G.artyT<=0){G.artyT=rand(40,75);barrage();}}
  updateWaves(dt);
  updateUnits(dt);
  updateFlags(dt);
  if(Net.client)netNades(dt);else updateNades(dt);
  if(Net.on)netTick(dt);
}
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=vmCam.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();vmCam.updateProjectionMatrix();makeRT();particleScale();}
window.addEventListener('resize',resize);
buildFlags();buildFlagHUD();
startDemo();resize();
// audio needs a user gesture: start the menu theme on the first click anywhere
document.addEventListener('pointerdown',function first(){initAudio();if(SET.music&&!MUS.on&&(G.demo))playMusic('theme');document.removeEventListener('pointerdown',first);},{once:false});
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(window.__freeze)return;
  const live=!G.paused||Net.on;
  if(live)update(dt);
  if(G.demo)demoCam(dt);
  if(live){smoke.update(dt);chunks.update(dt);glow.update(dt);updateFlashes(dt);updateTracers(dt);updateDebris(dt);burnTick(dt);hazeTick(dt);updateAmbient(dt);grassTime.value+=dt;waterU.time.value+=dt;skyU.time.value+=dt;}
  FX.trauma=Math.max(0,FX.trauma-dt*1.1);FX.blur=Math.max(0,FX.blur-dt*.5);FX.aberr=Math.max(0,FX.aberr-dt*1.5);FX.hurt=Math.max(0,FX.hurt-dt*(PL.u&&!PL.u.alive?0:1.4));FX.white=Math.max(0,FX.white-dt*1.2);
  if(!G.demo)updateHUD(dt);
  if(AU.ctx){updateListener();musicTick();}
  sky.position.copy(camera.position);placeSun(camera.position);
  vmSun.position.copy(sunDir);
  renderFrame(!G.demo&&PL.u&&PL.u.alive&&VM.g.visible);
}
requestAnimationFrame(frame);
