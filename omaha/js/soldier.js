'use strict';
/* ================= Soldier models ================= */
const STY={
  0:{coat:[0x7d7356,0x857a5a,0x76704f],trou:0x5f5a42,leg:0xb3a77f,boot:0x3b2a1d,helm:0x4b5232,web:0x8d8462,pack:0x7a7454},
  1:{coat:[0x5b6152,0x606555,0x575c4f],trou:0x55594f,leg:0x1c1b19,boot:0x1c1b19,helm:0x4a4d47,web:0x222220,pack:0x6d6a55}
};
const SKIN=[0xc8977a,0xb88a6c,0xcea184,0xa87c5e,0xbf9070];
const GEO_CACHE={};
const SPH=new THREE.SphereGeometry(1,18,14);
const sc=(geo,col,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>({geo,col:C(col),m:compose(x,y,z,rx,ry,rz,sx,sy,sz)});
// jacket torso, head and helmet, webbing: all rounded shapes
const TORSO=latheY([[0,-.1],[.17,-.1],[.19,.05],[.205,.2],[.215,.36],[.2,.5],[.13,.6],[.06,.64],[0,.64]],18);
const HELM_US=latheY([[0,.215],[.07,.205],[.12,.17],[.15,.11],[.163,.05],[.168,.01],[.178,-.005],[.172,-.012],[.15,-.004],[0,-.004]],24);
const HELM_DE=latheY([[0,.2],[.075,.19],[.125,.155],[.148,.1],[.152,.04],[.158,0],[.18,-.045],[.198,-.07],[.19,-.075],[.15,-.03],[0,-.03]],24);
const CANT=lathe([[0,.08],[.04,.075],[.05,.05],[.05,-.05],[.04,-.075],[0,-.08]],14);
function bodyGeoNoHelm(team,v){return bodyGeo(team,v,true);}
function bodyGeo(team,v,noHelm){
  const key='b'+team+v+(noHelm?'n':'');if(GEO_CACHE[key])return GEO_CACHE[key];
  const s=STY[team],coat=s.coat[v%3],skin=SKIN[v%5];const p=[];
  const leather=0x24201c,steel=0x8a8c8e,brass=0xa88a4a,canvasC=team?0x5e5c4a:0x8d8462,dark=0x2a2a26;
  const strap=(x0,y0,z0,x1,y1,z1,w,col,th=.012)=>{const a=new V3(x0,y0,z0),b=new V3(x1,y1,z1);const d=b.clone().sub(a);const g=rbox(w,d.length(),th,Math.min(w,th)*.45);
    const q=new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),d.clone().normalize());p.push({geo:g,col:C(col),m:new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),q,new V3(1,1,1))});};
  // torso, shoulders, collar, neck
  p.push(sc(TORSO,coat,0,0,0,1,1,.66));
  for(const sx of[-.19,.19])p.push(sc(SPH,coat,sx,.49,0,.08,.075,.08));
  p.push(sc(new THREE.CylinderGeometry(.055,.06,.1,12),skin,0,.64,0,1,1,1));
  p.push(sc(new THREE.TorusGeometry(.07,.022,8,18),coat,0,.6,.01,1,1,1,Math.PI/2));
  // head: skull, jaw, nose, ears, brows, eyes, lips
  p.push(sc(SPH,skin,0,.755,.005,.096,.112,.104),sc(SPH,skin,0,.708,.028,.076,.058,.082));
  p.push(sc(SPH,skin,0,.748,.106,.016,.026,.024),sc(SPH,skin,0,.732,.104,.02,.012,.016));
  for(const sx of[-.1,.1])p.push(sc(SPH,skin,sx,.75,0,.014,.028,.02));
  for(const sx of[-.034,.034])p.push(sc(SPH,0x3a2c22,sx,.772,.094,.009,.006,.004),sc(SPH,0x4a3424,sx,.786,.096,.019,.005,.008));
  p.push(sc(SPH,0x9a5a4a,0,.708,.098,.026,.006,.01));
  // shoulder straps on the jacket
  for(const sx of[-.13,.13])p.push(sc(rbox(.06,.012,.11,.004),coat,sx,.56,0,1,1,1,0,0,sx>0?-.25:.25));
  if(team===0){
    if(!noHelm){p.push(sc(HELM_US,s.helm,0,.755,-.005,1,1,1.08));
      // helmet netting and the loose chinstraps
      for(const[ly,r]of[[.035,.165],[.085,.157],[.13,.138],[.17,.108]])p.push(sc(new THREE.TorusGeometry(r,.0022,4,28),0x3a3e24,0,.755+ly,-.005,1,1,1.08,Math.PI/2));
      p.push(sc(rbox(.05,.035,.012,.006),0x6a6450,0,.82,-.17,1,1,1,-.5,0,0));
      for(const sx of[-.155,.155])strap(sx,.745,.01,sx*.75,.66,.06,.016,0x6a5a3a,.006);}
    else p.push(sc(SPH,0x3b2a1d,0,.79,-.01,.106,.068,.112));
    // M1936 suspenders and cartridge belt with ten pouches
    for(const sx of[-.09,.09]){strap(sx,.56,.125,sx*1.05,.12,.142,.04,canvasC);strap(sx,.56,-.125,sx*.5,.12,-.142,.04,canvasC);}
    p.push(sc(new THREE.CylinderGeometry(.208,.203,.06,20),canvasC,0,.1,0,1,1,.7));
    for(let k=0;k<10;k++){const a=-1.25+k*(2.5/9);p.push(sc(rbox(.06,.07,.035,.012),canvasC,Math.sin(a)*.205,.1,Math.cos(a)*.142,1,1,1,0,a,0));}
    p.push(sc(rbox(.05,.04,.02,.006),brass,0,.1,.152,1,1,1));
    // D-Day life belt round the waist, assault gas-mask bag on the chest
    p.push(sc(new THREE.TorusGeometry(.2,.028,8,24),0x5c5a3c,0,.02,0,1,1,.72,Math.PI/2));
    p.push(sc(rbox(.2,.16,.07,.03),0x55563a,.02,.3,.16,1,1,1,-.08,0,0),sc(rbox(.18,.02,.06,.008),0x4a4a32,.02,.38,.17,1,1,1));strap(-.12,.52,.12,.12,.36,.18,.03,0x4f4f34);
    // canteen, first-aid pouch, bayonet, pack with entrenching tool
    p.push(sc(CANT,0x55573f,.2,.0,-.06,1,1,1,Math.PI/2),sc(rbox(.07,.07,.04,.012),canvasC,.18,.05,.1,1,1,1,0,.9,0));
    p.push(sc(rbox(.035,.3,.02,.008),0x3a3a2a,-.22,-.05,-.03,1,1,1,0,0,-.12),sc(rbox(.04,.07,.03,.01),0x4a4a3a,-.22,.1,-.03,1,1,1));
    p.push(sc(rbox(.26,.26,.11,.04),s.pack,0,.36,-.19,1,1,1));
    p.push(sc(rbox(.16,.14,.03,.015),0x4a4c3a,0,.2,-.255,1,1,1),sc(new THREE.CylinderGeometry(.013,.013,.3,8),0x5a4630,0,.36,-.26,1,1,1));
    for(const sx of[-.1,.1])strap(sx,.48,-.16,sx,.25,-.17,.03,canvasC);
  }else{
    if(!noHelm){p.push(sc(HELM_DE,s.helm,0,.755,-.01,1,1,1.06));for(const sx of[-.16,.16])strap(sx,.72,0,sx*.55,.66,.05,.014,leather,.006);}
    else p.push(sc(SPH,0x6b4a2a,0,.79,-.01,.106,.068,.112));
    // tunic pocket flaps and buttons
    for(const sx of[-.1,.1]){p.push(sc(rbox(.09,.035,.012,.005),coat,sx,.42,.138,1,1,1),sc(rbox(.1,.04,.012,.005),coat,sx,.2,.142,1,1,1));}
    for(let k=0;k<5;k++)p.push(sc(SPH,0x6a6c64,0,.18+k*.085,.141,.008,.008,.006));
    p.push(sc(rbox(.04,.012,.03,.004),0x3a5a3a,-.05,.6,.06,1,1,1),sc(rbox(.04,.012,.03,.004),0x3a5a3a,.05,.6,.06,1,1,1));
    // black leather belt, steel buckle, Y-straps
    p.push(sc(new THREE.CylinderGeometry(.207,.202,.05,20),leather,0,.1,0,1,1,.7),sc(rbox(.055,.045,.014,.006),steel,0,.1,.148,1,1,1));
    strap(.12,.12,.142,.07,.56,.11,.032,leather);strap(-.12,.12,.142,-.07,.56,.11,.032,leather);strap(0,.12,-.142,0,.5,-.13,.032,leather);
    for(const sx of[-.07,.07])p.push(sc(new THREE.TorusGeometry(.012,.003,6,10),steel,sx,.56,.11,1,1,1));
    // two triple K98 ammo pouches
    for(const sx of[-1,1])for(let k=0;k<3;k++)p.push(sc(rbox(.034,.07,.035,.01),leather,sx*(.07+k*.036),.08,.155,1,1,1,0,-sx*.1*k,0));
    // bread bag, canteen with cup, mess tin, gas-mask canister, spade and bayonet
    p.push(sc(rbox(.17,.15,.07,.03),s.pack,.17,-.02,-.11,1,1,1,0,.5,0));
    p.push(sc(CANT,0x4a3a2a,.22,-.02,-.02,1,1,1,Math.PI/2),sc(new THREE.CylinderGeometry(.03,.028,.04,12),0x2a2c2a,.235,.08,-.02,1,1,1));
    p.push(sc(rbox(.11,.09,.05,.025),0x4f5244,.08,.3,-.17,1,1,1));
    const can=lathe([[0,.14],[.055,.138],[.06,.12],[.06,.09],[.064,.08],[.06,.07],[.06,-.07],[.064,-.08],[.06,-.09],[.06,-.12],[.055,-.138],[0,-.14]],16);
    p.push(sc(can,0x4e5546,-.08,.12,-.21,1,1,1,-Math.PI/2+.35));strap(.19,.55,.1,-.12,.24,-.2,.022,0x3a3a30,.008);
    p.push(sc(rbox(.12,.14,.012,.02),0x3a3c36,-.21,-.08,-.06,1,1,1,0,1.2,0),sc(new THREE.CylinderGeometry(.012,.012,.2,8),0x5a4630,-.21,.07,-.06,1,1,1));
    p.push(sc(rbox(.03,.26,.018,.008),0x2a2a2a,-.2,-.02,.06,1,1,1,0,0,-.1));
  }
  return GEO_CACHE[key]=mergeGeos(p);
}
function legGeos(team){
  const key='l'+team;if(GEO_CACHE[key])return GEO_CACHE[key];const s=STY[team];
  const thigh=mergeGeos([sc(new THREE.CylinderGeometry(.084,.072,.48,14),s.trou,0,-.22,0,1,1,1),sc(SPH,s.trou,0,-.45,0,.07,.06,.075)]);
  const boot=rbox(.11,.085,.25,.035);
  const shin=team===0?mergeGeos([sc(new THREE.CylinderGeometry(.068,.062,.24,14),s.trou,0,-.1,0,1,1,1),sc(new THREE.CylinderGeometry(.07,.066,.2,14),s.leg,0,-.3,0,1,1,1),sc(boot,s.boot,0,-.45,.045,1,1,1)])
                     :mergeGeos([sc(new THREE.CylinderGeometry(.068,.064,.12,14),s.trou,0,-.05,0,1,1,1),sc(new THREE.CylinderGeometry(.074,.068,.34,14),s.boot,0,-.28,0,1,1,1),sc(boot,s.boot,0,-.45,.045,1,1,1)]);
  return GEO_CACHE[key]={thigh,shin};
}
// arms holding a given weapon; grip sits in front of the right shoulder
function armsGeo(team,v,wid){
  const key='a'+team+v%3+wid;if(GEO_CACHE[key])return GEO_CACHE[key];
  const s=STY[team],coat=s.coat[v%3],skin=SKIN[v%5];const W=WEAPONS[wid];const m=weaponModel(wid);
  const grip=new V3(-.1,-.12,.25),fore=new V3(-.07,-.1,.25-m.foreZ);
  const parts=[];
  if(W.type==='melee'||W.type==='nade'||W.pistol){grip.set(-.12,-.12,.4);fore.copy(grip).add(new V3(.06,0,0));}
  const sh=new V3(-.2,0,0),shL=new V3(.2,0,0);
  const el=grip.clone().add(sh).multiplyScalar(.5).add(new V3(-.06,-.12,-.05));const elL=fore.clone().add(shL).multiplyScalar(.5).add(new V3(.08,-.14,-.02));
  const lb=(a,b,w,c)=>{parts.push(limb(a,b,w,c));};
  lb(sh,el,.1,coat);lb(el,grip,.088,coat,.075);parts.push(sc(SPH,coat,el.x,el.y,el.z,.05,.05,.05),sc(SPH,skin,grip.x,grip.y,grip.z,.04,.045,.055));
  lb(shL,elL,.1,coat);lb(elL,fore,.088,coat,.075);parts.push(sc(SPH,coat,elL.x,elL.y,elL.z,.05,.05,.05),sc(SPH,skin,fore.x,fore.y,fore.z,.04,.045,.055));
  const wg=weaponGeoTP(wid);
  const G=mergeGeos(parts);
  const wgc=wg.clone();wgc.applyMatrix4(compose(grip.x+.02,grip.y+.06,grip.z));
  return GEO_CACHE[key]=concatGeos(G,wgc);
}
function concatGeos(a,b){
  const out=new THREE.BufferGeometry();
  for(const name of['position','normal','color','uv']){const A=a.attributes[name],B=b.attributes[name];const arr=new Float32Array(A.array.length+B.array.length);arr.set(A.array);arr.set(B.array,A.array.length);out.setAttribute(name,new THREE.BufferAttribute(arr,A.itemSize));}
  out.computeBoundingSphere();return out;
}
// woven fabric detail over every uniform and piece of kit
const fabric=surface(128,128,(x,y)=>{const w=((x>>1)+(y>>1))%2,n=tnoise(x/3,y/3,42);const v=200+w*22+n*30;return[v,v,v,w*.5+n*.5];},.9);
fabric.map.repeat.set(5,5);fabric.normalMap.repeat.set(5,5);
const SMAT=new THREE.MeshStandardMaterial({vertexColors:true,map:fabric.map,normalMap:fabric.normalMap,normalScale:new THREE.Vector2(.5,.5),roughness:.82,metalness:.06,envMap:ENV,envMapIntensity:.4});

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
  if(Net.client)return;// the host decides all damage
  if(attacker&&attacker!==u&&attacker.team===u.team)return;
  u.hp-=dmg;u.lastDmg=dmg;u.slowT=.6;u.lastHurt=GAME.time;u.lastAttacker=attacker;
  if(dmg>=8&&zone!=='fall'&&u.hp>0){if(!u.bleed&&u.isPlayer)hint('You are bleeding! Press H to bandage',3);u.bleed=true;u.lastWid=wid;}
  if(u.remote)Net.event(['hurt',u.id,Math.round(dmg),Math.max(0,Math.round(u.hp)),attacker?attacker.id:-1,zone,dir?Math.round(dir.x*100)/100:0,dir?Math.round(dir.z*100)/100:0]);
  if(u.isPlayer)playerHurt(dmg,attacker,zone,dir);
  else{if(attacker&&u.brain)u.brain.onHurt(attacker);if(u.hp>0&&Math.random()<.5)painGrunt(u.pos.clone().setY(u.pos.y+1.5),.22);}
  if(zone==='head'&&wid!=='arty'&&wid!=='nade')play('helmet',{pos:u.pos.clone().setY(u.pos.y+1.7),vol:.5,maxD:70});
  if(u.hp<=0)killUnit(u,attacker,wid,zone,dir);
}
function killUnit(u,attacker,wid,zone,dir){
  if(Net.host)Net.event(['kill',u.id,attacker?attacker.id:-1,wid,zone,dir?Math.round(dir.x*100)/100:0,dir?Math.round(dir.z*100)/100:0]);
  u.alive=false;u.hp=0;u.deaths++;u.deadAt=GAME.time;u.deployed=false;u.bleed=false;u.bandT=0;
  if(attacker&&attacker!==u){attacker.kills++;attacker.score+=1;}
  addFeed(attacker,u,wid,zone);
  const m=u.model;
  if(m){
    if(zone==='blast'&&!u.blast&&dir)u.blast={c:u.pos.clone().addScaledVector(dir,-2.5),P:2};
    startRagdoll(u,m,dir,zone,u.lastDmg||60);u.blast=null;
    CORPSES.push(m);
    if(CORPSES.length>40)removeCorpse(CORPSES.shift());
  }
  const p=u.pos.clone().setY(u.pos.y+1.4);
  if(zone!=='head')deathCry(p);
  play('bodyfall',{pos:u.pos.clone(),vol:.45,delay:.45,maxD:50});
  if(u.isPlayer)playerDied(attacker,wid);
  if(u.brain)u.brain.onDeath();
}
function animModel(u,dt){
  const m=u.model;if(!m)return;
  if(!u.alive&&m.rag)return;
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

// wounds drain health until the soldier bandages (Day of Defeat style)
function bleedTick(u,dt){
  if(!u.bleed||!u.alive||Net.client)return;
  u.bleedAcc=(u.bleedAcc||0)+dt*1.3;
  while(u.bleedAcc>=1&&u.alive){u.bleedAcc-=1;u.hp-=1;if(u.remote&&u.hp%5===0)Net.event(['hp',u.id,Math.max(0,Math.round(u.hp))]);
    if(u.hp<=0){const a=u.lastAttacker&&u.lastAttacker.team!==u.team?u.lastAttacker:null;killUnit(u,a,'bleed','chest',null);}}
}
function startBandage(u){if(!u.alive||!u.bleed||u.bandT>0)return false;u.bandT=2.4;play('flap',{pos:u.pos.clone().setY(u.pos.y+1),vol:.4,maxD:20});return true;}
function bandageTick(u,dt){if(!(u.bandT>0))return;u.bandT-=dt;if(u.bandT<=0){u.bandT=0;u.bleed=false;u.bleedAcc=0;if(u.isPlayer)hint('Bandaged',1.5);}}
