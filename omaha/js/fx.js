'use strict';
/* ================= Particles ================= */
const smokeTex=canvasTex(128,128,(g)=>{
  for(let i=0;i<26;i++){const x=64+rand(-20,20),y=64+rand(-20,20),r=rand(14,40);
    const gr=g.createRadialGradient(x,y,0,x,y,r);const a=rand(.1,.22);gr.addColorStop(0,`rgba(255,255,255,${a})`);gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gr;g.fillRect(0,0,128,128);}
},false);
const glowTex=canvasTex(64,64,(g)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,235,190,.7)');gr.addColorStop(1,'rgba(255,190,110,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);},false);
const chunkTex=canvasTex(32,32,(g)=>{g.fillStyle='#fff';g.beginPath();for(let i=0;i<7;i++){const a=i/7*TAU,r=rand(8,15);g.lineTo(16+Math.cos(a)*r,16+Math.sin(a)*r);}g.fill();},false);
smokeTex.wrapS=smokeTex.wrapT=glowTex.wrapS=glowTex.wrapT=chunkTex.wrapS=chunkTex.wrapT=THREE.ClampToEdgeWrapping;
const PVS=`attribute float psize;attribute float palpha;attribute vec3 pcolor;attribute float prot;
uniform float scale;varying float vA;varying vec3 vC;varying float vR;varying float vFog;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=min(psize*scale/max(-mv.z,0.1),1400.0);gl_Position=projectionMatrix*mv;vA=palpha;vC=pcolor;vR=prot;vFog=-mv.z;}`;
const PFS=`uniform sampler2D map;uniform vec3 fogColor;uniform float fogDensity;varying float vA;varying vec3 vC;varying float vR;varying float vFog;
void main(){vec2 uv=gl_PointCoord-0.5;float c=cos(vR),s=sin(vR);uv=vec2(c*uv.x-s*uv.y,s*uv.x+c*uv.y)+0.5;
vec4 t=texture2D(map,clamp(uv,0.0,1.0));float f=1.0-exp(-fogDensity*fogDensity*vFog*vFog);vec4 col=vec4(vC*t.rgb,t.a*vA);
#ifdef ADD
col.a*=1.0-f;
#else
col.rgb=mix(col.rgb,fogColor,f);
#endif
if(col.a<0.004)discard;gl_FragColor=col;
#include <tonemapping_fragment>
#include <encodings_fragment>
}`;
const wind=new V3(1.4,.15,.6);
class PS{
  constructor(max,tex,additive,order){
    this.max=max;this.cur=0;
    const g=new THREE.BufferGeometry();
    this.P=new Float32Array(max*3);this.S=new Float32Array(max);this.A=new Float32Array(max);this.Co=new Float32Array(max*3);this.R=new Float32Array(max);
    g.setAttribute('position',new THREE.BufferAttribute(this.P,3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize',new THREE.BufferAttribute(this.S,1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('palpha',new THREE.BufferAttribute(this.A,1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor',new THREE.BufferAttribute(this.Co,3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('prot',new THREE.BufferAttribute(this.R,1).setUsage(THREE.DynamicDrawUsage));
    this.g=g;
    this.V=new Float32Array(max*3);this.L=new Float32Array(max);this.ML=new Float32Array(max);this.S0=new Float32Array(max);this.S1=new Float32Array(max);
    this.A0=new Float32Array(max);this.D=new Float32Array(max);this.G=new Float32Array(max);this.RV=new Float32Array(max);
    this.mat=new THREE.ShaderMaterial({uniforms:{map:{value:tex},scale:{value:600},fogColor:{value:FOG_COL},fogDensity:{value:scene.fog.density}},
      vertexShader:PVS,fragmentShader:PFS,transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,defines:additive?{ADD:1}:{}});
    this.pts=new THREE.Points(g,this.mat);this.pts.frustumCulled=false;this.pts.renderOrder=order;scene.add(this.pts);this.live=0;
  }
  spawn(x,y,z,vx,vy,vz,life,s0,s1,a0,r,gc,b,drag,grav){
    const i=this.cur;this.cur=(i+1)%this.max;
    this.P[i*3]=x;this.P[i*3+1]=y;this.P[i*3+2]=z;this.V[i*3]=vx;this.V[i*3+1]=vy;this.V[i*3+2]=vz;
    this.L[i]=life;this.ML[i]=life;this.S0[i]=s0;this.S1[i]=s1;this.A0[i]=a0;this.Co[i*3]=r;this.Co[i*3+1]=gc;this.Co[i*3+2]=b;
    this.D[i]=drag;this.G[i]=grav;this.R[i]=Math.random()*TAU;this.RV[i]=rand(-.4,.4);this.S[i]=s0;this.A[i]=0;
  }
  clear(){this.L.fill(0);this.A.fill(0);this.g.attributes.palpha.needsUpdate=true;}
  update(dt){
    const P=this.P,V=this.V;
    for(let i=0;i<this.max;i++){
      let l=this.L[i];if(l<=0)continue;l-=dt;this.L[i]=l;
      if(l<=0){this.A[i]=0;continue;}
      const k=1-l/this.ML[i],dr=Math.exp(-this.D[i]*dt),i3=i*3,gr=this.G[i];
      if(gr===0){V[i3]=wind.x+(V[i3]-wind.x)*dr;V[i3+1]=wind.y+(V[i3+1]-wind.y)*dr;V[i3+2]=wind.z+(V[i3+2]-wind.z)*dr;}
      else{V[i3]*=dr;V[i3+1]=V[i3+1]*dr-gr*dt;V[i3+2]*=dr;}
      P[i3]+=V[i3]*dt;P[i3+1]+=V[i3+1]*dt;P[i3+2]+=V[i3+2]*dt;
      if(gr>0){const gy=Math.max(H(P[i3],P[i3+2]),-.1);if(P[i3+1]<gy){P[i3+1]=gy;V[i3]*=.3;V[i3+1]=0;V[i3+2]*=.3;}}
      const e=1-(1-k)*(1-k);
      this.S[i]=this.S0[i]+(this.S1[i]-this.S0[i])*e;
      this.A[i]=this.A0[i]*Math.pow(1-k,1.3)*Math.min(1,k*25);
      this.R[i]+=this.RV[i]*dt;
    }
    const a=this.g.attributes;a.position.needsUpdate=a.psize.needsUpdate=a.palpha.needsUpdate=a.pcolor.needsUpdate=a.prot.needsUpdate=true;
  }
}
const smoke=new PS(5000,smokeTex,false,2);
const chunks=new PS(3200,chunkTex,false,2);
const glow=new PS(1000,glowTex,true,4);
function particleScale(){const s=renderer.getDrawingBufferSize(new THREE.Vector2()).y/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2));smoke.mat.uniforms.scale.value=chunks.mat.uniforms.scale.value=glow.mat.uniforms.scale.value=s;}

/* ================= Flash lights ================= */
const flashLights=[];
for(let i=0;i<5;i++){const L=new THREE.PointLight(C(0xffb468),0,30,1.6);scene.add(L);flashLights.push({L,t:0,d:1,i:0});}
function flashAt(p,intensity,dur,range){
  if(p.distanceTo(camera.position)>range*3)return;
  let f=flashLights[0];for(const x of flashLights)if(x.t<f.t)f=x;
  f.L.position.copy(p);f.L.distance=range;f.t=dur;f.d=dur;f.i=intensity;f.L.intensity=intensity;
}
function updateFlashes(dt){for(const f of flashLights){if(f.t>0){f.t-=dt;f.L.intensity=f.i*Math.max(0,f.t/f.d);}else f.L.intensity=0;}}

/* ================= Tracers ================= */
const tracers=[];
{
  const geo=new THREE.BoxGeometry(.035,.035,1);geo.translate(0,0,-.5);
  const mat=new THREE.MeshBasicMaterial({color:new THREE.Color(4,2.6,1.2),transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
  for(let i=0;i<70;i++){const m=new THREE.Mesh(geo,mat);m.visible=false;m.frustumCulled=false;m.renderOrder=5;scene.add(m);tracers.push({m,t:0,len:0,d:new V3(),o:new V3(),max:0});}
}
let tracerI=0;
function tracer(o,dir,dist,speed=520){
  const tr=tracers[tracerI];tracerI=(tracerI+1)%tracers.length;
  tr.o.copy(o);tr.d.copy(dir);tr.max=dist;tr.t=0;tr.speed=speed;tr.m.visible=true;
  tr.m.position.copy(o);tr.m.lookAt(o.x-dir.x,o.y-dir.y,o.z-dir.z);
}
function updateTracers(dt){
  for(const tr of tracers){if(!tr.m.visible)continue;tr.t+=dt*tr.speed;if(tr.t>tr.max){tr.m.visible=false;continue;}
    const len=Math.min(tr.t,7,tr.max-tr.t+.5);tr.m.position.copy(tr.o).addScaledVector(tr.d,tr.t);tr.m.scale.set(1,1,Math.max(.3,len));}
}

/* ================= Debris (physical chunks) ================= */
const debris=[];
{
  const g=new THREE.DodecahedronGeometry(.12,0);
  const m=new THREE.InstancedMesh(g,new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}),120);m.castShadow=true;m.count=120;
  for(let i=0;i<120;i++){m.setMatrixAt(i,compose(0,-50,0));m.setColorAt(i,new THREE.Color(1,1,1));debris.push({p:new V3(0,-50,0),v:new V3(),r:new V3(),rv:new V3(),t:0,s:1});}
  scene.add(m);debris.mesh=m;debris.i=0;
}
const _dc=new THREE.Color();
function throwDebris(p,n,speed,col){
  for(let k=0;k<n;k++){const d=debris[debris.i];debris.i=(debris.i+1)%debris.length;
    d.p.copy(p);d.v.set(rand(-1,1)*speed*.5,rand(.5,1)*speed,rand(-1,1)*speed*.5);d.rv.set(rand(-9,9),rand(-9,9),rand(-9,9));d.t=rand(4,8);d.s=rand(.6,2.2);
    _dc.copy(col).offsetHSL(0,0,rand(-.06,.06));debris.mesh.setColorAt(debris.indexOf(d),_dc);}
  debris.mesh.instanceColor.needsUpdate=true;
}
function updateDebris(dt){
  let any=false;
  debris.forEach((d,i)=>{if(d.t<=0)return;any=true;d.t-=dt;
    d.v.y-=18*dt;d.p.addScaledVector(d.v,dt);const g=H(d.p.x,d.p.z);
    if(d.p.y<g+.05){d.p.y=g+.05;if(d.v.y<-2&&Math.random()<.04)play('clink',{pos:d.p.clone(),vol:.15});d.v.y*=-.25;d.v.x*=.5;d.v.z*=.5;d.rv.multiplyScalar(.5);}
    d.r.addScaledVector(d.rv,dt);
    const sink=d.t<1?d.t:1;debris.mesh.setMatrixAt(i,compose(d.p.x,d.p.y-(1-sink)*.3,d.p.z,d.r.x,d.r.y,d.r.z,d.s,d.s,d.s));});
  if(any)debris.mesh.instanceMatrix.needsUpdate=true;
}

/* ================= Decals: scorch marks and blood ================= */
const decals=[];
{
  const scorchMat=new THREE.MeshBasicMaterial({map:TEX.crater,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,fog:true,opacity:.85});
  const bloodTex=canvasTex(64,64,(g)=>{for(let i=0;i<14;i++){const x=32+rand(-14,14),y=32+rand(-14,14),r=rand(3,12);g.fillStyle=`rgba(90,8,4,${rand(.5,.9)})`;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}});
  bloodTex.wrapS=bloodTex.wrapT=THREE.ClampToEdgeWrapping;
  const bloodMat=new THREE.MeshBasicMaterial({map:bloodTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,fog:true,color:C(0x8a8a8a)});
  decals.scorch=scorchMat;decals.blood=bloodMat;decals.list=[];
}
function decalAt(x,z,size,kind){
  // conformed to the terrain: a small grid draped over H
  const n=6,geo=new THREE.PlaneGeometry(size,size,n,n);geo.rotateX(-Math.PI/2);const p=geo.attributes.position;const a=rand(0,TAU),ca=Math.cos(a),sa=Math.sin(a);
  for(let i=0;i<p.count;i++){const lx=p.getX(i),lz=p.getZ(i);const wx=x+lx*ca-lz*sa,wz=z+lx*sa+lz*ca;p.setXYZ(i,wx,H(wx,wz)+.04,wz);}
  geo.computeBoundingSphere();
  const m=new THREE.Mesh(geo,kind==='blood'?decals.blood:decals.scorch);m.renderOrder=0;scene.add(m);decals.list.push(m);
  if(decals.list.length>90){const o=decals.list.shift();scene.remove(o);o.geometry.dispose();}
}
function clearDecals(){for(const m of decals.list){scene.remove(m);m.geometry.dispose();}decals.list.length=0;}

/* ================= Effects ================= */
const SURF_COL={sand:[.62,.55,.42],grass:[.36,.32,.24],dirt:[.4,.33,.24],hedge:[.25,.3,.16],concrete:[.62,.6,.56],stone:[.6,.56,.5],plaster:[.7,.66,.58],sandbag:[.6,.54,.4],
  wood:[.42,.32,.22],timber:[.42,.32,.22],metal:[.3,.3,.3],slate:[.3,.3,.32],water:[.8,.82,.84],flesh:[.45,.05,.03]};
function impactFX(hit,dir){
  const x=hit.x,y=hit.y,z=hit.z,m=hit.mat;const c=SURF_COL[m]||SURF_COL.grass;
  const nx=hit.nx||0,ny=hit.ny||1,nz=hit.nz||0;
  if(m==='water'){for(let k=0;k<8;k++)smoke.spawn(x,y,z,rand(-.6,.6),rand(2.5,5.5),rand(-.6,.6),rand(.5,.9),.08,.35,.8,.85,.87,.88,1.2,9);
    smoke.spawn(x,y+.1,z,0,.3,0,1.2,.2,1.2,.3,.85,.87,.88,2,0);play('impWater',{pos:new V3(x,y,z),vol:.35,maxD:60});return;}
  const sp=m==='sand'||m==='grass'||m==='dirt'?1:0;
  for(let k=0;k<(sp?7:5);k++)chunks.spawn(x,y,z,nx*rand(1,4)+rand(-1.5,1.5),ny*rand(1,4)+rand(1,sp?5:3),nz*rand(1,4)+rand(-1.5,1.5),rand(.4,.9),.05,.04,1,c[0]*.7,c[1]*.7,c[2]*.7,1,14);
  smoke.spawn(x+nx*.1,y+ny*.1,z+nz*.1,nx*.8,ny*.8+.3,nz*.8,rand(.8,1.6),.12,sp?1.4:.9,sp?.55:.4,c[0],c[1],c[2],2,0);
  if(m==='metal'||m==='concrete'||m==='stone'){for(let k=0;k<4;k++)glow.spawn(x,y,z,nx*5+rand(-3,3),ny*5+rand(0,4),nz*5+rand(-3,3),rand(.08,.2),.05,.02,1,1,.75,.4,2,12);}
  const p=new V3(x,y,z);
  if(m==='metal')play('impMetal',{pos:p,vol:.35,maxD:60});
  else if(m==='concrete'||m==='stone'){play('impHard',{pos:p,vol:.3,maxD:60});if(Math.random()<.3)play('ric',{pos:p,vol:.3,maxD:70});}
  else if(m==='wood'||m==='timber')play('impWood',{pos:p,vol:.3,maxD:60});
  else play('impSand',{pos:p,vol:.3,maxD:50});
}
function bloodFX(p,dir){
  for(let k=0;k<6;k++)chunks.spawn(p.x,p.y,p.z,dir.x*rand(1,4)+rand(-1,1),rand(.5,2.5),dir.z*rand(1,4)+rand(-1,1),rand(.4,.8),.04,.03,1,.35,.02,.01,1,12);
  smoke.spawn(p.x,p.y,p.z,dir.x*1.5,.2,dir.z*1.5,rand(.4,.7),.1,.55,.7,.42,.03,.02,4,0);
}
function muzzleFX(p,dir,big){
  glow.spawn(p.x+dir.x*.1,p.y+dir.y*.1,p.z+dir.z*.1,dir.x*3,dir.y*3,dir.z*3,.05,big?.55:.4,big?.9:.7,1,1,.75,.4,4,0);
  glow.spawn(p.x+dir.x*.35,p.y+dir.y*.35,p.z+dir.z*.35,dir.x*7,dir.y*7,dir.z*7,.04,.3,.6,.8,1,.65,.3,4,0);
  smoke.spawn(p.x+dir.x*.3,p.y+dir.y*.3,p.z+dir.z*.3,dir.x*3+rand(-.3,.3),dir.y*3+rand(0,.4),dir.z*3+rand(-.3,.3),rand(.6,1.4),.08,big?.9:.6,.22,.75,.74,.72,3,0);
}
// a single shell or grenade blast. power 1 = grenade, 2.2 = artillery
function explosion(p,power,owner,weapon){
  if(Net.host)Net.event(['boom',Math.round(p.x*100)/100,Math.round(p.y*100)/100,Math.round(p.z*100)/100,power]);
  const inWater=H(p.x,p.z)<-.05&&p.y<.4;
  const P=power;
  if(inWater){
    for(let k=0;k<40*P;k++){const a=rand(0,TAU),s=rand(0,2.5)*P;smoke.spawn(p.x+Math.cos(a)*rand(0,1.5),.1,p.z+Math.sin(a)*rand(0,1.5),Math.cos(a)*s,rand(8,18)*P*.8,Math.sin(a)*s,rand(1.4,2.6),.4*P,1.6*P,.85,.85,.87,.9,.6,9);}
    for(let k=0;k<10;k++)smoke.spawn(p.x+rand(-2,2),rand(0,3),p.z+rand(-2,2),rand(-1,1),rand(1,3),rand(-1,1),rand(3,6),1.5*P,6*P,.45,.82,.84,.86,1.5,0);
    play('splashBoom',{pos:p,vol:.9*P/2,ref:12});
  }else{
    const ground=SURF_COL[p.z>35?'sand':'dirt'];
    for(let k=0;k<12*P;k++)glow.spawn(p.x+rand(-.5,.5),p.y+rand(0,.6),p.z+rand(-.5,.5),rand(-6,6)*P,rand(2,9)*P,rand(-6,6)*P,rand(.12,.32),rand(1.2,2.2)*P,rand(2.4,4)*P,1,1,.62,.28,5,0);
    for(let k=0;k<26*P;k++){const a=rand(0,TAU),s=rand(2,7)*P;chunks.spawn(p.x,p.y+.3,p.z,Math.cos(a)*s,rand(5,14)*P,Math.sin(a)*s,rand(1,2.2),.12,.08,1,ground[0]*.55,ground[1]*.55,ground[2]*.55,.4,14);}
    for(let k=0;k<18*P;k++){const a=rand(0,TAU),s=rand(.5,3)*P;smoke.spawn(p.x+Math.cos(a)*rand(0,1),p.y+rand(0,1.5)*P,p.z+Math.sin(a)*rand(0,1),Math.cos(a)*s,rand(1,6)*P,Math.sin(a)*s,rand(4,9),rand(.8,1.6)*P,rand(4,8)*P,rand(.45,.7),.22,.2,.18,1.4,0);}
    for(let k=0;k<6*P;k++)smoke.spawn(p.x+rand(-1,1),p.y+rand(0,2),p.z+rand(-1,1),rand(-1,1),rand(3,9),rand(-1,1),rand(2,4),.8*P,3*P,.5,ground[0]*.8,ground[1]*.8,ground[2]*.8,1.2,0);
    throwDebris(new V3(p.x,p.y+.3,p.z),Math.round(5*P),7*P,new THREE.Color(ground[0]*.6,ground[1]*.6,ground[2]*.6));
    // a geyser of sand and earth thrown straight up, which then rains back down
    const sandy=p.z>35;const gc=sandy?[.72,.64,.5]:ground;
    for(let k=0;k<55*P;k++){const a=rand(0,TAU),s=rand(0,2.4)*P;chunks.spawn(p.x+Math.cos(a)*rand(0,.8),p.y+.2,p.z+Math.sin(a)*rand(0,.8),Math.cos(a)*s,rand(9,20)*P*.8,Math.sin(a)*s,rand(2,3.6),rand(.05,.14),.05,1,gc[0]*rand(.6,.9),gc[1]*rand(.6,.9),gc[2]*rand(.6,.9),.15,13);}
    for(let k=0;k<14*P;k++){const h=rand(.3,1);smoke.spawn(p.x+rand(-.6,.6),p.y+.5,p.z+rand(-.6,.6),rand(-.8,.8),rand(10,17)*P*h*.75,rand(-.8,.8),rand(2.5,4.5),rand(.8,1.4)*P,rand(3,5.5)*P,rand(.55,.8),gc[0]*.95,gc[1]*.93,gc[2]*.9,1.6,0);}
    for(let k=0;k<10*P;k++){const a=rand(0,TAU),r=rand(1,3)*P;smoke.spawn(p.x+Math.cos(a)*r,p.y+.3,p.z+Math.sin(a)*r,Math.cos(a)*rand(2,5),rand(.3,1.2),Math.sin(a)*rand(2,5),rand(3,6),rand(1,2)*P,rand(5,8)*P,rand(.35,.55),gc[0],gc[1]*.97,gc[2]*.92,1.2,0);}
    decalAt(p.x,p.z,2.2*P+rand(0,1),'scorch');
    flashAt(new V3(p.x,p.y+1.5,p.z),9*P,.25,18*P);
    play(P>1.5?'boom':'nade',{pos:p,vol:P>1.5?1:.85,ref:P>1.5?14:9});
    if(P>1.5)play('debris',{pos:p,vol:.4,delay:.5});
  }
  // blast damage and concussion
  const lethal=3.2*P,maxR=9*P;
  if(!Net.client)for(const u of UNITS){if(!u.alive)continue;
    const d=Math.hypot(u.pos.x-p.x,u.pos.y+.9-p.y,u.pos.z-p.z);if(d>maxR)continue;
    // walls between the blast and the target soak it
    const eye=new V3(u.pos.x,u.pos.y+1.0,u.pos.z);if(!clearLine(new V3(p.x,p.y+.4,p.z),eye))continue;
    const dmg=d<lethal?200:120*Math.pow(1-(d-lethal)/(maxR-lethal),1.5);
    if(dmg>3)hurt(u,dmg,owner,weapon||'arty','blast',new V3(u.pos.x-p.x,0,u.pos.z-p.z).normalize());
  }
  const dc=p.distanceTo(camera.position);
  FX.trauma=Math.min(1.6,FX.trauma+clamp((P*18)/(dc+3),0,1.3));
  if(!inWater&&dc<22*P*.8)sandRain(clamp(1.3-dc/(22*P*.8),.2,1),p.z>35);
  if(dc<12*P)FX.kick=Math.min(1,(FX.kick||0)+(1-dc/(12*P))*.8);
  if(dc<6*P){FX.blur=Math.min(1,FX.blur+(1-dc/(6*P))*.9);FX.white=Math.max(FX.white,.5*(1-dc/(6*P)));muffle(380,3.5);earRing(.05*(1-dc/(6*P)),4);if(dc<3*P){FX.aberr=1;}}
  else if(dc<14*P){muffle(1600,1.2);}
}
// persistent fires and smoke columns
function burnTick(dt){
  for(const b of BURNING){
    if(Math.random()<dt*(b.big?14:8))smoke.spawn(b.x+rand(-.6,.6),b.y,b.z+rand(-.6,.6),rand(-.3,.3),rand(1.5,3),rand(-.3,.3),rand(9,16),rand(.8,1.4),rand(7,12),rand(.5,.75),.09,.085,.08,.25,0);
    if(Math.random()<dt*10)glow.spawn(b.x+rand(-.6,.6),b.y-.3,b.z+rand(-.6,.6),rand(-.2,.2),rand(1,2.5),rand(-.2,.2),rand(.3,.6),rand(.5,.9),rand(.1,.3),.9,1,.55,.2,1,0);
  }
  if(!flashLights.fire){flashLights.fire=BURNING.map(b=>{const L=new THREE.PointLight(C(0xff8a3a),2.2,11,1.6);L.position.set(b.x,b.y,b.z);scene.add(L);return L;});}
  for(const L of flashLights.fire)L.intensity=1.6+Math.random()*1.2;
}
// drifting battle smoke over the beach
function hazeTick(dt){
  if(Math.random()<dt*2.2){const x=rand(-100,100),z=rand(40,140);smoke.spawn(x,H(x,z)+1,z,rand(-.5,.5),.2,rand(-.5,.5),rand(18,30),rand(5,8),rand(14,22),rand(.12,.22),.55,.55,.54,.2,0);}
}

/* ---- sand raining down on you after a close blast, and grit on the lens ---- */
const RAIN={t:0,amt:0,sandy:true};
function sandRain(a,sandy){RAIN.t=Math.max(RAIN.t,1.2+a*2.2);RAIN.amt=Math.max(RAIN.amt,a);RAIN.sandy=sandy;if(a>.35)dirtOnLens(a);
  play('debris',{vol:.25+a*.4,delay:.6});}
function rainTick(dt){
  if(RAIN.t<=0)return;RAIN.t-=dt;const c=camera.position,a=RAIN.amt*Math.min(1,RAIN.t/1.2);const col=RAIN.sandy?[.7,.62,.48]:[.42,.35,.26];
  const n=Math.round(a*220*dt*10)/10;for(let k=0;k<n;k++){const r=rand(.5,6),an=rand(0,TAU);
    chunks.spawn(c.x+Math.cos(an)*r,c.y+rand(3,7),c.z+Math.sin(an)*r,rand(-.5,.5),rand(-4,-1),rand(-.5,.5),rand(1,1.8),rand(.02,.06),.03,1,col[0]*rand(.7,1),col[1]*rand(.7,1),col[2]*rand(.7,1),.1,9);}
  if(Math.random()<a*dt*6)smoke.spawn(c.x+rand(-3,3),c.y+rand(1,4),c.z+rand(-3,3),rand(-.3,.3),rand(-1.2,-.4),rand(-.3,.3),rand(2,3.5),rand(1,2),rand(3,5),.18*a,col[0],col[1],col[2],.5,0);
}
const dirt=$('dirt');const dctx=dirt.getContext('2d');let dirtA=0;
function dirtOnLens(a){
  dirt.width=innerWidth>>1;dirt.height=innerHeight>>1;const w=dirt.width,h=dirt.height;dctx.clearRect(0,0,w,h);
  for(let i=0;i<120*a;i++){const x=rand(0,w),y=rand(0,h);const edge=Math.min(1,Math.hypot(x/w-.5,y/h-.5)*2.2);if(Math.random()>edge*1.1)continue;
    const r=rand(1,4)*(1+a);dctx.fillStyle=`rgba(${rand(70,120)|0},${rand(55,95)|0},${rand(35,60)|0},${rand(.5,.9)})`;dctx.beginPath();dctx.ellipse(x,y,r,r*rand(.6,1),rand(0,3),0,TAU);dctx.fill();}
  for(let i=0;i<8*a;i++){const x=rand(0,w),y=rand(0,h),r=rand(20,70);const g=dctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(90,72,50,.35)');g.addColorStop(1,'rgba(90,72,50,0)');dctx.fillStyle=g;dctx.fillRect(x-r,y-r,r*2,r*2);}
  dirtA=Math.min(1,.6+a*.5);dirt.style.opacity=dirtA;
}
function dirtTick(dt){if(dirtA>0){dirtA=Math.max(0,dirtA-dt*.28);dirt.style.opacity=dirtA;}}
