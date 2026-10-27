'use strict';
/* ================= Weapon data =================
   dmg is to the chest; zones multiply it (head x3, belly x.85, limbs x.55). 100 hp.
   spread in radians: hip / ads (aimed) / dep (deployed or prone with a bipod gun)                       */
const WEAPONS={
  garand:{name:'M1 Garand',type:'semi',mag:8,reserve:88,rof:.17,dmg:72,hip:.045,ads:.0035,kick:.032,reload:2.3,adsFov:52,snd:'garand',ping:true,clip:true},
  carbine:{name:'M1 Carbine',type:'semi',mag:15,reserve:90,rof:.13,dmg:46,hip:.035,ads:.006,kick:.018,reload:2.0,adsFov:55,snd:'carbine'},
  thompson:{name:'Thompson M1A1',type:'auto',mag:30,reserve:150,rof:60/700,dmg:31,hip:.034,ads:.016,kick:.016,reload:2.6,adsFov:60,snd:'thompson'},
  greasegun:{name:'M3 Grease Gun',type:'auto',mag:30,reserve:150,rof:60/450,dmg:33,hip:.03,ads:.014,kick:.013,reload:2.6,adsFov:60,snd:'greasegun'},
  springfield:{name:'Springfield M1903A4',type:'bolt',mag:5,reserve:50,rof:.12,bolt:1.25,dmg:118,hip:.09,ads:.0006,kick:.06,reload:3.0,scope:true,adsFov:16,snd:'springfield',clip:true},
  bar:{name:'Browning BAR M1918A2',type:'auto',mag:20,reserve:160,rof:60/550,dmg:56,hip:.06,ads:.026,dep:.009,kick:.03,reload:2.8,adsFov:55,snd:'bar',bipod:true},
  m1919:{name:'Browning .30 cal M1919A6',type:'auto',mag:150,reserve:150,rof:60/550,dmg:60,hip:.13,ads:.13,dep:.011,kick:.05,depKick:.008,reload:6.0,adsFov:60,snd:'m1919',mg:true,tracer:3},
  k98:{name:'Karabiner 98k',type:'bolt',mag:5,reserve:60,rof:.12,bolt:1.05,dmg:118,hip:.05,ads:.0022,kick:.055,reload:2.6,adsFov:52,snd:'k98',clip:true},
  g43:{name:'Gewehr 43',type:'semi',mag:10,reserve:80,rof:.18,dmg:68,hip:.045,ads:.004,kick:.03,reload:2.4,adsFov:52,snd:'g43'},
  mp40:{name:'MP40',type:'auto',mag:32,reserve:160,rof:60/500,dmg:30,hip:.03,ads:.014,kick:.013,reload:2.4,adsFov:60,snd:'mp40'},
  mp44:{name:'StG 44',type:'auto',mag:30,reserve:150,rof:60/600,dmg:42,hip:.04,ads:.017,kick:.022,reload:2.5,adsFov:56,snd:'mp44'},
  k98s:{name:'Scoped K98k',type:'bolt',mag:5,reserve:50,rof:.12,bolt:1.3,dmg:118,hip:.09,ads:.0006,kick:.06,reload:3.0,scope:true,adsFov:16,snd:'k98',clip:true},
  mg34:{name:'MG34',type:'auto',mag:75,reserve:225,rof:60/850,dmg:55,hip:.13,ads:.13,dep:.012,kick:.05,depKick:.008,reload:5.0,adsFov:60,snd:'mg34',mg:true,tracer:3},
  mg42:{name:'MG42',type:'auto',mag:250,reserve:250,rof:60/1200,dmg:52,hip:.14,ads:.14,dep:.014,kick:.05,depKick:.007,reload:6.5,adsFov:60,snd:'mg42',mg:true,tracer:4},
  colt:{name:'Colt M1911',type:'semi',mag:7,reserve:21,rof:.16,dmg:38,hip:.03,ads:.012,kick:.03,reload:1.7,adsFov:65,snd:'colt',pistol:true},
  luger:{name:'Luger P08',type:'semi',mag:8,reserve:24,rof:.15,dmg:36,hip:.03,ads:.012,kick:.026,reload:1.7,adsFov:65,snd:'luger',pistol:true},
  knife:{name:'M3 Trench Knife',type:'melee',dmg:60,range:1.7,rof:.5},
  spade:{name:'Entrenching Spade',type:'melee',dmg:75,range:1.9,rof:.65},
  mk2:{name:'Mk II Frag Grenade',type:'nade',fuse:4.2,throwV:17},
  stick:{name:'Stielhandgranate 24',type:'nade',fuse:4.5,throwV:20}
};
const ZONE_MUL={head:3,chest:1,belly:.85,limb:.55,blast:1,melee:1};
const CLASSES={
  0:[
    {id:'rifleman',name:'Rifleman',wep:'garand',pistol:null,nades:2,limit:0,desc:'Semi-automatic rifle with eight rounds. The empty clip pings out when you run dry.'},
    {id:'staffsgt',name:'Staff Sergeant',wep:'carbine',pistol:null,nades:2,limit:0,desc:'Light carbine with a 15-round box. Fast handling, light hits.'},
    {id:'mastersgt',name:'Master Sergeant',wep:'thompson',pistol:'colt',nades:1,limit:0,desc:'The Tommy gun. Close-quarters firepower for clearing bunkers and trenches.'},
    {id:'sergeant',name:'Sergeant',wep:'greasegun',pistol:'colt',nades:1,limit:0,desc:'Slow, steady M3 submachine gun. Easy to keep on target.'},
    {id:'sniper',name:'Sniper',wep:'springfield',pistol:'colt',nades:0,limit:2,desc:'Scoped bolt-action rifle. One body shot kills. Hold still when scoped.'},
    {id:'support',name:'Support Infantry',wep:'bar',pistol:'colt',nades:1,limit:3,desc:'BAR automatic rifle. Wild from the hip, deadly prone or rested on cover.'},
    {id:'mg',name:'Machine Gunner',wep:'m1919',pistol:'colt',nades:0,limit:2,desc:'.30 cal belt-fed gun. Useless unless deployed prone or on sandbags and walls.'}
  ],
  1:[
    {id:'grenadier',name:'Grenadier',wep:'k98',pistol:null,nades:2,limit:0,desc:'Bolt-action Karabiner. One chest shot kills. Work the bolt between shots.'},
    {id:'stoss',name:'Stosstruppe',wep:'g43',pistol:null,nades:2,limit:0,desc:'Semi-automatic Gewehr 43 with a ten-round box.'},
    {id:'unteroffizier',name:'Unteroffizier',wep:'mp40',pistol:'luger',nades:1,limit:0,desc:'MP40 submachine gun. Controllable and reliable up close.'},
    {id:'sturm',name:'Sturmtruppe',wep:'mp44',pistol:'luger',nades:1,limit:0,desc:'StG 44 assault rifle. Hits harder than a submachine gun, kicks more.'},
    {id:'sniper',name:'Scharfschütze',wep:'k98s',pistol:'luger',nades:0,limit:2,desc:'Scoped K98k. One body shot kills. Hold still when scoped.'},
    {id:'mg34',name:'MG34-Schütze',wep:'mg34',pistol:'luger',nades:0,limit:1,desc:'MG34 on a 75-round drum. Deploy it prone or on cover.'},
    {id:'mg42',name:'MG42-Schütze',wep:'mg42',pistol:'luger',nades:0,limit:1,desc:"Hitler's buzzsaw. 1,200 rounds a minute. Deploy it or it goes everywhere."}
  ]
};
const TEAM_NAME=['Allies','Axis'];
const MELEE=['knife','spade'],NADE=['mk2','stick'];

/* ================= Weapon models (forward is -z, origin at the trigger) ================= */
const WC={wood:0x6e4529,wood2:0x5a3920,dwood:0x4a2f1c,met:0x2a2c2f,met2:0x3d4043,blk:0x1b1c1e,bak:0x2c221b,od:0x4d5432,brass:0xb08a45,fg:0x575c4e};
function WM(id){
  const p=[],mag=[],bolt=[];let sightY=.06,muzzleZ=-.8,foreZ=-.3,scopeY=0;
  const b=(w,h,d,c,x,y,z,rx=0,ry=0,rz=0,arr=p)=>arr.push(P(Bx(w,h,d),c,x,y,z,rx,ry,rz));
  const cz=(r,len,c,x,y,z,arr=p,s=8)=>arr.push(P(Cz(r,len,s),c,x,y,z));
  const rifleBody=(wood,len,barrel)=>{
    b(.048,.1,.3,wood,0,-.035,.2,.08);b(.04,.06,.12,wood,0,-.01,.04);
    b(.05,.055,len,wood,0,-.005,-len/2-.02);b(.04,.03,len*.7,wood,0,.035,-len*.4-.05);
    cz(.011,barrel,WC.met,0,.028,-barrel/2-.05);b(.012,.03,.06,WC.met,0,-.04,.0);
  };
  switch(id){
    case'garand':rifleBody(WC.wood,.5,.78);b(.046,.05,.2,WC.met,0,.025,-.08);b(.007,.03,.02,WC.met,.011,.0625,0);b(.007,.03,.02,WC.met,-.011,.0625,0);b(.004,.022,.008,WC.met,0,.0605,-.82);cz(.013,.1,WC.met,0,.012,-.8);
      b(.02,.012,.05,WC.met2,.03,.03,-.07,0,0,0,bolt);b(.028,.02,.05,WC.brass,0,.05,-.09,0,0,0,mag);sightY=.0725;muzzleZ=-.84;foreZ=-.33;break;
    case'carbine':rifleBody(WC.wood2,.36,.55);b(.042,.045,.16,WC.met,0,.025,-.06);b(.007,.022,.02,WC.met,.01,.058,0);b(.007,.022,.02,WC.met,-.01,.058,0);b(.004,.02,.008,WC.met,0,.055,-.6);
      b(.026,.075,.045,WC.met,0,-.065,-.07,0,0,0,mag);b(.016,.01,.04,WC.met2,.026,.03,-.05,0,0,0,bolt);sightY=.066;muzzleZ=-.62;foreZ=-.28;break;
    case'thompson':b(.045,.1,.26,WC.wood,0,-.03,.21,.1);b(.05,.065,.3,WC.met,0,.02,-.06);b(.035,.09,.045,WC.wood,0,-.06,.04,-.25);b(.045,.045,.15,WC.wood,0,-.015,-.25);
      cz(.016,.2,WC.met,0,.025,-.3);cz(.019,.06,WC.met,0,.025,-.42);b(.006,.02,.02,WC.met,.009,.068,.04);b(.006,.02,.02,WC.met,-.009,.068,.04);b(.004,.018,.006,WC.met,0,.063,-.4);
      b(.032,.18,.05,WC.met2,0,-.11,-.1,.05,0,0,mag);b(.018,.014,.03,WC.met2,.03,.04,-.02,0,0,0,bolt);sightY=.073;muzzleZ=-.45;foreZ=-.25;break;
    case'greasegun':cz(.033,.26,WC.met,0,.0,-.06,p,10);cz(.013,.14,WC.met,0,.0,-.26);b(.03,.09,.04,WC.met,0,-.06,.07,-.25);b(.008,.008,.24,WC.met,.025,-.0,.2);b(.008,.008,.24,WC.met,-.025,-.0,.2);b(.06,.05,.008,WC.met,0,-.02,.32);
      b(.03,.2,.045,WC.met2,0,-.13,-.13,.1,0,0,mag);b(.012,.028,.012,WC.met,0,.038,.06);sightY=.054;muzzleZ=-.33;foreZ=-.13;break;
    case'springfield':rifleBody(WC.wood,.5,.78);b(.044,.045,.2,WC.met,0,.025,-.06);cz(.018,.32,WC.blk,0,.082,-.06,p,10);cz(.024,.06,WC.blk,0,.082,-.23,p,10);cz(.02,.05,WC.blk,0,.082,.11,p,10);
      b(.012,.025,.012,WC.met,0,.055,-.15);b(.012,.025,.012,WC.met,0,.055,.02);
      b(.05,.012,.012,WC.met2,.03,.03,.02,0,0,0,bolt);b(.016,.016,.016,WC.met2,.058,.03,.02,0,0,0,bolt);sightY=.082;muzzleZ=-.84;foreZ=-.33;break;
    case'bar':rifleBody(WC.wood,.36,.9);b(.055,.08,.4,WC.met,0,.01,-.12);b(.04,.09,.07,WC.met2,0,-.075,-.13,0,0,0,mag);
      b(.008,.008,.35,WC.met,.03,.0,-.7,.18);b(.008,.008,.35,WC.met,-.03,.0,-.7,.18);cz(.02,.08,WC.met,0,.028,-.98);b(.004,.022,.008,WC.met,0,.061,-.96);b(.006,.024,.02,WC.met,.009,.072,0);b(.006,.024,.02,WC.met,-.009,.072,0);
      b(.016,.014,.03,WC.met2,-.035,.02,-.12,0,0,0,bolt);sightY=.072;muzzleZ=-1.0;foreZ=-.4;break;
    case'm1919':b(.07,.095,.48,WC.met,0,.02,-.1);cz(.027,.48,WC.met2,0,.03,-.58,p,10);cz(.012,.1,WC.met,0,.03,-.86);b(.04,.075,.22,WC.met,0,-.01,.3);b(.03,.09,.04,WC.wood2,0,-.06,.13,-.2);
      b(.008,.3,.008,WC.met,.04,-.12,-.55,.5);b(.008,.3,.008,WC.met,-.04,-.12,-.55,.5);b(.1,.03,.03,WC.met,0,.075,-.28);b(.006,.03,.01,WC.met,0,.083,-.8);
      b(.09,.13,.2,WC.od,-.11,-.06,-.12,0,0,0,mag);b(.05,.012,.25,WC.brass,-.05,.04,-.14,0,0,.4,mag);b(.02,.02,.04,WC.met2,.045,.05,-.0,0,0,0,bolt);sightY=.098;muzzleZ=-.92;foreZ=-.38;break;
    case'k98':case'k98s':rifleBody(WC.dwood,.5,.74);b(.044,.045,.2,WC.met,0,.025,-.06);b(.004,.022,.008,WC.met,0,.047,-.8);
      b(.05,.012,.012,WC.met2,.032,.012,.03,0,0,-.6,bolt);b(.018,.018,.018,WC.met2,.058,-.004,.03,0,0,0,bolt);
      if(id==='k98s'){cz(.018,.3,WC.blk,0,.085,-.07,p,10);cz(.026,.06,WC.blk,0,.085,-.23,p,10);cz(.022,.05,WC.blk,0,.085,.09,p,10);b(.03,.03,.02,WC.met,0,.058,-.14);b(.03,.03,.02,WC.met,0,.058,.0);sightY=.085;}
      else{b(.026,.012,.03,WC.met,0,.05,-.12);sightY=.058;}muzzleZ=-.8;foreZ=-.32;break;
    case'g43':rifleBody(WC.dwood,.45,.66);b(.046,.05,.22,WC.met,0,.025,-.07);b(.03,.07,.08,WC.met2,0,-.06,-.08,0,0,0,mag);b(.004,.022,.008,WC.met,0,.047,-.72);b(.018,.012,.04,WC.met2,.03,.03,-.03,0,0,0,bolt);
      b(.024,.012,.03,WC.met,0,.05,-.14);sightY=.058;muzzleZ=-.74;foreZ=-.3;break;
    case'mp40':cz(.027,.32,WC.blk,0,.01,-.1,p,10);cz(.012,.12,WC.blk,0,.01,-.32);b(.012,.016,.05,WC.blk,0,-.022,-.31);b(.03,.09,.045,WC.bak,0,-.06,.05,-.2);b(.04,.035,.12,WC.bak,0,-.03,-.04);
      b(.008,.008,.24,WC.met,.022,.0,.2);b(.008,.008,.24,WC.met,-.022,.0,.2);b(.05,.055,.01,WC.met,0,-.02,.32);b(.03,.012,.02,WC.met,0,.045,.04);b(.005,.02,.006,WC.met,0,.04,-.3);
      b(.026,.21,.04,WC.blk,0,-.13,-.15,0,0,0,mag);b(.02,.012,.03,WC.met2,-.03,.022,-.02,0,0,0,bolt);sightY=.052;muzzleZ=-.38;foreZ=-.16;break;
    case'mp44':b(.045,.1,.24,WC.wood,0,-.035,.22,.1);b(.05,.07,.34,WC.met,0,.015,-.06);b(.032,.09,.045,WC.wood,0,-.065,.06,-.25);b(.046,.045,.13,WC.wood,0,.0,-.29);cz(.012,.2,WC.met,0,.025,-.42);cz(.01,.2,WC.met,0,.055,-.32);
      b(.006,.026,.008,WC.met,0,.06,-.47);b(.026,.014,.04,WC.met,0,.06,-.0);
      b(.028,.12,.045,WC.met,0,-.09,-.16,.12,0,0,mag);b(.028,.1,.045,WC.met,0,-.18,-.19,.35,0,0,mag);b(.016,.014,.03,WC.met2,-.03,.03,-.08,0,0,0,bolt);sightY=.072;muzzleZ=-.52;foreZ=-.29;break;
    case'mg34':cz(.032,.42,WC.met,0,.03,-.05,p,10);b(.06,.04,.18,WC.met,0,.065,-.02);cz(.03,.4,WC.met2,0,.03,-.45,p,10);cz(.014,.08,WC.met,0,.03,-.69);b(.04,.09,.22,WC.bak,0,-.01,.3,.05);b(.03,.09,.04,WC.bak,0,-.065,.08,-.2);
      b(.008,.3,.008,WC.met,.035,-.12,-.5,.5);b(.008,.3,.008,WC.met,-.035,-.12,-.5,.5);b(.006,.04,.01,WC.met,0,.08,-.62);b(.006,.03,.012,WC.met,.01,.1,-.06);b(.006,.03,.012,WC.met,-.01,.1,-.06);
      p.length;mag.push(P((()=>{const g=new THREE.CylinderGeometry(.06,.06,.05,14);g.rotateZ(Math.PI/2);return g;})(),WC.blk,-.075,-.01,-.06));b(.03,.015,.03,WC.met2,.04,.05,-.0,0,0,0,bolt);sightY=.1;muzzleZ=-.73;foreZ=-.36;break;
    case'mg42':b(.062,.085,.42,WC.blk,0,.02,-.05);b(.064,.07,.44,WC.met2,0,.025,-.46);for(let k=0;k<5;k++)b(.066,.03,.04,WC.blk,0,.028,-.3-k*.075);cz(.016,.08,WC.blk,0,.03,-.71);
      b(.045,.09,.24,WC.bak,0,-.01,.3,.05);b(.03,.09,.04,WC.bak,0,-.065,.08,-.2);b(.008,.3,.008,WC.met,.035,-.12,-.55,.5);b(.008,.3,.008,WC.met,-.035,-.12,-.55,.5);b(.006,.04,.01,WC.met,0,.075,-.66);b(.006,.03,.012,WC.met,.01,.095,-.08);b(.006,.03,.012,WC.met,-.01,.095,-.08);
      for(let k=0;k<8;k++)b(.02,.008,.035,WC.brass,-.06-k*.012,.03-k*.022,-.05,0,0,.3,mag);b(.03,.015,.03,WC.met2,.04,.05,.02,0,0,0,bolt);sightY=.095;muzzleZ=-.75;foreZ=-.36;break;
    case'colt':case'luger':
      if(id==='colt'){b(.028,.032,.2,WC.met,0,.03,-.06,0,0,0,bolt);b(.026,.02,.17,WC.met2,0,.004,-.05);b(.028,.1,.048,WC.wood2,0,-.045,.03,-.2);b(.004,.01,.006,WC.met,0,.05,-.15);}
      else{cz(.009,.11,WC.met,0,.035,-.12);b(.024,.03,.12,WC.met,0,.02,-.04);b(.022,.022,.05,WC.met2,0,.05,-.0,0,0,0,bolt);b(.026,.1,.045,WC.bak,0,-.045,.035,-.35);b(.004,.012,.006,WC.met,0,.05,-.17);}
      b(.026,.09,.035,WC.met,0,-.05,.035,-.2,0,0,mag);sightY=.055;muzzleZ=-.18;foreZ=-.02;break;
    case'knife':b(.004,.028,.18,0x9a9d9f,0,.0,-.14);b(.06,.012,.014,WC.met,0,.0,-.04);b(.026,.032,.11,WC.bak,0,.0,.02);sightY=.0;muzzleZ=-.24;break;
    case'spade':b(.03,.03,.46,WC.wood,0,0,-.1);b(.14,.17,.012,0x494d47,0,.0,-.42,Math.PI/2-.2);b(.06,.03,.03,WC.met,0,0,.14);sightY=0;muzzleZ=-.5;break;
    case'mk2':p.push(P(new THREE.SphereGeometry(.03,10,8),WC.od,0,0,0,0,0,0,1,1.25,1));b(.012,.03,.012,WC.met2,0,.045,0);b(.008,.05,.01,WC.met2,.016,.03,0,0,0,-.2);sightY=0;muzzleZ=0;break;
    case'stick':cz(.014,.3,WC.wood,0,0,.1);p.push(P(new THREE.CylinderGeometry(.034,.034,.09,12),WC.fg,0,0,-.08,Math.PI/2,0,0));sightY=0;muzzleZ=0;break;
  }
  return{p,mag,bolt,sightY,muzzleZ,foreZ};
}
const WM_CACHE={};
function weaponModel(id){return WM_CACHE[id]||(WM_CACHE[id]=WM(id));}
// third-person: a single merged geometry, rotated to face +z (bots face +z)
const TPW_CACHE={};
function weaponGeoTP(id){
  if(TPW_CACHE[id])return TPW_CACHE[id];
  const m=weaponModel(id);const rot=new THREE.Matrix4().makeRotationY(Math.PI);
  const parts=[...m.p,...m.mag,...m.bolt].map(q=>({geo:q.geo,col:q.col,m:q.m.clone().premultiply(rot)}));
  return TPW_CACHE[id]=mergeGeos(parts);
}

/* ================= Viewmodel ================= */
const VM={g:new THREE.Group(),gun:null,mag:null,bolt:null,arms:null,id:null};
vmCam.add(VM.g);
const vmMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:.12});
const armMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9});
function limb(a,b,w,col){
  const d=b.clone().sub(a);const len=d.length();const g=new THREE.BoxGeometry(w,w,len);
  const m=new THREE.Matrix4().lookAt(new V3(0,0,0),d,new V3(0,1,0));m.setPosition(a.clone().add(b).multiplyScalar(.5));
  return{geo:g,col:C(col),m};
}
function buildVM(id,team){
  if(VM.gun){VM.g.remove(VM.gun);}
  VM.id=id;const W=WEAPONS[id];const m=weaponModel(id);
  const root=new THREE.Group();
  const gun=new THREE.Mesh(mergeGeos(m.p),vmMat);root.add(gun);
  VM.mag=null;VM.bolt=null;
  if(m.mag.length){VM.mag=new THREE.Mesh(mergeGeos(m.mag),vmMat);root.add(VM.mag);}
  if(m.bolt.length){VM.bolt=new THREE.Mesh(mergeGeos(m.bolt),vmMat);root.add(VM.bolt);}
  // arms: sleeves from off-screen down to the hands
  const sleeve=team===0?0x7d7356:0x5b6152,skin=0xd2a07c,cuff=team===0?0x6c6448:0x4c5246;
  const parts=[];
  const rh=new V3(0,-.065,.05),lh=new V3(0,-.03,m.foreZ);
  if(W.type==='nade'||W.type==='melee'){rh.set(0,-.02,.02);}
  const re=new V3(.14,-.24,.4),le=new V3(-.2,-.24,.25);
  parts.push(limb(re,rh.clone().add(new V3(.012,-.02,.07)),.075,sleeve),limb(rh.clone().add(new V3(.012,-.02,.07)),rh,.06,skin));
  parts.push(P(Bx(.055,.07,.09),skin,rh.x,rh.y,rh.z));
  if(W.type!=='nade'&&W.type!=='melee'&&!W.pistol){
    parts.push(limb(le,lh.clone().add(new V3(-.03,-.04,.08)),.075,sleeve),limb(lh.clone().add(new V3(-.03,-.04,.08)),lh.clone().add(new V3(-.01,-.02,0)),.058,skin));
    parts.push(P(Bx(.06,.05,.08),skin,lh.x-.012,lh.y-.02,lh.z));parts.push(P(Bx(.08,.08,.06),cuff,-.17,-.22,.27));
  }
  parts.push(P(Bx(.085,.085,.06),cuff,.13,-.22,.37));
  const arms=new THREE.Mesh(mergeGeos(parts),armMat);root.add(arms);
  VM.g.add(root);VM.gun=root;VM.sightY=m.sightY;VM.muzzleZ=m.muzzleZ;
  VM.magHome=VM.mag?VM.mag.position.clone():null;
}
