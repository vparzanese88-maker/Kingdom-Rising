'use strict';
/* ================= Shooting (shared by bots and the player) ================= */
const _v1=new V3(),_v2=new V3(),_v3=new V3();
function spreadDir(dir,spread,out){
  if(spread<=0)return out.copy(dir);
  const r=spread*Math.sqrt(Math.random()),a=Math.random()*TAU;
  const up=Math.abs(dir.y)<.95?_v3.set(0,1,0):_v3.set(1,0,0);
  const right=_v2.crossVectors(dir,up).normalize();const up2=_v3.crossVectors(right,dir).normalize();
  return out.copy(dir).addScaledVector(right,Math.cos(a)*r).addScaledVector(up2,Math.sin(a)*r).normalize();
}
const r2=v=>Math.round(v*100)/100;
// muzzle velocities (m/s): bullets fly, drop and take time to arrive
const MUZZLE_V={garand:853,carbine:600,thompson:285,greasegun:280,springfield:853,bar:850,m1919:850,k98:760,g43:745,mp40:400,mp44:685,k98s:760,mg34:755,mg42:755,colt:253,luger:350};
const GRAV=9.81;
const BULLETS=[];
// fire a round. On the host and offline it does damage; on a client it is only seen and heard.
function fireBullet(u,o,dir,W,wid,isTracer,visual){
  const sp=MUZZLE_V[wid]||700;
  const b={u,p:o.clone(),v:dir.clone().multiplyScalar(sp),W,wid,dmg:!Net.client&&!visual,team:u.team,dist:0,age:0,cracked:new Set(),tr:null};
  if(isTracer){const tr=tracers[tracerI];tracerI=(tracerI+1)%tracers.length;tr.m.visible=true;tr.owner=b;b.tr=tr;}
  BULLETS.push(b);
  if(Net.host&&!visual)Net.event(['shot',u.id,r2(o.x),r2(o.y),r2(o.z),Math.round(dir.x*1e4)/1e4,Math.round(dir.y*1e4)/1e4,Math.round(dir.z*1e4)/1e4,wid,isTracer?1:0]);
  if(Net.client&&u===PL.u&&!visual)Net.send({t:'fire',o:[r2(o.x),r2(o.y),r2(o.z)],d:[dir.x,dir.y,dir.z],w:wid,tr:isTracer?1:0});
}
const _bd=new V3();
function updateBullets(dt){
  for(let i=BULLETS.length-1;i>=0;i--){const b=BULLETS[i];
    let done=false,left=dt;
    while(left>0&&!done){const h=Math.min(left,1/60);left-=h;
      const p=b.p,v=b.v;const sp=v.length();_bd.copy(v).divideScalar(sp);const L=sp*h;
      const wh=rayWorld(p.x,p.y,p.z,_bd.x,_bd.y,_bd.z,L);
      const uh=rayUnits(p,_bd,wh?wh.t:L,b.u,b.team);
      // near misses: crack overhead for the player, suppression for bots
      const segT=uh?uh.t:wh?wh.t:L;
      for(const t of UNITS){if(!t.alive||t.team===b.team||b.cracked.has(t))continue;
        const ex=t.pos.x-p.x,ey=t.pos.y+1.2-p.y,ez=t.pos.z-p.z;const al=ex*_bd.x+ey*_bd.y+ez*_bd.z;if(al<0||al>segT)continue;
        const px=ex-_bd.x*al,py=ey-_bd.y*al,pz=ez-_bd.z*al;const d=Math.sqrt(px*px+py*py+pz*pz);if(d>3.2)continue;b.cracked.add(t);
        if(t.isPlayer){if(!(uh&&uh.u===t)){play(sp>343&&b.dist>20?'crack':'whiz',{pos:new V3(p.x+_bd.x*al,p.y+_bd.y*al,p.z+_bd.z*al),vol:.5,travel:false,ref:3});
          FX.trauma=Math.min(.4,FX.trauma+.02);FX.aberr=Math.min(1,FX.aberr+.2);PL.suppress=Math.min(1,PL.suppress+.2);}}
        else if(t.brain&&d<2.6&&b.dmg)t.brain.suppress+=(b.W.mg?.22:.12)*(1-d/2.6);}
      if(uh){
        const hp=new V3(p.x+_bd.x*uh.t,p.y+_bd.y*uh.t,p.z+_bd.z*uh.t);const dist=b.dist+uh.t;
        let dmg=b.W.dmg*ZONE_MUL[uh.zone];
        if((b.W.type==='auto'||b.W.pistol)&&!b.W.mg)dmg*=clamp(1-(dist-35)/170,.55,1);
        goreHit(hp,_bd,uh.zone,uh.u,dmg);
        if(b.ric)dmg*=.5;
        if(b.dmg){const before=uh.u.alive;hurt(uh.u,dmg,b.u,b.wid,uh.zone,_bd.clone());
          if(before&&b.u.isPlayer)hitMarker(!uh.u.alive,uh.zone==='head');else if(before&&b.u.remote)Net.event(['hm',b.u.id,uh.u.alive?0:1,uh.zone==='head'?1:0]);}
        done=true;p.copy(hp);
      }else if(wh){impactFX(wh,_bd);p.set(wh.x,wh.y,wh.z);
        // ricochet: glancing hits skip off steel, concrete, stone, water and even sand; machine-gun fire most of all
        const cosI=-(_bd.x*wh.nx+_bd.y*wh.ny+_bd.z*wh.nz);const hard={metal:.85,concrete:.7,stone:.65,water:.45,sand:.35,dirt:.25,grass:.2,wood:.12,timber:.12,sandbag:.1}[wh.mat]||.15;
        const chance=hard*(1.3-cosI)*(b.W.mg?1.7:b.W.type==='auto'?1:.7)*(b.ric?.45:1);
        if((b.ric||0)<2&&Math.random()<chance){
          b.ric=(b.ric||0)+1;const dn=2*(_bd.x*wh.nx+_bd.y*wh.ny+_bd.z*wh.nz);
          _bd.set(_bd.x-dn*wh.nx,_bd.y-dn*wh.ny,_bd.z-dn*wh.nz);spreadDir(_bd,.22,_bd);if(_bd.y<.02)_bd.y=Math.abs(_bd.y)+.05;_bd.normalize();
          v.copy(_bd).multiplyScalar(sp*rand(.3,.6));p.addScaledVector(_bd,.05);b.cracked.clear();
          if(wh.mat!=='water'&&wh.mat!=='sand'&&wh.mat!=='dirt'&&wh.mat!=='grass')for(let k=0;k<6;k++)glow.spawn(wh.x,wh.y,wh.z,_bd.x*rand(4,12)+rand(-2,2),_bd.y*rand(4,12)+rand(0,3),_bd.z*rand(4,12)+rand(-2,2),rand(.08,.2),.05,.02,1,1,.75,.4,2,12);
          play('ric',{pos:p.clone(),vol:b.W.mg?.42:.32,maxD:90,jit:.15});
        }else done=true;}
      else{p.addScaledVector(v,h);v.y-=GRAV*h;v.multiplyScalar(1-h*.12);b.dist+=L;}
      b.age+=h;if(b.age>3||b.dist>900||p.y<-30)done=true;
    }
    if(b.tr){const tr=b.tr;if(tr.owner!==b)b.tr=null;else{const len=Math.min(7,b.dist+.5);_bd.copy(b.v).normalize();tr.m.position.copy(b.p);tr.m.lookAt(b.p.x-_bd.x,b.p.y-_bd.y,b.p.z-_bd.z);tr.m.scale.set(1,1,len);if(done){tr.m.visible=false;tr.owner=null;}}}
    if(done)BULLETS.splice(i,1);
  }
}
// aim above a target far away so the round drops onto it (skill decides how well)
function dropComp(dir,dist,wid,skill){const sp=MUZZLE_V[wid]||700;const t=dist/sp;dir.y+=.5*GRAV*t*t/dist*skill;return dir.normalize();}
function gunSound(u,W,o){
  if(u.isPlayer)play('g_'+W.snd,{vol:.75,rev:.18,jit:.04});
  else play('g_'+W.snd,{pos:o,vol:.9,ref:7,jit:.05});
}

/* ================= Grenades ================= */
const NADES=[];let nadeSeq=0;
const nadeMeshes={};
function nadeMesh(id){const m=new THREE.Mesh(mergeGeos([...weaponModel(id).p]),SMAT);m.castShadow=true;scene.add(m);return m;}
function throwNade(u,o,v,fuse,id){
  const n={nid:++nadeSeq,p:o.clone(),v:v.clone(),fuse,owner:u,id,mesh:nadeMesh(id),rest:false,held:null,rot:new V3(rand(-8,8),rand(-8,8),rand(-8,8))};
  NADES.push(n);
  if(u.team===0&&!u.isPlayer)shout(u,'nade');else if(!u.isPlayer)shout(u,'nade');
  return n;
}
const _nb=[];
function updateNades(dt){
  for(let i=NADES.length-1;i>=0;i--){const n=NADES[i];
    n.fuse-=dt;
    if(n.held){const h=n.held;if(!h.alive){n.held=null;n.p.copy(h.pos).setY(h.pos.y+1);n.v.set(0,0,0);}else{h.eye(n.p);n.p.y-=.3;}}
    else if(!n.rest){
      n.v.y-=14*dt;const np=_v1.copy(n.p).addScaledVector(n.v,dt);
      let bounced=false;
      for(const s of solidsNear(np.x,np.z,.3,_nb)){if(np.x>s.x0&&np.x<s.x1&&np.y>s.y0&&np.y<s.y1&&np.z>s.z0&&np.z<s.z1){
        if(n.p.x<=s.x0||n.p.x>=s.x1)n.v.x*=-.4;else if(n.p.z<=s.z0||n.p.z>=s.z1)n.v.z*=-.4;else{n.v.y*=-.3;n.v.x*=.6;n.v.z*=.6;if(n.p.y>=s.y1)np.y=s.y1+.03;}
        bounced=true;break;}}
      if(!bounced)n.p.copy(np);
      const g=H(n.p.x,n.p.z);
      if(n.p.y<g+.04){n.p.y=g+.04;if(g<-.05){n.v.multiplyScalar(.2);n.rest=true;}
        else{if(n.v.y<-1.5)play('clink',{pos:n.p.clone(),vol:.4});n.v.y*=-.3;n.v.x*=.55;n.v.z*=.55;if(Math.hypot(n.v.x,n.v.y,n.v.z)<.6)n.rest=true;}}
      if(bounced&&Math.hypot(n.v.x,n.v.z)>1)play('clink',{pos:n.p.clone(),vol:.35});
      n.mesh.rotation.x+=n.rot.x*dt;n.mesh.rotation.y+=n.rot.y*dt;n.rot.multiplyScalar(n.rest?0:1);
    }
    n.mesh.position.copy(n.p);n.mesh.visible=!(n.held&&n.held.isPlayer);
    if(n.fuse<=0){scene.remove(n.mesh);NADES.splice(i,1);explosion(n.p.clone().setY(n.p.y+.15),1,n.owner,n.id);}
  }
}
function clearNades(){for(const n of NADES)scene.remove(n.mesh);NADES.length=0;}
// ballistic launch velocity to land near target (lob ~40 degrees)
function lobVelocity(o,t,maxV){
  const dx=t.x-o.x,dz=t.z-o.z,dy=t.y-o.y;const d=Math.hypot(dx,dz);const g=14;const th=.72;
  let v=Math.sqrt(Math.max(1,g*d*d/(2*Math.cos(th)*Math.cos(th)*Math.max(.5,d*Math.tan(th)-dy))));v=Math.min(v,maxV);
  return new V3(dx/d*v*Math.cos(th),v*Math.sin(th),dz/d*v*Math.cos(th));
}

/* ================= Bot brain ================= */
const DIFF=[{err:.06,react:.8,acc:.7},{err:.04,react:.5,acc:1},{err:.026,react:.32,acc:1.3}];
const SPOTS={};
function coverSpots(fi,team){
  const key=fi+'_'+team;if(SPOTS[key])return SPOTS[key];
  const f=FLAG_DEFS[fi];const ez=team===0?-1:1;const out=[];const tmp=[];
  for(let k=0;k<260&&out.length<26;k++){
    const a=rand(0,TAU),r=rand(3,f.r+8);const x=f.x+Math.cos(a)*r,z=f.z+Math.sin(a)*r;if(!walkable(x,z))continue;const h=H(x,z);
    // cover: something chest-high just toward the enemy
    let cov=false;for(const s of solidsNear(x,z+ez*1,1.2,tmp)){const ch=s.y1-h;if(ch>.75&&ch<1.7&&s.y0<h+.6&&x>s.x0-.4&&x<s.x1+.4){const dz=ez<0?(z-s.z1):(s.z0-z);if(dz>-.2&&dz<1.2){cov=true;break;}}}
    if(!cov&&z>-14&&z<4&&trenchDist(x,z)<.7)cov=true;
    if(cov)out.push({x,z});
  }
  for(let k=0;k<60&&out.length<14;k++){const a=rand(0,TAU),r=rand(2,f.r*.8);const x=f.x+Math.cos(a)*r,z=f.z+Math.sin(a)*r;if(walkable(x,z))out.push({x,z});}
  return SPOTS[key]=out;
}
const ROLE_SPEED={mg:.88,support:.92};
class Brain{
  constructor(u){this.u=u;u.brain=this;this.reset();}
  reset(){
    Object.assign(this,{goal:null,goalT:0,path:null,pathI:0,pathT:0,target:null,seenT:0,trackT:0,reactT:0,lastSeen:null,lastSeenT:-99,percT:rand(0,.3),
      burst:0,burstT:0,shotT:0,suppress:0,strafeT:0,strafeDir:1,stuckT:0,lastPos:new V3(),sideT:0,side:new V3(),fleeT:0,flee:new V3(),
      nadeT:rand(4,10),hold:null,threat:null,threatT:-99,spokeEnemy:false,wantStance:'stand',sprint:false,jumpT:0,deployYaw:0,
      wander:new V3(),wanderT:0,lane:rand(-1,1)});
  }
  onDeath(){this.target=null;this.path=null;}
  onHurt(a){if(a&&a.alive){this.threat=a;this.threatT=GAME.time;if(!this.target||!this.canSeeT)this.reactT=Math.min(this.reactT,.2);}this.suppress+=.3;}
  role(){const id=this.u.cls.id;return(id==='mg'||id==='mg34'||id==='mg42')?'mg':id==='sniper'?'sniper':'rifle';}
  chooseGoal(){
    const u=this.u,team=u.team;const flags=G.flags;
    const notOurs=flags.filter(f=>f.owner!==team),ours=flags.filter(f=>f.owner===team);
    const front=t=>team===0?Math.min(...t.map(f=>f.tier)):Math.max(...t.map(f=>f.tier));
    let attack=notOurs.length?notOurs.filter(f=>f.tier===front(notOurs)):[];
    // defend own flags that border enemy ones
    const defend=ours.filter(f=>notOurs.some(n=>Math.abs(n.tier-f.tier)<=1));
    const role=this.role();
    const aggr=team===0?.84:attack.length&&attack[0].tier===0?.1:.3;
    let mode=Math.random()<aggr?'attack':'defend';
    if(this.forceDefend)mode='defend';if(!attack.length)mode='defend';if(!defend.length)mode='attack';
    if(role!=='rifle'&&defend.length&&Math.random()<.85)mode='perch';
    if(mode==='perch'){
      const opts=PERCHES.filter(p=>p.team===team&&defend.includes(flags[p.flag])&&(p.role===role||(role==='sniper'&&p.role==='rifle'))&&!UNITS.some(o=>o!==u&&o.alive&&o.brain&&o.brain.goal&&o.brain.goal.perch===p));
      if(opts.length){const p=pick(opts);this.goal={type:'spot',x:p.x,z:p.z,perch:p,flag:p.flag};this.goalT=rand(40,70);this.path=null;return;}
      mode='defend';
    }
    if(mode==='attack'&&attack.length){
      // spread attackers over parallel flags, prefer the nearer one
      let best=attack[0],bs=1e9;for(const f of attack){const s=Math.hypot(f.x-u.pos.x,f.z-u.pos.z)*rand(.6,1.4);if(s<bs){bs=s;best=f;}}
      this.goal={type:'flag',fi:best.i};this.goalT=rand(12,20);this.path=null;return;
    }
    // cap defenders per flag so big teams spread out instead of packing two bunkers
    let mates=0;const on=[0,0,0,0,0,0,0,0];for(const o of UNITS)if(o.team===team&&o!==u){mates++;if(o.alive&&o.brain&&o.brain.goal&&o.brain.goal.flag!=null&&o.brain.goal.type==='spot')on[o.brain.goal.flag]++;}
    const cap=Math.max(5,Math.round(mates*.2));
    let pool=(defend.length?defend:ours.length?ours:flags).filter(f=>on[f.i]<cap);
    if(!pool.length)pool=ours.filter(f=>on[f.i]<cap);
    if(!pool.length&&attack.length){const best=attack[randi(0,attack.length-1)];this.goal={type:'flag',fi:best.i};this.goalT=rand(12,20);this.path=null;return;}
    const f=pick(pool.length?pool:defend.length?defend:ours.length?ours:flags);const spots=coverSpots(f.i,team);const s=pick(spots)||{x:f.x,z:f.z};
    this.goal={type:'spot',x:s.x,z:s.z,flag:f.i};this.goalT=rand(15,30);this.path=null;
  }
  // nearest visible enemy
  perceive(){
    const u=this.u,eye=u.eye(_v1),fx=Math.sin(u.yaw),fz=Math.cos(u.yaw);const W=u.W;
    const range=W.scope?260:W.mg?190:W.type==='auto'?130:170;
    let best=null,bd=1e9;
    for(const e of UNITS){if(!e.alive||e.team===u.team)continue;
      const dx=e.pos.x-u.pos.x,dz=e.pos.z-u.pos.z;const d=Math.hypot(dx,dz);if(d>range)continue;
      const heard=GAME.time-e.lastShot<1.2&&d<45;const front=(dx*fx+dz*fz)/Math.max(d,.01);
      if(front<-.15&&d>10&&!heard&&e!==this.threat)continue;
      // a quiet soldier who is crouched or prone is hard to pick out, harder still in long grass or against a hedge
      const quiet=GAME.time-e.lastShot>2.5,moving=Math.hypot(e.vel.x,e.vel.z)>1.2;
      if(quiet&&e!==this.target&&e!==this.threat){
        let see=e.stance==='prone'?.22:e.stance==='crouch'?.5:1;
        if(see<1){if(moving)see*=1.5;if(e.pos.z<32&&e.pos.z>-170&&H(e.pos.x,e.pos.z)>1)see*=.8;for(const s of solidsNear(e.pos.x,e.pos.z,2.2,_sn))if(s.mat==='hedge'){see*=.7;break;}}
        if(d>range*see)continue;
        if(see<1&&d>12&&Math.random()>see+.25)continue;
      }
      let score=d*(e===this.target?.6:1)*(e===this.threat&&GAME.time-this.threatT<4?.5:1);
      if(score>=bd)continue;
      const tgt=e.center(_v2);if(e.stance!=='prone')tgt.y+=.2;
      if(!clearLine(eye,tgt))continue;
      best=e;bd=score;
    }
    if(best!==this.target){
      if(best){this.reactT=DIFF[SET.diff].react+rand(0,.35)+Math.hypot(best.pos.x-u.pos.x,best.pos.z-u.pos.z)/220+(best.stance==='prone'?.6:best.stance==='crouch'?.25:0);this.trackT=0;
        if(!this.spokeEnemy&&Math.random()<.25){shout(u,best.W.mg?'mg':best.W.scope?'sniper':'enemy');this.spokeEnemy=true;}}
      this.target=best;
    }
    if(best){this.lastSeen=best.pos.clone();this.lastSeenT=GAME.time;}
  }
  think(dt){
    const u=this.u,W=u.W,role=this.role();
    this.suppress=Math.max(0,Math.min(1.5,this.suppress)-dt*.35);
    this.percT-=dt;if(this.percT<=0){this.percT=rand(.18,.32);this.perceive();}
    this.goalT-=dt;if(!this.goal||this.goalT<=0)this.chooseGoal();
    if(this.goal&&this.goal.type==='flag'&&G.flags[this.goal.fi].owner===u.team&&G.flags[this.goal.fi].prog<=0)this.chooseGoal();
    const tg=this.target&&this.target.alive?this.target:null;if(!tg)this.target=null;
    // ---- danger: live grenade close by ----
    if(this.fleeT<=0){for(const n of NADES){const d=Math.hypot(n.p.x-u.pos.x,n.p.z-u.pos.z);if(d<6&&n.fuse>.6&&!n.held){this.fleeT=Math.min(n.fuse,2.2);this.flee.set(u.pos.x-n.p.x,0,u.pos.z-n.p.z).normalize();if(Math.random()<.6)shout(u,'seeNade');
      // a quick soldier picks it up and throws it back
      if(d<1.6&&Math.random()<.25*(SET.diff+1)&&n.fuse>1.3&&n.owner.team!==u.team){n.held=u;n.owner=u;this.fleeT=0;this.heldNade=n;}break;}}}
    if(this.heldNade){const n=this.heldNade;if(!NADES.includes(n)||n.held!==u){this.heldNade=null;}else if(n.fuse<rand(.8,1.6)||!tg){const aim=this.lastSeen||new V3(u.pos.x,u.pos.y,u.pos.z+(u.team?12:-12));
      n.held=null;n.p.copy(u.eye(_v1));n.v.copy(lobVelocity(n.p,aim,WEAPONS[n.id].throwV));this.heldNade=null;n.rest=false;shout(u,'nade');}}
    // ---- movement intent ----
    let mx=0,mz=0,speed=5.2*(ROLE_SPEED[u.cls.id==='support'?'support':role]||1);let stance='stand';let faceYaw=null;
    let wantFire=false;
    const dGoal=this.goalDist();
    if(this.fleeT>0){this.fleeT-=dt;mx=this.flee.x;mz=this.flee.z;speed=7;}
    else if(tg){
      const dx=tg.pos.x-u.pos.x,dz=tg.pos.z-u.pos.z,d=Math.hypot(dx,dz);
      faceYaw=Math.atan2(dx,dz);this.trackT+=dt;wantFire=true;
      const atPerch=this.goal&&this.goal.perch&&dGoal<1.2;
      if(role==='mg'){if(atPerch&&this.goal.perch.deployY){stance=this.deployStance(this.goal.perch.deployY);u.deployed=true;}else if(d>12){stance='prone';u.deployed=u.stance==='prone';}else stance='crouch';}
      else if(role==='sniper'){stance=d>40?(atPerch?'crouch':'prone'):'crouch';}
      else if(W.type==='auto'){
        // close in and strafe
        this.strafeT-=dt;if(this.strafeT<=0){this.strafeT=rand(.6,1.6);this.strafeDir=Math.random()<.5?-1:1;}
        const adv=d>22?1:d<9?-.3:0;const sx=Math.cos(faceYaw)*this.strafeDir,sz=-Math.sin(faceYaw)*this.strafeDir;
        mx=dx/d*adv+sx*.8;mz=dz/d*adv+sz*.8;speed=4.2;if(this.suppress>.8&&d>25)stance='crouch';
        if(d>40&&this.goal&&!(this.goal.type==='spot'&&dGoal<2)){wantFire=d<70;mx=0;mz=0;this.moveToGoal();mx=this.mv.x;mz=this.mv.z;speed=5;}
      }else{
        if(d<20){this.strafeT-=dt;if(this.strafeT<=0){this.strafeT=rand(.8,2);this.strafeDir=Math.random()<.5?-1:1;}mx=Math.cos(faceYaw)*this.strafeDir;mz=-Math.sin(faceYaw)*this.strafeDir;speed=3;}
        else{
          // bounding overwatch: fire from a knee for a few seconds, then get up and push toward the objective
          this.bound=(this.bound||0)-dt;if(this.bound<=0){this.bounding=!this.bounding;this.bound=this.bounding?rand(3,6):rand(1.5,3.5);}
          const attacking=this.goal&&this.goal.type==='flag'&&G.flags[this.goal.fi].owner!==u.team&&dGoal>8;
          if(attacking&&this.bounding&&this.suppress<1.1){this.moveToGoal();mx=this.mv.x;mz=this.mv.z;speed=5;wantFire=d<45;}
          else stance=this.suppress>.7&&d>50?'prone':'crouch';
        }
      }
      if(atPerch&&role!=='mg')stance=stance==='prone'?'prone':'crouch';
    }else{
      u.deployed=false;
      if(this.lastSeen&&GAME.time-this.lastSeenT<4&&role!=='mg'&&role!=='sniper'&&Math.hypot(this.lastSeen.x-u.pos.x,this.lastSeen.z-u.pos.z)<40){
        // grenade over the wall, then push the last known position
        if(u.weps.nade.count>0&&this.nadeT<=0&&Math.hypot(this.lastSeen.x-u.pos.x,this.lastSeen.z-u.pos.z)>8){this.throwAt(this.lastSeen);}
        this.moveToPoint(this.lastSeen.x,this.lastSeen.z);mx=this.mv.x;mz=this.mv.z;speed=4.5;
        if(Math.hypot(this.lastSeen.x-u.pos.x,this.lastSeen.z-u.pos.z)<3)this.lastSeen=null;
      }else{
        this.moveToGoal();mx=this.mv.x;mz=this.mv.z;
        if(this.mvDone){
          // holding: crouch behind cover, look toward the enemy side, scan a little
          stance=role==='sniper'||role==='mg'?(this.goal&&this.goal.perch&&this.goal.perch.deployY?this.deployStance(this.goal.perch.deployY):'prone'):'crouch';
          if(role==='rifle'&&this.goal&&this.goal.type==='flag')stance=Math.random()<.002?'stand':u.stance==='stand'?'stand':'crouch';
          this.wanderT-=dt;if(this.wanderT<=0){this.wanderT=rand(1.5,4);this.wander.set(rand(-.9,.9),0,0);}
          faceYaw=(u.team===0?Math.PI:0)+this.wander.x+(this.goal&&this.goal.perch?this.goal.perch.yaw:0);
          if(this.goal&&this.goal.type==='flag'){const f=G.flags[this.goal.fi];if(f.owner!==u.team&&Math.random()<dt*.4){const a=rand(0,TAU),r=rand(0,f.r*.55);this.goal.sub={x:f.x+Math.cos(a)*r,z:f.z+Math.sin(a)*r};}}
        }else{
          const far=dGoal>30&&this.suppress<.3;this.sprint=far&&u.stam>30;speed*=this.sprint?1.38:1;
        }
      }
    }
    if(this.suppress>1&&!tg&&Math.random()<dt)stance='crouch';
    // obstacle handling: stuck detection and sidestep
    if(this.sideT>0){this.sideT-=dt;mx=this.side.x;mz=this.side.z;}
    this.stuckT+=dt;
    if(this.stuckT>1.2){const moved=Math.hypot(u.pos.x-this.lastPos.x,u.pos.z-this.lastPos.z);this.lastPos.copy(u.pos);this.stuckT=0;
      if(moved<.5&&(mx||mz)&&!tg){this.stuck=(this.stuck||0)+1;const a=rand(0,TAU);this.side.set(Math.cos(a),0,Math.sin(a));this.sideT=rand(.4,.9);this.path=null;if(this.stuck>4){this.chooseGoal();this.stuck=0;}}else this.stuck=0;}
    // separation from friends
    for(const o of UNITS){if(o===u||!o.alive||o.team!==u.team)continue;const dx=u.pos.x-o.pos.x,dz=u.pos.z-o.pos.z,d2=dx*dx+dz*dz;if(d2<2.2&&d2>1e-4){const d=Math.sqrt(d2);mx+=dx/d*(1.5-d)*.8;mz+=dz/d*(1.5-d)*.8;}}
    const ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml;}
    if(stance==='prone'&&u.stance!=='prone'&&(mx||mz)&&!tg)stance='crouch';
    if(stance!=='prone'&&stance!=='crouch'&&role!=='mg')u.deployed=false;
    this.wantStance=stance;
    // ---- aiming and shooting ----
    if(faceYaw===null&&(mx||mz))faceYaw=Math.atan2(mx,mz);
    if(faceYaw!==null){const turn=(tg?5.5:4)*dt;u.yaw+=clamp(angDiff(u.yaw,faceYaw),-turn,turn);}
    let wantPitch=0;
    if(tg){const e=u.eye(_v1),t=tg.center(_v2);const d=Math.hypot(t.x-e.x,t.z-e.z);wantPitch=Math.atan2(t.y-e.y,d);}
    u.pitch+=(wantPitch-u.pitch)*Math.min(1,dt*6);
    this.nadeT-=dt;
    this.weaponLogic(dt,tg,wantFire);
    if(tg&&u.weps.nade.count>0&&this.nadeT<=0&&W.type!=='bolt'){const d=Math.hypot(tg.pos.x-u.pos.x,tg.pos.z-u.pos.z);if(d>9&&d<26&&(tg.stance!=='stand'||Math.random()<.3)&&Math.random()<.02)this.throwAt(tg.pos);}
    return{mx,mz,speed:this.sprint&&!tg?speed:speed};
  }
  deployStance(y){const u=this.u;const h=y-u.pos.y;return h<.95?'crouch':'stand';}
  goalDist(){const g=this.goalPoint();return g?Math.hypot(g.x-this.u.pos.x,g.z-this.u.pos.z):0;}
  goalPoint(){const g=this.goal;if(!g)return null;if(g.type==='flag'){if(g.sub)return g.sub;const f=G.flags[g.fi];return{x:f.x,z:f.z};}return g;}
  moveToGoal(){
    const u=this.u;this.mv=this.mv||new V3();this.mvDone=false;
    const g=this.goal;if(!g){this.mv.set(0,0,0);return;}
    const gp=this.goalPoint();const d=Math.hypot(gp.x-u.pos.x,gp.z-u.pos.z);
    if(g.type==='flag'){const f=G.flags[g.fi];
      if(d<(g.sub?1.2:f.r*.55)){this.mvDone=true;this.mv.set(0,0,0);return;}
      if(d>14||!g.sub){const nx=flowNext(FLAG_DEFS[g.fi].field,u.pos.x,u.pos.z,_v3);if(nx){const dx=nx.x-u.pos.x+this.lane*.6,dz=nx.z-u.pos.z;const l=Math.hypot(dx,dz)||1;this.mv.set(dx/l,0,dz/l);return;}}
      this.moveToPoint(gp.x,gp.z);return;}
    if(d<.8){this.mvDone=true;this.mv.set(0,0,0);return;}
    this.moveToPoint(gp.x,gp.z);
  }
  moveToPoint(x,z){
    const u=this.u;this.mv=this.mv||new V3();this.mvDone=false;
    const d=Math.hypot(x-u.pos.x,z-u.pos.z);
    if(d<6&&clearLine(_v1.set(u.pos.x,u.pos.y+.9,u.pos.z),_v2.set(x,H(x,z)+.9,z))){this.mv.set((x-u.pos.x)/d,0,(z-u.pos.z)/d);this.path=null;if(d<.5)this.mvDone=true;return;}
    this.pathT-=1/60;
    if(!this.path||this.pathT<=0||!this.pathTo||Math.hypot(this.pathTo.x-x,this.pathTo.z-z)>3){
      // long trips ride the flag flow field first
      if(d>45&&this.goal&&this.goal.flag!=null){const nx=flowNext(FLAG_DEFS[this.goal.flag].field,u.pos.x,u.pos.z,_v3);if(nx){const dx=nx.x-u.pos.x,dz=nx.z-u.pos.z,l=Math.hypot(dx,dz)||1;this.mv.set(dx/l,0,dz/l);return;}}
      this.path=findPath(u.pos.x,u.pos.z,x,z,6000);this.pathI=0;this.pathT=4;this.pathTo={x,z};
      if(!this.path){this.mv.set((x-u.pos.x)/d,0,(z-u.pos.z)/d);return;}}
    while(this.pathI<this.path.length-1&&Math.hypot(this.path[this.pathI].x-u.pos.x,this.path[this.pathI].z-u.pos.z)<1.2)this.pathI++;
    const w=this.path[this.pathI];const dx=w.x-u.pos.x,dz=w.z-u.pos.z,l=Math.hypot(dx,dz)||1;this.mv.set(dx/l,0,dz/l);
  }
  throwAt(p){
    const u=this.u;if(u.weps.nade.count<=0)return;u.weps.nade.count--;this.nadeT=rand(8,16);
    const o=u.eye(new V3());const tgt=new V3(p.x+rand(-1.5,1.5),H(p.x,p.z),p.z+rand(-1.5,1.5));
    const v=lobVelocity(o,tgt,WEAPONS[NADE[u.team]].throwV);
    throwNade(u,o,v,WEAPONS[NADE[u.team]].fuse-rand(.3,1.2),NADE[u.team]);u.model&&(u.model.kick=1);
  }
  weaponLogic(dt,tg,wantFire){
    const u=this.u;const w=u.weps[u.cur];const W=WEAPONS[w.id];
    if(u.reloadT>0){u.reloadT-=dt;if(u.reloadT<=0){const need=W.mag-w.mag,take=Math.min(need,w.res);w.mag+=take;w.res-=take;}return;}
    if(w.boltT>0){w.boltT-=dt;if(w.boltT<=0&&u.pos.distanceTo(camera.position)<25)play('boltFwd',{pos:u.pos.clone().setY(u.pos.y+1.4),vol:.4});return;}
    if(w.mag<=0){if(w.res>0){u.reloadT=W.reload*rand(1,1.2);if(Math.random()<.2)shout(u,'reload');play(W.clip?'clipIn':'magIn',{pos:u.pos.clone().setY(u.pos.y+1.3),vol:.35,delay:W.reload*.7,maxD:25});}
      else if(u.cur==='primary'&&u.weps.pistol){u.cur='pistol';}
      else if(u.cur!=='melee'){u.cur='melee';}
      return;}
    if(!tg){if(w.mag<W.mag*.4&&w.res>0&&u.cur!=='melee'){u.reloadT=W.reload;}return;}
    // melee when close
    const d=Math.hypot(tg.pos.x-u.pos.x,tg.pos.z-u.pos.z);
    if(d<1.8){u.cool=(u.cool||0)-dt;if(u.cool<=0){u.cool=.7;play('swish',{pos:u.pos.clone().setY(u.pos.y+1.3),vol:.4});const MW=WEAPONS[MELEE[u.team]];
      if(Math.abs(angDiff(u.yaw,Math.atan2(tg.pos.x-u.pos.x,tg.pos.z-u.pos.z)))<.6){play('stab',{pos:tg.pos.clone().setY(tg.pos.y+1.2),vol:.6});hurt(tg,MW.dmg,u,MELEE[u.team],'melee',new V3(tg.pos.x-u.pos.x,0,tg.pos.z-u.pos.z).normalize());}}return;}
    if(u.cur==='melee')return;
    if(this.reactT>0){this.reactT-=dt;return;}
    if(!wantFire)return;
    u.cool=(u.cool||0)-dt;if(u.cool>0)return;
    // aim error shrinks while tracking
    const D=DIFF[SET.diff];
    let err=D.err*(.35+.65*Math.exp(-this.trackT/1.3))+Math.hypot(tg.vel.x,tg.vel.z)*.004+this.suppress*.03+(Math.hypot(u.vel.x,u.vel.z)>1?.02:0);
    if(W.scope)err*=.35;if(u.deployed)err*=.8;if(tg.isPlayer||tg.human)err*=1.15;
    if(tg.stance==='prone')err*=1.35;else if(tg.stance==='crouch')err*=1.15;
    if(W.mg&&!u.deployed)err+=.05;
    const e=u.eye(new V3());const aim=tg.center(new V3());
    if(tg.stance!=='prone')aim.y+=Math.random()<(W.scope?.35:.12)*D.acc?.5:.18;
    const dir=aim.sub(e).normalize();const fx=Math.sin(u.yaw),fz=Math.cos(u.yaw);
    if(dir.x*fx+dir.z*fz<.9)return;// not facing yet
    dropComp(dir,d,w.id,[.75,.92,1][SET.diff]);
    spreadDir(dir,err,dir);
    const spread=u.deployed?(W.dep||W.ads):Math.hypot(u.vel.x,u.vel.z)>1?W.hip*.6:W.ads;
    spreadDir(dir,spread,dir);
    const o=e.addScaledVector(dir,.6);
    fireBullet(u,o,dir,W,w.id,W.tracer&&Math.random()<1/W.tracer);
    muzzleFX(o,dir,!!W.mg);gunSound(u,W,o);u.lastShot=GAME.time;u.model&&(u.model.kick=1);
    if(o.distanceTo(camera.position)<60)flashAt(o,1.5,.05,8);
    w.mag--;
    if(W.ping&&w.mag===0)play('ping',{pos:o,vol:.45,delay:.05,maxD:40});
    if(W.type==='bolt'){w.boltT=W.bolt*rand(1,1.3);u.cool=.1;if(o.distanceTo(camera.position)<25)play('boltUp',{pos:o,vol:.4,delay:.35});}
    else if(W.type==='semi')u.cool=W.rof+rand(.25,.7)+d/250;
    else{if(this.burst<=0){this.burst=W.mg?(u.deployed?randi(8,22):randi(4,8)):randi(3,7);}
      this.burst--;u.cool=W.rof;if(this.burst<=0)u.cool+=rand(.25,.7)+(W.mg?.2:0);}
  }
}
// physics shared with the player: walk a unit toward (mx,mz)
function moveUnit(u,mx,mz,speed,dt){
  const st=u.stance;let sp=speed*(st==='prone'?.18:st==='crouch'?.45:1);
  if(u.deployed)sp=0;
  if(u.slowT>0){u.slowT-=dt;sp*=.55;}
  const depth=-H(u.pos.x,u.pos.z);if(depth>.2&&u.pos.y<.2)sp*=.62;
  if(inWire(u.pos.x,u.pos.z))sp*=.45;
  const k=1-Math.exp(-dt*10);
  u.vel.x+=(mx*sp-u.vel.x)*k;u.vel.z+=(mz*sp-u.vel.z)*k;
  const p=_v1.set(u.pos.x+u.vel.x*dt,0,u.pos.z+u.vel.z*dt);
  const height=st==='prone'?.5:st==='crouch'?1.2:1.8;
  collide(p,.33,u.pos.y,height);
  // low wall in the way: climb it
  if(!u.isPlayer&&(mx||mz)){const moved=Math.hypot(p.x-u.pos.x,p.z-u.pos.z);if(moved<sp*dt*.3){const top=climbable(u.pos.x,u.pos.z,mx,mz,u.pos.y);if(top!==null){u.pos.y=top+.02;p.x=u.pos.x+mx*.35;p.z=u.pos.z+mz*.35;}}}
  u.vel.x=(p.x-u.pos.x)/dt;u.vel.z=(p.z-u.pos.z)/dt;
  u.pos.x=p.x;u.pos.z=p.z;
  const g=groundAt(u.pos.x,u.pos.z,u.pos.y,.2);
  if(u.pos.y>g+.05){u.vel.y-=17*dt;u.pos.y=Math.max(g,u.pos.y+u.vel.y*dt);}
  else{u.pos.y=g;u.vel.y=0;}
}
function updateBot(u,dt){
  const b=u.brain;
  // bandage when bleeding and nobody is shooting at us
  if(u.bleed&&!(u.bandT>0)&&!b.target&&GAME.time-(u.lastHurt||0)>1.5){startBandage(u);if(Math.random()<.3)shout(u,'medic');}
  if(u.bandT>0){u.stance='crouch';u.vel.x*=.8;u.vel.z*=.8;moveUnit(u,0,0,0,dt);return;}
  const m=b.think(dt);
  // stance changes take a moment
  if(b.wantStance!==u.stance){b.stanceT=(b.stanceT||0)+dt;if(b.stanceT>(b.wantStance==='prone'||u.stance==='prone'?.6:.2)){u.stance=b.wantStance;b.stanceT=0;}}else b.stanceT=0;
  if(u.stance!=='prone'&&u.stance!=='crouch'&&b.role()==='mg'&&!(b.goal&&b.goal.perch&&b.goal.perch.deployY))u.deployed=false;
  const spd=m.speed;
  if(b.sprint&&Math.hypot(m.mx,m.mz)>.5)u.stam=Math.max(0,u.stam-dt*14);else u.stam=Math.min(100,u.stam+dt*12);
  moveUnit(u,m.mx,m.mz,spd,dt);
  // footsteps near the camera
  const sp=Math.hypot(u.vel.x,u.vel.z);
  if(sp>1.5&&u.stance!=='prone'){u.stepD=(u.stepD||0)+sp*dt;if(u.stepD>2.1){u.stepD=0;const d=u.pos.distanceTo(camera.position);if(d<26){const s=surfaceAt(u.pos.x,u.pos.z,u.pos.y);play(s==='water'?'stWater':s==='sand'?'stSand':s==='hard'?'stHard':s==='wood'?'stWood':'stGrass',{pos:u.pos.clone(),vol:.32*Math.min(1,sp/5),maxD:26,ref:3});}}}
}
