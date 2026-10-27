'use strict';
/* ================= Ragdolls and gore =================
   A dead soldier becomes ten physics points held together by stick constraints (verlet):
   pelvis, chest, head, knees, feet, hands and a side marker that keeps the torso from twisting.
   The body, legs and arms are then drawn along those points, so corpses crumple, slide down the
   bluff, get thrown by blasts and float in the surf. Close blasts can tear limbs off.            */
const RAGS=[];
const RAG_G=-13,RAG_ITER=8;
const P_PELVIS=0,P_CHEST=1,P_HEAD=2,P_LKNEE=3,P_LFOOT=4,P_RKNEE=5,P_RFOOT=6,P_LHAND=7,P_RHAND=8,P_SIDE=9;
const ARM_GEO=(()=>{const g=new THREE.CylinderGeometry(.05,.045,1,10);g.translate(0,-.5,0);return g;})();
const HAND_GEO=new THREE.SphereGeometry(.045,10,8);
const _ra=new V3(),_rb=new V3(),_rc=new V3(),_rm=new THREE.Matrix4(),_rq=new THREE.Quaternion();
function startRagdoll(u,m,dir,zone,dmg){
  m.root.updateMatrixWorld(true);
  const h=m.hips,L=m.legs;
  const pt=v=>({p:v.clone(),o:v.clone(),r:.09,stuck:0});
  const P=[pt(h.localToWorld(new V3(0,0,0))),pt(h.localToWorld(new V3(0,.56,0))),pt(h.localToWorld(new V3(0,.78,.02))),
    pt(L[0].sh.localToWorld(new V3(0,0,0))),pt(L[0].sh.localToWorld(new V3(0,-.47,.03))),pt(L[1].sh.localToWorld(new V3(0,0,0))),pt(L[1].sh.localToWorld(new V3(0,-.47,.03))),
    pt(m.arms.localToWorld(new V3(.14,-.2,.32))),pt(m.arms.localToWorld(new V3(-.14,-.2,.28))),pt(h.localToWorld(new V3(.22,.05,0)))];
  P[P_HEAD].r=.13;
  const CS=[];const link=(a,b,k=1)=>CS.push({a,b,len:P[a].p.distanceTo(P[b].p),k,on:true});
  link(0,1);link(1,2);link(0,2);link(9,0);link(9,1);link(9,2);
  link(0,3);link(9,3,.5);link(3,4);link(0,5);link(9,5,.5);link(5,6);
  link(1,7);link(1,8);link(9,7,.3);
  // soft limits so legs don't fold through the body
  const mins=[[4,0,.45],[6,0,.45],[4,1,.75],[6,1,.75],[3,5,.12],[4,6,.1],[7,0,.2],[8,0,.2]];
  // initial velocity from the killing blow
  const vel=new V3();
  const kick=(i,vx,vy,vz,dt=1/60)=>{P[i].o.set(P[i].p.x-vx*dt,P[i].p.y-vy*dt,P[i].p.z-vz*dt);};
  if(u.vel){for(const q of P)kick(P.indexOf(q),u.vel.x*.8,0,u.vel.z*.8);}
  const b=u.blast;
  if(zone==='blast'&&b){
    const d0=Math.max(.6,Math.hypot(u.pos.x-b.c.x,u.pos.z-b.c.z));const pw=Math.min(9,b.P*4.2/Math.max(.8,d0*.6));
    P.forEach((q,i)=>{_ra.subVectors(q.p,b.c);_ra.y=Math.max(.3,_ra.y);_ra.normalize();kick(i,_ra.x*pw*rand(.7,1.15),Math.min(7.5,pw*rand(.5,.9))+rand(.5,2),_ra.z*pw*rand(.7,1.15));});
  }else if(dir){
    const f=2.2+Math.min(4,(dmg||40)/35);const top=zone==='head'?P_HEAD:zone==='limb'?(Math.random()<.5?P_LKNEE:P_RKNEE):P_CHEST;
    for(let i=0;i<P.length;i++){const w=i===top?1:i===P_HEAD||i===P_CHEST||i===P_SIDE?.75:.25;kick(i,(u.vel?u.vel.x*.8:0)+dir.x*f*w,rand(.2,1)*w,(u.vel?u.vel.z*.8:0)+dir.z*f*w);}
  }
  // meshes drawn along the points
  const g=new THREE.Group();scene.add(g);
  const team=u.team,coat=STY[team].coat[u.variant%3],skin=SKIN[u.variant%5];
  const headshot=zone==='head';
  const body=new THREE.Mesh(headshot?bodyGeoNoHelm(team,u.variant):m.body.geometry,SMAT);
  const lg=legGeos(team);
  const thL=new THREE.Mesh(lg.thigh,SMAT),thR=new THREE.Mesh(lg.thigh,SMAT),shL=new THREE.Mesh(lg.shin,SMAT),shR=new THREE.Mesh(lg.shin,SMAT);
  const armMat=new THREE.MeshStandardMaterial({color:C(coat),roughness:.9}),handMat=new THREE.MeshStandardMaterial({color:C(skin),roughness:.7});
  const arL=new THREE.Mesh(ARM_GEO,armMat),arR=new THREE.Mesh(ARM_GEO,armMat),hdL=new THREE.Mesh(HAND_GEO,handMat),hdR=new THREE.Mesh(HAND_GEO,handMat);
  for(const me of[body,thL,thR,shL,shR,arL,arR,hdL,hdR]){me.castShadow=true;me.matrixAutoUpdate=false;g.add(me);}
  const r={u,P,C:CS,mins,g,body,thL,thR,shL,shR,arL,arR,hdL,hdR,sleep:0,age:0,cut:{},spurts:[],pool:null,team};
  if(headshot)popHelmet(u,P[P_HEAD].p,dir);
  dropWeapon(u,m,P[P_RHAND].p,dir);
  // close blasts tear limbs off
  if(zone==='blast'&&b&&SET.gore){const d0=Math.hypot(u.pos.x-b.c.x,u.pos.z-b.c.z);
    if(d0<3.6*b.P*.6){const limbs=['lleg','rleg','larm','rarm'].sort(()=>Math.random()-.5);const n=d0<1.6?randi(1,3):1;for(let k=0;k<n;k++)sever(r,limbs[k]);}}
  scene.remove(m.root);m.rag=r;RAGS.push(r);
  if(RAGS.length>14){const old=RAGS.find(x=>x.sleep<999);if(old&&RAGS.filter(x=>x.sleep<999).length>14)old.sleep=999;}
  return r;
}
const LIMB={lleg:[[0,3],[9,3]],rleg:[[0,5],[9,5]],larm:[[1,7],[9,7]],rarm:[[1,8]]};
const STUMP={lleg:P_LKNEE,rleg:P_RKNEE,larm:P_LHAND,rarm:P_RHAND};
function sever(r,limb){
  if(r.cut[limb])return;r.cut[limb]=true;
  for(const c of r.C)for(const[a,b]of LIMB[limb])if((c.a===a&&c.b===b)||(c.a===b&&c.b===a))c.on=false;
  const root=limb[1]==='l'?(limb==='lleg'||limb==='rleg'?P_PELVIS:P_CHEST):P_CHEST;
  const tip=STUMP[limb];r.P[tip].o.y-=.12;r.P[tip].o.x+=rand(-.1,.1);r.P[tip].o.z+=rand(-.1,.1);
  r.spurts.push({i:limb.endsWith('leg')?P_PELVIS:P_CHEST,limb,t:rand(2.5,4)},{i:tip,limb,t:rand(1,2)});
  goreBurst(r.P[tip].p,2);
}
function ragFloor(x,z,y){let g=H(x,z);for(const s of solidsNear(x,z,.1,_sn)){if(x<s.x0||x>s.x1||z<s.z0||z>s.z1)continue;if(s.y1<=y+.35&&s.y1>g)g=s.y1;}return g;}
function stepRag(r,dt){
  const P=r.P;let moved=0;
  for(const q of P){const vx=(q.p.x-q.o.x)*.985,vy=(q.p.y-q.o.y)*.985,vz=(q.p.z-q.o.z)*.985;q.o.copy(q.p);
    q.p.x+=vx;q.p.y+=vy+RAG_G*dt*dt;q.p.z+=vz;
    // floating in the surf
    const sea=H(q.p.x,q.p.z);if(sea<-.05&&q.p.y<.06){q.p.y+=(.06-q.p.y)*.25;q.o.x=lerp(q.o.x,q.p.x,.08);q.o.z=lerp(q.o.z,q.p.z,.08);q.p.x+=Math.sin(GAME.time*.7+q.p.z)*.002;}
    moved=Math.max(moved,Math.abs(vx)+Math.abs(vy)+Math.abs(vz));}
  for(let it=0;it<RAG_ITER;it++){
    for(const c of r.C){if(!c.on)continue;const a=P[c.a].p,b=P[c.b].p;_ra.subVectors(b,a);const d=_ra.length()||1e-6;const k=(d-c.len)/d*.5*c.k;a.addScaledVector(_ra,k);b.addScaledVector(_ra,-k);}
    for(const[i,j,mn]of r.mins){const a=P[i].p,b=P[j].p;_ra.subVectors(b,a);const d=_ra.length();if(d<mn&&d>1e-6){const k=(d-mn)/d*.5;a.addScaledVector(_ra,k);b.addScaledVector(_ra,-k);}}
    for(const q of P){const f=ragFloor(q.p.x,q.p.z,q.p.y)+q.r*.7;if(q.p.y<f){q.p.y=f;q.o.x=lerp(q.o.x,q.p.x,.35);q.o.z=lerp(q.o.z,q.p.z,.35);}
      for(const s of solidsNear(q.p.x,q.p.z,.2,_sn)){if(q.p.y>s.y1||q.p.y<s.y0||q.p.x<s.x0-.05||q.p.x>s.x1+.05||q.p.z<s.z0-.05||q.p.z>s.z1+.05)continue;
        const l=q.p.x-s.x0,rr=s.x1-q.p.x,f2=q.p.z-s.z0,bb=s.z1-q.p.z,t=s.y1-q.p.y;const mm=Math.min(l,rr,f2,bb,t);
        if(mm===t)q.p.y=s.y1;else if(mm===l)q.p.x=s.x0-.06;else if(mm===rr)q.p.x=s.x1+.06;else if(mm===f2)q.p.z=s.z0-.06;else q.p.z=s.z1+.06;}}
  }
  return moved;
}
// orient a mesh whose local -y runs from `a` toward `b`, with `side` as its x axis
function boneMatrix(me,a,b,side,len){
  const y=_rb.subVectors(a,b).normalize();const x=_ra.copy(side).addScaledVector(y,-side.dot(y)).normalize();const z=_rc.crossVectors(x,y);
  me.matrix.makeBasis(x,y,z);if(len!=null)me.matrix.scale(new V3(1,len,1));me.matrix.setPosition(a);me.matrixWorldNeedsUpdate=true;
}
const _side=new V3(),_up=new V3(),_hip=new V3(),_sh=new V3();
function drawRag(r){
  const P=r.P;const pel=P[P_PELVIS].p,ch=P[P_CHEST].p;
  _up.subVectors(ch,pel).normalize();_side.subVectors(P[P_SIDE].p,pel);_side.addScaledVector(_up,-_side.dot(_up)).normalize();
  const fwd=_rc.crossVectors(_side,_up);
  r.body.matrix.makeBasis(_side,_up,fwd);r.body.matrix.setPosition(pel);r.body.matrixWorldNeedsUpdate=true;
  const side=_side.clone();
  const limb=(th,sh,hipSign,knee,foot,cut)=>{_hip.copy(pel).addScaledVector(side,.1*hipSign);
    if(cut){const k=P[knee].p;boneMatrix(th,k.clone().addScaledVector(_up,.47),k,side);}else boneMatrix(th,_hip,P[knee].p,side);
    boneMatrix(sh,P[knee].p,P[foot].p,side);};
  limb(r.thL,r.shL,1,P_LKNEE,P_LFOOT,r.cut.lleg);limb(r.thR,r.shR,-1,P_RKNEE,P_RFOOT,r.cut.rleg);
  const arm=(ar,hd,sign,hand,cut)=>{_sh.copy(ch).addScaledVector(side,.2*sign).addScaledVector(_up,-.06);const hp=P[hand].p;
    const from=cut?hp.clone().addScaledVector(_rb.subVectors(_sh,hp).normalize(),.55):_sh;
    boneMatrix(ar,from,hp,side,Math.max(.05,from.distanceTo(hp)));hd.matrix.makeTranslation(hp.x,hp.y,hp.z);hd.matrixWorldNeedsUpdate=true;};
  arm(r.arL,r.hdL,1,P_LHAND,r.cut.larm);arm(r.arR,r.hdR,-1,P_RHAND,r.cut.rarm);
}
function updateRagdolls(dt){
  const h=Math.min(dt,1/30);
  for(const r of RAGS){
    r.age+=dt;
    if(r.sleep<1.2){const sub=dt>1/45?2:1;let mv=0;for(let s=0;s<sub;s++)mv=Math.max(mv,stepRag(r,h/sub));
      if(mv<.0025)r.sleep+=dt;else r.sleep=0;drawRag(r);
      if(r.sleep>=1.2&&!r.pool&&SET.gore)r.pool={t:0,x:r.P[P_CHEST].p.x,z:r.P[P_CHEST].p.z,s:rand(1.4,2.4)};}
    // blood spurting from wounds and stumps
    for(const s of r.spurts){if(s.t<=0)continue;s.t-=dt;const q=r.P[s.i].p;if(Math.random()<dt*24){const k=Math.max(.2,s.t/3);
      chunks.spawn(q.x,q.y+.05,q.z,rand(-1,1)*k,rand(1,3)*k,rand(-1,1)*k,rand(.4,.9),.05,.03,1,.38,.02,.01,.6,12);}
      if(Math.random()<dt*2)decalAt(q.x+rand(-.3,.3),q.z+rand(-.3,.3),rand(.3,.7),'blood');}
    // a pool of blood spreads under the body
    if(r.pool&&r.pool.t<1){r.pool.t+=dt/7;if(!r.pool.m){r.pool.m=decalAt(r.pool.x,r.pool.z,r.pool.s,'pool');}if(r.pool.m)r.pool.m.scale.setScalar(.2+.8*Math.min(1,r.pool.t));}
  }
  updateProps(dt);
}
function removeCorpse(m){if(!m)return;scene.remove(m.root);if(m.rag){scene.remove(m.rag.g);const i=RAGS.indexOf(m.rag);if(i>=0)RAGS.splice(i,1);}}
function clearRagdolls(){for(const r of RAGS)scene.remove(r.g);RAGS.length=0;for(const p of PROPS)scene.remove(p.m);PROPS.length=0;}
function ragCenter(m){return m&&m.rag?m.rag.P[P_PELVIS].p:m?m.root.position:null;}

/* ---- props: dropped weapons and helmets that tumble and settle ---- */
const PROPS=[];
function addProp(mesh,p,v,spin,flat){mesh.position.copy(p);mesh.castShadow=true;scene.add(mesh);PROPS.push({m:mesh,v:v.clone(),spin:spin.clone(),rest:false,flat,t:0});
  if(PROPS.length>30){const o=PROPS.shift();scene.remove(o.m);}}
function updateProps(dt){
  for(const p of PROPS){if(p.rest)continue;p.t+=dt;p.v.y+=RAG_G*dt;p.m.position.addScaledVector(p.v,dt);
    p.m.rotation.x+=p.spin.x*dt;p.m.rotation.y+=p.spin.y*dt;p.m.rotation.z+=p.spin.z*dt;
    const g=ragFloor(p.m.position.x,p.m.position.z,p.m.position.y)+.03;
    if(p.m.position.y<g){p.m.position.y=g;if(p.v.y<-2)play('clink',{pos:p.m.position.clone(),vol:.3,maxD:30});p.v.y*=-.25;p.v.x*=.5;p.v.z*=.5;p.spin.multiplyScalar(.5);
      if(p.v.length()<.5||p.t>4){p.rest=true;if(p.flat)p.flat(p.m);}}}
}
function dropWeapon(u,m,at,dir){
  const id=u.weps&&u.weps[u.cur]?u.weps[u.cur].id:null;if(!id)return;
  const me=new THREE.Mesh(weaponGeoTP(id),SMAT);me.rotation.set(0,u.yaw,0);
  const v=new V3(rand(-1,1),rand(1.5,3),rand(-1,1));if(dir)v.addScaledVector(dir,2);
  addProp(me,at,v,new V3(rand(-6,6),rand(-3,3),rand(-6,6)),o=>{o.rotation.set(0,o.rotation.y,Math.PI/2*(Math.random()<.5?1:-1));});
}
function popHelmet(u,at,dir){
  const me=new THREE.Mesh(u.team?HELM_DE:HELM_US,new THREE.MeshStandardMaterial({color:C(STY[u.team].helm),roughness:.6,metalness:.3,envMap:ENV,envMapIntensity:.5}));
  me.scale.set(1,1,1.07);const v=new V3(rand(-1,1),rand(3,5),rand(-1,1));if(dir)v.addScaledVector(dir,3);
  addProp(me,at.clone().setY(at.y+.08),v,new V3(rand(-9,9),rand(-9,9),rand(-9,9)),o=>{o.rotation.set(Math.random()<.5?0:Math.PI,o.rotation.y,0);});
  play('helmet',{pos:at.clone(),vol:.6,maxD:60});
}

/* ---- gore ---- */
const BLOODC=[.42,.02,.015];
function goreHit(p,dir,zone,victim,dmg){
  const g=SET.gore?1:.35,big=zone==='head'?1.8:zone==='chest'?1.2:1;
  const n=Math.round((10+dmg/6)*big*g);
  for(let k=0;k<n;k++){const s=rand(1,5)*big;chunks.spawn(p.x,p.y,p.z,dir.x*s+rand(-1.2,1.2),rand(-.3,2.4)+dir.y*s,dir.z*s+rand(-1.2,1.2),rand(.5,1.1),rand(.03,.07),.02,1,BLOODC[0]*rand(.8,1.2),BLOODC[1],BLOODC[2],.5,12);}
  for(let k=0;k<Math.round(3*big*g);k++)smoke.spawn(p.x+dir.x*rand(0,.3),p.y,p.z+dir.z*rand(0,.3),dir.x*rand(1,3),rand(-.2,.6),dir.z*rand(1,3),rand(.35,.8),.12,rand(.5,1.1)*big,.75,.5,.03,.02,4,0);
  play('flesh',{pos:p,vol:.5,maxD:45});
  if(!SET.gore)return;
  // exit spray onto whatever is behind
  const h=rayWorld(p.x,p.y,p.z,dir.x,dir.y-.15,dir.z,4.5,true);
  if(h){if(h.ny>.6)decalAt(h.x,h.z,rand(.7,1.4)*big,'blood');else wallDecal(h,rand(.6,1.2)*big);}
  else{const d=rand(1,2.5);decalAt(p.x+dir.x*d,p.z+dir.z*d,rand(.5,1)*big,'blood');}
  if(p.distanceTo(camera.position)<2.6)bloodOnLens(.35*big);
}
function goreBurst(p,big){
  for(let k=0;k<30*big;k++)chunks.spawn(p.x,p.y,p.z,rand(-4,4),rand(1,6),rand(-4,4),rand(.6,1.4),rand(.04,.09),.03,1,BLOODC[0]*rand(.7,1.2),BLOODC[1],BLOODC[2],.4,12);
  for(let k=0;k<6*big;k++)smoke.spawn(p.x,p.y,p.z,rand(-2,2),rand(0,2),rand(-2,2),rand(.6,1.2),.3,1.6,.6,.45,.03,.02,3,0);
  for(let k=0;k<3;k++)decalAt(p.x+rand(-1.5,1.5),p.z+rand(-1.5,1.5),rand(.6,1.4),'blood');
  if(p.distanceTo(camera.position)<4)bloodOnLens(.7);
}
// blood trail from the wounded, and screams
function woundTick(u,dt){
  if(!u.alive||!u.bleed)return;
  u.trailD=(u.trailD||0)+Math.hypot(u.vel.x,u.vel.z)*dt+dt*.3;
  if(u.trailD>1.3&&SET.gore){u.trailD=0;decalAt(u.pos.x+rand(-.2,.2),u.pos.z+rand(-.2,.2),rand(.25,.5),'blood');}
  if(!u.isPlayer&&Math.random()<dt*.05&&u.pos.distanceTo(camera.position)<35)vox(u.pos.clone().setY(u.pos.y+1.4),{f0:rand(150,240),dur:rand(.6,1.2),rise:true,vowel:pick(['a','o']),vol:.28});
}
const bloodCv=$('blood'),bctx=bloodCv.getContext('2d');let bloodA=0;
function bloodOnLens(a){
  if(!SET.gore)a*=.4;
  if(bloodA<.05){bloodCv.width=innerWidth>>1;bloodCv.height=innerHeight>>1;bctx.clearRect(0,0,bloodCv.width,bloodCv.height);}
  const w=bloodCv.width,h=bloodCv.height;
  for(let i=0;i<14*a+2;i++){const edge=Math.random()<.75;let x=rand(0,w),y=rand(0,h);if(edge){if(Math.random()<.5)x=Math.random()<.5?rand(0,w*.18):rand(w*.82,w);else y=Math.random()<.5?rand(0,h*.2):rand(h*.8,h);}
    const r=rand(6,26)*(.6+a);bctx.fillStyle=`rgba(${rand(90,140)|0},${rand(0,12)|0},${rand(0,8)|0},${rand(.55,.85)})`;bctx.beginPath();
    for(let k=0;k<10;k++){const an=k/10*TAU,rr=r*rand(.6,1.25);bctx.lineTo(x+Math.cos(an)*rr,y+Math.sin(an)*rr);}bctx.fill();
    if(Math.random()<.6){bctx.fillRect(x-r*.12,y,r*.24,rand(r,r*4));}
    for(let k=0;k<5;k++){bctx.beginPath();bctx.arc(x+rand(-r*2,r*2),y+rand(-r*2,r*2),rand(1,4),0,TAU);bctx.fill();}}
  bloodA=Math.min(1,bloodA+a);bloodCv.style.opacity=bloodA;
}
function bloodTick(dt){if(bloodA>0){bloodA=Math.max(0,bloodA-dt*.18);bloodCv.style.opacity=bloodA;}}
