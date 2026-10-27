'use strict';
/* ================= Solids: axis-aligned boxes used for collision, bullets and sight ================= */
const SOLIDS=[];
const SG={cs:8,x0:-140,z0:-200};SG.nx=Math.ceil(280/SG.cs);SG.nz=Math.ceil(420/SG.cs);SG.cells=Array.from({length:SG.nx*SG.nz},()=>[]);
let rayStamp=1;
function addSolid(x0,y0,z0,x1,y1,z1,mat){
  const s={x0:Math.min(x0,x1),y0:Math.min(y0,y1),z0:Math.min(z0,z1),x1:Math.max(x0,x1),y1:Math.max(y0,y1),z1:Math.max(z0,z1),mat,stamp:0};
  SOLIDS.push(s);
  const i0=clamp(Math.floor((s.x0-SG.x0)/SG.cs),0,SG.nx-1),i1=clamp(Math.floor((s.x1-SG.x0)/SG.cs),0,SG.nx-1);
  const j0=clamp(Math.floor((s.z0-SG.z0)/SG.cs),0,SG.nz-1),j1=clamp(Math.floor((s.z1-SG.z0)/SG.cs),0,SG.nz-1);
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)SG.cells[j*SG.nx+i].push(s);
  return s;
}
function solidsNear(x,z,r,out){
  out.length=0;rayStamp++;
  const i0=clamp(Math.floor((x-r-SG.x0)/SG.cs),0,SG.nx-1),i1=clamp(Math.floor((x+r-SG.x0)/SG.cs),0,SG.nx-1);
  const j0=clamp(Math.floor((z-r-SG.z0)/SG.cs),0,SG.nz-1),j1=clamp(Math.floor((z+r-SG.z0)/SG.cs),0,SG.nz-1);
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)for(const s of SG.cells[j*SG.nx+i])if(s.stamp!==rayStamp){s.stamp=rayStamp;out.push(s);}
  return out;
}

/* ================= Static mesh buckets (merged per material) ================= */
const BUCKETS={};
function bucket(mat,shadow=true){const k=mat+(shadow?'':'_ns');return BUCKETS[k]||(BUCKETS[k]={mat,shadow,parts:[]});}
// a textured box; solid unless o.solid===false. ts: metres per texture repeat
function addBox(x0,y0,z0,x1,y1,z1,mat,o={}){
  const w=Math.abs(x1-x0),h=Math.abs(y1-y0),d=Math.abs(z1-z0);
  bucket(mat,o.shadow!==false).parts.push({geo:boxGeo(w,h,d,o.ts||3),m:compose((x0+x1)/2,(y0+y1)/2,(z0+z1)/2),col:o.col?C(o.col):null});
  if(o.solid!==false)return addSolid(x0,y0,z0,x1,y1,z1,o.smat||mat);
}
// a rotated decorative box (no collision)
function addPart(mat,w,h,d,x,y,z,rx=0,ry=0,rz=0,o={}){bucket(mat,o.shadow!==false).parts.push({geo:boxGeo(w,h,d,o.ts||3),m:compose(x,y,z,rx,ry,rz),col:o.col?C(o.col):null});}
function addGeo(mat,geo,m,col){bucket(mat).parts.push({geo,m,col:col?C(col):null});}
function finalizeBuckets(){
  for(const k in BUCKETS){const b=BUCKETS[k];if(!b.parts.length)continue;
    const geo=mergeGeos(b.parts);const mat=MAT[b.mat];
    const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=b.shadow;mesh.receiveShadow=true;scene.add(mesh);}
}
// tinted materials need vertex colors switched on
for(const k of['concrete','stone','plaster','wood','slate','sandbag','hedge','metal','dirt','timber'])MAT[k].vertexColors=true;
// minY of terrain over a footprint
function minH(x0,z0,x1,z1){let m=1e9;for(let x=x0;x<=x1+.01;x+=Math.max(.5,(x1-x0)/6))for(let z=z0;z<=z1+.01;z+=Math.max(.5,(z1-z0)/6))m=Math.min(m,H(x,z));return m;}
function maxH(x0,z0,x1,z1){let m=-1e9;for(let x=x0;x<=x1+.01;x+=Math.max(.5,(x1-x0)/6))for(let z=z0;z<=z1+.01;z+=Math.max(.5,(z1-z0)/6))m=Math.max(m,H(x,z));return m;}

/* ================= Seawall ================= */
{
  const gaps=[[-47,-43],[-4.5,4.5],[41,45]];
  let x=-100;
  const segs=[];for(const g of gaps){segs.push([x,g[0]]);x=g[1];}segs.push([x,100]);
  for(const[a,b]of segs){for(let s=a;s<b-.01;s+=4){const e=Math.min(b,s+4);
    const y0=minH(s,33.6,e,34.6)-.6;addBox(s,y0,33.6,e,MAP.WALLTOP,34.6,'concrete',{col:0xc8c4ba});
    addPart('concrete',e-s,.25,.4,(s+e)/2,MAP.WALLTOP+.1,33.85,0,0,0,{col:0xbab6ac});}}
  // timber groynes running down the beach
  for(const gx of[-80,-25,30,78])for(let z=48;z<92;z+=2.2){const y=H(gx,z);addPart('timber',.3,1.0+rand(-.2,.2),.3,gx,y+.35,z,rand(-.08,.08),0,rand(-.08,.08),{col:0x8a7a66});}
}
/* ================= Shingle pebbles ================= */
{
  const N=2600;const g=new THREE.DodecahedronGeometry(1,0);const m=new THREE.InstancedMesh(g,new THREE.MeshStandardMaterial({color:C(0x8e8a80),roughness:.8}),N);
  const c=new THREE.Color();
  for(let i=0;i<N;i++){const x=rand(-100,100),z=rand(35,47.5);const s=rand(.06,.2);m.setMatrixAt(i,compose(x,H(x,z)+s*.3,z,rand(0,3),rand(0,3),rand(0,3),s*rand(1,1.5),s*rand(.6,1),s));c.setHSL(.1,rand(0,.08),rand(.35,.65));m.setColorAt(i,c);}
  m.receiveShadow=true;scene.add(m);
}
/* ================= Beach obstacles ================= */
const HEDGEHOGS=[];
{
  const beam=new THREE.BoxGeometry(.22,.22,2.3);
  const parts=[];const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.6155,0,Math.PI/4));
  for(const e of[[0,0,0],[Math.PI/2,0,0],[0,Math.PI/2,0]]){const m=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...e));m.premultiply(new THREE.Matrix4().makeRotationFromQuaternion(q));parts.push({geo:beam,m});}
  const hg=mergeGeos(parts);hg.translate(0,.75,0);
  const lanes=[-52,-18,18,52];
  let seed=3;const r=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let row=0;row<6;row++)for(let k=0;k<20;k++){
    const x=-95+k*10+r()*6+(row%2)*5,z=64+row*12+r()*5;if(lanes.some(l=>Math.abs(x-l)<3&&z>110))continue;
    HEDGEHOGS.push([x,z,r()*3]);}
  const im=new THREE.InstancedMesh(hg,MAT.metal,HEDGEHOGS.length);
  HEDGEHOGS.forEach(([x,z,ry],i)=>{const y=H(x,z);im.setMatrixAt(i,compose(x,y-.08,z,0,ry,0));addSolid(x-.6,y-.3,z-.6,x+.6,y+1.3,z+.6,'metal');});
  im.castShadow=true;im.receiveShadow=true;scene.add(im);
  // log ramps with Teller mines
  const logs=[];for(let i=0;i<34;i++){const x=rand(-92,92),z=rand(98,136);if(lanes.some(l=>Math.abs(x-l)<3.5))continue;logs.push([x,z]);}
  const lg=new THREE.CylinderGeometry(.14,.16,3.6,7);
  const lm=new THREE.InstancedMesh(lg,MAT.timber,logs.length);const mm=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.16,.1,10),MAT.metal,logs.length);
  logs.forEach(([x,z],i)=>{const y=H(x,z);lm.setMatrixAt(i,compose(x,y+1.0,z-.4,-.65,0,0));mm.setMatrixAt(i,compose(x,y+1.7+.08,z-1.35,-.65+Math.PI/2,0,0));addSolid(x-.25,y,z-.3,x+.25,y+1.2,z+.3,'wood');});
  lm.castShadow=mm.castShadow=true;scene.add(lm,mm);
}
/* ================= Barbed wire ================= */
const WIRES=[];
function wireLine(xa,xb,z,gaps){
  const pts=[];
  for(let x=xa;x<xb;x+=.15){if(gaps.some(g=>x>g[0]&&x<g[1]))continue;const a=x*5.2;const y=H(x,z);
    pts.push(x,y+.5+Math.sin(a)*.42,z+Math.cos(a)*.42);}
  const segs=[];for(let i=0;i<pts.length/3-1;i++){const a=i*3,b=a+3;if(Math.abs(pts[b]-pts[a])>.4)continue;segs.push(pts[a],pts[a+1],pts[a+2],pts[b],pts[b+1],pts[b+2]);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(segs,3));
  scene.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:C(0x2d2b28)})));
  let s=null;for(let x=xa;x<=xb;x+=1){const open=gaps.some(g=>x>g[0]&&x<g[1]);if(!open&&!s)s={x0:x,z,hw:.75};if((open||x>=xb)&&s){s.x1=x;WIRES.push(s);s=null;}}
  for(let x=xa;x<xb;x+=3){if(gaps.some(g=>x>g[0]-1&&x<g[1]+1))continue;addPart('wood',.07,1.1,.07,x,H(x,z)+.45,z,0,0,0,{col:0x8a7458,shadow:false,ts:.5});}
}
wireLine(-100,100,48.5,[[-56,-48],[-22,-14],[-5,5],[14,22],[48,56]]);
wireLine(-100,100,24,[[-70,-62],[-36,-28],[-9,9],[24,32],[58,66]]);
wireLine(-100,100,11,[[-52,-44],[-18,-10],[-6,6],[12,20],[40,48]]);
function inWire(x,z){for(const w of WIRES)if(x>w.x0&&x<w.x1&&Math.abs(z-w.z)<w.hw)return true;return false;}

/* ================= Landing craft (LCVP) ================= */
const BOAT_X=[-52,-18,18,52],BOAT_Z=150;
const BOATS=[];
function buildBoat(){
  const g=new THREE.Group();
  const hullC=0x6a735f,inC=0x7a8170;
  const hull=new THREE.Group();g.add(hull);
  const add=(w,h,d,x,y,z,col,mat='metal',rx=0)=>{const m=new THREE.Mesh(boxGeo(w,h,d,2),MAT[mat]);m.position.set(x,y,z);m.rotation.x=rx;m.castShadow=m.receiveShadow=true;if(col)m.material=m.material.clone(),m.material.color=C(col),m.material.vertexColors=false;hull.add(m);return m;};
  add(3.5,.5,11,0,-.4,0,hullC);// bottom
  add(.16,2.2,11,-1.67,.55,0,hullC);add(.16,2.2,11,1.67,.55,0,hullC);// sides
  add(3.5,2.2,.2,0,.55,5.4,hullC);// stern
  add(3.2,.08,10.4,0,-.12,0,0x3d4237,'wood');// deck boards
  add(1.4,1.2,1.6,0,1.1,4.6,0x4a5144);// coxswain station
  add(.12,.4,9,-1.6,1.75,0,0x3c4238);add(.12,.4,9,1.6,1.75,0,0x3c4238);// gunwales
  // ramp hinges at the bow (z=-5.5): pivot group
  const rp=new THREE.Group();rp.position.set(0,-.35,-5.5);g.add(rp);
  const ramp=new THREE.Mesh(boxGeo(3.3,2.3,.14,2),MAT.metal.clone());ramp.material.vertexColors=false;ramp.material.color=C(0x606a58);ramp.position.set(0,1.15,0);ramp.castShadow=true;rp.add(ramp);
  for(let k=0;k<4;k++){const rib=new THREE.Mesh(new THREE.BoxGeometry(3.2,.06,.06),ramp.material);rib.position.set(0,.3+k*.5,.09);rp.add(rib);}
  return{g,rp};
}
for(let i=0;i<4;i++){const b=buildBoat();b.home=new V3(BOAT_X[i],.35,BOAT_Z);b.g.position.copy(b.home);scene.add(b.g);BOATS.push(b);
  const x=BOAT_X[i];// collision when beached
  addSolid(x-1.8,-1,BOAT_Z-5.5,x-1.55,2.25,BOAT_Z+5.5,'metal');addSolid(x+1.55,-1,BOAT_Z-5.5,x+1.8,2.25,BOAT_Z+5.5,'metal');
  addSolid(x-1.8,-1,BOAT_Z+5.3,x+1.8,2.25,BOAT_Z+5.6,'metal');addSolid(x-1.6,-1,BOAT_Z-5.4,x+1.6,.25,BOAT_Z+5.3,'wood');
  addSolid(x-.7,.25,BOAT_Z+3.8,x+.7,2.05,BOAT_Z+5.4,'metal');}
// a sunk craft and wrecked tanks on the beach
const BURNING=[];
function sherman(x,z,ry,tilt=0){
  const g=new THREE.Group();g.position.set(x,H(x,z)-.15,z);g.rotation.set(tilt,ry,tilt*.5);
  const mat=MAT.metal.clone();mat.vertexColors=false;mat.color=C(0x3e4232);
  const burnt=MAT.metal.clone();burnt.vertexColors=false;burnt.color=C(0x26241f);
  const add=(geo,px,py,pz,m=mat,rx=0,rz=0)=>{const me=new THREE.Mesh(geo,m);me.position.set(px,py,pz);me.rotation.x=rx;me.rotation.z=rz;me.castShadow=me.receiveShadow=true;g.add(me);return me;};
  add(boxGeo(2.6,1.0,5.8),0,1.0,0);add(boxGeo(.6,.9,6),-1.25,.45,0,burnt);add(boxGeo(.6,.9,6),1.25,.45,0,burnt);
  add(boxGeo(2.4,.6,1.6),0,1.2,-2.8,mat,-.5);
  add(new THREE.CylinderGeometry(.95,1.05,.75,12),0,1.85,.2,burnt);
  const gun=add(new THREE.CylinderGeometry(.07,.08,2.6,8),0,1.95,-1.3,burnt,Math.PI/2+.12);
  scene.add(g);
  addSolid(x-1.6,H(x,z)-.5,z-3,x+1.6,H(x,z)+2.2,z+3,'metal');
  BURNING.push({x,y:H(x,z)+2,z,big:true});
}
sherman(-31,97,.25,.05);sherman(36,113,-.4,-.04);sherman(-70,124,1.2,.03);
{
  const x=71,z=139;const b=buildBoat();b.g.position.set(x,-.6,z);b.g.rotation.set(.12,.4,.2);b.rp.rotation.x=-1.2;scene.add(b.g);
  addSolid(x-2.5,-1,z-5,x+2.5,1.2,z+5,'metal');BURNING.push({x,y:.8,z,big:false});
}
// crates, jerry cans and dead equipment at the seawall
for(let i=0;i<14;i++){const x=rand(-85,85),z=rand(36.4,39);if(Math.abs(x)<6)continue;const s=rand(.5,.8);const y=H(x,z);addBox(x-s/2,y-.05,z-s/2,x+s/2,y+s*.8,z+s/2,'wood',{col:0x9a8a6a,ts:1});}

/* ================= Bunkers ================= */
const PERCHES=[];// {x,z,yaw,team,role,flag,deployY}
function bunker(cx,cz,w,d){
  const y=H(cx,cz)-.02;const x0=cx-w/2,x1=cx+w/2,z0=cz-d/2,z1=cz+d/2,t=.8,ih=2.5,roof=.9;
  const emb0=1.0,emb1=1.75;
  const o={col:0xb8b4aa};
  // south wall with embrasure slit
  addBox(x0,y-.5,z1-t,x1,y+emb0,z1,'concrete',o);
  addBox(x0,y+emb1,z1-t,x1,y+ih,z1,'concrete',o);
  addBox(x0,y+emb0,z1-t,cx-2.6,y+emb1,z1,'concrete',o);addBox(cx+2.6,y+emb0,z1-t,x1,y+emb1,z1,'concrete',o);
  // side walls
  addBox(x0,y-.5,z0,x0+t,y+ih,z1-t,'concrete',o);addBox(x1-t,y-.5,z0,x1,y+ih,z1-t,'concrete',o);
  // north wall with a door
  addBox(x0+t,y-.5,z0,cx-1,y+ih,z0+t,'concrete',o);addBox(cx+1,y-.5,z0,x1-t,y+ih,z0+t,'concrete',o);addBox(cx-1,y+2.1,z0,cx+1,y+ih,z0+t,'concrete',o);
  // roof slab with chamfered lip
  addBox(x0-.3,y+ih,z0-.3,x1+.3,y+ih+roof,z1+.6,'concrete',o);
  addPart('concrete',w+.6,.3,.6,cx,y+ih+.2,z1+.85,.6,0,0,o);
  // interior: floor boards, shelf, ammo crates, MG on the sill
  addBox(x0+t,y-.02,z0+t,x1-t,y+.06,z1-t,'wood',{solid:false,col:0x6a5a46});
  for(const dx of[-2.8,2.8])addBox(cx+dx-.4,y,z0+1,cx+dx+.4,y+.5,z0+1.6,'wood',{col:0x6f6346,ts:1});
  // earth berm on the roof
  PERCHES.push({x:cx,z:z1-1.35,yaw:0,role:'mg',deployY:y+emb0},{x:cx-1.8,z:z1-1.3,yaw:0,role:'rifle'},{x:cx+1.8,z:z1-1.3,yaw:0,role:'rifle'});
  return y;
}
for(const b of BUNKERS)bunker(b.x,b.z,b.w,b.d);
// 88 casemate covering the draw
{
  const cx=18,cz=16,y=H(cx,cz);const o={col:0xb4b0a6};
  addBox(14,y-.5,12,22,y+3.4,20,'concrete',o);addBox(13.6,y+3.4,11.6,22.4,y+4.2,20.4,'concrete',o);
  addBox(14.6,y+1.2,19.98,17.6,y+2.6,20.05,'concrete',{solid:false,col:0x161512});
  const gun=new THREE.Mesh(new THREE.CylinderGeometry(.11,.13,4.2,10),MAT.metal);gun.rotation.x=Math.PI/2;gun.rotation.z=.35;gun.position.set(15.4,y+1.8,21.6);gun.castShadow=true;scene.add(gun);
  const mant=new THREE.Mesh(new THREE.SphereGeometry(.55,10,8),MAT.metal);mant.position.set(16,y+1.85,20.05);scene.add(mant);
}
/* ================= Trenches, nests ================= */
{
  // timber revetment and a sandbag parapet along every trench leg
  for(const L of TRENCHES)for(let k=0;k<L.length-1;k++){
    const[ax,az]=L[k],[bx,bz]=L[k+1];const len=Math.hypot(bx-ax,bz-az),ry=Math.atan2(bx-ax,bz-az);const nx=Math.cos(ry),nz=-Math.sin(ry);
    for(let s=0;s<len;s+=2){const t=(s+1)/len;if(t>1)continue;const px=lerp(ax,bx,t),pz=lerp(az,bz,t);
      for(const side of[-1,1]){const wx=px+nx*side*1.05,wz=pz+nz*side*1.05;const gy=H(px,pz);
        addPart('timber',.12,1.5,2.05,wx,gy+.75,wz,0,ry,0,{col:0x7a6650,shadow:false,ts:1.4});
        const top=H(px+nx*side*1.9,pz+nz*side*1.9);
        if(side===1&&(az+bz)/2<0||true)addPart('sandbag',.9,.32,1.9,px+nx*side*1.75,top+.14,pz+nz*side*1.75,0,ry,0,{col:0xc6b88f,ts:1.1});}}
  }
  const nest=(cx,cz)=>{const y=H(cx,cz);const o={col:0xcfc19a,ts:1.15};
    addBox(cx-1.9,y-.2,cz+1.0,cx+1.9,y+.85,cz+1.8,'sandbag',o);
    addBox(cx-2.6,y-.2,cz-1.2,cx-1.9,y+.85,cz+1.8,'sandbag',o);addBox(cx+1.9,y-.2,cz-1.2,cx+2.6,y+.85,cz+1.8,'sandbag',o);
    PERCHES.push({x:cx,z:cz+.35,yaw:0,role:'mg',deployY:y+.85},{x:cx-1.2,z:cz+.2,yaw:0,role:'rifle'});};
  nest(-62,3.4);nest(-22,3.6);nest(23,3.6);nest(64,3.4);
}
/* ================= Draw: anti-tank wall ================= */
for(let x=-16;x<16;x+=2){if(x>=-2.5&&x<2.5)continue;const y=minH(x,19,x+2,20.2);const top=maxH(x,19,x+2,20.2)+2.1;addBox(x,y-.5,19,x+2,top,20.2,'concrete',{col:0xbcb8ae});}
// tank ditch blocks and a sandbagged foxhole line at the top of the draw
for(const[x,z]of[[-7,-12],[7,-14],[-4,-26],[5,-28]]){const y=H(x,z);addBox(x-1.6,y-.2,z-.45,x+1.6,y+.95,z+.45,'sandbag',{col:0xc9bb93,ts:1.15});}

/* ================= Hedgerows (bocage) ================= */
const HEDGE_BLOBS=[];
function hedge(x0,z0,x1,z1){
  const alongX=Math.abs(x1-x0)>Math.abs(z1-z0);const L=alongX?Math.abs(x1-x0):Math.abs(z1-z0);const th=1.8;
  for(let s=0;s<L-.01;s+=5){const e=Math.min(L,s+5);
    let a0,a1,b0,b1;if(alongX){a0=Math.min(x0,x1)+s;a1=Math.min(x0,x1)+e;b0=z0-th/2;b1=z0+th/2;}else{b0=Math.min(z0,z1)+s;b1=Math.min(z0,z1)+e;a0=x0-th/2;a1=x0+th/2;}
    const X0=alongX?a0:a0,X1=alongX?a1:a1,Z0=alongX?b0:b0,Z1=alongX?b1:b1;
    const y0=minH(X0,Z0,X1,Z1)-.4,y1=maxH(X0,Z0,X1,Z1)+2.5;
    // earth bank under the hedge
    addBox(X0,y0,Z0,X1,y0+1.4,Z1,'dirt',{col:0x8d7a5c,solid:false});
    addBox(X0+.1,y0+1.0,Z0+.1,X1-.1,y1,Z1-.1,'hedge',{solid:false,col:0xa8b494});
    addSolid(X0,y0,Z0,X1,y1,Z1,'hedge');
    for(let k=0;k<4;k++)HEDGE_BLOBS.push([lerp(X0,X1,Math.random()),y1-rand(0,.4),lerp(Z0,Z1,Math.random()),rand(1.1,1.8)]);
  }
}
for(const sg of[1,-1]){
  const seg=(a,b,z)=>hedge(sg>0?a:-b,z,sg>0?b:-a,z);
  seg(6,24,-24);seg(30,54,-24);seg(60,96,-24);
  seg(6,34,-66);seg(40,64,-66);seg(70,96,-66);
  hedge(sg*40,-62,sg*40,-50);hedge(sg*40,-40,sg*40,-28);hedge(sg*76,-62,sg*76,-28);
  hedge(sg*6,-40,sg*6,-28);hedge(sg*6,-62,sg*6,-51);
}
{
  const g=new THREE.IcosahedronGeometry(1,1);const im=new THREE.InstancedMesh(g,new THREE.MeshStandardMaterial({color:C(0x4c5a30),roughness:1,flatShading:true}),HEDGE_BLOBS.length);
  const c=new THREE.Color();HEDGE_BLOBS.forEach(([x,y,z,s],i)=>{im.setMatrixAt(i,compose(x,y,z,rand(0,3),rand(0,3),0,s*1.2,s*.8,s));c.setHSL(rand(.18,.25),rand(.25,.4),rand(.22,.32));im.setColorAt(i,c);});
  im.castShadow=true;im.receiveShadow=true;scene.add(im);
}

/* ================= Buildings ================= */
function house(x0,z0,x1,z1,o={}){
  const w=x1-x0,d=z1-z0,y=minH(x0,z0,x1,z1)-.3,top=maxH(x0,z0,x1,z1);const hh=(o.h||5.5)+(top-y)*.5;const mat=o.mat||'stone';const col=o.col||0xe6dccb;
  if(!o.ruin){
    addBox(x0,y,z0,x1,y+hh,z1,mat,{col});
    // gable roof along the long side
    const alongX=w>=d;const span=alongX?d:w,len=(alongX?w:d)+.6;const rise=span*.42;const sl=Math.hypot(span/2,rise)+.35,ang=Math.atan2(rise,span/2);
    const cx=(x0+x1)/2,cz=(z0+z1)/2;
    for(const s of[-1,1]){if(alongX)addPart('slate',len,.22,sl,cx,y+hh+rise/2,cz+s*span/4,s*ang,0,0,{col:0x9ea2a8});else addPart('slate',sl,.22,len,cx+s*span/4,y+hh+rise/2,cz,0,0,-s*ang,{col:0x9ea2a8});}
    // gable ends
    const sh=new THREE.Shape();sh.moveTo(-span/2,0);sh.lineTo(span/2,0);sh.lineTo(0,rise);sh.closePath();
    const gg=new THREE.ExtrudeGeometry(sh,{depth:len-.6,bevelEnabled:false});const uv=gg.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/3,uv.getY(i)/3);
    addGeo(mat,gg,alongX?compose(x0,y+hh,cz,0,Math.PI/2,0):compose(cx,y+hh,z0),col);
    // chimney
    addBox(x0+.6,y+hh,z0+.6,x0+1.5,y+hh+rise+1.2,z0+1.5,'stone',{col:0xb8aa96,solid:false});
    // windows and doors (dark insets with stone lintels)
    const win=(px,pz,nx,nz,wy,ww,wh)=>{const t=.06;if(nx)addBox(px-t,wy,pz-ww/2,px+t,wy+wh,pz+ww/2,'wood',{solid:false,col:0x2a2219});else addBox(px-ww/2,wy,pz-t,px+ww/2,wy+wh,pz+t,'wood',{solid:false,col:0x2a2219});};
    for(let k=1;k<Math.floor(w/3);k++){win(x0+k*3,z0,0,1,y+1+.8,1,1.3);win(x0+k*3,z1,0,1,y+1+.8,1,1.3);if(hh>5){win(x0+k*3,z0,0,1,y+4,1,1.1);win(x0+k*3,z1,0,1,y+4,1,1.1);}}
    for(let k=1;k<Math.floor(d/3);k++){win(x0,z0+k*3,1,0,y+1.8,1,1.3);win(x1,z0+k*3,1,0,y+1.8,1,1.3);}
    if(o.door)win(o.door[0],o.door[1],o.door[2],o.door[3],y+.3,1.4,2.4);
  }else{
    // ruined shell: broken walls of uneven height with gaps, open to the sky
    const wall=(ax,az,bx,bz,gapAt)=>{const alongX=Math.abs(bx-ax)>.1;const L=alongX?bx-ax:bz-az;const t=.6;
      for(let s=0;s<L-.01;s+=1.5){const e=Math.min(L,s+1.5);if(gapAt&&gapAt.some(g=>s+.75>g[0]&&s+.75<g[1]))continue;
        const hgt=Math.max(.6,hh*(.35+.65*Math.abs(Math.sin(s*1.7+ax))))*(Math.random()<.15?.3:1);
        if(alongX)addBox(ax+s,y,az-t/2,ax+e,y+hgt,az+t/2,mat,{col});else addBox(ax-t/2,y,az+s,ax+t/2,y+hgt,az+e,mat,{col});}};
    wall(x0,z0,x1,z0,o.gS);wall(x0,z1,x1,z1,o.gN);wall(x0,z0,x0,z1,o.gW);wall(x1,z0,x1,z1,o.gE);
    // rubble and a few charred beams
    for(let k=0;k<14;k++){const rx=rand(x0+.8,x1-.8),rz=rand(z0+.8,z1-.8),s=rand(.3,.9);addPart(mat,s,s*.6,s*rand(.6,1.2),rx,H(rx,rz)+s*.2,rz,rand(-.4,.4),rand(0,3),rand(-.4,.4),{col});}
    for(let k=0;k<3;k++)addPart('timber',.25,.25,rand(3,5),rand(x0+1,x1-1),y+rand(.3,1.4),rand(z0+1,z1-1),rand(-.3,.3),rand(0,3),rand(-.5,.5),{col:0x2b241d});
  }
  return y;
}
// crossroads farm
house(-19,-60,-9,-51,{door:[-14,-51,0,1]});
house(9,-40,19,-31,{ruin:true,gS:[[2,4]],gW:[[3,5]],gN:[[5,7.5]],mat:'stone',col:0xcfc3ad});
for(const[a,b,z]of[[-30,-10,-49.2],[10,30,-41]]){for(let x=a;x<b;x+=2){if(Math.abs(x)<4)continue;const y=minH(x,z-.3,x+2,z+.3);addBox(x,y-.3,z-.35,x+2,y+1.1,z+.35,'stone',{col:0xc9bda6});}}
// village
const VH=[
  [-16,-92,-7,-82,{mat:'plaster',door:[-7,-87,1,0]}],[-16,-126,-7,-113,{ruin:true,gE:[[3,5],[8,10]],gS:[[2,4]],mat:'stone'}],
  [-34,-93,-23,-80,{mat:'stone',door:[-28,-93,0,1]}],[-32,-129,-21,-114,{mat:'plaster'}],[-52,-119,-40,-106,{mat:'stone',h:6.5}],
  [7,-92,16,-82,{ruin:true,gW:[[3,6]],gN:[[2,4]],mat:'plaster'}],[7,-128,16,-116,{mat:'stone',door:[7,-122,1,0]}],
  [24,-91,35,-80,{mat:'plaster'}],[24,-127,36,-112,{mat:'stone',h:6.5}],[44,-121,54,-107,{mat:'plaster'}],
  [-50,-90,-41,-80,{ruin:true,gS:[[2,5]],mat:'stone'}],[42,-92,52,-81,{mat:'stone'}],
  [-60,-150,-48,-138,{mat:'stone'}],[48,-150,60,-136,{mat:'plaster'}]
];
for(const v of VH)house(...v);
// church: nave + tower + spire
{
  const y=minH(-6,-152,6,-122)-.3;const col=0xd6ccb8;
  addBox(-6,y,-150,6,y+8,-128,'stone',{col});
  const span=12,rise=5,sl=Math.hypot(6,rise)+.4,ang=Math.atan2(rise,6);
  for(const s of[-1,1])addPart('slate',sl,.25,23,s*3,y+8+rise/2,-139,0,0,-s*ang,{col:0x8e949c});
  const sh=new THREE.Shape();sh.moveTo(-6,0);sh.lineTo(6,0);sh.lineTo(0,rise);sh.closePath();
  const gg=new THREE.ExtrudeGeometry(sh,{depth:22,bevelEnabled:false});const uv=gg.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/3,uv.getY(i)/3);addGeo('stone',gg,compose(0,y+8,-150),col);
  addBox(-3.2,y,-128,3.2,y+17,-121.6,'stone',{col});
  addBox(-3.5,y+17,-128.3,3.5,y+17.6,-121.3,'stone',{col:0xc4baa6,solid:false});
  const spire=new THREE.Mesh(new THREE.ConeGeometry(3.1,9,4),MAT.slate);spire.rotation.y=Math.PI/4;spire.position.set(0,y+17.6+4.5,-124.8);spire.castShadow=true;scene.add(spire);
  // belfry openings and the door
  for(const[px,pz,rx]of[[0,-121.55,0],[0,-128.05,0]])addBox(px-.8,y+13,pz-.06,px+.8,y+15.5,pz+.06,'wood',{solid:false,col:0x1c1814});
  addBox(-1,y+.2,-121.62,1,y+3.4,-121.5,'wood',{solid:false,col:0x3a2b1e});
  for(const z of[-132,-138,-144])for(const x of[-6.05,6.05])addBox(x-.06,y+3,z-.6,x+.06,y+6,z+.6,'wood',{solid:false,col:0x2a3240});
  // graveyard wall
  for(const[a,b,z]of[[-14,-6.5,-127],[6.5,14,-127]])addBox(a,y,z-.3,b,y+1.2,z+.3,'stone',{col:0xbdb29c});
}
// street barricades, carts and a well in the square
for(const[x,z]of[[-3,-96],[3.5,-104],[-28,-100.5],[30,-99.5],[0,-70]]){const y=H(x,z);addBox(x-1.6,y-.2,z-.45,x+1.6,y+1.0,z+.45,'sandbag',{col:0xc9bb93,ts:1.15});}
{const y=H(-4,-112);addBox(-4.9,y,-112.9,-3.1,y+.9,-111.1,'stone',{col:0xb0a690});}
// Opel Blitz truck at the Axis assembly area
{
  const x=-22,z=-156,y=H(x,z);const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=.2;
  const m=MAT.metal.clone();m.vertexColors=false;m.color=C(0x4e5246);const k=MAT.metal.clone();k.vertexColors=false;k.color=C(0x1d1d1b);
  const cv=MAT.dirt.clone();cv.vertexColors=false;cv.color=C(0x8f8a6a);
  const add=(geo,mat,px,py,pz)=>{const me=new THREE.Mesh(geo,mat);me.position.set(px,py,pz);me.castShadow=me.receiveShadow=true;g.add(me);};
  add(boxGeo(2.2,1.6,1.8),m,0,1.5,-2.4);add(boxGeo(2.1,1,1.4),m,0,1.2,-3.6);add(boxGeo(2.3,2.2,3.8),cv,0,2.0,.6);add(boxGeo(2.3,.3,4.2),m,0,.8,.4);
  for(const[wx,wz]of[[-1,-3.2],[1,-3.2],[-1,1.4],[1,1.4]]){const wh=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.3,12),k);wh.rotation.z=Math.PI/2;wh.position.set(wx,.45,wz);g.add(wh);}
  scene.add(g);addSolid(x-1.6,y,z-4.4,x+1.6,y+3.1,z+2.6,'metal');
}
// telegraph poles along the road
for(let z=-30;z>-150;z-=16){const x=4.5,y=H(x,z);addPart('timber',.22,7,.22,x,y+3.5,z,0,0,0,{col:0x5b4a38});addPart('timber',1.6,.12,.12,x,y+6.6,z,0,0,0,{col:0x5b4a38});addSolid(x-.15,y,z-.15,x+.15,y+7,z+.15,'wood');}

/* ================= Trees ================= */
{
  const trees=[];
  const add=(x,z,s,kind)=>{if(roadDist(x,z)<4)return;for(const so of solidsNear(x,z,1,[]))if(x>so.x0-1&&x<so.x1+1&&z>so.z0-1&&z<so.z1+1)return;trees.push([x,z,s,kind]);};
  for(let i=0;i<70;i++){const x=rand(-95,95),z=rand(-75,-28);if(Math.random()<.5)add(x,z,rand(.8,1.3),0);}
  for(let z=-26;z>-80;z-=7){add(-5.5,z,rand(1,1.2),1);add(5.5,z-3,rand(1,1.2),1);}
  for(let i=0;i<40;i++)add(rand(-100,100),rand(-170,-80),rand(.9,1.4),0);
  for(let i=0;i<26;i++)add(rand(-30,-10),rand(-80,-68)+rand(-4,4),rand(.6,.8),2);// orchard
  const trunkGeo=new THREE.CylinderGeometry(.18,.32,5,6);trunkGeo.translate(0,2.5,0);
  const folGeo=new THREE.IcosahedronGeometry(1,1);
  const trunk=new THREE.InstancedMesh(trunkGeo,new THREE.MeshStandardMaterial({color:C(0x463a2e),roughness:1}),trees.length);
  const fol=new THREE.InstancedMesh(folGeo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true}),trees.length*3);
  const fc=[C(0x3d4a26),C(0x4a5629),C(0x55602c),C(0x36421f)];const tc=new THREE.Color();
  trees.forEach(([x,z,s,k],i)=>{const y=H(x,z)-.2;
    if(k===1){trunk.setMatrixAt(i,compose(x,y,z,0,0,0,s*.8,s*2.2,s*.8));for(let j=0;j<3;j++){tc.copy(fc[(i+j)%4]);fol.setMatrixAt(i*3+j,compose(x,y+5+j*3.2*s,z,0,rand(0,6),0,1.5*s,2.6*s,1.5*s));fol.setColorAt(i*3+j,tc);}}
    else{const hs=k===2?.5:1;trunk.setMatrixAt(i,compose(x,y,z,rand(-.05,.05),rand(0,6),0,s,s*hs,s));
      for(let j=0;j<3;j++){tc.copy(fc[(i+j)%4]).offsetHSL(0,0,rand(-.03,.03));fol.setMatrixAt(i*3+j,compose(x+rand(-1.4,1.4)*s,y+(k===2?3:5.5)*s+rand(0,2)*s*hs,z+rand(-1.4,1.4)*s,rand(0,3),rand(0,6),0,(k===2?2:3.2)*s,(k===2?1.6:2.8)*s,(k===2?2:3.2)*s));fol.setColorAt(i*3+j,tc);}}
    addSolid(x-.3*s,y,z-.3*s,x+.3*s,y+5*s,z+.3*s,'wood');});
  trunk.castShadow=fol.castShadow=true;scene.add(trunk,fol);
}
finalizeBuckets();

/* ================= Grass ================= */
const grassTime={value:0};
{
  const tex=canvasTex(128,128,(g)=>{for(let i=0;i<46;i++){const x=rand(8,120),hgt=rand(50,124),lean=rand(-26,26);
    g.strokeStyle=`hsl(${rand(45,75)},${rand(22,42)}%,${rand(30,58)}%)`;g.lineWidth=rand(1.4,3.4);g.beginPath();g.moveTo(x,128);g.quadraticCurveTo(x+lean*.3,128-hgt*.6,x+lean,128-hgt);g.stroke();}});
  tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
  const a=new THREE.PlaneGeometry(1,.8),b=a.clone();a.translate(0,.4,0);b.translate(0,.4,0);b.rotateY(Math.PI/2);
  const geo=mergeGeos([{geo:a},{geo:b}]);const nrm=geo.attributes.normal;for(let i=0;i<nrm.count;i++)nrm.setXYZ(i,0,1,0);
  const mat=new THREE.MeshLambertMaterial({map:tex,alphaTest:.45,side:THREE.DoubleSide});
  mat.onBeforeCompile=sh=>{sh.uniforms.uTime=grassTime;
    sh.fragmentShader=sh.fragmentShader.replace(/\( gl_FrontFacing \) \? vLightFront : vLightBack/g,'vLightFront').replace(/\( gl_FrontFacing \) \? vIndirectFront : vIndirectBack/g,'vIndirectFront');
    sh.vertexShader='uniform float uTime;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    #ifdef USE_INSTANCING
    vec2 ip=vec2(instanceMatrix[3][0],instanceMatrix[3][2]);
    #else
    vec2 ip=vec2(0.0);
    #endif
    float sw=sin(uTime*1.7+ip.x*0.21+ip.y*0.17)*0.16+sin(uTime*3.1+ip.x*0.7)*0.05;
    transformed.x+=sw*position.y;transformed.z+=sw*0.5*position.y;`);};
  const N=GAME.quality==='high'?26000:14000;const inst=new THREE.InstancedMesh(geo,mat,N);const col=new THREE.Color();let k=0;const tmp=[];
  for(let i=0;i<N*2&&k<N;i++){
    const x=rand(-100,100),z=rand(-165,31);if(roadDist(x,z)<3.2)continue;if(z>-14&&z<4&&trenchDist(x,z)<2)continue;
    let blocked=false;for(const s of solidsNear(x,z,.5,tmp))if(x>s.x0-.2&&x<s.x1+.2&&z>s.z0-.2&&z<s.z1+.2&&s.mat!=='hedge'){blocked=true;break;}if(blocked)continue;
    const bluff=z>4;const s=bluff?rand(.8,1.6):rand(.5,1.1);
    inst.setMatrixAt(k,compose(x,H(x,z)-.04,z,0,rand(0,6.28),0,s,s*rand(.8,1.4),s));
    if(bluff)col.setHSL(rand(.12,.16),rand(.25,.4),rand(.6,.85));else col.setHSL(rand(.17,.24),rand(.25,.45),rand(.45,.75));
    inst.setColorAt(k,col);k++;}
  inst.count=k;scene.add(inst);
}

/* ================= Physics helpers ================= */
const STEP=.55;
const _sn=[];
// ground height under a point for someone whose feet are at feetY
function groundAt(x,z,feetY,r=.2){
  let g=H(x,z);
  for(const s of solidsNear(x,z,r+.1,_sn)){if(x+r<s.x0||x-r>s.x1||z+r<s.z0||z-r>s.z1)continue;if(s.y1<=feetY+STEP&&s.y1>g)g=s.y1;}
  return g;
}
// push a circle (x,z,r) out of solids that block someone standing at feetY with the given height
function collide(p,r,feetY,height){
  for(let it=0;it<2;it++){
    for(const s of solidsNear(p.x,p.z,r+.2,_sn)){
      if(s.y1<=feetY+STEP||s.y0>=feetY+height)continue;
      const cx=clamp(p.x,s.x0,s.x1),cz=clamp(p.z,s.z0,s.z1);let dx=p.x-cx,dz=p.z-cz;const d2=dx*dx+dz*dz;
      if(d2>=r*r)continue;
      if(d2>1e-8){const d=Math.sqrt(d2),k=(r-d)/d;p.x+=dx*k;p.z+=dz*k;}
      else{const l=p.x-s.x0,rr=s.x1-p.x,f=p.z-s.z0,b=s.z1-p.z;const m=Math.min(l,rr,f,b);if(m===l)p.x=s.x0-r;else if(m===rr)p.x=s.x1+r;else if(m===f)p.z=s.z0-r;else p.z=s.z1+r;}
    }
  }
  p.x=clamp(p.x,-MAP.BX,MAP.BX);p.z=clamp(p.z,MAP.BZN,MAP.BZS);
}
// first low wall in front that could be climbed: returns its top or null
function climbable(x,z,dx,dz,feetY){
  const px=x+dx*.6,pz=z+dz*.6;
  for(const s of solidsNear(px,pz,.5,_sn)){if(px<s.x0-.3||px>s.x1+.3||pz<s.z0-.3||pz>s.z1+.3)continue;const h=s.y1-feetY;if(h>STEP&&h<1.4)return s.y1;}
  return null;
}
function surfaceAt(x,z,feetY){
  for(const s of solidsNear(x,z,.3,_sn))if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1&&Math.abs(s.y1-feetY)<.15)return s.mat==='wood'?'wood':s.mat==='hedge'||s.mat==='sandbag'||s.mat==='dirt'?'grass':'hard';
  const h=H(x,z);if(h<-.05&&feetY<.05)return'water';if(z>35)return'sand';if(roadDist(x,z)<2.5&&z<-70)return'hard';return'grass';
}

/* ================= Ray casting ================= */
const _rs=[];
// returns {t,x,y,z,nx,ny,nz,mat} or null. Checks solids, terrain and the sea surface.
function rayWorld(ox,oy,oz,dx,dy,dz,maxT,noWater){
  let best=maxT,hit=null;
  // solids: walk the coarse grid along the ray
  rayStamp++;const st=rayStamp;
  const steps=Math.ceil(maxT/(SG.cs*.5));
  for(let k=0;k<=steps;k++){
    const t=Math.min(maxT,k*SG.cs*.5);if(t>best)break;
    const x=ox+dx*t,z=oz+dz*t;
    const ci=Math.floor((x-SG.x0)/SG.cs),cj=Math.floor((z-SG.z0)/SG.cs);
    for(let jj=cj-1;jj<=cj+1;jj++)for(let ii=ci-1;ii<=ci+1;ii++){if(ii<0||jj<0||ii>=SG.nx||jj>=SG.nz)continue;
      for(const s of SG.cells[jj*SG.nx+ii]){if(s.stamp===st)continue;s.stamp=st;
        let t0=0,t1=best,nAx=0;
        let ok=true;
        for(let a=0;a<3;a++){const o=a===0?ox:a===1?oy:oz,d=a===0?dx:a===1?dy:dz,lo=a===0?s.x0:a===1?s.y0:s.z0,hi=a===0?s.x1:a===1?s.y1:s.z1;
          if(Math.abs(d)<1e-9){if(o<lo||o>hi){ok=false;break;}continue;}
          let ta=(lo-o)/d,tb=(hi-o)/d;let ax=-(a+1);if(ta>tb){const q=ta;ta=tb;tb=q;ax=a+1;}
          if(ta>t0){t0=ta;nAx=ax;}if(tb<t1)t1=tb;if(t0>t1){ok=false;break;}}
        if(ok&&t0<best&&t0>0){best=t0;const a=Math.abs(nAx)-1,sg=nAx<0?-1:1;
          hit={t:t0,nx:a===0?(dx>0?-1:1):0,ny:a===1?(dy>0?-1:1):0,nz:a===2?(dz>0?-1:1):0,mat:s.mat,solid:s};}
      }}
  }
  // terrain: adaptive march then bisection
  let t=0,prevT=0,prevD=(oy-H(ox,oz));
  if(prevD>0){
    while(t<best){
      const step=clamp(prevD*.6,.25,6);t=Math.min(best,t+step);
      const x=ox+dx*t,y=oy+dy*t,z=oz+dz*t;const d=y-H(x,z);
      if(d<0){let a=prevT,b=t;for(let i=0;i<10;i++){const m=(a+b)/2;if(oy+dy*m-H(ox+dx*m,oz+dz*m)<0)b=m;else a=m;}
        best=b;const hx=ox+dx*b,hz=oz+dz*b;const e=.4;const nx=H(hx-e,hz)-H(hx+e,hz),nz=H(hx,hz-e)-H(hx,hz+e);const l=Math.hypot(nx,2*e,nz);
        hit={t:b,nx:nx/l,ny:2*e/l,nz:nz/l,mat:'terrain'};break;}
      prevT=t;prevD=d;if(t>=best)break;
    }
  }
  // sea surface
  if(!noWater&&dy<0&&oy>0){const tw=-oy/dy;if(tw<best){const x=ox+dx*tw,z=oz+dz*tw;if(H(x,z)<0){best=tw;hit={t:tw,nx:0,ny:1,nz:0,mat:'water'};}}}
  if(hit){hit.x=ox+dx*hit.t;hit.y=oy+dy*hit.t;hit.z=oz+dz*hit.t;
    if(hit.mat==='terrain'){hit.mat=hit.z>35?'sand':hit.z>-14&&hit.z<4&&trenchDist(hit.x,hit.z)<2?'dirt':'grass';}}
  return hit;
}
const _los=new V3();
function clearLine(a,b){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;const d=Math.hypot(dx,dy,dz);if(d<.01)return true;const h=rayWorld(a.x,a.y,a.z,dx/d,dy/d,dz/d,d-.2,true);return !h;}

/* ================= Navigation grid ================= */
const NAV={cs:1.5,x0:-93,z0:-160};NAV.nx=Math.ceil(186/NAV.cs);NAV.nz=Math.ceil(332/NAV.cs);
NAV.cost=new Float32Array(NAV.nx*NAV.nz);
{
  const tmp=[];
  for(let j=0;j<NAV.nz;j++)for(let i=0;i<NAV.nx;i++){
    const x=NAV.x0+(i+.5)*NAV.cs,z=NAV.z0+(j+.5)*NAV.cs;const h=H(x,z);let c=1;
    if(h<-1.15){NAV.cost[j*NAV.nx+i]=Infinity;continue;}
    if(h<-.1)c+=1.2;
    const sl=slopeAt(x,z);if(sl>1.25){NAV.cost[j*NAV.nx+i]=Infinity;continue;}c+=sl*1.5;
    if(inWire(x,z))c+=5;
    for(const s of solidsNear(x,z,.6,tmp)){
      if(x+.45<s.x0||x-.45>s.x1||z+.45<s.z0||z-.45>s.z1)continue;
      if(s.y0>h+1.7||s.y1<=h+STEP)continue;
      if(s.y1-h<1.3&&s.mat!=='hedge'&&s.mat!=='metal')c+=6;else{c=Infinity;break;}
    }
    NAV.cost[j*NAV.nx+i]=c;
  }
}
function navCell(x,z){const i=Math.floor((x-NAV.x0)/NAV.cs),j=Math.floor((z-NAV.z0)/NAV.cs);if(i<0||j<0||i>=NAV.nx||j>=NAV.nz)return-1;return j*NAV.nx+i;}
function cellX(c){return NAV.x0+(c%NAV.nx+.5)*NAV.cs;}
function cellZ(c){return NAV.z0+((c/NAV.nx|0)+.5)*NAV.cs;}
function nearestOpen(c){if(c>=0&&NAV.cost[c]<Infinity)return c;if(c<0)return-1;const ci=c%NAV.nx,cj=c/NAV.nx|0;
  for(let r=1;r<8;r++)for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){if(Math.max(Math.abs(di),Math.abs(dj))!==r)continue;const i=ci+di,j=cj+dj;if(i<0||j<0||i>=NAV.nx||j>=NAV.nz)continue;const k=j*NAV.nx+i;if(NAV.cost[k]<Infinity)return k;}return-1;}
class Heap{constructor(){this.k=[];this.v=[];}
  push(key,val){const k=this.k,v=this.v;let i=k.length;k.push(key);v.push(val);while(i>0){const p=(i-1)>>1;if(v[p]<=val)break;k[i]=k[p];v[i]=v[p];i=p;}k[i]=key;v[i]=val;}
  pop(){const k=this.k,v=this.v;const top=k[0];const lk=k.pop(),lv=v.pop();if(k.length){let i=0;const n=k.length;while(true){let l=2*i+1,r=l+1,m=i;let mv=lv;if(l<n&&v[l]<mv){m=l;mv=v[l];}if(r<n&&v[r]<mv){m=r;}if(m===i)break;k[i]=k[m];v[i]=v[m];i=m;}k[i]=lk;v[i]=lv;}return top;}
  get size(){return this.k.length;}}
const NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
// distance field from a target (flow field)
function flowField(tx,tz,r=3){
  const N=NAV.nx*NAV.nz,dist=new Float32Array(N).fill(Infinity);const hp=new Heap();
  for(let dz=-r;dz<=r;dz+=NAV.cs)for(let dx=-r;dx<=r;dx+=NAV.cs){const c=navCell(tx+dx,tz+dz);if(c>=0&&NAV.cost[c]<Infinity){dist[c]=0;hp.push(c,0);}}
  if(!hp.size){const c=nearestOpen(navCell(tx,tz));if(c>=0){dist[c]=0;hp.push(c,0);}}
  while(hp.size){const c=hp.pop();const d=dist[c];const ci=c%NAV.nx,cj=c/NAV.nx|0;
    for(const[di,dj,w]of NB){const i=ci+di,j=cj+dj;if(i<0||j<0||i>=NAV.nx||j>=NAV.nz)continue;const k=j*NAV.nx+i;const cc=NAV.cost[k];if(cc===Infinity)continue;
      if(di&&dj&&(NAV.cost[cj*NAV.nx+i]===Infinity||NAV.cost[j*NAV.nx+ci]===Infinity))continue;
      const nd=d+w*cc;if(nd<dist[k]){dist[k]=nd;hp.push(k,nd);}}}
  return dist;
}
// next waypoint from a flow field: look a few cells downhill
function flowNext(field,x,z,out){
  let c=nearestOpen(navCell(x,z));if(c<0)return null;
  for(let step=0;step<3;step++){const ci=c%NAV.nx,cj=c/NAV.nx|0;let best=c,bd=field[c];
    for(const[di,dj]of NB){const i=ci+di,j=cj+dj;if(i<0||j<0||i>=NAV.nx||j>=NAV.nz)continue;const k=j*NAV.nx+i;if(field[k]<bd){bd=field[k];best=k;}}
    if(best===c)break;c=best;}
  out.x=cellX(c);out.z=cellZ(c);return out;
}
// A* to a point, returns array of {x,z}
function findPath(sx,sz,tx,tz,limit=9000){
  const s=nearestOpen(navCell(sx,sz)),g=nearestOpen(navCell(tx,tz));if(s<0||g<0)return null;if(s===g)return[{x:tx,z:tz}];
  const gx=g%NAV.nx,gz=g/NAV.nx|0;const G=new Map(),from=new Map();const hp=new Heap();G.set(s,0);hp.push(s,0);let n=0,found=false;
  while(hp.size&&n++<limit){const c=hp.pop();if(c===g){found=true;break;}const ci=c%NAV.nx,cj=c/NAV.nx|0;const gc=G.get(c);
    for(const[di,dj,w]of NB){const i=ci+di,j=cj+dj;if(i<0||j<0||i>=NAV.nx||j>=NAV.nz)continue;const k=j*NAV.nx+i;const cc=NAV.cost[k];if(cc===Infinity)continue;
      if(di&&dj&&(NAV.cost[cj*NAV.nx+i]===Infinity||NAV.cost[j*NAV.nx+ci]===Infinity))continue;
      const ng=gc+w*cc;const og=G.get(k);if(og===undefined||ng<og){G.set(k,ng);from.set(k,c);hp.push(k,ng+Math.hypot(i-gx,j-gz)*.9);}}}
  if(!found)return null;
  const path=[];let c=g;while(c!==s&&c!==undefined){path.push({x:cellX(c),z:cellZ(c)});c=from.get(c);}path.reverse();
  // thin out waypoints
  const out=[];for(let i=0;i<path.length;i++)if(i%2===1||i===path.length-1)out.push(path[i]);
  out[out.length-1]={x:tx,z:tz};return out;
}
function walkable(x,z){const c=navCell(x,z);return c>=0&&NAV.cost[c]<Infinity;}

/* ================= Flags and spawns ================= */
const FLAG_DEFS=[
  {name:'Seawall',short:'SEAWALL',x:-1,z:39,r:9,start:0,tier:0},
  {name:'West Bunker',short:'W. BUNKER',x:-40,z:-12,r:9,start:1,tier:1},
  {name:'East Bunker',short:'E. BUNKER',x:42,z:-12,r:9,start:1,tier:1},
  {name:'Crossroads',short:'CROSSROADS',x:0,z:-45,r:9,start:1,tier:2},
  {name:'Church Square',short:'CHURCH',x:0,z:-110,r:10,start:1,tier:3}
];
for(const f of FLAG_DEFS)f.field=flowField(f.x,f.z,3);
// assign perches to the nearest flag
for(const p of PERCHES){let b=0,bd=1e9;FLAG_DEFS.forEach((f,i)=>{const d=Math.hypot(f.x-p.x,f.z-p.z);if(d<bd){bd=d;b=i;}});p.flag=b;p.team=1;}
// extra perches: Axis snipers on the crest and in the village, Allied riflemen at the seawall
PERCHES.push({x:-12,z:-74,yaw:0,role:'sniper',team:1,flag:3},{x:20,z:-72,yaw:0,role:'sniper',team:1,flag:3},{x:-75,z:-1,yaw:-.3,role:'sniper',team:1,flag:1},{x:78,z:-1,yaw:.3,role:'sniper',team:1,flag:2},
  {x:-9,z:-100,yaw:0,role:'sniper',team:1,flag:4},{x:10,z:-98,yaw:0,role:'mg',team:1,flag:4,deployY:H(3.5,-104)+1.0},{x:-3,z:-94.8,yaw:0,role:'mg',team:1,flag:4,deployY:H(-3,-96)+1.0});
for(let x=-80;x<=80;x+=16)PERCHES.push({x:x+rand(-3,3),z:35.6,yaw:Math.PI,role:x%32===0?'mg':'rifle',team:0,flag:0,deployY:MAP.WALLTOP});
const SPAWNS={
  allies:{boats:true},
  alliesFwd:{x0:-40,x1:40,z0:36,z1:40},
  axis:{x0:-34,x1:34,z0:-158,z1:-152},
  axisFwd:{x0:-24,x1:24,z0:-80,z1:-70}
};
