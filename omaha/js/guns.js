'use strict';
/* ================= Weapon models =================
   Forward is -z, the origin is at the trigger, y is up, units are metres.
   Each part has a material kind (wood, metal, matte, bake, brass, paint) used for the first-person view;
   third-person soldiers get the same shapes merged into one mesh with vertex colours.                 */
const GC={walnut:0xe2c6a8,beech:0xc89a74,dwood:0xa47a58,blue:0x30343b,park:0x44474a,blk:0x2a2a2c,bake:0x3a2a20,brass:0xe6b45a,od:0x5f6a40,fg:0x6a7060,steel:0xb8bcc0,leather:0x5a3a22};
function WM(id){
  const p=[],mag=[],bolt=[];let sightY=.06,muzzleZ=-.8,foreZ=-.3;
  const add=(kind,geo,col,x=0,y=0,z=0,rx=0,ry=0,rz=0,arr=p,s=1)=>{arr.push({geo,col:C(col),m:compose(x,y,z,rx,ry,rz,s,s,s),kind});};
  const W=(geo,x,y,z,col=GC.walnut,rx=0)=>add('wood',geo,col,x,y,z,rx);
  const M=(geo,x,y,z,col=GC.blue,rx=0,ry=0,rz=0,arr=p)=>add('metal',geo,col,x,y,z,rx,ry,rz,arr);
  const T=(geo,x,y,z,col=GC.park,rx=0,ry=0,rz=0,arr=p)=>add('matte',geo,col,x,y,z,rx,ry,rz,arr);
  const guard=(z,y=-.03,r=.022,col=GC.blue)=>{const g=new THREE.TorusGeometry(r,.0034,8,18,Math.PI);g.rotateX(Math.PI);g.rotateY(Math.PI/2);M(g,0,y,z,col);
    M(prof([['M',.004,0],['Q',-.004,-.012,.006,-.024],['L',.01,-.022],['Q',.003,-.012,.01,0]],.006,.0015),0,-.012,z-.005,col);};
  // notch rear sight (two small ears) or a peep ring, and a thin front post whose tip sits on the line of sight
  const sights=(rearZ,frontZ,sy,col=GC.blue,peep)=>{
    if(peep){const r=new THREE.TorusGeometry(.0062,.0024,10,22);M(r,0,sy,rearZ,col);M(rbox(.004,.016,.008,.0015),0,sy-.014,rearZ,col);}
    else for(const sx of[-.0072,.0072])M(rbox(.0045,.014,.012,.0015),sx,sy-.003,rearZ,col);
    M(rbox(.0028,.018,.005,.001),0,sy-.009,frontZ,col);};
  const stock=(bz,tz,col,o={})=>{const d=o.drop||0,top=o.top||.014;
    W(prof([['M',bz,.022-d],['L',bz+.006,-.122-d],['Q',bz-.13,-.118-d,.11,-.064],['Q',.05,-.052,.022,-.05],['L',-.06,-.042],['L',tz+.045,-.036],['Q',tz,-.034,tz,-.012],
      ['L',tz+.012,top],['L',-.07,top],['L',-.02,.006],['L',.05,.004],['Q',.12,.004,.16,.022-d*.5],['L',bz,.022-d]],o.w||.045,.01,8),0,0,0,col);
    T(prof([['M',bz,.024-d],['L',bz+.012,-.124-d],['L',bz+.004,-.124-d],['L',bz-.004,.024-d]],.046,.003),0,0,0,GC.park);};
  const barrel=(z0,z1,r,y=.028,col=GC.blue)=>{M(tube(r,r*.95,z0-z1,18),0,y,(z0+z1)/2,col);M(tube(r*1.06,r*1.06,.012,18),0,y,z1+.006,col);};
  const scope=(y,z0,z1)=>{M(lathe([[.0,z0+.012],[.021,z0+.01],[.023,z0],[.019,z0-.03],[.0125,z0-.05],[.0125,z1+.05],[.017,z1+.03],[.021,z1+.004],[.0,z1]],24),0,y,0,GC.blk);
    for(const z of[z0-.06,z1+.08])T(rbox(.018,.03,.016,.004),0,y-.022,z,GC.blk);M(tube(.004,.004,.018,10),0,y+.016,(z0+z1)/2,GC.blk,Math.PI/2);};
  const boltHandle=(z,down,arr=bolt)=>{const g=tube(.0045,.0045,.05,10);g.rotateY(Math.PI/2);M(g,.03,.026,z,GC.steel,0,0,down?-.7:0,arr);
    M(new THREE.SphereGeometry(.0095,14,10),.054,down?.006:.026,z,GC.steel,0,0,0,arr);};
  switch(id){
    case'garand':
      stock(.36,-.6,GC.walnut);W(rbox(.034,.026,.2,.011),0,.038,-.17);W(rbox(.032,.024,.17,.011),0,.036,-.45);
      T(prof([['M',.06,.004],['L',.06,.04],['Q',.04,.05,.0,.048],['L',-.16,.044],['L',-.16,.006],['Z']].filter(c=>c[0]!=='Z'),.033,.006),0,0,0);
      barrel(-.16,-.84,.0095);T(tube(.012,.012,.08,16),0,.014,-.79);T(rbox(.03,.03,.012,.005),0,.032,-.012);
      T(rbox(.012,.012,.38,.004),.022,.018,-.33);M(rbox(.014,.016,.03,.004),.026,.024,-.08,GC.park,0,0,0,bolt);
      for(const z of[-.32,-.56])T(tube(.021,.021,.012,18),0,.022,z);
      add('brass',rbox(.026,.02,.05,.004),GC.brass,0,.05,-.07,0,0,0,mag);
      guard(-.015);sights(-.012,-.83,.074,GC.park,true);sightY=.074;muzzleZ=-.86;foreZ=-.34;break;
    case'carbine':
      stock(.3,-.44,GC.beech,{w:.042});W(rbox(.03,.022,.18,.01),0,.034,-.22);
      T(prof([['M',.05,.004],['L',.05,.038],['Q',.03,.046,0,.044],['L',-.14,.04],['L',-.14,.006]],.03,.006),0,0,0);
      barrel(-.14,-.62,.0085);T(tube(.017,.017,.012,16),0,.022,-.36);
      T(rbox(.024,.075,.046,.004),0,-.068,-.07,GC.park,0,0,0,mag);T(rbox(.012,.012,.03,.004),.02,.026,-.05,GC.park,0,0,0,bolt);
      guard(-.015);sights(.0,-.6,.066,GC.park,true);sightY=.066;muzzleZ=-.63;foreZ=-.28;break;
    case'thompson':
      W(prof([['M',.36,.03],['L',.365,-.105],['Q',.2,-.07,.08,-.03],['L',.08,.03],['Q',.2,.03,.36,.03]],.044,.01),0,-.005,0);
      M(prof([['M',.085,-.02],['L',.085,.045],['Q',.07,.058,.04,.056],['L',-.2,.05],['L',-.2,-.024],['Q',-.06,-.03,.085,-.02]],.052,.008),0,0,0);
      W(prof([['M',.03,-.02],['Q',.045,-.07,.06,-.11],['L',.025,-.118],['Q',.008,-.07,-.01,-.022]],.034,.009),0,0,0);
      W(prof([['M',-.18,-.022],['L',-.34,-.02],['Q',-.36,-.01,-.34,.006],['L',-.18,.006]],.046,.01),0,0,0);
      M(tube(.012,.012,.28,18),0,.024,-.34);for(let k=0;k<11;k++)M(tube(.0175,.0175,.004,18),0,.024,-.21-k*.012);
      M(rbox(.032,.03,.06,.008),0,.026,-.48);M(new THREE.SphereGeometry(.009,12,8),0,.064,-.02,GC.steel,0,0,0,bolt);
      M(rbox(.028,.17,.046,.005),0,-.11,-.1,GC.blue,.05,0,0,mag);
      guard(.0,-.024);sights(.04,-.47,.074);sightY=.074;muzzleZ=-.51;foreZ=-.26;break;
    case'greasegun':
      M(lathe([[0,.08],[.024,.078],[.031,.06],[.031,-.17],[.024,-.19],[.014,-.2],[0,-.2]],22),0,0,0,GC.park);
      M(tube(.011,.011,.15,16),0,0,-.27,GC.park);
      for(const sx of[-.02,.02])T(bar([[sx,0,.07],[sx,-.005,.2],[sx,-.01,.32]],.0045),0,0,0,GC.park);T(bar([[-.02,-.01,.32],[0,-.02,.33],[.02,-.01,.32]],.005),0,0,0,GC.park);
      T(prof([['M',.07,-.02],['L',.09,-.11],['L',.055,-.115],['L',.035,-.02]],.03,.008),0,0,0,GC.park);
      T(rbox(.026,.2,.044,.005),0,-.12,-.13,GC.park,.12,0,0,mag);T(rbox(.03,.034,.05,.006),0,-.03,-.13,GC.park);
      M(rbox(.01,.01,.05,.003),-.03,.012,-.02,GC.steel,0,0,0,bolt);guard(.03,-.03,.018,GC.park);
      for(const sx of[-.008,.008])T(rbox(.005,.02,.008,.002),sx,.038,.06,GC.park);T(rbox(.004,.016,.006,.0015),0,.033,-.18,GC.park);
      sightY=.046;muzzleZ=-.35;foreZ=-.14;break;
    case'springfield':case'k98':case'k98s':{
      const k=id!=='springfield';const wc=k?GC.dwood:GC.walnut;
      stock(.36,-.6,wc,{drop:k?.006:0});W(rbox(.032,.024,k?.26:.22,.011),0,.036,-.32);
      M(lathe([[0,.06],[.016,.058],[.017,-.15],[.013,-.17],[0,-.17]],20),0,.025,0);
      barrel(-.16,-.82,.0092);M(tube(.018,.018,.014,16),0,.022,-.52);M(tube(.018,.018,.014,16),0,.022,-.25);
      boltHandle(.03,k);M(lathe([[0,.1],[.011,.096],[.011,.04],[0,.03]],14),0,.025,0,GC.steel,0,0,0,bolt);
      guard(-.012);
      if(id==='k98'){for(const sx of[-.008,.008])M(rbox(.005,.016,.03,.002),sx,.05,-.12);M(lathe([[.0,-.795],[.012,-.79],[.012,-.82],[0,-.825]],14),0,.03,0);M(rbox(.003,.016,.006,.001),0,.052,-.81);sightY=.058;}
      else if(id==='springfield'){scope(.085,.13,-.2);sightY=.085;}
      else{scope(.088,.12,-.21);sightY=.088;}
      muzzleZ=-.83;foreZ=-.34;break;}
    case'g43':
      stock(.35,-.52,GC.dwood,{w:.044});W(rbox(.032,.024,.22,.011),0,.036,-.28);
      T(prof([['M',.06,.004],['L',.06,.042],['Q',.04,.05,0,.048],['L',-.18,.044],['L',-.18,.006]],.034,.006),0,0,0,GC.park);
      barrel(-.18,-.74,.0092);T(tube(.008,.008,.3,12),0,.05,-.33,GC.park);T(rbox(.03,.07,.08,.006),0,-.062,-.08,GC.park,0,0,0,mag);
      T(rbox(.012,.012,.03,.004),.022,.03,-.04,GC.park,0,0,0,bolt);guard(-.012,-.03,.022,GC.park);
      sights(-.1,-.72,.06,GC.park);sightY=.06;muzzleZ=-.76;foreZ=-.3;break;
    case'mp40':
      M(lathe([[0,.1],[.022,.098],[.027,.08],[.027,-.2],[.02,-.22],[0,-.22]],22),0,.012,0,GC.blk);M(tube(.011,.011,.14,16),0,.012,-.29,GC.blk);
      T(rbox(.012,.016,.05,.004),0,-.016,-.33,GC.blk);
      add('bake',prof([['M',.14,-.008],['L',-.12,-.008],['L',-.12,-.04],['L',.01,-.04],['Q',.03,-.08,.05,-.12],['L',.09,-.118],['Q',.07,-.07,.08,-.035],['L',.14,-.03]],.036,.008),GC.bake);
      for(const sx of[-.022,.022])T(bar([[sx,-.01,.13],[sx,-.006,.25],[sx,-.002,.34]],.004),0,0,0,GC.blk);T(rbox(.05,.05,.01,.004),0,-.01,.345,GC.blk);
      T(rbox(.03,.05,.04,.005),0,-.06,-.15,GC.blk);T(rbox(.026,.21,.04,.004),0,-.15,-.15,GC.blk,0,0,0,mag);
      M(new THREE.SphereGeometry(.008,12,8),-.032,.02,-.04,GC.steel,0,0,0,bolt);guard(.02,-.04,.018,GC.blk);
      for(const sx of[-.008,.008])T(rbox(.005,.016,.01,.002),sx,.044,.05,GC.blk);T(rbox(.004,.014,.006,.0015),0,.045,-.32,GC.blk);
      sightY=.052;muzzleZ=-.37;foreZ=-.16;break;
    case'mp44':
      W(prof([['M',.34,.03],['L',.345,-.1],['Q',.2,-.07,.07,-.03],['L',.07,.035],['Q',.2,.035,.34,.03]],.042,.01),0,-.008,0,GC.dwood);
      T(prof([['M',.075,-.012],['L',.075,.05],['Q',.06,.064,.03,.064],['L',-.24,.06],['L',-.24,-.012]],.044,.006),0,0,0,GC.park);
      W(prof([['M',.02,-.015],['Q',.04,-.06,.06,-.105],['L',.025,-.113],['Q',.008,-.065,-.012,-.016]],.032,.009),0,0,0,GC.dwood);
      W(rbox(.042,.04,.12,.012),0,.02,-.3,GC.dwood);T(tube(.01,.01,.24,14),0,.058,-.36,GC.park);barrel(-.24,-.55,.0115,.03,GC.park);
      T(prof([['M',-.12,-.01],['L',-.07,-.01],['Q',-.085,-.14,-.15,-.24],['L',-.195,-.215],['Q',-.13,-.13,-.12,-.01]],.026,.006),0,0,0,GC.park,0,0,0,mag);
      T(rbox(.014,.014,.03,.004),-.028,.04,-.08,GC.park,0,0,0,bolt);guard(.0,-.016,.02,GC.park);
      for(const sx of[-.009,.009])T(rbox(.006,.02,.02,.002),sx,.068,.0,GC.park);T(rbox(.004,.022,.006,.0015),0,.061,-.5,GC.park);
      sightY=.074;muzzleZ=-.56;foreZ=-.3;break;
    case'bar':
      stock(.38,-.3,GC.walnut,{w:.048});
      T(prof([['M',.1,-.03],['L',.1,.05],['Q',.08,.064,.05,.062],['L',-.28,.058],['L',-.28,-.03]],.052,.008),0,0,0,GC.park);
      W(rbox(.05,.05,.24,.014),0,.012,-.42);barrel(-.3,-.98,.0115);T(tube(.009,.009,.4,12),0,.004,-.55);
      M(lathe([[.012,-.97],[.017,-.99],[.017,-1.03],[.011,-1.04]],16),0,.028,0,GC.park);
      for(const sx of[-.03,.03])T(bar([[sx,.01,-.88],[sx*1.4,-.01,-.7],[sx*1.6,-.02,-.55]],.004),0,0,0,GC.park);
      T(rbox(.036,.08,.075,.005),0,-.065,-.13,GC.park,0,0,0,mag);T(rbox(.014,.016,.03,.004),-.032,.02,-.12,GC.park,0,0,0,bolt);
      guard(-.02,-.032,.022,GC.park);sights(.03,-.97,.074,GC.park);sightY=.074;muzzleZ=-1.04;foreZ=-.42;break;
    case'm1919':
      T(rbox(.066,.095,.47,.012),0,.02,-.1,GC.park);T(rbox(.07,.03,.2,.008),0,.07,-.06,GC.park);
      M(tube(.027,.027,.48,20),0,.03,-.58,GC.park);for(let k=0;k<9;k++)for(let a=0;a<4;a++){const an=a*Math.PI/2+.4;add('bake',new THREE.CircleGeometry(.006,10),GC.blk,Math.sin(an)*.0275,.03+Math.cos(an)*.0275,-.38-k*.045,0,an,0);}
      M(lathe([[.012,-.82],[.02,-.83],[.02,-.87],[.013,-.88]],16),0,.03,0,GC.park);
      T(prof([['M',.15,.05],['L',.38,.03],['L',.4,-.08],['L',.36,-.09],['Q',.25,-.03,.15,-.03]],.04,.008),0,0,0,GC.park);
      W(prof([['M',.12,-.02],['Q',.14,-.07,.16,-.12],['L',.125,-.128],['Q',.105,-.08,.09,-.025]],.034,.009),0,0,0);
      for(const sx of[-.04,.04])T(bar([[sx,0,-.55],[sx*1.3,-.12,-.6],[sx*1.5,-.24,-.63]],.0045),0,0,0,GC.park);
      add('paint',rbox(.09,.12,.2,.01),GC.od,-.11,-.06,-.12,0,0,0,mag);for(let k=0;k<6;k++)add('brass',tube(.004,.004,.07,8),GC.brass,-.05,.035,-.05-k*.016,0,Math.PI/2,0,mag);
      T(rbox(.016,.02,.04,.005),.046,.05,0,GC.park,0,0,0,bolt);guard(.11,-.03,.02,GC.park);
      for(const sx of[-.01,.01])T(rbox(.006,.03,.012,.002),sx,.09,-.2,GC.park);T(rbox(.004,.03,.01,.0015),0,.083,-.8,GC.park);
      sightY=.098;muzzleZ=-.88;foreZ=-.38;break;
    case'mg34':
      M(lathe([[0,.12],[.026,.115],[.032,.09],[.032,-.3],[0,-.3]],22),0,.03,0,GC.blk);T(rbox(.06,.035,.2,.008),0,.07,-.02,GC.blk);
      M(tube(.031,.031,.42,22),0,.03,-.51,GC.blk);for(let k=0;k<7;k++)for(let a=0;a<6;a++){const an=a*Math.PI/3;add('bake',new THREE.CircleGeometry(.007,10),0x0c0c0c,Math.sin(an)*.0315,.03+Math.cos(an)*.0315,-.34-k*.05,0,an,0);}
      M(lathe([[.012,-.72],[.02,-.73],[.02,-.78],[.012,-.79]],16),0,.03,0,GC.blk);
      add('bake',prof([['M',.12,.04],['L',.38,.02],['Q',.4,-.04,.38,-.1],['L',.34,-.1],['Q',.24,-.04,.12,-.03]],.042,.01),GC.bake);
      add('bake',prof([['M',.06,-.02],['Q',.08,-.07,.1,-.12],['L',.065,-.128],['Q',.045,-.08,.03,-.025]],.034,.009),GC.bake);
      for(const sx of[-.035,.035])T(bar([[sx,0,-.6],[sx*1.3,-.12,-.64],[sx*1.5,-.24,-.67]],.0045),0,0,0,GC.blk);
      add('matte',lathe([[0,.035],[.07,.033],[.072,0],[.07,-.033],[0,-.035]],26),GC.blk,-.09,0,-.05,0,0,Math.PI/2,mag);
      M(rbox(.016,.02,.03,.005),.04,.05,.03,GC.steel,0,0,0,bolt);guard(.06,-.03,.02,GC.blk);
      for(const sx of[-.01,.01])T(rbox(.006,.03,.012,.002),sx,.1,-.06,GC.blk);T(rbox(.004,.04,.01,.0015),0,.08,-.62,GC.blk);
      sightY=.1;muzzleZ=-.79;foreZ=-.36;break;
    case'mg42':
      T(prof([['M',.12,-.02],['L',.12,.065],['Q',.1,.08,.06,.08],['L',-.26,.074],['L',-.26,-.02]],.062,.008),0,0,0,GC.blk);
      T(rbox(.066,.07,.44,.01),0,.03,-.48,GC.blk);for(let k=0;k<5;k++){add('bake',rbox(.068,.03,.05,.012),0x0c0c0c,0,.03,-.32-k*.075);add('bake',rbox(.04,.072,.03,.01),0x0c0c0c,0,.03,-.34-k*.075);}
      M(lathe([[.013,-.7],[.024,-.71],[.024,-.76],[.012,-.77]],16),0,.03,0,GC.blk);
      add('bake',prof([['M',.12,.05],['L',.38,.03],['Q',.4,-.04,.38,-.1],['L',.34,-.1],['Q',.24,-.04,.12,-.03]],.044,.01),GC.bake);
      add('bake',prof([['M',.06,-.02],['Q',.08,-.07,.1,-.12],['L',.065,-.128],['Q',.045,-.08,.03,-.025]],.034,.009),GC.bake);
      for(const sx of[-.035,.035])T(bar([[sx,0,-.62],[sx*1.3,-.12,-.66],[sx*1.5,-.24,-.69]],.0045),0,0,0,GC.blk);
      for(let k=0;k<9;k++)add('brass',tube(.004,.004,.06,8),GC.brass,-.04-k*.01,.035-k*.02,-.05,0,Math.PI/2,.3,mag);
      M(rbox(.016,.02,.03,.005),.04,.05,.03,GC.steel,0,0,0,bolt);guard(.06,-.03,.02,GC.blk);
      for(const sx of[-.01,.01])T(rbox(.006,.03,.012,.002),sx,.095,-.08,GC.blk);T(rbox(.004,.04,.01,.0015),0,.075,-.66,GC.blk);
      sightY=.095;muzzleZ=-.77;foreZ=-.36;break;
    case'colt':
      M(prof([['M',.03,.004],['L',.03,.03],['Q',.025,.036,.015,.036],['L',-.18,.034],['Q',-.19,.034,-.19,.026],['L',-.19,.004]],.026,.005),0,0,0,GC.blue,0,0,0,bolt);
      M(prof([['M',.02,-.012],['L',.02,.004],['L',-.16,.004],['L',-.16,-.006],['L',-.02,-.014]],.024,.004),0,0,0,GC.blue);
      W(prof([['M',.035,-.0],['Q',.05,-.05,.06,-.1],['L',.025,-.108],['Q',.008,-.06,.0,-.012]],.03,.006),0,0,0,GC.walnut);
      M(rbox(.025,.07,.035,.006),0,-.05,.035,GC.blue,-.25);guard(-.02,-.012,.016);M(prof([['M',.035,.02],['L',.05,.04],['L',.04,.044],['L',.03,.026]],.008,.002),0,0,0,GC.blue);
      M(rbox(.026,.09,.032,.004),0,-.055,.035,GC.blue,-.2,0,0,mag);
      for(const sx of[-.006,.006])M(rbox(.004,.008,.006,.0015),sx,.04,.02,GC.blue);M(rbox(.003,.008,.004,.001),0,.04,-.18,GC.blue);
      sightY=.044;muzzleZ=-.19;foreZ=-.02;break;
    case'luger':
      M(tube(.009,.009,.12,16),0,.03,-.12,GC.blue);M(prof([['M',.04,.004],['L',.04,.034],['L',-.07,.034],['L',-.07,.004]],.024,.004),0,0,0,GC.blue);
      M(lathe([[0,.06],[.011,.058],[.011,.03],[0,.028]],14),.0,.044,0,GC.blue,0,0,0,bolt);for(const sx of[-.014,.014])M(new THREE.SphereGeometry(.008,12,8),sx,.046,.05,GC.steel,0,0,0,bolt);
      add('bake',prof([['M',.045,.004],['Q',.075,-.04,.09,-.095],['L',.05,-.105],['Q',.035,-.05,.0,-.006]],.03,.007),GC.bake);
      guard(-.02,-.008,.015);M(rbox(.026,.08,.03,.004),0,-.05,.045,GC.blue,-.6,0,0,mag);
      M(rbox(.003,.01,.004,.001),0,.042,-.17,GC.blue);for(const sx of[-.005,.005])M(rbox(.003,.008,.004,.001),sx,.05,.03,GC.blue);
      sightY=.05;muzzleZ=-.18;foreZ=-.02;break;
    case'knife':
      M(prof([['M',0,-.012],['L',-.13,-.012],['Q',-.17,-.008,-.195,.012],['L',-.12,.012],['L',0,.012]],.0045,.0018),0,0,-.03,GC.steel);
      M(rbox(.012,.05,.012,.003),0,0,-.025,GC.park);add('bake',lathe([[0,.1],[.013,.096],[.015,.08],[.013,.06],[.015,.04],[.013,.02],[.015,0],[.013,-.015],[0,-.02]],16),GC.leather);
      sightY=0;muzzleZ=-.23;break;
    case'spade':
      W(lathe([[0,.18],[.016,.175],[.016,-.26],[0,-.27]],16),0,0,0,GC.beech);T(tube(.02,.02,.05,16),0,0,-.28,GC.park);
      T(prof([['M',-.3,-.006],['L',-.3,.006],['L',-.46,.006],['Q',-.5,0,-.46,-.006]],.15,.003),0,0,0,GC.park);
      sightY=0;muzzleZ=-.5;break;
    case'mk2':{
      const g=new THREE.SphereGeometry(.03,32,24);const pa=g.attributes.position;
      for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);const th=Math.atan2(z,x),ph=Math.acos(clamp(y/.03,-1,1));
        const b=Math.max(0,Math.sin(th*4))*.5+Math.max(0,Math.sin(ph*6))*.5;const k=1+.12*Math.pow(Math.abs(Math.sin(th*4)*Math.sin(ph*6)),.6);pa.setXYZ(i,x*k,y*k*1.22,z*k);}
      g.computeVertexNormals();add('paint',g,GC.od);
      T(lathe([[0,0],[.011,0],[.011,-.012],[.008,-.026],[0,-.028]],16),0,.036,0,GC.park,-Math.PI/2);
      T(prof([['M',.0,.045],['Q',.012,.03,.02,-.02],['L',.026,-.02],['Q',.018,.03,.006,.05]],.012,.002),0,0,0,GC.park);
      M(new THREE.TorusGeometry(.012,.0018,6,16),-.016,.048,0,GC.steel,0,Math.PI/2,0);
      sightY=0;muzzleZ=0;break;}
    case'stick':
      W(lathe([[0,.29],[.016,.285],[.0145,.02],[0,.018]],18),0,0,0,GC.beech);T(lathe([[0,.3],[.017,.298],[.017,.282],[0,.28]],16),0,0,0,GC.park);
      add('paint',lathe([[0,.03],[.02,.03],[.034,.02],[.036,0],[.036,-.07],[.03,-.085],[0,-.09]],24),GC.fg);
      sightY=0;muzzleZ=0;break;
  }
  return{p,mag,bolt,sightY,muzzleZ,foreZ};
}
// a smooth limb (tapered tube with a rounded end) between a and b
function limb(a,b,w,col,w2){
  const d=b.clone().sub(a);const len=d.length();const g=new THREE.CylinderGeometry((w2||w*.88)/2,w/2,len,12,1);
  const q=new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),d.clone().normalize());
  const m=new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),q,new V3(1,1,1));
  return{geo:g,col:C(col),m,kind:'cloth'};
}
// a hand: palm, fingers curled round the grip, and a thumb
function handParts(at,skin,dir=1){
  const s=C(skin),out=[];const pm=(geo,x,y,z,sx=1,sy=1,sz=1,rx=0)=>out.push({geo,col:s,m:compose(at.x+x,at.y+y,at.z+z,rx,0,0,sx,sy,sz),kind:'skin'});
  const sp=new THREE.SphereGeometry(1,16,12);
  pm(sp,.006*dir,-.004,.012,.03,.042,.05);
  for(let k=0;k<4;k++)pm(sp,-.014*dir,-.026+k*.0,.0-k*.016+.02,.012,.012,.009);
  pm(sp,.02*dir,.012,-.006,.01,.01,.024,-.4);
  return out;
}
const WM_CACHE={};
function weaponModel(id){return WM_CACHE[id]||(WM_CACHE[id]=WM(id));}
const TPW_CACHE={};
function weaponGeoTP(id){
  if(TPW_CACHE[id])return TPW_CACHE[id];
  const m=weaponModel(id);const rot=new THREE.Matrix4().makeRotationY(Math.PI);
  // no wood texture at this distance: bake the walnut colour in
  const woodC=C(0x9a6640);
  const parts=[...m.p,...m.mag,...m.bolt].map(q=>({geo:q.geo,col:q.kind==='wood'?q.col.clone().multiply(woodC):q.col,m:q.m.clone().premultiply(rot)}));
  return TPW_CACHE[id]=mergeGeos(parts);
}
// first-person weapon: one mesh per material, plus the magazine and bolt as their own meshes
function kindMeshes(parts){
  const g=new THREE.Group();const by={};for(const q of parts)(by[q.kind||'metal']=by[q.kind||'metal']||[]).push(q);
  for(const k in by){const me=new THREE.Mesh(mergeGeos(by[k]),WMAT[k]||WMAT.metal);g.add(me);}return g;
}
function buildVM(id,team){
  if(VM.gun){VM.g.remove(VM.gun);}
  VM.id=id;const W=WEAPONS[id];const m=weaponModel(id);
  const root=new THREE.Group();
  root.add(kindMeshes(m.p));
  VM.mag=m.mag.length?kindMeshes(m.mag):null;if(VM.mag)root.add(VM.mag);
  VM.bolt=m.bolt.length?kindMeshes(m.bolt):null;if(VM.bolt)root.add(VM.bolt);
  // sleeves and hands
  const sleeve=team===0?0x8a7f5e:0x646a5a,skin=0xd8a580,cuff=team===0?0x776d4e:0x555b4c;
  const parts=[];
  const one=W.type==='nade'||W.type==='melee'||W.pistol;
  const rh=one?new V3(0,-.03,.03):new V3(0,-.075,.045),lh=new V3(0,-.035,m.foreZ);
  const re=new V3(.15,-.26,.42),le=new V3(-.22,-.26,.24);
  const rw=rh.clone().add(new V3(.008,-.012,.06)),lw=lh.clone().add(new V3(-.018,-.03,.07));
  parts.push(limb(re,rw,.088,sleeve,.07),{geo:tube(.04,.04,.03,16),col:C(cuff),m:new THREE.Matrix4().lookAt(rw,re,new V3(0,1,0)).setPosition(rw.clone().lerp(re,.08)),kind:'cloth'});
  parts.push(...handParts(rh,skin,1));
  if(!one){parts.push(limb(le,lw,.088,sleeve,.07),{geo:tube(.04,.04,.03,16),col:C(cuff),m:new THREE.Matrix4().lookAt(lw,le,new V3(0,1,0)).setPosition(lw.clone().lerp(le,.08)),kind:'cloth'});parts.push(...handParts(lh,skin,-1));}
  root.add(kindMeshes(parts));
  VM.g.add(root);VM.gun=root;VM.sightY=m.sightY;VM.muzzleZ=m.muzzleZ;
}
