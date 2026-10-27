'use strict';
/* ================= Map layout constants =================
   +z is the sea (south), -z is inland (north). x runs along the beach.
   Water line ~ z=140. Shingle z 36..46. Seawall z~34. Bluff rises z 30 -> 3 to ~16.5m.
   Draw (road exit) at x~0. Plateau and hedgerows z 0..-78. Village z -80..-160.            */
const MAP={BX:92,BZN:-160,BZS:172,SEA:0,WALLZ:34.1,WALLTOP:3.3};
function baseH(x,z){
  let h;
  if(z>140)h=(140-z)*0.05;
  else if(z>46)h=(140-z)*0.0165;
  else if(z>36)h=1.55+(46-z)*0.05;
  else h=2.05;
  const ax=Math.abs(x);
  const draw=sstep(19,8,ax);
  const bluffA=22*sstep(31,2,z);
  const bluffD=22*sstep(36,-38,z);
  h+=bluffA+(bluffD-bluffA)*draw;
  const onBluff=sstep(32,26,z)*sstep(-10,4,z)*(1-draw*.8);
  h+=onBluff*(fbm(x*.07+11,z*.07,4)*2.6-1.1);
  const plateau=sstep(2,-10,z);
  h+=plateau*(fbm(x*.018+3,z*.018,3)*3.4-1.4);
  if(z>40&&z<138)h+=Math.sin(x*.045+z*.31)*.035+Math.sin(x*.11-z*.17)*.02;
  // side bluffs close the sector in
  h+=Math.max(0,ax-104)*.18*sstep(36,10,z)*(.7+.6*fbm(x*.03,z*.05,2));
  // northern hills
  h+=Math.max(0,-z-175)*.25;
  // village plateau levels out
  const v=sstep(-74,-88,z);h=h+(24.6+fbm(x*.03,z*.03,2)*.6-h)*v*.85;
  return h;
}
/* ---- heightfield grid (0.5 m) with carved features ---- */
const HG={x0:-130,z0:-190,x1:130,z1:220,res:.5};
HG.nx=Math.round((HG.x1-HG.x0)/HG.res)+1;HG.nz=Math.round((HG.z1-HG.z0)/HG.res)+1;
HG.h=new Float32Array(HG.nx*HG.nz);
for(let j=0;j<HG.nz;j++){const z=HG.z0+j*HG.res;for(let i=0;i<HG.nx;i++)HG.h[j*HG.nx+i]=baseH(HG.x0+i*HG.res,z);}
function H(x,z){
  const fx=(x-HG.x0)/HG.res,fz=(z-HG.z0)/HG.res;
  if(fx<0||fz<0||fx>=HG.nx-1||fz>=HG.nz-1)return baseH(x,z);
  const i=fx|0,j=fz|0,u=fx-i,v=fz-j,k=j*HG.nx+i,h=HG.h;
  return(h[k]*(1-u)+h[k+1]*u)*(1-v)+(h[k+HG.nx]*(1-u)+h[k+HG.nx+1]*u)*v;
}
function gridEdit(x0,z0,x1,z1,fn){
  const i0=Math.max(0,Math.floor((x0-HG.x0)/HG.res)),i1=Math.min(HG.nx-1,Math.ceil((x1-HG.x0)/HG.res));
  const j0=Math.max(0,Math.floor((z0-HG.z0)/HG.res)),j1=Math.min(HG.nz-1,Math.ceil((z1-HG.z0)/HG.res));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*HG.nx+i;HG.h[k]=fn(HG.x0+i*HG.res,HG.z0+j*HG.res,HG.h[k]);}
}
function flattenRect(x0,z0,x1,z1,y,blend=2){
  gridEdit(x0-blend,z0-blend,x1+blend,z1+blend,(x,z,h)=>{const dx=Math.max(x0-x,0,x-x1),dz=Math.max(z0-z,0,z-z1);const d=Math.hypot(dx,dz);const w=1-sstep(0,blend,d);return h+(y-h)*w;});
}
function segDist(px,pz,ax,az,bx,bz){const vx=bx-ax,vz=bz-az,wx=px-ax,wz=pz-az;const t=clamp((wx*vx+wz*vz)/(vx*vx+vz*vz),0,1);return Math.hypot(px-ax-vx*t,pz-az-vz*t);}
// trenches: zigzag polylines carved 1.7 m deep
const TRENCHES=[];
function zigzag(xa,xb,z,amp,period){const pts=[];const n=Math.max(2,Math.round(Math.abs(xb-xa)/(period/2)));for(let k=0;k<=n;k++){const x=lerp(xa,xb,k/n);pts.push([x,z+(k%2?amp:-amp)*(k===0||k===n?0:1)]);}return pts;}
TRENCHES.push(zigzag(-84,-47,-6,1.6,9),zigzag(-33,-13,-6,1.4,8),zigzag(13,35,-6,1.4,8),zigzag(49,84,-6,1.6,9));
// connecting trench behind the bunkers
TRENCHES.push([[-47,-6],[-44,-9],[-36,-9],[-33,-6]],[[35,-6],[38,-9],[46,-9],[49,-6]]);
const TRENCH_DEPTH=1.75,TRENCH_HW=1.15;
function trenchDist(x,z){let d=1e9;for(const L of TRENCHES)for(let k=0;k<L.length-1;k++){const a=L[k],b=L[k+1];if(Math.abs(x-a[0])>14&&Math.abs(x-b[0])>14)continue;d=Math.min(d,segDist(x,z,a[0],a[1],b[0],b[1]));}return d;}
// bunker pads (flattened) before carving
const BUNKERS=[{x:-40,z:1.5,w:11,d:8},{x:42,z:1.5,w:11,d:8}];
for(const b of BUNKERS)flattenRect(b.x-b.w/2,b.z-b.d/2,b.x+b.w/2,b.z+b.d/2,H(b.x,b.z-1),2.5);
// draw casemate pad
flattenRect(14,12,22,20,H(18,16),2);
gridEdit(-90,-14,90,4,(x,z,h)=>{const d=trenchDist(x,z);if(d>TRENCH_HW+.6)return h;
  // shallow ramps at the open ends
  let depth=TRENCH_DEPTH;for(const L of TRENCHES.slice(0,4))for(const e of[L[0],L[L.length-1]]){const de=Math.hypot(x-e[0],z-e[1]);if(de<4)depth*=sstep(0,4,de)*.8+.2;}
  return h-depth*(1-sstep(TRENCH_HW-.3,TRENCH_HW+.6,d));});
// shell craters (real dents in the ground)
const CRATERS=[];
{let seed=7;const r=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const add=(x0,x1,z0,z1,n,s0,s1)=>{for(let i=0;i<n;i++){const x=lerp(x0,x1,r()),z=lerp(z0,z1,r());if(Math.abs(x)<5&&z<40)continue;if(trenchDist(x,z)<4)continue;CRATERS.push({x,z,r:lerp(s0,s1,r())});}};
  add(-88,88,48,128,26,1.6,3.2);add(-88,88,8,30,22,1.8,3.4);add(-88,88,-74,-12,18,2,4);add(-60,60,-150,-82,5,2,3);}
for(const c of CRATERS)gridEdit(c.x-c.r*1.6,c.z-c.r*1.6,c.x+c.r*1.6,c.z+c.r*1.6,(x,z,h)=>{const d=Math.hypot(x-c.x,z-c.z)/c.r;if(d>1.6)return h;
  return h-(d<1?(1-d*d)*c.r*.32:0)+(d>.85&&d<1.6?Math.sin((d-.85)/.75*Math.PI)*c.r*.07:0);});
function slopeAt(x,z){const e=.6;return Math.hypot(H(x+e,z)-H(x-e,z),H(x,z+e)-H(x,z-e))/(2*e);}
// roads: draw road from the beach to the village plus the village streets
const ROADS=[[[0,40],[0,10],[1,-20],[0,-45],[0,-121]],[[-95,-45],[95,-45]],[[-60,-100],[60,-100]]];
function roadDist(x,z){let d=1e9;for(const L of ROADS)for(let k=0;k<L.length-1;k++)d=Math.min(d,segDist(x,z,L[k][0],L[k][1],L[k+1][0],L[k+1][1]));return d;}
// sink roads a touch
gridEdit(-96,-162,96,40,(x,z,h)=>{const d=roadDist(x,z);return d<3.2?h-.12*(1-sstep(2,3.2,d)):h;});

/* ================= Lights & sky ================= */
const sunDir=new V3(.55,.62,.3).normalize();
const hemi=new THREE.HemisphereLight(C(0xb4bcc6),C(0x5a5242),.95);scene.add(hemi);
const sun=new THREE.DirectionalLight(C(0xfff2dc),1.7);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,near:1,far:400});
sun.shadow.bias=-0.0005;sun.shadow.normalBias=0.04;
scene.add(sun);scene.add(sun.target);
function placeSun(p){sun.target.position.set(Math.round(p.x/4)*4,0,Math.round(p.z/4)*4);sun.position.copy(sun.target.position).addScaledVector(sunDir,180);}

const skyU={time:{value:0},sunDir:{value:sunDir},top:{value:C(0x6d7782)},hor:{value:FOG_COL.clone()},dark:{value:C(0x585e66)}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(2000,32,16),new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,fog:false,uniforms:skyU,
  vertexShader:`varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;}`,
  fragmentShader:`uniform vec3 top,hor,dark,sunDir;uniform float time;varying vec3 vD;
  float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
  float fb(vec2 p){float s=0.0,a=0.5;for(int i=0;i<5;i++){s+=ns(p)*a;p*=2.03;a*=0.5;}return s;}
  void main(){vec3 d=normalize(vD);float h=max(d.y,0.0);
    vec3 col=mix(hor,top,pow(h,0.6));
    vec2 cp=d.xz/(d.y+0.12)*1.6+vec2(time*0.004,time*0.0015);
    float c=fb(cp),c2=fb(cp*2.3+3.0);
    float cl=smoothstep(0.35,0.75,c*0.7+c2*0.4);
    vec3 cc=mix(dark,hor*1.08,smoothstep(0.3,0.9,c2));
    col=mix(col,cc,cl*smoothstep(0.0,0.25,h)*0.9);
    float s=max(dot(d,sunDir),0.0);col+=vec3(1.0,0.93,0.8)*(pow(s,40.0)*0.25+pow(s,6.0)*0.12)*(1.0-cl*0.6);
    col=mix(col,hor,smoothstep(0.12,0.0,d.y));
    gl_FragColor=vec4(col,1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }`}));
sky.renderOrder=-10;sky.frustumCulled=false;scene.add(sky);

/* ================= Terrain mesh ================= */
TEX.sandD.encoding=TEX.grassD.encoding=TEX.rockD.encoding=THREE.LinearEncoding;
const terrainMat=new THREE.MeshStandardMaterial({vertexColors:true,map:TEX.sandD,roughness:.96,metalness:0});
terrainMat.onBeforeCompile=sh=>{
  sh.uniforms.grassMap={value:TEX.grassD};sh.uniforms.rockMap={value:TEX.rockD};
  sh.vertexShader='attribute vec3 aW;\nvarying vec3 vW;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvW=aW;');
  sh.fragmentShader='uniform sampler2D grassMap;uniform sampler2D rockMap;\nvarying vec3 vW;\n'+sh.fragmentShader.replace('#include <map_fragment>',
  `vec3 tS=texture2D(map,vUv).rgb;vec3 tG=texture2D(grassMap,vUv*1.6).rgb;vec3 tR=texture2D(rockMap,vUv*0.7).rgb;
   vec3 tG2=texture2D(grassMap,vUv*0.23).rgb;
   vec3 det=tS*vW.x+tG*mix(0.75,1.2,tG2.r)*vW.y+tR*vW.z;diffuseColor.rgb*=det*1.4;`);
};
function terrainColor(x,z,h,out,w){
  const sl=slopeAt(x,z);const rd=roadDist(x,z);const tr=z>-14&&z<4?trenchDist(x,z):99;
  const wet=C(0x4f483c),sand=C(0x9d8f72),dry=C(0xab9c7e),shingle=C(0x76726a),dryGrass=C(0x726c45),grass=C(0x4c5629),grass2=C(0x636236),dirt=C(0x5e503c),mud=C(0x40382c),sea=C(0x37332b);
  const n=fbm(x*.08,z*.08,3),n2=fbm(x*.02+5,z*.02,2);
  let c=out;w[0]=1;w[1]=0;w[2]=0;
  if(h<-.05){c.copy(sea).lerp(wet,clamp(1+h*.4,0,1));}
  else if(z>46){c.copy(wet).lerp(sand,sstep(.1,1.0,h));c.lerp(dry,sstep(1.0,1.6,h)*.6);c.offsetHSL(0,0,(n-.5)*.05);}
  else if(z>35.5){c.copy(shingle).lerp(sand,sstep(43,46,z)*.7);w[0]=sstep(42,46,z);w[2]=1-w[0];c.offsetHSL(0,0,(n-.5)*.08);}
  else{
    const green=sstep(6,-10,z);c.copy(dryGrass).lerp(grass2,n2).lerp(grass,green*.8);c.offsetHSL(0,0,(n-.5)*.06);
    w[0]=0;w[1]=1;
    const bare=clamp((sl-.55)*2.5,0,1);if(bare>0){c.lerp(dirt,bare*.8);w[1]=1-bare*.7;w[2]=bare*.7;}
    if(z>30){const k=sstep(30,35.5,z);c.lerp(sand,k);w[0]=k;w[1]=(1-k)*w[1];}
  }
  if(rd<3.4&&z<40){const k=1-sstep(2.2,3.4,rd);c.lerp(dirt,k*.9);w[0]=Math.max(w[0],k*.5);w[1]*=1-k;w[2]=Math.max(w[2],k*.4);}
  if(tr<2.2){const k=1-sstep(1.2,2.2,tr);c.lerp(mud,k);w[1]*=1-k;w[0]=Math.max(w[0],k*.5);w[2]=Math.max(w[2],k*.5);}
  for(const cr of CRATERS){const d=Math.hypot(x-cr.x,z-cr.z);if(d<cr.r*1.3){const k=1-sstep(cr.r*.6,cr.r*1.3,d);c.lerp(z>36?C(0x6d6250):mud,k*.7);}}
  const s=w[0]+w[1]+w[2];w[0]/=s;w[1]/=s;w[2]/=s;
}
function buildTerrainMesh(x0,z0,x1,z1,step,sink){
  const nx=Math.round((x1-x0)/step),nz=Math.round((z1-z0)/step);
  const geo=new THREE.PlaneGeometry(x1-x0,z1-z0,nx,nz);geo.rotateX(-Math.PI/2);geo.translate((x0+x1)/2,0,(z0+z1)/2);
  const p=geo.attributes.position,uv=geo.attributes.uv;const col=new Float32Array(p.count*3),W=new Float32Array(p.count*3);const tmp=new THREE.Color(),w=[0,0,0];
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);let h=H(x,z);
    if(sink&&x>HG.x0+6&&x<HG.x1-6&&z>HG.z0+6&&z<HG.z1-6)h-=3;
    p.setY(i,h);uv.setXY(i,x/3,z/3);
    terrainColor(x,z,h,tmp,w);col[i*3]=tmp.r;col[i*3+1]=tmp.g;col[i*3+2]=tmp.b;W[i*3]=w[0];W[i*3+1]=w[1];W[i*3+2]=w[2];}
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.setAttribute('aW',new THREE.BufferAttribute(W,3));
  geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,terrainMat);m.receiveShadow=true;scene.add(m);return m;
}
buildTerrainMesh(HG.x0,HG.z0,HG.x1,HG.z1,1,false);
buildTerrainMesh(-760,-760,760,230,8,true);

/* ================= Sea ================= */
// shore depth texture for the water shader
const depthTex=(()=>{const w=256,h=512,d=new Uint8Array(w*h*4);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const x=lerp(HG.x0,HG.x1,i/(w-1)),z=lerp(HG.z0,HG.z1,j/(h-1));const hh=H(x,z);const v=clamp((hh+4)/8,0,1)*255;const k=(j*w+i)*4;d[k]=v;d[k+1]=v;d[k+2]=v;d[k+3]=255;}
  const t=new THREE.DataTexture(d,w,h,THREE.RGBAFormat);t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;})();
const waterU=Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog),{time:{value:0},dT:{value:depthTex},sunDir:{value:sunDir},
  deep:{value:C(0x22302f)},shallow:{value:C(0x51604f)},skyC:{value:C(0x9aa2a6)},foamC:{value:C(0xe4e2d8)},
  box:{value:new THREE.Vector4(HG.x0,HG.z0,HG.x1-HG.x0,HG.z1-HG.z0)}});
const waterMat=new THREE.ShaderMaterial({uniforms:waterU,transparent:true,fog:true,
  vertexShader:`uniform float time;uniform sampler2D dT;uniform vec4 box;varying vec3 vP;varying float vDepth;varying vec3 vN;
  #include <fog_pars_vertex>
  float ground(vec2 p){vec2 uv=(p-box.xy)/box.zw;if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0)return -6.0;return texture2D(dT,uv).r*8.0-4.0;}
  void main(){vec3 p=position;vec4 wp=modelMatrix*vec4(p,1.0);
    float g=ground(wp.xz);float dep=max(0.0,-g);float amp=clamp(dep*0.12,0.03,0.45);
    float w1=sin(wp.z*0.22-time*1.5+sin(wp.x*0.03)*2.0),w2=sin(wp.x*0.13+wp.z*0.17-time*1.1),w3=sin(wp.x*-0.31+wp.z*0.27-time*2.3);
    wp.y+=(w1*0.6+w2*0.3+w3*0.12)*amp;
    float dz=(cos(wp.z*0.22-time*1.5)*0.22*0.6+cos(wp.x*0.13+wp.z*0.17-time*1.1)*0.17*0.3)*amp,dx=(cos(wp.x*0.13+wp.z*0.17-time*1.1)*0.13*0.3-cos(wp.x*-0.31+wp.z*0.27-time*2.3)*0.31*0.12)*amp;
    vN=normalize(vec3(-dx,1.0,-dz));vP=wp.xyz;vDepth=wp.y-g;
    vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
  }`,
  fragmentShader:`uniform float time;uniform vec3 deep,shallow,skyC,foamC,sunDir;varying vec3 vP;varying float vDepth;varying vec3 vN;
  #include <fog_pars_fragment>
  float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
  void main(){
    vec2 q=vP.xz;float n1=ns(q*0.9+vec2(time*0.3,time*0.5)),n2=ns(q*2.3-vec2(time*0.4,-time*0.2));
    vec3 N=normalize(vN+vec3(n1-0.5,0.0,n2-0.5)*0.35);
    vec3 V=normalize(cameraPosition-vP);
    float fr=pow(1.0-max(dot(N,V),0.0),4.0)*0.7+0.1;
    float d=clamp(vDepth,0.0,8.0);
    vec3 col=mix(shallow,deep,smoothstep(0.0,4.0,d));
    col=mix(col,skyC,fr);
    vec3 H=normalize(sunDir+V);col+=vec3(1.0,0.95,0.85)*pow(max(dot(N,H),0.0),120.0)*0.5;
    float band=sin(d*5.0-time*1.8+n1*2.0)*0.5+0.5;
    float foam=smoothstep(0.45,0.0,d)*0.85+smoothstep(1.3,0.25,d)*smoothstep(0.8,1.0,band)*smoothstep(0.4,0.7,n2)*0.6;
    foam+=smoothstep(0.92,1.0,n1*n2*1.5)*0.08;
    col=mix(col,foamC,clamp(foam,0.0,1.0));
    float a=mix(0.35,0.96,smoothstep(0.0,1.2,d));a=max(a,foam);
    gl_FragColor=vec4(col,a);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    #include <fog_fragment>
  }`});
const water=new THREE.Mesh((()=>{const g=new THREE.PlaneGeometry(700,420,350,210);g.rotateX(-Math.PI/2);g.translate(0,0,300);return g;})(),waterMat);
water.renderOrder=1;scene.add(water);
for(const[w,d,x,z]of[[5000,3000,0,2010],[2150,420,-1425,300],[2150,420,1425,300]]){
  const m=new THREE.Mesh((()=>{const g=new THREE.PlaneGeometry(w,d,Math.ceil(w/60),Math.ceil(d/60));g.rotateX(-Math.PI/2);g.translate(x,0,z);return g;})(),waterMat);m.renderOrder=1;scene.add(m);}

/* ================= The fleet on the horizon ================= */
const FLEET=[];
{
  const silM=new THREE.MeshBasicMaterial({color:C(0x6a706f),fog:false});
  const silD=new THREE.MeshBasicMaterial({color:C(0x5d6362),fog:false});
  const balM=new THREE.MeshBasicMaterial({color:C(0x7a807e),fog:false});
  const ship=(x,z,len,kind)=>{
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rand(-.25,.25)+Math.PI/2;
    const m=z>900?silM:silD;
    const hull=new THREE.Mesh(new THREE.BoxGeometry(len,len*.09,len*.13),m);hull.position.y=len*.03;g.add(hull);
    const bow=new THREE.Mesh(new THREE.ConeGeometry(len*.065,len*.18,4),m);bow.rotation.z=-Math.PI/2;bow.position.set(len*.58,len*.03,0);g.add(bow);
    if(kind==='bb'){
      const s=new THREE.Mesh(new THREE.BoxGeometry(len*.22,len*.12,len*.08),m);s.position.set(0,len*.13,0);g.add(s);
      const t=new THREE.Mesh(new THREE.BoxGeometry(len*.05,len*.2,len*.04),m);t.position.set(-len*.02,len*.24,0);g.add(t);
      for(const tx of[-.3,-.18,.22,.33]){const tu=new THREE.Mesh(new THREE.BoxGeometry(len*.07,len*.04,len*.07),m);tu.position.set(len*tx,len*.09,0);g.add(tu);
        const b=new THREE.Mesh(new THREE.BoxGeometry(len*.09,len*.008,len*.01),m);b.position.set(len*(tx+.06*Math.sign(tx)),len*.1,0);g.add(b);}
    }else if(kind==='dd'){
      const s=new THREE.Mesh(new THREE.BoxGeometry(len*.18,len*.09,len*.07),m);s.position.set(len*.1,len*.1,0);g.add(s);
      for(const fx of[-.05,-.15]){const f=new THREE.Mesh(new THREE.CylinderGeometry(len*.015,len*.018,len*.1,6),m);f.position.set(len*fx,len*.13,0);g.add(f);}
    }else{
      const s=new THREE.Mesh(new THREE.BoxGeometry(len*.15,len*.1,len*.1),m);s.position.set(-len*.38,len*.1,0);g.add(s);
      // barrage balloon
      const bal=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),balM);bal.scale.set(9,4,4);bal.position.set(0,len*.9+rand(0,30),0);g.add(bal);
      for(const a of[0,2.1,4.2]){const fin=new THREE.Mesh(new THREE.BoxGeometry(5,.3,4),balM);fin.position.set(-9,bal.position.y,0);fin.rotation.x=a;g.add(fin);}
      const cable=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,bal.position.y,3),balM);cable.position.y=bal.position.y/2;g.add(cable);
    }
    scene.add(g);FLEET.push({g,kind,x,z,len,next:rand(4,20)});
  };
  for(let i=0;i<5;i++)ship(rand(-1100,1100),rand(1150,1450),rand(180,240),'bb');
  for(let i=0;i<9;i++)ship(rand(-1200,1200),rand(800,1100),rand(100,120),'dd');
  for(let i=0;i<16;i++)ship(rand(-1300,1300),rand(650,1300),rand(90,110),'lst');
}
