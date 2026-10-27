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

/* ================= First-person view (models in guns.js) ================= */
const VM={g:new THREE.Group(),gun:null,mag:null,bolt:null,id:null};
vmCam.add(VM.g);
