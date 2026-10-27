'use strict';
/* ================= Soldier models ================= */
const STY={
  0:{coat:[0x7d7356,0x857a5a,0x76704f],trou:0x5f5a42,leg:0xb3a77f,boot:0x3b2a1d,helm:0x4b5232,web:0x8d8462,pack:0x7a7454},
  1:{coat:[0x5b6152,0x606555,0x575c4f],trou:0x55594f,leg:0x1c1b19,boot:0x1c1b19,helm:0x4a4d47,web:0x222220,pack:0x6d6a55}
};
const SKIN=[0xd9a882,0xc99470,0xe0b48f,0xb98a65,0xd0a07a];
const GEO_CACHE={};
function bodyGeo(team,v){
  const key='b'+team+v;if(GEO_CACHE[key])return GEO_CACHE[key];
  const s=STY[team],coat=s.coat[v%3],skin=SKIN[v%5];const p=[];
  p.push(P(Bx(.38,.22,.24),coat,0,.03,0),P(Bx(.42,.5,.26),coat,0,.33,0),P(Bx(.44,.05,.28),s.web,0,.1,0),P(Bx(.1,.09,.1),skin,0,.62,0));
  p.push(P(new THREE.IcosahedronGeometry(.112,1),skin,0,.75,.0,0,0,0,1,1.12,1.05),P(Bx(.03,.05,.04),skin,0,.74,.115),P(Bx(.22,.06,.02),coat,0,.6,.12));
  if(team===0){
    const hg=new THREE.SphereGeometry(.155,12,7,0,TAU,0,Math.PI/2);
    p.push(P(hg,s.helm,0,.78,-.005,0,0,0,1,.82,1.1),P(Cy(.17,.17,.018,14),s.helm,0,.785,-.005,0,0,0,1,1,1.1));
    // suspenders, cartridge belt pouches, canteen, pack
    p.push(P(Bx(.05,.5,.02),s.web,.11,.33,.135),P(Bx(.05,.5,.02),s.web,-.11,.33,.135),P(Bx(.05,.5,.02),s.web,.11,.33,-.135),P(Bx(.05,.5,.02),s.web,-.11,.33,-.135));
    for(let k=-2;k<=2;k++)if(k)p.push(P(Bx(.07,.08,.05),s.web,k*.085,.1,.15));
    p.push(P(Cy(.05,.05,.15,8),0x55573f,.21,.02,-.06),P(Bx(.3,.3,.13),s.pack,0,.38,-.2),P(Bx(.08,.22,.06),0x6a5e42,.12,.25,-.24));
  }else{
    const hg=new THREE.SphereGeometry(.152,12,7,0,TAU,0,Math.PI/2);
    p.push(P(hg,s.helm,0,.765,0,0,0,0,1,.95,1.08),P(Cy(.16,.185,.07,14),s.helm,0,.755,-.01,-.12,0,0,1,1,1.05),P(Cy(.18,.19,.02,14),s.helm,0,.72,-.02,-.15,0,0,1,1,1.05));
    // Y-straps, ammo pouches, bread bag, gas-mask canister, mess tin
    p.push(P(Bx(.04,.5,.02),s.web,.1,.33,.135,0,0,.12),P(Bx(.04,.5,.02),s.web,-.1,.33,.135,0,0,-.12),P(Bx(.04,.5,.02),s.web,0,.33,-.135));
    p.push(P(Bx(.12,.1,.05),0x2a2a26,.12,.13,.15),P(Bx(.12,.1,.05),0x2a2a26,-.12,.13,.15),P(Bx(.18,.16,.08),s.pack,.16,.0,-.12),P(Cy(.06,.06,.26,10),0x4e5546,-.08,.12,-.2,.3,0,0),P(Bx(.12,.1,.05),0x4f5244,.08,.3,-.17));
  }
  return GEO_CACHE[key]=mergeGeos(p);
}
function legGeos(team){
  const key='l'+team;if(GEO_CACHE[key])return GEO_CACHE[key];const s=STY[team];
  const thigh=mergeGeos([P(Bx(.16,.47,.18),s.trou,0,-.22,0)]);
  const shin=team===0?mergeGeos([P(Bx(.14,.24,.16),s.trou,0,-.1,0),P(Bx(.145,.2,.165),s.leg,0,-.3,0),P(Bx(.14,.09,.26),s.boot,0,-.45,.045)])
                     :mergeGeos([P(Bx(.14,.12,.16),s.trou,0,-.05,0),P(Bx(.15,.34,.17),s.boot,0,-.28,0),P(Bx(.14,.09,.26),s.boot,0,-.45,.045)]);
  return GEO_CACHE[key]={thigh,shin};
}
// arms holding a given weapon; grip sits in front of the right shoulder
function armsGeo(team,v,wid){
  const key='a'+team+v%3+wid;if(GEO_CACHE[key])return GEO_CACHE[key];
  const s=STY[team],coat=s.coat[v%3],skin=SKIN[v%5];const W=WEAPONS[wid];const m=weaponModel(wid);
  const grip=new V3(-.1,-.12,.25),fore=new V3(-.07,-.1,.25-m.foreZ);
  const parts=[];
  if(W.type==='melee'||W.type==='nade'||W.pistol){grip.set(-.12,-.12,.4);fore.copy(grip).add(new V3(.06,0,0));}
  const sh=new V3(-.21,0,0),shL=new V3(.21,0,0);
  const el=grip.clone().add(sh).multiplyScalar(.5).add(new V3(-.06,-.12,-.05));const elL=fore.clone().add(shL).multiplyScalar(.5).add(new V3(.08,-.14,-.02));
  const lb=(a,b,w,c)=>{const q=limb(a,b,w,c);parts.push(q);};
  lb(sh,el,.1,coat);lb(el,grip,.09,coat);parts.push(P(Bx(.07,.08,.08),skin,grip.x,grip.y,grip.z));
  lb(shL,elL,.1,coat);lb(elL,fore,.09,coat);parts.push(P(Bx(.07,.08,.08),skin,fore.x,fore.y,fore.z));
  const wg=weaponGeoTP(wid);
  parts.push({geo:wg,m:compose(grip.x+.02,grip.y+.06,grip.z),col:null});
  // mergeGeos would tint with white; keep the weapon's own vertex colors
  const G=mergeGeos(parts.filter(q=>q.geo!==wg));
  const wgc=wg.clone();wgc.applyMatrix4(compose(grip.x+.02,grip.y+.06,grip.z));
  return GEO_CACHE[key]=concatGeos(G,wgc);
}
function concatGeos(a,b){
  const out=new THREE.BufferGeometry();
  for(const name of['position','normal','color','uv']){const A=a.attributes[name],B=b.attributes[name];const arr=new Float32Array(A.array.length+B.array.length);arr.set(A.array);arr.set(B.array,A.array.length);out.setAttribute(name,new THREE.BufferAttribute(arr,A.itemSize));}
  out.computeBoundingSphere();return out;
}
const SMAT=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:.05});

function buildModel(u){
  const root=new THREE.Group();root.rotation.order='YXZ';
  const pose=new THREE.Group();root.add(pose);
  const hips=new THREE.Group();hips.position.y=.95;pose.add(hips);
  const body=new THREE.Mesh(bodyGeo(u.team,u.variant),SMAT);hips.add(body);
  const arms=new THREE.Mesh(armsGeo(u.team,u.variant,u.wepId()),SMAT);arms.position.set(0,.55,0);hips.add(arms);
  const lg=legGeos(u.team);const legs=[];
  for(const sx of[.1,-.1]){const th=new THREE.Group();th.position.set(sx,.95,0);pose.add(th);const tm=new THREE.Mesh(lg.thigh,SMAT);th.add(tm);
    const sh=new THREE.Group();sh.position.y=-.46;th.add(sh);const sm=new THREE.Mesh(lg.shin,SMAT);sh.add(sm);legs.push({th,sh});}
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;}});
  scene.add(root);
  return{root,pose,hips,body,arms,legs,armWep:u.wepId(),phase:Math.random()*TAU,dieT:0,fall:1,crouch:0,prone:0,lean:0,kick:0};
}

/* ================= Units ================= */
const UNITS=[];
const NAMES={0:['Pvt. Miller','Pvt. Kowalski','Cpl. Reiben','Pvt. Caparzo','Sgt. Horvath','Pvt. Jackson','Pvt. Mellish','Pvt. Wade','Cpl. Dawson','Pvt. Sullivan','Pvt. O\'Brien','Pvt. Garcia','Pvt. Hughes','Pvt. Novak','Pvt. Russo','Pvt. Fletcher','Pvt. Hale','Pvt. Bennett','Cpl. Lindqvist','Pvt. Brooks','Pvt. Duncan'],
  1:['Gefr. Weber','Schütze Becker','Obgfr. Krause','Schütze Hoffmann','Uffz. Wagner','Schütze Schulz','Gefr. Fischer','Schütze Richter','Schütze Klein','Gefr. Wolf','Schütze Neumann','Schütze Braun','Obgfr. Zimmer','Schütze Hartmann','Gefr. Lange','Schütze Vogel','Schütze Jung','Gefr. Keller','Schütze Roth','Uffz. Busch','Schütze Frank']};
let unitId=0;
class Unit{
  constructor(team,isPlayer,name){
    this.id=unitId++;this.team=team;this.isPlayer=isPlayer;this.name=name;this.variant=Math.random()*15|0;
    this.alive=false;this.hp=100;this.pos=new V3();this.vel=new V3();this.yaw=0;this.pitch=0;this.stance='stand';this.onGround=true;
    this.kills=0;this.deaths=0;this.caps=0;this.score=0;this.cls=null;this.nextCls=null;this.model=null;this.hit=[];this.voicePitch=rand(.55,1.05);
    this.spawnProt=0;this.slowT=0;this.stam=100;this.deployed=false;this.cur='primary';this.lastShot=-9;
  }
  wepId(){const w=this.weps&&this.weps[this.cur];return w?w.id:(this.cls?this.cls.wep:'garand');}
  get W(){return WEAPONS[this.wepId()];}
  eye(out){const h=this.stance==='prone'?.38:this.stance==='crouch'?1.05:1.62;return out.set(this.pos.x,this.pos.y+h,this.pos.z);}
  center(out){const h=this.stance==='prone'?.25:this.stance==='crouch'?.75:1.15;return out.set(this.pos.x,this.pos.y+h,this.pos.z);}
}
function giveLoadout(u){
  const c=u.cls;const W=WEAPONS[c.wep];
  u.weps={primary:{id:c.wep,mag:W.mag,res:W.reserve,boltT:0,needBolt:false},melee:{id:MELEE[u.team]},nade:{id:NADE[u.team],count:c.nades}};
  if(c.pistol){const P_=WEAPONS[c.pistol];u.weps.pistol={id:c.pistol,mag:P_.mag,res:P_.reserve};}
  u.cur='primary';u.reloadT=0;u.cool=0;u.deployed=false;
}
function updateHitSpheres(u){
  const x=u.pos.x,y=u.pos.y,z=u.pos.z,H_=u.hit;H_.length=0;
  if(u.stance==='prone'){const fx=Math.sin(u.yaw),fz=Math.cos(u.yaw);
    H_.push({x:x+fx*.78,y:y+.3,z:z+fz*.78,r:.15,zone:'head'},{x:x+fx*.42,y:y+.25,z:z+fz*.42,r:.24,zone:'chest'},{x:x+fx*.05,y:y+.22,z:z+fz*.05,r:.22,zone:'belly'},
      {x:x-fx*.4,y:y+.16,z:z-fz*.4,r:.2,zone:'limb'},{x:x-fx*.8,y:y+.14,z:z-fz*.8,r:.18,zone:'limb'});}
  else if(u.stance==='crouch'){H_.push({x,y:y+1.22,z,r:.15,zone:'head'},{x,y:y+.93,z,r:.25,zone:'chest'},{x,y:y+.66,z,r:.23,zone:'belly'},{x,y:y+.32,z,r:.3,zone:'limb'});}
  else{H_.push({x,y:y+1.69,z,r:.145,zone:'head'},{x,y:y+1.34,z,r:.25,zone:'chest'},{x,y:y+1.03,z,r:.23,zone:'belly'},{x,y:y+.62,z,r:.21,zone:'limb'},{x,y:y+.25,z,r:.18,zone:'limb'});}
}
// ray vs all units. returns {u,t,zone} for the nearest hit before maxT
function rayUnits(o,d,maxT,skip,skipTeam){
  let best=maxT,res=null;
  for(const u of UNITS){if(!u.alive||u===skip||u.team===skipTeam)continue;
    const dx=u.pos.x-o.x,dz=u.pos.z-o.z;const along=dx*d.x+dz*d.z;if(along<-2||along>best+2)continue;
    for(const s of u.hit){const ox=o.x-s.x,oy=o.y-s.y,oz=o.z-s.z;const b=ox*d.x+oy*d.y+oz*d.z;const c=ox*ox+oy*oy+oz*oz-s.r*s.r;const h=b*b-c;if(h<0)continue;const t=-b-Math.sqrt(h);
      if(t>0&&t<best){best=t;res={u,t,zone:s.zone};}}}
  return res;
}

/* ================= Damage & death ================= */
const CORPSES=[];
function hurt(u,dmg,attacker,wid,zone,dir){
  if(!u.alive||u.spawnProt>0)return;
  if(attacker&&attacker!==u&&attacker.team===u.team)return;
  u.hp-=dmg;u.slowT=.6;u.lastHurt=GAME.time;u.lastAttacker=attacker;
  if(u.isPlayer)playerHurt(dmg,attacker,zone,dir);
  else{if(attacker&&u.brain)u.brain.onHurt(attacker);if(u.hp>0&&Math.random()<.5)painGrunt(u.pos.clone().setY(u.pos.y+1.5),.22);}
  if(zone==='head'&&wid!=='arty'&&wid!=='nade')play('helmet',{pos:u.pos.clone().setY(u.pos.y+1.7),vol:.5,maxD:70});
  if(u.hp<=0)killUnit(u,attacker,wid,zone,dir);
}
function killUnit(u,attacker,wid,zone,dir){
  u.alive=false;u.hp=0;u.deaths++;u.deadAt=GAME.time;u.deployed=false;
  if(attacker&&attacker!==u){attacker.kills++;attacker.score+=1;}
  addFeed(attacker,u,wid,zone);
  const m=u.model;
  if(m){
    m.dieT=.001;m.fallDir=dir?(Math.sin(u.yaw)*dir.x+Math.cos(u.yaw)*dir.z>0?1:-1):(Math.random()<.5?1:-1);
    if(zone==='blast'){m.fallDir=Math.random()<.5?1:-1;m.blast=dir?dir.clone():new V3();}
    m.twist=rand(-.6,.6);m.legA=rand(-.4,.4);
    CORPSES.push(m);
    if(CORPSES.length>40){const o=CORPSES.shift();scene.remove(o.root);}
  }
  const p=u.pos.clone().setY(u.pos.y+1.4);
  if(zone!=='head')deathCry(p);
  play('bodyfall',{pos:u.pos.clone(),vol:.45,delay:.45,maxD:50});
  if(u.isPlayer)playerDied(attacker,wid);
  if(u.brain)u.brain.onDeath();
}
function animModel(u,dt){
  const m=u.model;if(!m)return;
  if(!u.alive){
    if(m.dieT>0&&m.dieT<2){m.dieT+=dt;const k=Math.min(1,m.dieT/.55);const e=k*k;
      m.pose.rotation.x=-m.fallDir*1.5*e;m.pose.rotation.z=m.twist*e;m.pose.position.y=.12*e;
      m.hips.rotation.x=0;m.arms.rotation.x=lerp(m.arms.rotation.x,-.6,e);
      for(const L of m.legs){L.th.rotation.x=lerp(L.th.rotation.x,m.legA,e);L.sh.rotation.x=lerp(L.sh.rotation.x,.3,e);}
      if(m.blast&&m.dieT<.5){m.root.position.addScaledVector(m.blast,dt*4);m.root.position.y+=Math.sin(m.dieT*6)*dt*2;}
      if(m.dieT>=.55&&m.blast){m.root.position.y=H(m.root.position.x,m.root.position.z);m.blast=null;}}
    return;
  }
  const sp=Math.hypot(u.vel.x,u.vel.z);
  const crouchT=u.stance==='crouch'?1:0,proneT=u.stance==='prone'?1:0;
  m.crouch=lerp(m.crouch,crouchT,1-Math.exp(-dt*10));m.prone=lerp(m.prone,proneT,1-Math.exp(-dt*7));
  m.phase+=sp*dt*(u.stance==='prone'?1.4:2.35);
  const amp=Math.min(.9,sp*.16)*(1-m.prone);
  const s=Math.sin(m.phase);
  m.root.position.set(u.pos.x,u.pos.y+Math.abs(Math.cos(m.phase))*.05*Math.min(1,sp*.3)*(1-m.prone)-m.crouch*.42*(1-m.prone),u.pos.z);
  m.root.rotation.y=u.yaw;
  m.pose.rotation.x=m.prone*1.48;m.pose.position.set(0,m.prone*.18,-m.prone*.85);
  const lean=(sp>6.5?.28:sp>2?.1:0)*(1-m.prone)+m.crouch*.25;m.lean=lerp(m.lean,lean,dt*6);m.hips.rotation.x=m.lean;
  for(let i=0;i<2;i++){const L=m.legs[i],ph=i?s:-s;
    const crouchTh=-1.35+(i?.3:-.1),crouchSh=1.6;
    const th=ph*amp,sh=Math.max(0,-Math.sin(m.phase+(i?Math.PI:0)+.8))*amp*1.3;
    L.th.rotation.x=lerp(th,crouchTh+th*.4,m.crouch*(1-m.prone))+m.prone*Math.sin(m.phase*2+i*3)*.15*Math.min(1,sp);
    L.sh.rotation.x=lerp(sh,crouchSh,m.crouch*(1-m.prone));
    L.th.rotation.z=i?-.04:.04;}
  m.kick=Math.max(0,m.kick-dt*8);
  m.arms.rotation.x=-(u.pitch)-m.lean-m.prone*1.48+(sp>6.5&&!u.firing?.7:0)-m.kick*.15;
  m.arms.position.z=-m.kick*.05;
  if(m.armWep!==u.wepId()){m.armWep=u.wepId();m.arms.geometry=armsGeo(u.team,u.variant,m.armWep);}
}
