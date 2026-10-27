'use strict';
/* ================= Utilities ================= */
const $=id=>document.getElementById(id);
const rand=(a,b)=>a+Math.random()*(b-a);
const randi=(a,b)=>Math.floor(a+Math.random()*(b-a+1));
const pick=a=>a[Math.random()*a.length|0];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const C=hex=>new THREE.Color(hex).convertSRGBToLinear();
const V3=THREE.Vector3;
const TAU=Math.PI*2;
function angDiff(a,b){let d=b-a;while(d>Math.PI)d-=TAU;while(d<-Math.PI)d+=TAU;return d;}
function hash2(x,z){let h=(x*374761393+z*668265263)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295;}
function vnoise(x,z){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi;const u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);
  const a=hash2(xi,zi),b=hash2(xi+1,zi),c=hash2(xi,zi+1),d=hash2(xi+1,zi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function fbm(x,z,o=4){let s=0,a=.5,f=1,n=0;for(let i=0;i<o;i++){s+=vnoise(x*f,z*f)*a;n+=a;a*=.5;f*=2.03;}return s/n;}

const GAME={time:0,mode:'menu',quality:'high'};
// Multiplayer state (filled in by net.js). The map is built with a fixed random seed so every player gets the same one.
const Net={on:false,host:false,client:false,ev:[],applying:false,event(e){if(this.host)this.ev.push(e);},send(){}};
const _realRandom=Math.random;
{let s=0x2c1b3c6d;Math.random=function(){s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const SET={music:true,voice:true,sens:1.4,size:16,diff:1,team:0};
try{const s=JSON.parse(localStorage.getItem('omaha.settings')||'null');if(s)Object.assign(SET,s);}catch(e){}
SET.vol=Object.assign({master:.9,sfx:1,music:.6,voice:.9},SET.vol||{});
function saveSettings(){try{localStorage.setItem('omaha.settings',JSON.stringify(SET));}catch(e){}}

/* ================= Renderer ================= */
const canvas=$('c');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});}
catch(e){$('unsupported').hidden=false;throw e;}
const isGL2=renderer.capabilities.isWebGL2;
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
renderer.setSize(innerWidth,innerHeight,false);
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.autoClear=false;
const maxAniso=Math.min(8,renderer.capabilities.getMaxAnisotropy());

const scene=new THREE.Scene();
const FOG_COL=C(0x9fa3a0);
scene.fog=new THREE.FogExp2(0xffffff,0.0058);
scene.fog.color.copy(FOG_COL);
scene.background=FOG_COL.clone();
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.05,2600);
camera.rotation.order='YXZ';
scene.add(camera);

// viewmodel scene, drawn over the world after a depth clear so the gun never clips into walls
const vmScene=new THREE.Scene();
const vmCam=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.01,10);
vmScene.add(vmCam);
vmScene.add(new THREE.HemisphereLight(C(0xc9ccd0),C(0x5a5546),1.05));
const vmSun=new THREE.DirectionalLight(C(0xfff0dc),1.6);vmSun.position.set(-.4,1,.3);vmScene.add(vmSun);

/* ================= Post-processing ================= */
let rt=null;
function makeRT(){
  const s=renderer.getDrawingBufferSize(new THREE.Vector2());
  if(rt)rt.dispose();
  const opts={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,depthBuffer:true};
  rt=isGL2&&THREE.WebGLMultisampleRenderTarget?new THREE.WebGLMultisampleRenderTarget(s.x,s.y,opts):new THREE.WebGLRenderTarget(s.x,s.y,opts);
  if(rt.samples!==undefined)rt.samples=GAME.quality==='high'?4:2;
  rt.texture.encoding=THREE.sRGBEncoding;
  if(post)post.mat.uniforms.res.value.set(s.x,s.y);
  if(window.BLOOM&&BLOOM.a){BLOOM.a.setSize(s.x>>2,s.y>>2);BLOOM.b.setSize(s.x>>2,s.y>>2);}
}
const post={};
post.mat=new THREE.ShaderMaterial({
  uniforms:{tD:{value:null},tB:{value:null},bloom:{value:.55},res:{value:new THREE.Vector2(1,1)},time:{value:0},desat:{value:.32},grain:{value:.045},blur:{value:0},aberr:{value:0},
    hurt:{value:0},lowHp:{value:0},white:{value:0},dark:{value:0},vig:{value:.55}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
  fragmentShader:`uniform sampler2D tD,tB;uniform float bloom;uniform vec2 res;uniform float time,desat,grain,blur,aberr,hurt,lowHp,white,dark,vig;varying vec2 vUv;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){
    vec2 uv=vUv,c=uv-0.5;
    vec3 col;
    float ab=aberr*0.012+0.0012;
    col.r=texture2D(tD,uv+c*ab).r;col.g=texture2D(tD,uv).g;col.b=texture2D(tD,uv-c*ab).b;
    if(blur>0.002){vec3 acc=col;for(int i=1;i<10;i++){float s=1.0-float(i)*blur*0.011;acc+=texture2D(tD,0.5+c*s).rgb;}col=acc/10.0;}
    float l=dot(col,vec3(0.299,0.587,0.114));
    col=mix(col,vec3(l),clamp(desat+lowHp*0.55,0.0,1.0));
    vec3 sc=col*col*(3.0-2.0*col);col=mix(col,sc,0.42);
    col*=vec3(1.03,1.01,0.93);
    col=mix(col,col*vec3(1.25,0.55,0.5),lowHp*0.35*length(c)*2.0);
    float r=length(c*vec2(res.x/res.y,1.0));
    col*=1.0-smoothstep(0.35,1.15,r)*vig;
    col=mix(col,vec3(0.45,0.02,0.0),hurt*smoothstep(0.25,0.95,r));
    col+=(h(uv*res+fract(time*7.13)*vec2(91.0,37.0))-0.5)*grain;
    col+=texture2D(tB,uv).rgb*bloom;
    col=mix(col,vec3(1.0,0.97,0.9),white);
    col*=1.0-dark;
    gl_FragColor=vec4(col,1.0);
  }`,depthTest:false,depthWrite:false});
post.scene=new THREE.Scene();post.cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
{const q=new THREE.Mesh(new THREE.PlaneGeometry(2,2),post.mat);q.frustumCulled=false;post.scene.add(q);}
makeRT();
const FX={trauma:0,blur:0,aberr:0,hurt:0,white:0,dark:0,ring:0};
// bloom: bright parts are cut out at quarter size, blurred twice and added back
var BLOOM={};
{
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));quad.frustumCulled=false;BLOOM.scene=new THREE.Scene();BLOOM.scene.add(quad);BLOOM.quad=quad;
  const vs=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
  BLOOM.bright=new THREE.ShaderMaterial({uniforms:{tD:{value:null}},vertexShader:vs,fragmentShader:`uniform sampler2D tD;varying vec2 vUv;void main(){vec3 c=texture2D(tD,vUv).rgb;float l=dot(c,vec3(.299,.587,.114));gl_FragColor=vec4(c*smoothstep(.72,1.0,l),1.0);}`,depthTest:false,depthWrite:false});
  BLOOM.blur=new THREE.ShaderMaterial({uniforms:{tD:{value:null},dir:{value:new THREE.Vector2()}},vertexShader:vs,fragmentShader:`uniform sampler2D tD;uniform vec2 dir;varying vec2 vUv;
    void main(){vec3 c=texture2D(tD,vUv).rgb*.227;c+=(texture2D(tD,vUv+dir*1.38).rgb+texture2D(tD,vUv-dir*1.38).rgb)*.316;c+=(texture2D(tD,vUv+dir*3.23).rgb+texture2D(tD,vUv-dir*3.23).rgb)*.07;gl_FragColor=vec4(c,1.0);}`,depthTest:false,depthWrite:false});
  const s=renderer.getDrawingBufferSize(new THREE.Vector2());const o={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false};
  BLOOM.a=new THREE.WebGLRenderTarget(s.x>>2,s.y>>2,o);BLOOM.b=new THREE.WebGLRenderTarget(s.x>>2,s.y>>2,o);
}
function bloomPass(){
  const B=BLOOM,q=B.quad;
  q.material=B.bright;B.bright.uniforms.tD.value=rt.texture;renderer.setRenderTarget(B.a);renderer.render(B.scene,post.cam);
  for(let i=0;i<2;i++){
    q.material=B.blur;B.blur.uniforms.tD.value=B.a.texture;B.blur.uniforms.dir.value.set((i+1)/B.a.width,0);renderer.setRenderTarget(B.b);renderer.render(B.scene,post.cam);
    B.blur.uniforms.tD.value=B.b.texture;B.blur.uniforms.dir.value.set(0,(i+1)/B.a.height);renderer.setRenderTarget(B.a);renderer.render(B.scene,post.cam);}
  post.mat.uniforms.tB.value=B.a.texture;
}
function renderFrame(showVM){
  renderer.setRenderTarget(rt);renderer.clear();
  renderer.render(scene,camera);
  if(showVM){renderer.clearDepth();renderer.render(vmScene,vmCam);}
  bloomPass();
  renderer.setRenderTarget(null);
  const u=post.mat.uniforms;u.tD.value=rt.texture;u.time.value=GAME.time;
  u.blur.value=FX.blur;u.aberr.value=FX.aberr;u.hurt.value=FX.hurt;u.white.value=FX.white;u.dark.value=FX.dark;
  renderer.render(post.scene,post.cam);
}

/* ================= Textures ================= */
function canvasTex(w,h,draw,srgb=true){
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');draw(g,w,h);
  const t=new THREE.CanvasTexture(c);if(srgb)t.encoding=THREE.sRGBEncoding;t.anisotropy=maxAniso;t.wrapS=t.wrapT=THREE.RepeatWrapping;t._canvas=c;return t;
}
// Height in a 0..1 grid -> tangent-space normal map
function normalTex(w,h,height,strength=2){
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');const img=g.createImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const l=height[y*w+((x-1+w)%w)],r=height[y*w+((x+1)%w)],u=height[((y-1+h)%h)*w+x],d=height[((y+1)%h)*w+x];
    let nx=(l-r)*strength,ny=(u-d)*strength,nz=1;const k=1/Math.hypot(nx,ny,nz);nx*=k;ny*=k;nz*=k;
    const i=(y*w+x)*4;img.data[i]=(nx*.5+.5)*255;img.data[i+1]=(ny*.5+.5)*255;img.data[i+2]=(nz*.5+.5)*255;img.data[i+3]=255;}
  g.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=maxAniso;return t;
}
// Procedural surface: fn(x,y) returns [r,g,b,height] for each texel (tileable when fn uses periodic noise)
function surface(w,h,fn,nStr){
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');const img=g.createImageData(w,h);const H=new Float32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=fn(x,y);const i=(y*w+x)*4;img.data[i]=clamp(v[0],0,255);img.data[i+1]=clamp(v[1],0,255);img.data[i+2]=clamp(v[2],0,255);img.data[i+3]=255;H[y*w+x]=v[3];}
  g.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=maxAniso;
  return{map:t,normalMap:normalTex(w,h,H,nStr)};
}
// tileable noise: wrap coordinates at period p
function tnoise(x,y,p){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const m=k=>((k%p)+p)%p;const a=hash2(m(xi),m(yi)),b=hash2(m(xi+1),m(yi)),c=hash2(m(xi),m(yi+1)),d=hash2(m(xi+1),m(yi+1));
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function tfbm(x,y,p,o=4){let s=0,a=.5,n=0,f=1;for(let i=0;i<o;i++){s+=tnoise(x*f,y*f,p*f)*a;n+=a;a*=.5;f*=2;}return s/n;}

const TEX={};
function buildTextures(){
  const S=256;
  TEX.concrete=surface(S,S,(x,y)=>{const n=tfbm(x/16,y/16,16,5),m=tfbm(x/48,y/48,S/48|0||5,3);
    const board=(y%42<2)?-.25:0;const pit=hash2(x,y)>.985?-.35:0;const stain=Math.max(0,m-.55)*1.8;
    const v=150+n*55-stain*60+board*40+pit*60;return[v,v*.99,v*.95,n*.6+board+pit];},2.2);
  TEX.stone=surface(S,S,(x,y)=>{const row=Math.floor(y/26),off=(row%2)*31,bx=Math.floor((x+off)/62),lx=(x+off)%62,ly=y%26;
    const mortar=(lx<3||ly<3)?1:0;const n=tfbm(x/12,y/12,S/12|0,4);const tone=hash2(bx,row);
    if(mortar)return[120,114,100,.1];const v=150+tone*50+n*45;return[v+8,v,v*.86,.55+n*.4];},3);
  TEX.plaster=surface(S,S,(x,y)=>{const n=tfbm(x/10,y/10,S/10|0||25,5),m=tfbm(x/40,y/40,6,3);const bare=m>.62;
    if(bare){const v=130+n*50;return[v+10,v,v*.85,.3+n*.3];}const v=196+n*30-m*30;return[v,v*.96,v*.86,.6+n*.15];},1.6);
  TEX.wood=surface(S,S,(x,y)=>{const pl=Math.floor(x/32),lx=x%32;const g=Math.sin((y/S*TAU*3)+tnoise(x/4,y/40,64)*6+pl)*.5+.5;const gap=lx<2?1:0;
    const t=hash2(pl,7)*30;const v=gap?40:95+g*35+t;return[v*1.05,v*.78,v*.55,gap?0:.5+g*.3];},2);
  TEX.slate=surface(S,S,(x,y)=>{const row=Math.floor(y/21),off=(row%2)*16,bx=Math.floor((x+off)/32),lx=(x+off)%32,ly=y%21;
    const edge=(lx<2||ly<2)?1:0;const n=tnoise(x/6,y/6,S/6|0||42);const t=hash2(bx,row)*22;const v=edge?32:66+t+n*18;return[v*.9,v*.95,v*1.05,edge?0:.6+ly/21*.3];},2.5);
  TEX.sandbag=surface(S,S,(x,y)=>{const row=Math.floor(y/48),off=(row%2)*48,lx=(x+off)%96,ly=y%48;
    const bx=(lx-48)/48,by=(ly-24)/24;const d=Math.max(0,1-Math.pow(Math.abs(bx),4)-Math.pow(Math.abs(by),3));const n=tnoise(x/3,y/3,S/3|0||85);
    const weave=((x+y)%4<2)?6:0;const v=d>0?120+d*55+n*14+weave:70;return[v*1.0,v*.9,v*.66,d+n*.08];},3.5);
  TEX.hedge=surface(S,S,(x,y)=>{const n=tfbm(x/7,y/7,S/7|0||36,5),m=tfbm(x/30,y/30,8,3);const leaf=Math.pow(n,1.5);
    return[34+leaf*60+m*20,52+leaf*80+m*20,22+leaf*36,leaf];},4);
  TEX.metal=surface(S,S,(x,y)=>{const n=tfbm(x/20,y/20,S/20|0||12,4),r=tfbm(x/9+5,y/9,S/9|0||28,4);const rust=Math.max(0,r-.55)*3;
    return[62+n*20+rust*80,64+n*18+rust*30,60+n*16,n*.3+rust*.3];},1.5);
  TEX.dirt=surface(S,S,(x,y)=>{const n=tfbm(x/9,y/9,S/9|0||28,5);const p=hash2(x,y)>.97?-.3:0;const v=92+n*50+p*50;return[v*1.05,v*.85,v*.62,n+p];},3);
  TEX.timber=surface(S,S,(x,y)=>{const pl=Math.floor(y/36),ly=y%36;const g=Math.sin(x/S*TAU*2+tnoise(x/40,y/4,6)*5+pl)*.5+.5;const gap=ly<3;const v=gap?30:70+g*25+hash2(pl,3)*20;
    return[v*1.05,v*.86,v*.65,gap?0:.5+g*.3];},2.5);
  // terrain detail textures
  TEX.sandD=canvasTex(S,S,(g,w,h)=>{const img=g.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const n=tfbm(x/6,y/6,S/6|0||42,4),rip=Math.sin((y+tnoise(x/30,y/30,8)*20)/S*TAU*9)*.5+.5;const p=hash2(x,y);
    const v=170+n*45+rip*16+(p>.96?-30:0);const i=(y*w+x)*4;img.data[i]=v;img.data[i+1]=v;img.data[i+2]=v;img.data[i+3]=255;}g.putImageData(img,0,0);});
  TEX.grassD=canvasTex(S,S,(g,w,h)=>{const img=g.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const n=tfbm(x/4,y/4,S/4,4),m=tfbm(x/20,y/20,S/20|0||12,3);const v=150+n*80+m*30;const i=(y*w+x)*4;img.data[i]=v;img.data[i+1]=v;img.data[i+2]=v;img.data[i+3]=255;}g.putImageData(img,0,0);
    for(let i=0;i<2600;i++){const x=Math.random()*w,y=Math.random()*h,l=rand(3,9);const v=rand(150,255)|0;g.strokeStyle=`rgba(${v},${v},${v},.45)`;g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+rand(-2,2),y-l);g.stroke();}});
  TEX.rockD=canvasTex(S,S,(g,w,h)=>{const img=g.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const n=tfbm(x/10,y/10,S/10|0||25,5);const v=120+n*120;const i=(y*w+x)*4;img.data[i]=v;img.data[i+1]=v;img.data[i+2]=v;img.data[i+3]=255;}g.putImageData(img,0,0);
    for(let i=0;i<500;i++){const x=Math.random()*w,y=Math.random()*h,r=rand(2,6);const v=rand(170,250)|0;g.fillStyle=`rgba(${v},${v},${v},.8)`;g.beginPath();g.ellipse(x,y,r,r*rand(.6,1),rand(0,3),0,TAU);g.fill();g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(x+1,y+1.5,r,r*.5,0,0,Math.PI);g.fill();}});
  TEX.crater=canvasTex(128,128,(g,w,h)=>{const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(20,16,12,.95)');gr.addColorStop(.45,'rgba(40,32,24,.8)');gr.addColorStop(.7,'rgba(70,58,44,.5)');gr.addColorStop(1,'rgba(70,58,44,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);
    for(let i=0;i<60;i++){const a=rand(0,TAU),r=rand(30,60);g.fillStyle=`rgba(30,24,18,${rand(.2,.5)})`;g.beginPath();g.arc(64+Math.cos(a)*r,64+Math.sin(a)*r,rand(1,4),0,TAU);g.fill();}});
  TEX.crater.wrapS=TEX.crater.wrapT=THREE.ClampToEdgeWrapping;
}
buildTextures();

const MAT={};
function stdMat(tex,o={}){
  const ns=o.ns||1;o=Object.assign({},o);delete o.ns;const m=new THREE.MeshStandardMaterial(Object.assign({map:tex.map,normalMap:tex.normalMap,roughness:.92,metalness:0},o));
  if(tex.normalMap)m.normalScale=new THREE.Vector2(ns,ns);return m;
}
MAT.concrete=stdMat(TEX.concrete,{color:C(0xffffff)});
MAT.stone=stdMat(TEX.stone,{color:C(0xffffff)});
MAT.plaster=stdMat(TEX.plaster,{color:C(0xffffff)});
MAT.wood=stdMat(TEX.wood,{color:C(0xffffff)});
MAT.slate=stdMat(TEX.slate,{color:C(0xffffff),roughness:.75});
MAT.sandbag=stdMat(TEX.sandbag,{color:C(0xffffff),ns:1.6});
MAT.hedge=stdMat(TEX.hedge,{color:C(0xffffff),ns:1.5});
MAT.metal=stdMat(TEX.metal,{color:C(0x9a9c98),roughness:.62,metalness:.15});
MAT.dirt=stdMat(TEX.dirt,{color:C(0xffffff)});
MAT.timber=stdMat(TEX.timber,{color:C(0xffffff)});
MAT.dark=new THREE.MeshStandardMaterial({color:C(0x15130f),roughness:1});
MAT.vc=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85});
MAT.vcL=new THREE.MeshLambertMaterial({vertexColors:true});

/* ================= Geometry helpers ================= */
const _o=new THREE.Object3D();
function compose(x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){_o.position.set(x,y,z);_o.rotation.set(rx,ry,rz);_o.scale.set(sx,sy,sz);_o.updateMatrix();return _o.matrix.clone();}
// box with UVs scaled to world size so textures tile at a constant density (ts = metres per texture repeat)
function boxGeo(w,h,d,ts=3){
  const g=new THREE.BoxGeometry(w,h,d);const uv=g.attributes.uv;
  const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0;f<6;f++)for(let k=0;k<4;k++){const i=f*4+k;uv.setXY(i,uv.getX(i)*dims[f][0]/ts,uv.getY(i)*dims[f][1]/ts);}
  return g;
}
// Merge geometries (each with a matrix and optional color) into one BufferGeometry with position/normal/uv/color
function mergeGeos(list){
  let n=0;const gs=list.map(p=>{const g=(p.geo.index?p.geo.toNonIndexed():p.geo.clone());if(p.m)g.applyMatrix4(p.m);n+=g.attributes.position.count;return g;});
  const pos=new Float32Array(n*3),nor=new Float32Array(n*3),uv=new Float32Array(n*2),col=new Float32Array(n*3);let o=0;
  gs.forEach((g,i)=>{const c=list[i].col||{r:1,g:1,b:1},cn=g.attributes.position.count;pos.set(g.attributes.position.array,o*3);nor.set(g.attributes.normal.array,o*3);
    if(g.attributes.uv)uv.set(g.attributes.uv.array,o*2);for(let k=0;k<cn;k++){col[(o+k)*3]=c.r;col[(o+k)*3+1]=c.g;col[(o+k)*3+2]=c.b;}o+=cn;g.dispose();});
  const G=new THREE.BufferGeometry();G.setAttribute('position',new THREE.BufferAttribute(pos,3));G.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  G.setAttribute('uv',new THREE.BufferAttribute(uv,2));G.setAttribute('color',new THREE.BufferAttribute(col,3));G.computeBoundingSphere();G.computeBoundingBox();return G;
}
// Colored part for character/weapon models: P(geo,color,x,y,z,rx,ry,rz)
function P(geo,col,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){return{geo,col:typeof col==='number'?C(col):col,m:compose(x,y,z,rx,ry,rz,sx,sy,sz)};}
const Bx=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
const Cy=(rt,rb,h,s=8)=>new THREE.CylinderGeometry(rt,rb,h,s);
// cylinder along z (forward)
const Cz=(r,len,s=8)=>{const g=new THREE.CylinderGeometry(r,r,len,s);g.rotateX(Math.PI/2);return g;};
