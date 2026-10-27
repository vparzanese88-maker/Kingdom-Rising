'use strict';
/* ================= Player ================= */
const PL={u:null,keys:{},locked:false,lockOK:true,ads:0,eyeH:1.62,bob:0,bobAmt:0,kickP:0,kickY:0,recoilZ:0,swayX:0,swayY:0,lookVX:0,lookVY:0,
  switchT:0,pendingW:null,lastW:'pistol',reloadT:0,reloadDur:0,boltT:0,boltDur:0,meleeT:0,nadeHold:null,nadeT:0,stanceT:0,targetStance:'stand',
  deployYaw:0,deployEye:0,stepD:0,breathT:0,heartT:0,suppress:0,deathT:0,killer:null,landV:0,fireHeld:false,semiReady:true,mouseDown:false,throwAnim:0,
  roll:0,sprinting:false,lastPing:0,dmgDirs:[]};
const _f=new V3(),_r=new V3(),_e=new V3(),_d=new V3(),_m=new V3();
function playerUnit(){return PL.u;}
function canAct(){return PL.u&&PL.u.alive&&(G.mode==='play'||G.mode==='intro'&&false);}
function curW(){const u=PL.u;return u.weps[u.cur];}
function curWD(){return WEAPONS[curW().id];}

function setStance(s){
  const u=PL.u;if(!u.alive||u.stance===s&&PL.targetStance===s)return;
  if(u.deployed)undeploy();
  PL.targetStance=s;PL.stanceT=(s==='prone'||u.stance==='prone')?.75:.12;
  if(s==='prone'||u.stance==='prone')play('deploy',{vol:.25,rate:.7});
}
function tryDeploy(){
  const u=PL.u,W=curWD();if(!(W.mg||W.bipod))return false;
  if(u.stance==='prone'&&PL.stanceT<=0){u.deployed=true;PL.deployYaw=PL.yaw;PL.deployEye=.38;play('deploy',{vol:.55});return true;}
  // look for a rest at chest height in front
  const fx=-Math.sin(PL.yaw),fz=-Math.cos(PL.yaw);const lo=u.stance==='crouch'?.45:.8,hi=u.stance==='crouch'?1.0:1.4;
  for(let d=.35;d<=1.05;d+=.1){const x=u.pos.x+fx*d,z=u.pos.z+fz*d;
    for(const s of solidsNear(x,z,.2,_sn)){if(x<s.x0-.05||x>s.x1+.05||z<s.z0-.05||z>s.z1+.05)continue;const h=s.y1-u.pos.y;
      if(h>=lo&&h<=hi){u.deployed=true;PL.deployYaw=PL.yaw;PL.deployEye=h+.2;play('deploy',{vol:.55});return true;}}
    const th=H(x,z)-u.pos.y;if(th>=lo&&th<=hi){u.deployed=true;PL.deployYaw=PL.yaw;PL.deployEye=th+.2;play('deploy',{vol:.55});return true;}}
  return false;
}
function undeploy(){const u=PL.u;if(u.deployed){u.deployed=false;play('deploy',{vol:.35,rate:1.2});}}
function switchTo(slot){
  const u=PL.u;if(!u.alive||!u.weps[slot]||u.cur===slot&&!PL.pendingW)return;
  if(slot==='nade'&&u.weps.nade.count<=0){hint('No grenades left');return;}
  if(PL.nadeHold)return;
  undeploy();PL.reloadT=0;PL.pendingW=slot;PL.switchT=.45;play('magOut',{vol:.25,rate:1.3});
}
function lastWeapon(){const u=PL.u;const l=PL.lastW;if(u.weps[l]&&l!==u.cur)switchTo(l);else switchTo(u.cur==='primary'?(u.weps.pistol?'pistol':'melee'):'primary');}
function cycleWeapon(d){const order=['melee','pistol','primary','nade'].filter(s=>PL.u.weps[s]&&(s!=='nade'||PL.u.weps.nade.count>0));const cur=PL.pendingW||PL.u.cur;const i=order.indexOf(cur);switchTo(order[(i+d+order.length)%order.length]);}
function startReload(){
  const u=PL.u,w=curW(),W=curWD();if(!W.mag||PL.reloadT>0||PL.switchT>0||w.mag>=W.mag||w.res<=0)return;
  if(W.ping&&w.mag>0){/* a Garand clip can't be topped up: the rest goes with it */w.res+=0;}
  PL.reloadT=PL.reloadDur=W.reload*(u.deployed||!W.mg?1:1.15);PL.boltT=0;
  play(W.clip?'boltBack':'magOut',{vol:.5});
  setTimeout(()=>{if(PL.reloadT>0)play(W.clip?'clipIn':'magIn',{vol:.55});},W.reload*550);
  if(W.mg)setTimeout(()=>{if(PL.reloadT>0)play('belt',{vol:.5});},W.reload*300);
  setTimeout(()=>{if(PL.reloadT>0&&(W.type==='bolt'||W.clip||W.type==='auto'))play(W.type==='bolt'?'boltFwd':'cock',{vol:.5});},W.reload*880);
  if(Math.random()<.3)say(LINES[u.team].reload[0],{de:u.team===1,vol:.5});
}
function finishReload(){const w=curW(),W=curWD();if(W.ping&&w.mag>0)w.mag=0;const take=Math.min(W.mag-w.mag,w.res);w.mag+=take;w.res-=take;curW().boltT=0;}

/* ---- shooting ---- */
function playerSpread(W){
  const u=PL.u;const sp=Math.hypot(u.vel.x,u.vel.z);
  let s;
  if(u.deployed)s=W.dep||W.ads;
  else if(W.mg)s=W.hip;
  else s=lerp(W.hip,W.ads,PL.ads);
  if(W.scope&&PL.ads<.95)s=W.hip;
  s+=sp*(PL.ads>.5?.003:.0055);
  if(!u.onGround)s+=.08;
  if(u.stance==='crouch')s*=.8;else if(u.stance==='prone')s*=.6;
  if(PL.stanceT>0)s+=.03;
  s*=1+PL.suppress*.6;
  return s;
}
function playerFire(){
  const u=PL.u;if(!u.alive||G.mode!=='play'||PL.switchT>0||PL.reloadT>0||PL.stanceT>.2)return false;
  const slot=u.cur,w=curW(),W=curWD();
  if(W.type==='melee'){if(PL.meleeT>0)return false;doMelee(W);return true;}
  if(W.type==='nade'){if(!PL.nadeHold&&u.weps.nade.count>0)pullPin();return true;}
  if(u.cool>0||w.boltT>0)return false;
  if(w.mag<=0){play('dry',{vol:.5});u.cool=.25;if(w.res>0)startReload();return false;}
  if(PL.sprinting)return false;
  camera.getWorldDirection(_f);
  const spread=playerSpread(W);
  const dir=spreadDir(_f,spread,_d);
  const o=_e.copy(camera.position);
  fireBullet(u,o,dir,W,w.id,W.tracer&&(w.mag%W.tracer===0));
  // muzzle flash in the world, in front of the viewmodel muzzle
  _r.set(1,0,0).applyQuaternion(camera.quaternion);
  const mp=_m.copy(camera.position).addScaledVector(_f,.9).addScaledVector(_r,PL.ads>.5?0:.12);mp.y-=PL.ads>.5?.05:.12;
  muzzleFX(mp,_f,!!W.mg);flashAt(mp,2.4,.06,9);
  gunSound(u,W,o);u.lastShot=GAME.time;
  w.mag--;
  let kick=u.deployed?(W.depKick||W.kick*.35):W.kick;if(u.stance==='crouch')kick*=.8;if(u.stance==='prone')kick*=.6;if(W.scope&&PL.ads>.5)kick*=1.4;
  PL.kickP+=kick;PL.kickY+=rand(-.4,.4)*kick;PL.recoilZ=Math.min(1,PL.recoilZ+(W.type==='auto'?.5:1));
  FX.trauma=Math.min(1,FX.trauma+(W.mg?.04:W.type==='bolt'?.12:.06));
  if(W.ping&&w.mag===0){play('ping',{vol:.55,delay:.06});PL.lastPing=GAME.time;}
  if(W.type==='bolt'&&w.mag>0){w.boltT=W.bolt;PL.boltDur=W.bolt;setTimeout(()=>play('boltUp',{vol:.55}),W.bolt*180);setTimeout(()=>play('boltBack',{vol:.5}),W.bolt*380);setTimeout(()=>play('boltFwd',{vol:.55}),W.bolt*700);}
  u.cool=W.rof;
  stats.shots++;
  if(w.mag===0&&w.res>0&&W.type!=='auto')setTimeout(()=>{if(PL.u.alive&&curW()===w&&w.mag===0)startReload();},350);
  return true;
}
function doMelee(W){
  const u=PL.u;W=W||WEAPONS[MELEE[u.team]];PL.meleeT=W.rof;PL.meleeAnim=1;play('swish',{vol:.5});
  camera.getWorldDirection(_f);
  let best=null,bd=1e9;
  for(const e of UNITS){if(!e.alive||e.team===u.team)continue;const c=e.center(_e);c.y+=.2;const dx=c.x-camera.position.x,dy=c.y-camera.position.y,dz=c.z-camera.position.z;const d=Math.hypot(dx,dy,dz);
    if(d>W.range+.4)continue;const dot=(dx*_f.x+dy*_f.y+dz*_f.z)/d;if(dot<.75)continue;if(d<bd){bd=d;best=e;}}
  if(best){setTimeout(()=>{if(!best.alive)return;play('stab',{vol:.7});const back=Math.cos(angDiff(best.yaw,PL.yaw+Math.PI))<-.5;
    const before=best.alive;hurt(best,W.dmg*(back?2.5:1),u,W===WEAPONS.knife?'knife':'spade','melee',_f.clone());bloodFX(best.center(new V3()),_f);if(before)hitMarker(!best.alive,false);},120);}
}
function pullPin(){
  const u=PL.u;const id=u.weps.nade.id;u.weps.nade.count--;play('pin',{vol:.6});
  PL.nadeHold={fuse:WEAPONS[id].fuse,id,own:true};PL.nadeT=0;
}
function releaseNade(){
  const u=PL.u;const h=PL.nadeHold;if(!h)return;PL.nadeHold=null;PL.throwAnim=1;
  camera.getWorldDirection(_f);const o=camera.position.clone().addScaledVector(_f,.4);o.y-=.1;
  const v=_f.clone().multiplyScalar(WEAPONS[h.id].throwV*(u.stance==='prone'?.6:1));v.y+=3.2;v.x+=u.vel.x*.5;v.z+=u.vel.z*.5;
  if(h.nade){h.nade.held=null;h.nade.p.copy(o);h.nade.v.copy(v);h.nade.rest=false;h.nade.owner=u;}
  else throwNade(u,o,v,h.fuse,h.id);
  play('swish',{vol:.5});say(pick(LINES[u.team].nade),{de:u.team===1,vol:.6,force:false});
  setTimeout(()=>{if(PL.u.alive&&PL.u.cur==='nade'){if(PL.u.weps.nade.count>0)buildVM(PL.u.weps.nade.id,PL.u.team);else switchTo('primary');}},500);
}
function pickupNade(){
  const u=PL.u;if(!u.alive||PL.nadeHold)return;
  for(const n of NADES){if(n.held)continue;const d=Math.hypot(n.p.x-u.pos.x,n.p.y-u.pos.y-.3,n.p.z-u.pos.z);
    if(d<2.2){n.held=u;PL.nadeHold={fuse:n.fuse,id:n.id,nade:n};PL.prevSlot=u.cur;u.cur='nade';buildVM(n.id,u.team);play('clink',{vol:.5});hint('Throw it back! Left-click');return;}}
}

/* ---- per-frame update ---- */
function updatePlayer(dt){
  const u=PL.u;if(!u)return;
  if(!u.alive){updateDeathCam(dt);return;}
  const K=PL.keys;const W=curWD(),w=curW();
  const intro=G.mode==='intro';
  // stance transitions
  if(PL.stanceT>0){PL.stanceT-=dt;if(PL.stanceT<=0||PL.targetStance!=='prone'&&u.stance!=='prone')u.stance=PL.targetStance;}
  else if(u.stance!==PL.targetStance)u.stance=PL.targetStance;
  if(K.KeyC){if(u.stance!=='crouch'&&PL.targetStance!=='crouch'&&!PL.crouchHeld)setStance('crouch');PL.crouchHeld=true;}
  else if(PL.crouchHeld){PL.crouchHeld=false;if(PL.targetStance==='crouch')setStance('stand');}
  // movement input
  let ix=0,iz=0;if(!intro){if(K.KeyW)iz-=1;if(K.KeyS)iz+=1;if(K.KeyA)ix-=1;if(K.KeyD)ix+=1;}
  const il=Math.hypot(ix,iz);if(il>0){ix/=il;iz/=il;}
  const cy=Math.cos(PL.yaw),sy=Math.sin(PL.yaw);
  let mx=ix*cy+iz*sy,mz=-ix*sy+iz*cy;
  if(u.deployed&&il>0)undeploy();
  // sprint and stamina
  const wantSprint=K.ShiftLeft&&iz<0&&u.stance==='stand'&&!u.deployed&&PL.ads<.3&&!PL.nadeHold;
  if(wantSprint&&(PL.sprinting?u.stam>0:u.stam>12)){PL.sprinting=true;u.stam=Math.max(0,u.stam-dt*20);PL.stamRegenT=.9;}
  else{PL.sprinting=false;if(PL.stamRegenT>0)PL.stamRegenT-=dt;else u.stam=Math.min(100,u.stam+dt*14);}
  let speed=5.3*(W.mg?.88:W.bipod?.93:1);if(PL.sprinting)speed*=1.42;
  if(PL.ads>.5&&u.stance==='stand')speed*=.55;
  if(intro){mx=0;mz=0;}
  // jump / climb
  if(K.Space&&u.onGround&&!intro){
    const top=climbable(u.pos.x,u.pos.z,mx||-sy,mz||-cy,u.pos.y);
    if(top!==null&&il>0&&u.stance!=='prone'){PL.mantle={y0:u.pos.y,y1:top+.02,t:0,dx:mx||-sy,dz:mz||-cy};u.onGround=false;play('deploy',{vol:.3,rate:.8});}
    else if(u.stance==='stand'&&u.stam>10&&!PL.jumpLatch){u.vel.y=4.9;u.onGround=false;u.stam-=15;PL.jumpLatch=true;}
    else if(u.stance!=='stand')setStance('stand');
  }
  if(!K.Space)PL.jumpLatch=false;
  if(PL.mantle){const M=PL.mantle;M.t+=dt/.38;u.pos.y=lerp(M.y0,M.y1+.15,Math.min(1,M.t*1.4));if(M.t>=.6){u.pos.x+=M.dx*dt*3.2;u.pos.z+=M.dz*dt*3.2;}
    if(M.t>=1){PL.mantle=null;u.pos.y=M.y1;u.vel.y=0;}u.vel.x=u.vel.z=0;}
  else if(!intro){
    const yBefore=u.pos.y;const airborne=!u.onGround;
    if(airborne){const k=1-Math.exp(-dt*2);u.vel.x+=(mx*speed-u.vel.x)*k;u.vel.z+=(mz*speed-u.vel.z)*k;
      const p=_e.set(u.pos.x+u.vel.x*dt,0,u.pos.z+u.vel.z*dt);collide(p,.33,u.pos.y,1.8);u.pos.x=p.x;u.pos.z=p.z;}
    else moveUnit(u,mx,mz,speed,dt);
    const g=groundAt(u.pos.x,u.pos.z,u.pos.y,.25);
    if(!u.onGround||u.pos.y>g+.06){
      if(u.onGround&&u.pos.y-g<.6&&u.vel.y<=0){u.pos.y=g;}
      else{u.onGround=false;u.vel.y-=17*dt;u.pos.y+=u.vel.y*dt;
        if(u.pos.y<=g){const v=-u.vel.y;u.pos.y=g;u.vel.y=0;u.onGround=true;play('jumpLand',{vol:clamp(v/9,.2,.7)});PL.landV=Math.min(1,v/10);
          if(v>11)hurt(u,(v-11)*9,null,'fall','limb',null);}}
    }
    if(u.onGround)u.pos.y=Math.max(u.pos.y,g);
  }
  // deployed: yaw limits and eye height
  if(u.deployed){PL.yaw=PL.deployYaw+clamp(angDiff(PL.deployYaw,PL.yaw),-.75,.75);PL.pitch=clamp(PL.pitch,-.35,.3);}
  // footsteps and breathing
  const sp=Math.hypot(u.vel.x,u.vel.z);
  if(u.onGround&&sp>1.2&&u.stance!=='prone'){PL.stepD+=sp*dt;const stride=PL.sprinting?2.3:u.stance==='crouch'?1.3:1.95;
    if(PL.stepD>stride){PL.stepD=0;const s=surfaceAt(u.pos.x,u.pos.z,u.pos.y);play(s==='water'?'stWater':s==='sand'?'stSand':s==='hard'?'stHard':s==='wood'?'stWood':'stGrass',{vol:(u.stance==='crouch'?.18:.32)*(PL.sprinting?1.3:1),jit:.08});}}
  else if(u.stance==='prone'&&sp>.3){PL.stepD+=sp*dt;if(PL.stepD>.7){PL.stepD=0;play('stGrass',{vol:.15,rate:.7});}}
  if(u.stam<35){PL.breathT-=dt;if(PL.breathT<=0){PL.breathT=1.3;play('breath',{vol:.35*(1-u.stam/35)+.08});}}
  if(u.hp<35){PL.heartT-=dt;if(PL.heartT<=0){PL.heartT=.9-(.35-u.hp/100);play('heart',{vol:.5});}}
  // regenerate a little health after a while (bandaging is automatic out of combat)
  if(GAME.time-(u.lastHurt||-99)>8&&u.hp<100&&u.hp>0)u.hp=Math.min(100,u.hp+dt*4);
  // weapon state
  if(PL.switchT>0){PL.switchT-=dt;if(PL.switchT<=0&&PL.pendingW){PL.lastW=u.cur;u.cur=PL.pendingW;PL.pendingW=null;buildVM(curW().id,u.team);PL.switchT=-.3;play('cock',{vol:.35});}}
  else if(PL.switchT<0)PL.switchT=Math.min(0,PL.switchT+dt);
  if(PL.reloadT>0){PL.reloadT-=dt;if(PL.reloadT<=0)finishReload();}
  if(w.boltT>0)w.boltT-=dt;
  if(u.cool>0)u.cool-=dt;
  if(PL.meleeT>0)PL.meleeT-=dt;
  // ADS / scope
  const wantAds=PL.rmb&&!PL.sprinting&&PL.reloadT<=0&&PL.switchT===0&&W.adsFov&&!W.mg&&!(W.bipod&&u.deployed)&&W.type!=='nade'&&W.type!=='melee'&&w.boltT<=0;
  PL.ads=clamp(PL.ads+(wantAds?dt*(W.scope?4:6):-dt*7),0,1);
  // held grenade
  if(PL.nadeHold){const h=PL.nadeHold;h.fuse-=dt;if(h.nade)h.fuse=h.nade.fuse;
    if(h.fuse<=0&&!h.nade){PL.nadeHold=null;explosion(u.eye(new V3()),1,u,'nade');}
    else if(!PL.fireHeld&&h.own&&h.armed)releaseNade();
    if(PL.fireHeld)h.armed=true;}
  // automatic fire
  if(PL.fireHeld&&W.type==='auto')playerFire();
  if(PL.fireHeld&&W.type==='melee'&&PL.meleeT<=0)doMelee(W);
  // MG not deployed: remind
  if(W.mg&&PL.fireHeld&&!u.deployed&&GAME.time-(PL.mgHintT||0)>6){PL.mgHintT=GAME.time;hint('Right-click to deploy. Go prone or rest the gun on sandbags or a wall.');}
  PL.suppress=Math.max(0,PL.suppress-dt*.5);
  // recoil recovery
  const rec=Math.min(1,dt*(W.type==='auto'?7:9));PL.pitch+=PL.kickP*rec*1.0;PL.yaw+=PL.kickY*rec;PL.kickP-=PL.kickP*rec;PL.kickY-=PL.kickY*rec;
  PL.pitch=clamp(PL.pitch,-1.45,1.45);
  u.yaw=PL.yaw+Math.PI;u.pitch=PL.pitch;
  // eye height
  let eyeT=u.stance==='prone'?.38:u.stance==='crouch'?1.05:1.62;if(u.deployed)eyeT=Math.max(eyeT,PL.deployEye);
  PL.eyeH=lerp(PL.eyeH,eyeT,1-Math.exp(-dt*(u.stance==='prone'||PL.targetStance==='prone'?4:12)));
  PL.landV=Math.max(0,PL.landV-dt*4);
  // camera
  const bobOn=u.onGround&&sp>.5;PL.bob+=dt*sp*(PL.sprinting?1.55:1.9);PL.bobAmt=lerp(PL.bobAmt,bobOn?Math.min(1,sp/5.3):0,dt*8);
  const bobY=Math.abs(Math.sin(PL.bob))*.045*PL.bobAmt*(1-PL.ads*.8),bobX=Math.cos(PL.bob)*.03*PL.bobAmt*(1-PL.ads*.8);
  const sh=FX.trauma*FX.trauma,t=GAME.time;
  const shx=(Math.sin(t*47.3)+Math.sin(t*71.1+1))*sh*.035,shy=(Math.sin(t*53.7+2)+Math.sin(t*67.3))*sh*.035,shr=Math.sin(t*39.1)*sh*.05;
  PL.roll=lerp(PL.roll,-ix*.018*(PL.sprinting?1.6:1),dt*6);
  camera.position.set(u.pos.x+bobX*cy,u.pos.y+PL.eyeH+bobY-PL.landV*.08,u.pos.z-bobX*sy);
  if(intro&&G.introBoat){camera.position.y+=Math.sin(t*1.7)*.06;}
  camera.rotation.set(PL.pitch+shy,PL.yaw+shx,PL.roll+shr+(intro?Math.sin(t*1.3)*.03:0));
  // field of view
  const fov=lerp(75,W.adsFov||75,PL.ads)*(PL.sprinting?1.04:1);
  if(Math.abs(camera.fov-fov)>.01){camera.fov=fov;camera.updateProjectionMatrix();particleScale();}
  $('scope').hidden=!(W.scope&&PL.ads>.92);
  updateViewmodel(dt,sp);
}
function updateViewmodel(dt,sp){
  const u=PL.u,W=curWD(),w=curW();const g=VM.gun;if(!g)return;
  const t=GAME.time;
  VM.g.visible=!(W.scope&&PL.ads>.92);
  PL.swayX=lerp(PL.swayX,clamp(-PL.lookVX*.0009,-.05,.05),dt*10);PL.swayY=lerp(PL.swayY,clamp(PL.lookVY*.0009,-.05,.05),dt*10);PL.lookVX*=Math.exp(-dt*12);PL.lookVY*=Math.exp(-dt*12);
  const a=PL.ads;
  // hip, aim and special poses
  let x=lerp(.16,0,a),y=lerp(-.165,-(VM.sightY||.06),a),z=lerp(-.36,-.2,a),rx=0,ry=lerp(.05,0,a),rz=0;
  if(W.mg||W.bipod&&u.deployed){x=lerp(.1,.0,u.deployed?1:0);y=u.deployed?-(VM.sightY||.09)-.005:-.17;z=u.deployed?-.2:-.3;ry=u.deployed?0:.08;}
  if(W.pistol){x=lerp(.12,0,a);y=lerp(-.13,-(VM.sightY||.055),a);z=lerp(-.32,-.28,a);}
  if(W.type==='melee'){x=.16;y=-.18;z=-.3;rx=.25;ry=-.2;}
  if(W.type==='nade'){x=.16;y=-.16;z=-.3;if(PL.nadeHold){x=.2;y=-.08;z=-.2;rx=-.4;}}
  if(PL.sprinting){x+=-.02;y-=.03;rx+=-.35;ry+=.55;rz+=.25;}
  if(u.stance==='prone'&&!u.deployed&&sp>.3){y-=.12;rx-=.4;ry+=.4;}
  // walk bob
  const bb=PL.bobAmt*(1-a*.85);x+=Math.cos(PL.bob)*.012*bb;y+=Math.abs(Math.sin(PL.bob))*-.016*bb;
  // idle breathing
  y+=Math.sin(t*1.6)*.0025*(1-a*.7);x+=Math.sin(t*.8)*.0015*(1-a*.7);
  if(W.scope&&a>.5){x+=Math.sin(t*.9)*.004;y+=Math.sin(t*1.3)*.004;camera.rotation.x+=Math.sin(t*1.1)*.0025*(1-(u.stance==='prone'?.7:u.stance==='crouch'?.4:0));camera.rotation.y+=Math.sin(t*.7)*.0025;}
  // recoil
  PL.recoilZ=Math.max(0,PL.recoilZ-dt*(W.type==='auto'?14:7));const rc=PL.recoilZ;z+=rc*(W.type==='bolt'?.07:.035);rx+=rc*(W.type==='bolt'?.12:.05)*(u.deployed?.3:1);
  // switching, reloading, bolt
  if(PL.switchT>0){const k=Math.sin(Math.min(1,(.45-PL.switchT)/.45)*Math.PI*.5);y-=k*.3;rx-=k*.6;}
  else if(PL.switchT<0){const k=-PL.switchT/.3;y-=k*.25;rx-=k*.5;}
  if(PL.reloadT>0){const k=1-PL.reloadT/PL.reloadDur;const e=Math.sin(k*Math.PI);y-=e*.08;rx+=e*(W.clip?-.15:.25);rz+=e*.55;ry+=e*.2;
    if(VM.mag){const mk=k<.45?Math.min(1,k/.15):k<.75?1-(k-.45)/.3:0;VM.mag.position.set(0,-mk*.25,0);VM.mag.visible=!(k>.3&&k<.5);}}
  else if(VM.mag){VM.mag.position.set(0,0,0);VM.mag.visible=!(W.ping&&w.mag===0)&&!(W.type==='nade');}
  if(VM.bolt){let bz=0,brz=0;if(w.boltT>0&&W.bolt){const k=1-w.boltT/W.bolt;const e=Math.sin(Math.min(1,k/.8)*Math.PI);bz=e*.08;brz=Math.min(1,k*5)*(k<.8?1:Math.max(0,1-(k-.8)*5))*.9;rz+=e*.12;ry+=e*.08;}
    else if(W.type!=='bolt'&&PL.recoilZ>.5)bz=.03;
    VM.bolt.position.set(0,0,bz);VM.bolt.rotation.z=brz;}
  if(PL.meleeAnim>0){PL.meleeAnim=Math.max(0,PL.meleeAnim-dt*3.2);const k=Math.sin((1-PL.meleeAnim)*Math.PI);x-=k*.12;z-=k*.25;ry+=k*.6;rx-=k*.2;}
  if(PL.throwAnim>0){PL.throwAnim=Math.max(0,PL.throwAnim-dt*3);const k=Math.sin((1-PL.throwAnim)*Math.PI);z-=k*.3;y+=k*.1;rx-=k*.8;}
  if(PL.nadeHold&&curW().id===VM.id&&VM.gun)VM.gun.visible=true;
  g.position.set(x+PL.swayX,y+PL.swayY,z);g.rotation.set(rx+PL.swayY*2,ry+PL.swayX*2,rz);
  vmCam.fov=lerp(56,W.scope?40:46,a);vmCam.updateProjectionMatrix();
}
function updateDeathCam(dt){
  const u=PL.u;PL.deathT+=dt;const c=u.model?u.model.root.position:u.pos;
  const k=Math.min(1,PL.deathT/2.5);
  const a=PL.deathYaw+PL.deathT*.15;const r=lerp(1.5,5.5,k),h=lerp(1.2,4,k);
  const tx=c.x+Math.sin(a)*r,tz=c.z+Math.cos(a)*r;
  camera.position.set(tx,Math.max(H(tx,tz)+.5,c.y+h),tz);
  let look=new V3(c.x,c.y+.4,c.z);
  if(PL.killer&&PL.killer.alive&&PL.deathT>1.6){const kp=PL.killer.pos.clone().setY(PL.killer.pos.y+1.4);look.lerp(kp,Math.min(1,(PL.deathT-1.6)/1.2));}
  camera.lookAt(look);
  if(camera.fov!==75){camera.fov=75;camera.updateProjectionMatrix();particleScale();}
  $('scope').hidden=true;VM.g.visible=false;
}
function playerHurt(dmg,attacker,zone,dir){
  const u=PL.u;
  FX.hurt=Math.min(1,FX.hurt+dmg/60);FX.trauma=Math.min(1,FX.trauma+.18);
  PL.kickP+=rand(-.04,.08);PL.kickY+=rand(-.06,.06);
  play('flesh',{vol:.7});if(zone==='head')FX.white=Math.max(FX.white,.15);
  if(Math.random()<.6)painGrunt(null,.35);
  if(attacker&&attacker!==u){const ang=Math.atan2(attacker.pos.x-u.pos.x,attacker.pos.z-u.pos.z);showDmgDir(ang);}
  if(u.deployed&&dmg>30)undeploy();
  if(PL.ads>.5&&curWD().scope&&dmg>10)PL.ads=0;
}
function playerDied(attacker,wid){
  const u=PL.u;PL.deathT=0;PL.killer=attacker;PL.deathYaw=PL.yaw+Math.PI;PL.nadeHold&&PL.nadeHold.nade&&(PL.nadeHold.nade.held=null);PL.nadeHold=null;
  PL.ads=0;PL.reloadT=0;u.deployed=false;FX.hurt=1;FX.blur=.6;muffle(500,3);
  if(u.model)u.model.root.visible=true;
  const by=attacker&&attacker!==u?`${attacker.name} · ${wid==='arty'?'artillery':WEAPONS[wid]?WEAPONS[wid].name:wid}`:wid==='arty'?'Artillery':'You died';
  center('YOU ARE DEAD',by);
  $('cap').hidden=true;
}
