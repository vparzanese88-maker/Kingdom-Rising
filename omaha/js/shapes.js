'use strict';
/* ================= Smooth modelling helpers =================
   Guns, helmets and grenades are built from side profiles extruded with bevelled edges, lathed
   shapes and round tubes, then given smooth normals, so nothing looks like a stack of boxes.     */
// smooth the normals of a triangle soup, keeping edges sharper than `angle` (degrees)
function smoothNormals(geo,angle=55){
  if(geo.index)geo=geo.toNonIndexed();
  const p=geo.attributes.position,n=p.count,fn=new Float32Array(n*3);const cos=Math.cos(angle*Math.PI/180);
  const a=new V3(),b=new V3(),c=new V3(),ab=new V3(),ac=new V3();
  for(let i=0;i<n;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);ab.subVectors(b,a);ac.subVectors(c,a);ab.cross(ac);
    for(let k=0;k<3;k++){fn[(i+k)*3]=ab.x;fn[(i+k)*3+1]=ab.y;fn[(i+k)*3+2]=ab.z;}}
  const key=i=>Math.round(p.getX(i)*1e4)+'_'+Math.round(p.getY(i)*1e4)+'_'+Math.round(p.getZ(i)*1e4);
  const groups=new Map();for(let i=0;i<n;i++){const k=key(i);let g=groups.get(k);if(!g)groups.set(k,g=[]);g.push(i);}
  const out=new Float32Array(n*3);const v=new V3(),w=new V3(),s=new V3();
  for(const g of groups.values())for(const i of g){v.set(fn[i*3],fn[i*3+1],fn[i*3+2]);const lv=v.length()||1;s.set(0,0,0);
    for(const j of g){w.set(fn[j*3],fn[j*3+1],fn[j*3+2]);const lw=w.length()||1;if(v.dot(w)/(lv*lw)>=cos)s.add(w);}
    s.normalize();out[i*3]=s.x;out[i*3+1]=s.y;out[i*3+2]=s.z;}
  geo.setAttribute('normal',new THREE.BufferAttribute(out,3));return geo;
}
// a side profile in the weapon's (z,y) plane, extruded sideways (x) to width w with rounded edges.
// path: ['M',z,y],['L',z,y],['Q',cz,cy,z,y],['C',c1z,c1y,c2z,c2y,z,y]
function prof(path,w,bev=.004,seg=6){
  const sh=new THREE.Shape();
  for(const c of path){if(c[0]==='M')sh.moveTo(c[1],c[2]);else if(c[0]==='L')sh.lineTo(c[1],c[2]);else if(c[0]==='Q')sh.quadraticCurveTo(c[1],c[2],c[3],c[4]);else if(c[0]==='C')sh.bezierCurveTo(c[1],c[2],c[3],c[4],c[5],c[6]);}
  const b=Math.min(bev,w*.45);
  const g=new THREE.ExtrudeGeometry(sh,{depth:Math.max(.0005,w-2*b),bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:3,curveSegments:seg});
  g.rotateY(-Math.PI/2);g.computeBoundingBox();const bb=g.boundingBox;g.translate(-(bb.min.x+bb.max.x)/2,0,0);
  return smoothNormals(g,50);
}
// rounded box
function rbox(w,h,d,r=.008){
  r=Math.min(r,w*.45,h*.45,d*.45);const z0=-d/2,z1=d/2,y0=-h/2,y1=h/2;
  return prof([['M',z0+r,y0],['L',z1-r,y0],['Q',z1,y0,z1,y0+r],['L',z1,y1-r],['Q',z1,y1,z1-r,y1],['L',z0+r,y1],['Q',z0,y1,z0,y1-r],['L',z0,y0+r],['Q',z0,y0,z0+r,y0]],w,r,4);
}
// tube along z centred at the origin, radius r1 at the back (+z) and r2 at the front (-z)
function tube(r1,r2,len,seg=18){const g=new THREE.CylinderGeometry(r2,r1,len,seg,1);g.rotateX(-Math.PI/2);return g;}
// lathe a profile [[radius,z],...] around the z axis (z from back to front)
function lathe(pts,seg=20){const g=new THREE.LatheGeometry(pts.map(([r,z])=>new THREE.Vector2(Math.max(0,r),z)),seg);g.rotateX(Math.PI/2);return smoothNormals(g,70);}
// a lathed shape around the y axis (helmets)
function latheY(pts,seg=24){return smoothNormals(new THREE.LatheGeometry(pts.map(([r,y])=>new THREE.Vector2(Math.max(0,r),y)),seg),70);}
// a tube that follows a list of points (slings, belts, wire stocks)
function bar(points,r,seg=8){const curve=new THREE.CatmullRomCurve3(points.map(p=>new V3(...p)));return new THREE.TubeGeometry(curve,Math.max(4,points.length*4),r,seg,false);}

/* ---- environment map: an overcast sky with a bright horizon, for reflections on metal ---- */
const ENV=(()=>{
  const es=new THREE.Scene();
  const m=new THREE.ShaderMaterial({side:THREE.BackSide,uniforms:{},vertexShader:`varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec3 vD;void main(){vec3 d=normalize(vD);float h=d.y;
      vec3 top=vec3(.55,.6,.66),hor=vec3(1.0,.98,.92),gnd=vec3(.2,.18,.14);
      vec3 c=h>0.0?mix(hor,top,pow(h,.45)):mix(hor*.6,gnd,pow(-h,.4));
      c+=vec3(1.4,1.3,1.1)*pow(max(dot(d,normalize(vec3(.5,.6,.3))),0.0),24.0);
      gl_FragColor=vec4(c,1.0);
      #include <encodings_fragment>
      }`});
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10,32,16),m));
  const pm=new THREE.PMREMGenerator(renderer);const rt=pm.fromScene(es,.02);pm.dispose();
  return rt.texture;
})();
vmScene.environment=ENV;

/* ---- viewmodel materials ---- */
const woodTex=canvasTex(512,128,(g,w,h)=>{
  g.fillStyle='#8a5a34';g.fillRect(0,0,w,h);
  for(let i=0;i<70;i++){const y=rand(0,h),a=rand(.05,.22);g.strokeStyle=`rgba(${rand(40,70)|0},${rand(20,40)|0},10,${a})`;g.lineWidth=rand(.6,2.4);g.beginPath();g.moveTo(0,y);
    for(let x=0;x<=w;x+=16)g.lineTo(x,y+Math.sin(x*.02+i)*rand(1,5)+Math.sin(x*.07)*1.2);g.stroke();}
  for(let i=0;i<5;i++){const x=rand(0,w),y=rand(0,h);const gr=g.createRadialGradient(x,y,0,x,y,rand(8,20));gr.addColorStop(0,'rgba(50,25,10,.35)');gr.addColorStop(1,'rgba(50,25,10,0)');g.fillStyle=gr;g.fillRect(x-20,y-20,40,40);}
});
woodTex.repeat.set(4,10);
const WMAT={
  wood:new THREE.MeshStandardMaterial({vertexColors:true,map:woodTex,roughness:.5,metalness:0,envMapIntensity:.7}),
  metal:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.34,metalness:.8,envMapIntensity:.55}),
  matte:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:.5,envMapIntensity:.45}),
  bake:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.36,metalness:.05,envMapIntensity:.9}),
  brass:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.28,metalness:1,envMapIntensity:1.2}),
  paint:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.62,metalness:.15,envMapIntensity:.6}),
  skin:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.62,metalness:0,envMapIntensity:.5}),
  cloth:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0,envMapIntensity:.35})
};
