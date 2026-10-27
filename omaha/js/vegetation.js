'use strict';
/* ================= Vegetation =================
   Trees and hedges are bark trunks with thousands of leaf cards; grass, weeds, ferns and
   wildflowers are instanced cards. Everything sways in a gusting wind that rolls across the
   fields, leaves flutter, and small plants fade out with distance to keep the frame rate up.   */
const WIND={dir:new THREE.Vector2(.82,.57)};
// shared wind code injected into vegetation shaders
function windShader(sh,o){
  sh.uniforms.uTime=grassTime;
  sh.vertexShader='uniform float uTime;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    #ifdef USE_INSTANCING
    vec3 ip=vec3(instanceMatrix[3][0],instanceMatrix[3][1],instanceMatrix[3][2]);
    #else
    vec3 ip=vec3(0.0);
    #endif
    float gust=sin(dot(ip.xz,vec2(${WIND.dir.x.toFixed(2)},${WIND.dir.y.toFixed(2)}))*0.05-uTime*1.25)*0.5+0.5;gust=gust*gust;
    float hgt=max(position.y,0.0);
    float bend=(${o.bend.toFixed(3)})*(0.35+gust*1.1)*pow(hgt/${o.h.toFixed(2)},${o.pow.toFixed(1)});
    float fl=sin(uTime*${o.fq.toFixed(1)}+position.x*3.1+position.z*2.7+ip.x)*${o.flutter.toFixed(3)}*hgt/${o.h.toFixed(2)};
    transformed.x+=(bend+sin(uTime*1.9+ip.x*0.3)*bend*0.35)*${WIND.dir.x.toFixed(2)}+fl;
    transformed.z+=(bend+sin(uTime*1.7+ip.z*0.3)*bend*0.35)*${WIND.dir.y.toFixed(2)}+fl*0.7;
    ${o.fade?`float cd=distance(ip.xz,cameraPosition.xz);float fd=1.0-smoothstep(${o.fade[0]}.0,${o.fade[1]}.0,cd);transformed*=fd;`:''}`);
  // leaves: keep the outward canopy normal on both faces so the crown shades like a soft mass
  if(o.noFlip)sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_begin>','float faceDirection = gl_FrontFacing ? 1.0 : -1.0;\nvec3 normal = normalize( vNormal );\nvec3 geometryNormal = normal;');
  if(o.lambertFront)sh.fragmentShader=sh.fragmentShader.replace(/\( gl_FrontFacing \) \? vLightFront : vLightBack/g,'vLightFront').replace(/\( gl_FrontFacing \) \? vIndirectFront : vIndirectBack/g,'vIndirectFront');
}

/* ---- textures ---- */
const leafTex=canvasTex(512,512,(g,w,h)=>{
  g.clearRect(0,0,w,h);
  for(let i=0;i<14;i++){g.strokeStyle=`rgba(${rand(60,80)|0},${rand(48,60)|0},${rand(32,40)|0},.9)`;g.lineWidth=rand(1.5,3.5);g.beginPath();const x=rand(60,450),y=rand(60,450);g.moveTo(256+rand(-40,40),256+rand(-40,40));g.quadraticCurveTo((x+256)/2+rand(-40,40),(y+256)/2+rand(-40,40),x,y);g.stroke();}
  for(let i=0;i<900;i++){const a=rand(0,TAU),r=Math.sqrt(Math.random())*235;const x=256+Math.cos(a)*r,y=256+Math.sin(a)*r;const s=rand(7,15),rot=rand(0,TAU);
    const l=rand(22,42),hu=rand(78,108);g.fillStyle=`hsl(${hu},${rand(30,52)}%,${l}%)`;g.save();g.translate(x,y);g.rotate(rot);g.beginPath();g.ellipse(0,0,s,s*.48,0,0,TAU);g.fill();
    g.strokeStyle=`hsla(${hu},40%,${l+12}%,.6)`;g.lineWidth=1;g.beginPath();g.moveTo(-s,0);g.lineTo(s,0);g.stroke();g.restore();}
});
leafTex.wrapS=leafTex.wrapT=THREE.ClampToEdgeWrapping;
const barkSurf=surface(128,256,(x,y)=>{const n=tnoise(x/6,y/40,21),m=tfbm(x/10,y/10,12,3);const groove=Math.pow(Math.abs(Math.sin(x/128*TAU*7+n*3)),3);const v=60+m*50-groove*35;return[v*1.08,v*.95,v*.8,1-groove+m*.3];},3);
const BARK=new THREE.MeshStandardMaterial({map:barkSurf.map,normalMap:barkSurf.normalMap,roughness:.95,color:C(0xb8a898)});
const LEAF=new THREE.MeshStandardMaterial({map:leafTex,alphaTest:.5,side:THREE.DoubleSide,roughness:.82,metalness:0,vertexColors:false});
LEAF.onBeforeCompile=sh=>windShader(sh,{bend:.45,h:10,pow:1.6,fq:6.5,flutter:.06,noFlip:true});
BARK.onBeforeCompile=sh=>windShader(sh,{bend:.2,h:10,pow:2.0,fq:1,flutter:0});
const LEAF_DEPTH=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:leafTex,alphaTest:.5,side:THREE.DoubleSide});
// a leaf cluster: three crossed cards whose normals point out from the canopy centre for soft rounded shading
function cluster(out,cx,cy,cz,size,center){
  for(let k=0;k<3;k++){const g=new THREE.PlaneGeometry(size,size);g.rotateY(k*Math.PI/3+rand(-.3,.3));g.rotateX(rand(-.5,.5));g.translate(cx,cy,cz);
    const n=g.attributes.normal,p=g.attributes.position;for(let i=0;i<p.count;i++){const v=new V3(p.getX(i)-center.x,(p.getY(i)-center.y)*1.3,p.getZ(i)-center.z).normalize();n.setXYZ(i,v.x,v.y+.25,v.z);}
    out.push(g);}
}
function mergePlain(list){let n=0;for(const g of list)n+=(g.index?g.index.count:g.attributes.position.count);
  const pos=new Float32Array(n*3),nor=new Float32Array(n*3),uv=new Float32Array(n*2);let o=0;
  for(let g of list){if(g.index)g=g.toNonIndexed();const c=g.attributes.position.count;pos.set(g.attributes.position.array,o*3);nor.set(g.attributes.normal.array,o*3);uv.set(g.attributes.uv.array,o*2);o+=c;}
  const G=new THREE.BufferGeometry();G.setAttribute('position',new THREE.BufferAttribute(pos,3));G.setAttribute('normal',new THREE.BufferAttribute(nor,3));G.setAttribute('uv',new THREE.BufferAttribute(uv,2));G.computeBoundingSphere();return G;}

/* ---- trees: oak, poplar and apple ---- */
function treeType(kind){
  const trunk=[],leaves=[];
  const branch=(a,b,r1,r2)=>{const d=b.clone().sub(a);const g=new THREE.CylinderGeometry(r2,r1,d.length(),7,1);const q=new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),d.clone().normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),q,new V3(1,1,1)));trunk.push(g);};
  if(kind===1){// poplar: tall and narrow
    branch(new V3(0,-.3,0),new V3(.1,9,0),.32,.12);branch(new V3(.1,9,0),new V3(0,13,0),.12,.04);
    const c=new V3(0,8,0);for(let i=0;i<46;i++){const a=rand(0,TAU),t=rand(0,1);const y=3+t*10,r=(1-Math.abs(t-.45)*1.5)*1.9*rand(.5,1);cluster(leaves,Math.cos(a)*r,y,Math.sin(a)*r,rand(1.6,2.4),new V3(0,y,0));}
  }else if(kind===2){// apple: small, low and wide
    branch(new V3(0,-.2,0),new V3(.15,1.6,0),.2,.15);
    for(let i=0;i<4;i++){const a=i/4*TAU+rand(-.3,.3);branch(new V3(.15,1.5,0),new V3(Math.cos(a)*1.6,2.8+rand(0,.6),Math.sin(a)*1.6),.12,.05);}
    const c=new V3(0,3.1,0);for(let i=0;i<26;i++){const v=new V3(rand(-1,1),rand(-.5,1),rand(-1,1)).normalize().multiplyScalar(rand(.6,2.3));cluster(leaves,v.x,3.1+v.y*.8,v.z,rand(1.3,1.9),c);}
  }else{// oak: broad crown on a thick trunk
    branch(new V3(0,-.3,0),new V3(.2,4.2,.1),.42,.28);
    for(let i=0;i<5;i++){const a=i/5*TAU+rand(-.3,.3);const e=new V3(Math.cos(a)*rand(2.2,3.2),rand(5.5,7.5),Math.sin(a)*rand(2.2,3.2));branch(new V3(.2,4,.1),e,.22,.07);}
    const c=new V3(0,7,0);for(let i=0;i<58;i++){const v=new V3(rand(-1,1),rand(-.6,1),rand(-1,1)).normalize().multiplyScalar(rand(1,3.6));cluster(leaves,v.x,7+v.y*.85,v.z,rand(1.9,2.8),c);}
  }
  return{trunk:mergePlain(trunk),leaves:mergePlain(leaves)};
}
{
  const byKind=[[],[],[]];for(const t of TREES)byKind[t[4]].push(t);
  const fc=[0x8fa46a,0x9aaf6e,0x86985e,0xa3b072];
  byKind.forEach((list,kind)=>{if(!list.length)return;const T=treeType(kind);
    const tr=new THREE.InstancedMesh(T.trunk,BARK,list.length),lf=new THREE.InstancedMesh(T.leaves,LEAF,list.length);
    const c=new THREE.Color();
    list.forEach(([x,y,z,s,k,ry],i)=>{const m=compose(x,y,z,rand(-.04,.04),ry,rand(-.04,.04),s,s*rand(.9,1.1),s);tr.setMatrixAt(i,m);lf.setMatrixAt(i,m);c.set(fc[i%4]).offsetHSL(rand(-.02,.02),0,rand(-.05,.05));lf.setColorAt(i,c);});
    tr.castShadow=lf.castShadow=true;tr.receiveShadow=lf.receiveShadow=true;lf.customDepthMaterial=LEAF_DEPTH;scene.add(tr,lf);});
}
/* ---- hedgerows: dense leafy bocage on the earth banks ---- */
{
  const bushGeo=(()=>{const L=[];const c=new V3(0,.9,0);for(let i=0;i<6;i++){const v=new V3(rand(-1,1),rand(-.3,1),rand(-1,1)).normalize().multiplyScalar(rand(.2,.8));cluster(L,v.x,.9+v.y*.6,v.z,rand(1.3,1.9),c);}return mergePlain(L);})();
  const items=[];
  for(const[X0,Z0,X1,Z1,y0,y1]of HEDGE_SEGS){const alongX=X1-X0>Z1-Z0;const L=alongX?X1-X0:Z1-Z0;
    for(let s=.4;s<L;s+=1.05)for(const off of[-.45,.45])for(const lay of[0,1]){
      const x=alongX?X0+s+rand(-.3,.3):(X0+X1)/2+off+rand(-.15,.15),z=alongX?(Z0+Z1)/2+off+rand(-.15,.15):Z0+s+rand(-.3,.3);
      const base=y0+1.1+lay*rand(.9,1.4);const sc=rand(1.1,1.6)*(lay?1:1.15);items.push([x,base,z,sc]);}
    // occasional young tree growing out of the hedge
    if(Math.random()<.6){const s=rand(.2,.8)*L;items.push([alongX?X0+s:(X0+X1)/2,y1-.4,alongX?(Z0+Z1)/2:Z0+s,rand(2,2.6)]);}
  }
  const im=new THREE.InstancedMesh(bushGeo,LEAF,items.length);const c=new THREE.Color();
  items.forEach(([x,y,z,s],i)=>{im.setMatrixAt(i,compose(x,y,z,0,rand(0,TAU),0,s,s*rand(.85,1.15),s));c.set(0x7f9a5a).offsetHSL(rand(-.03,.03),rand(-.05,.05),rand(-.07,.05));im.setColorAt(i,c);});
  im.castShadow=im.receiveShadow=true;im.customDepthMaterial=LEAF_DEPTH;scene.add(im);
}

/* ---- grass, weeds, ferns and wildflowers ---- */
function cardTex(draw,size=256){const t=canvasTex(size,size,(g,w,h)=>{g.clearRect(0,0,w,h);draw(g,w,h);});t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;return t;}
const blade=(g,x,base,h,lean,wid,col,tip)=>{const gr=g.createLinearGradient(0,base,0,base-h);gr.addColorStop(0,col[0]);gr.addColorStop(1,col[1]);g.fillStyle=gr;g.beginPath();g.moveTo(x-wid,base);
  g.quadraticCurveTo(x+lean*.4-wid*.5,base-h*.55,x+lean,base-h);g.quadraticCurveTo(x+lean*.4+wid*.5,base-h*.55,x+wid,base);g.fill();};
const TEX_GRASS=cardTex((g,w,h)=>{for(let i=0;i<120;i++){const x=rand(10,w-10),hh=rand(80,250),l=rand(-40,40),hu=rand(55,85),li=rand(32,52);blade(g,x,h,hh,l,rand(1.6,3.6),[`hsl(${hu},35%,${li-14}%)`,`hsl(${hu-8},${rand(30,50)}%,${li+14}%)`]);}});
const TEX_DRY=cardTex((g,w,h)=>{for(let i=0;i<110;i++){const x=rand(10,w-10),hh=rand(100,250),l=rand(-50,50),li=rand(45,68);blade(g,x,h,hh,l,rand(1.4,3),[`hsl(${rand(38,50)},30%,${li-18}%)`,`hsl(${rand(42,55)},40%,${li+10}%)`]);}});
const TEX_WEED=cardTex((g,w,h)=>{for(let i=0;i<9;i++){const x=rand(40,w-40),top=rand(30,90);g.strokeStyle='hsl(70,30%,30%)';g.lineWidth=2.4;g.beginPath();g.moveTo(x,h);g.quadraticCurveTo(x+rand(-20,20),(h+top)/2,x+rand(-10,10),top);g.stroke();
  for(let k=0;k<14;k++){g.fillStyle=`hsl(${rand(35,50)},40%,${rand(45,65)}%)`;g.beginPath();g.ellipse(x+rand(-6,6),top+k*4,3,5,rand(-.4,.4),0,TAU);g.fill();}}
  for(let i=0;i<40;i++){const x=rand(10,w-10);blade(g,x,h,rand(40,120),rand(-30,30),2.4,['hsl(75,35%,22%)','hsl(70,40%,42%)']);}});
const TEX_BROAD=cardTex((g,w,h)=>{for(let i=0;i<7;i++){const a=-Math.PI/2+rand(-1.1,1.1),L=rand(70,120);const cx=w/2+Math.cos(a)*L*.5,cy=h-10+Math.sin(a)*L*.5;
  g.save();g.translate(cx,cy);g.rotate(a+Math.PI/2);const gr=g.createLinearGradient(0,-L/2,0,L/2);gr.addColorStop(0,'hsl(95,40%,40%)');gr.addColorStop(1,'hsl(90,38%,24%)');g.fillStyle=gr;
  g.beginPath();g.ellipse(0,0,L*.22,L*.5,0,0,TAU);g.fill();g.strokeStyle='hsla(80,40%,60%,.6)';g.lineWidth=1.5;g.beginPath();g.moveTo(0,-L*.5);g.lineTo(0,L*.5);g.stroke();g.restore();}});
const TEX_FERN=cardTex((g,w,h)=>{for(let f=0;f<5;f++){const a=-Math.PI/2+rand(-.9,.9),L=rand(150,220);g.save();g.translate(w/2,h);g.rotate(a+Math.PI/2);
  g.strokeStyle='hsl(85,35%,28%)';g.lineWidth=2;g.beginPath();g.moveTo(0,0);g.lineTo(0,-L);g.stroke();
  for(let k=6;k<L;k+=7){const s=(1-k/L)*30+4;g.fillStyle=`hsl(${rand(85,100)},${rand(35,50)}%,${rand(28,40)}%)`;for(const sg of[-1,1]){g.beginPath();g.ellipse(sg*s*.55,-k,s*.55,2.6,sg*.3,0,TAU);g.fill();}}g.restore();}});
const TEX_FLOWER=cardTex((g,w,h)=>{for(let i=0;i<10;i++){const x=rand(20,w-20),top=rand(60,160);g.strokeStyle='hsl(85,35%,30%)';g.lineWidth=2;g.beginPath();g.moveTo(x,h);g.quadraticCurveTo(x+rand(-15,15),(h+top)/2,x+rand(-6,6),top);g.stroke();
  const kind=Math.random();const r=rand(7,12);
  for(let p=0;p<6;p++){const a=p/6*TAU;g.fillStyle=kind<.5?'hsl(2,78%,45%)':kind<.75?'hsl(50,85%,58%)':'hsl(50,20%,94%)';g.beginPath();g.ellipse(x+Math.cos(a)*r*.6,top+Math.sin(a)*r*.6,r*.55,r*.38,a,0,TAU);g.fill();}
  g.fillStyle=kind<.5?'#1a1410':'hsl(45,90%,45%)';g.beginPath();g.arc(x,top,r*.3,0,TAU);g.fill();}
  for(let i=0;i<30;i++)blade(g,rand(10,w-10),h,rand(40,110),rand(-25,25),2,['hsl(75,35%,24%)','hsl(70,40%,44%)']);});
// card geometry: n crossed quads, normals tilted up so the plants light like a soft mass
function plantGeo(n,w,hgt){const L=[];for(let k=0;k<n;k++){const g=new THREE.PlaneGeometry(w,hgt);g.translate(0,hgt/2,0);g.rotateY(k*Math.PI/n);
  const nr=g.attributes.normal,p=g.attributes.position;for(let i=0;i<p.count;i++){const a=k*Math.PI/n;nr.setXYZ(i,Math.cos(a)*.3,1,Math.sin(a)*.3);}L.push(g);}return mergePlain(L);}
function plantMat(tex,o){const m=new THREE.MeshLambertMaterial({map:tex,alphaTest:.42,side:THREE.DoubleSide});m.onBeforeCompile=sh=>windShader(sh,Object.assign({lambertFront:true},o));return m;}
function scatter(geo,mat,N,where,scaleF,colorF){
  const inst=new THREE.InstancedMesh(geo,mat,N);const col=new THREE.Color();let k=0;const tmp=[];
  for(let i=0;i<N*3&&k<N;i++){
    const pnt=where();if(!pnt)continue;const[x,z]=pnt;if(roadDist(x,z)<2.8)continue;if(z>-14&&z<4&&trenchDist(x,z)<1.7)continue;
    let blocked=false;for(const s of solidsNear(x,z,.5,tmp))if(x>s.x0-.15&&x<s.x1+.15&&z>s.z0-.15&&z<s.z1+.15&&s.mat!=='hedge'){blocked=true;break;}if(blocked)continue;
    const y=H(x,z);if(y<.3)continue;const s=scaleF(x,z);
    inst.setMatrixAt(k,compose(x,y-.05,z,rand(-.08,.08),rand(0,TAU),rand(-.08,.08),s,s*rand(.8,1.25),s));colorF(col,x,z);inst.setColorAt(k,col);k++;}
  inst.count=k;inst.receiveShadow=true;scene.add(inst);return inst;
}
const inField=()=>[rand(-100,100),rand(-168,30)];
const nearHedge=()=>{const h=pick(HEDGE_SEGS);const alongX=h[2]-h[0]>h[3]-h[1];const side=Math.random()<.5?-1:1;
  return alongX?[rand(h[0],h[2]),(h[1]+h[3])/2+side*rand(1.1,2.2)]:[(h[0]+h[2])/2+side*rand(1.1,2.2),rand(h[1],h[3])];};
const HIGH=GAME.quality!=='medium';
scatter(plantGeo(3,1.1,.75),plantMat(TEX_GRASS,{bend:.32,h:.75,pow:1.6,fq:5,flutter:.03,fade:[70,105]}),HIGH?52000:26000,inField,
  (x,z)=>z>4?rand(.9,1.6):rand(.6,1.15),(c,x,z)=>{if(z>4)c.setHSL(rand(.12,.15),rand(.3,.45),rand(.62,.8));else c.setHSL(rand(.17,.24),rand(.3,.5),rand(.5,.78));});
scatter(plantGeo(3,1.2,1.1),plantMat(TEX_DRY,{bend:.42,h:1.1,pow:1.5,fq:4,flutter:.04,fade:[80,120]}),HIGH?9000:4500,()=>{const z=rand(-6,46),x=rand(-100,100);return z>36&&z<40?null:[x,z];},
  (x,z)=>rand(.8,1.4),(c)=>c.setHSL(rand(.11,.14),rand(.25,.4),rand(.66,.86)));
scatter(plantGeo(2,1.3,1.5),plantMat(TEX_WEED,{bend:.5,h:1.5,pow:1.4,fq:3.5,flutter:.05,fade:[70,110]}),HIGH?7000:3500,inField,(x,z)=>rand(.7,1.3),(c)=>c.setHSL(rand(.12,.2),rand(.2,.4),rand(.6,.85)));
scatter(plantGeo(2,.8,.5),plantMat(TEX_BROAD,{bend:.08,h:.5,pow:1.5,fq:3,flutter:.02,fade:[50,80]}),HIGH?7000:3500,inField,(x,z)=>rand(.7,1.3),(c)=>c.setHSL(rand(.2,.26),rand(.3,.5),rand(.6,.85)));
scatter(plantGeo(3,1.2,.9),plantMat(TEX_FERN,{bend:.15,h:.9,pow:1.4,fq:3,flutter:.03,fade:[60,95]}),HIGH?4500:2200,nearHedge,(x,z)=>rand(.8,1.4),(c)=>c.setHSL(rand(.22,.28),rand(.3,.5),rand(.55,.8)));
scatter(plantGeo(2,.9,.75),plantMat(TEX_FLOWER,{bend:.25,h:.75,pow:1.5,fq:4.5,flutter:.04,fade:[60,95]}),HIGH?7000:3500,()=>{const p=inField();return p[1]<-8?p:null;},(x,z)=>rand(.7,1.2),(c)=>c.setRGB(1,1,1));
