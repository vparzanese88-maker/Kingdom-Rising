'use strict';
/* ================= Multiplayer =================
   One player hosts: their page runs the whole battle (bots, flags, damage) and streams it to everyone.
   All traffic goes through the public relay (relay.js), so it works behind home routers and firewalls.
   Hosted games are listed in a public lobby, so friends can find them under "Find online games",
   or join with the 4-letter room code or the invite link.
   Each friend takes over a bot's slot on their side; when they leave, a bot takes the slot back.
   Clients move their own soldier locally and tell the host where they are; the host checks every
   shot, grenade and knife blow and sends back what happened.                                      */
// timeouts are generous: free relays sometimes drop a connection for a few seconds and it reconnects
const NET_VER=4,SNAP_HZ=12,ST_HZ=12,MAX_HUMANS=12,TIMEOUT=35000,WARN_T=5000;
Object.assign(Net,{conns:[],code:'',myId:-1,snapT:0,stT:0,sbT:0,annT:0,rosT:0,nadeMesh:{},pendingRoster:null,pendingJoin:false,welcome:null,status:'',games:{},lastSnapQ:0,lastHost:0});
const STANCE=['stand','crouch','prone'],SLOTS=['primary','pistol','melee','nade'];
const q=new URLSearchParams(location.search);
const gTopic=()=>RELAY_NS+'g/'+Net.code,lobbyTopic=c=>RELAY_NS+'lobby/'+c;
function mpStatus(t,bad){Net.status=t;for(const id of['mpStatus','brStatus']){const el=$(id);if(el){el.textContent=t;el.style.color=bad?'#e07a5f':'';}}}
function inviteLink(){const u=new URL(location.href);u.search='';if(q.get('relay'))u.searchParams.set('relay',q.get('relay'));u.searchParams.set('join',Net.code);return u.toString();}
function newCode(){const s='ABCDEFGHJKLMNPQRSTUVWXYZ';let c='';for(let i=0;i<4;i++)c+=s[Math.random()*s.length|0];return c;}
function playerName(){return(String($('pname').value||SET.name||'').trim().replace(/[<>&"]/g,'').slice(0,16))||'Soldier';}
const now=()=>performance.now();

/* ---------------- host ---------------- */
function netHost(){
  Object.assign(Net,{on:true,host:true,client:false,conns:[],ev:[],code:newCode(),annT:0});
  Relay.connect({topic:lobbyTopic(Net.code),payload:'',retain:true});
  Relay.sub(gTopic()+'/u',m=>{if(m)hostRecv(m);});
  Relay.onstate=up=>{if(up){announce();if(Net.relayLost){Net.relayLost=false;hint('Reconnected to the online relay',2.5);}}else if(!Relay.connected()){Net.relayLost=true;hint('Lost the online relay, reconnecting… Friends stay in the game for 35 seconds.',4);}};
  center('ROOM '+Net.code,'Your game is listed under Find online games. Press Esc for the invite link.',6);
  updateInvite();
}
function mkConn(id){return{id,open:true,name:'Soldier',unit:null,last:now(),send(m){Relay.pub(gTopic()+'/c/'+id,m);},close(){}};}
function hostRecv(m){
  let c=Net.conns.find(x=>x.id===m.i);
  if(m.t==='bye'){if(c)hostDrop(c);return;}
  if(!c){if(m.t!=='hello')return;
    if(Net.conns.length>=MAX_HUMANS-1){mkConn(m.i).send({t:'full',why:'The room is full.'});return;}
    c=mkConn(m.i);Net.conns.push(c);}
  c.last=now();
  try{hostData(c,m);}catch(e){console.warn('net',e);}
}
function announce(){
  if(!Net.host)return;
  Relay.pub(lobbyTopic(Net.code),{r:1,code:Net.code,host:SET.name||'Soldier',n:1+Net.conns.filter(c=>c.unit).length,max:MAX_HUMANS,round:G.round,size:SET.size,ts:Date.now(),v:NET_VER},true);
}
function rosterMsg(){return{t:'roster',r:UNITS.map(u=>[u.id,u.team,u.name,(u.nextCls||u.cls).id,u.variant,u.human||u.isPlayer?1:0])};}
function hostData(c,m){
  const u=c.unit;
  switch(m.t){
    case'hello':
      if(m.v!==NET_VER){c.send({t:'full',why:'Your friend has a different version of the game. Both of you reload the page.'});return;}
      if(c.unit){c.send(Object.assign(stateMsg(),{t:'you',id:c.unit.id}));return;}
      c.name=String(m.name||'Soldier').replace(/[<>&"]/g,'').slice(0,16);
      c.send(Object.assign(rosterMsg(),{t:'welcome',size:SET.size,diff:SET.diff,host:PL.u?PL.u.name:'Host'}));break;
    case'join':{
      if(c.unit){c.send(Object.assign(stateMsg(),{t:'you',id:c.unit.id}));return;}let team=m.team;if(team!==0&&team!==1)team=humanCount(0)<=humanCount(1)?0:1;
      let bot=pickBot(team);if(!bot){team=1-team;bot=pickBot(team);}
      if(!bot){c.send({t:'full',why:'Both teams are full of players.'});return;}
      const cls=clsById(team,m.cls)||CLASSES[team][0];
      if(cls.limit&&classCount(team,cls.id,bot)>=classLimit(cls)){const other=UNITS.find(x=>x.team===team&&x.brain&&x!==bot&&(x.nextCls||x.cls).id===cls.id);if(other)other.nextCls=CLASSES[team][0];}
      // take over the bot's slot: it leaves quietly and the player deploys with the next wave
      if(bot.alive&&bot.model){scene.remove(bot.model.root);bot.model=null;}
      bot.alive=false;bot.deadAt=GAME.time-10;bot.brain=null;bot.remote=c;bot.human=true;bot.botName=bot.name;bot.name=c.name;bot.nextCls=cls;bot.kills=bot.deaths=bot.caps=bot.score=0;
      c.unit=bot;
      c.send(Object.assign(stateMsg(),{t:'you',id:bot.id}));
      broadcast(rosterMsg());
      feedMsg(`${c.name} joined the ${TEAM_NAME[team]}`,team);hint(`${c.name} joined the ${TEAM_NAME[team]}`,3);
      if(G.mode==='intro'||G.mode==='freeze')spawnUnit(bot,true);
      break;}
    case'st':if(u&&u.alive){u.net={x:m.p[0],y:m.p[1],z:m.p[2],yaw:m.y,pitch:m.pi};u.stance=STANCE[m.s]||'stand';
      const sl=SLOTS[m.w]||'primary';if(u.weps[sl])u.cur=sl;u.deployed=!!m.d;u.firing=!!m.f;}break;
    case'fire':{if(!u||!u.alive)return;const W=WEAPONS[m.w];if(!W||W.type==='melee'||W.type==='nade')return;
      const o=new V3(...m.o),d=new V3(...m.d).normalize();
      fireBullet(u,o,d,W,m.w,!!m.tr);muzzleFX(o,d,!!W.mg);gunSound(u,W,o);u.lastShot=GAME.time;if(u.model)u.model.kick=1;break;}
    case'melee':if(u&&u.alive)meleeAttack(u,new V3(...m.o),new V3(...m.d).normalize(),WEAPONS[MELEE[u.team]]);break;
    case'nade':{if(!u||!u.alive&&m.fuse>0)return;const o=new V3(...m.o),v=new V3(...m.v);
      if(m.nid){const n=NADES.find(x=>x.nid===m.nid&&x.held===u);if(n){n.held=null;n.p.copy(o);n.v.copy(v);n.rest=false;n.owner=u;}}
      else if(u.weps.nade.count>0||m.fuse<=0){if(m.fuse>0)u.weps.nade.count--;throwNade(u,o,v,clamp(+m.fuse||0,0,5),NADE[u.team]);}
      break;}
    case'pick':{if(!u||!u.alive)return;const n=NADES.find(x=>!x.held&&Math.hypot(x.p.x-u.pos.x,x.p.y-u.pos.y-.3,x.p.z-u.pos.z)<2.4);
      if(n){n.held=u;n.owner=u;c.send({t:'picked',nid:n.nid,fuse:n.fuse,id:n.id});}break;}
    case'cls':{if(!u)return;const cls=clsById(u.team,m.id);if(cls){u.nextCls=cls;if(G.mode==='freeze'&&u.alive)spawnUnit(u,true);broadcast(rosterMsg());}break;}
    case'fall':if(u&&u.alive)hurt(u,clamp(+m.dmg||0,0,200),null,'fall','limb',null);break;
    case'band':if(u)startBandage(u);break;
  }
}
function humanCount(t){return UNITS.filter(u=>u.team===t&&(u.human||u.isPlayer)).length;}
function pickBot(t){const bots=UNITS.filter(u=>u.team===t&&u.brain&&!u.isPlayer);return bots.find(u=>!u.alive)||bots[bots.length-1]||null;}
function hostDrop(c){
  const i=Net.conns.indexOf(c);if(i<0)return;Net.conns.splice(i,1);
  const u=c.unit;if(!u)return;c.unit=null;
  feedMsg(`${u.name} left`,u.team);hint(`${u.name} left the game. A bot takes their place.`,3);
  u.remote=null;u.human=false;u.name=u.botName||pick(NAMES[u.team]);new Brain(u);
  if(u.alive)u.brain.chooseGoal();
  broadcast(rosterMsg());
}
function broadcast(m){if(Net.host)Relay.pub(gTopic()+'/h',m);}
const R=v=>Math.round(v*100)/100,R5=v=>Math.round(v*20)/20;
function stateMsg(){
  return{t:'s',m:G.mode,it:R(G.introT),fz:R(G.freezeT||0),tl:Math.round(G.timeLeft),w:[R(G.waveT[0]),R(G.waveT[1])],r:G.round,sc:G.score,
    f:G.flags.map(f=>[f.owner,R(f.prog),f.capTeam]),
    u:UNITS.map(u=>!u.alive?[u.id,0]:[u.id,1,R5(u.pos.x),R5(u.pos.y),R5(u.pos.z),R(u.yaw),R(u.pitch),STANCE.indexOf(u.stance),SLOTS.indexOf(u.cur),u.deployed?1:0,(u.cls||{}).id,Math.max(0,Math.ceil(u.hp)),u.bleed?1:0]),
    n:NADES.map(n=>[n.nid,R(n.p.x),R(n.p.y),R(n.p.z),n.id==='stick'?1:0,n.held?n.held.id:-1])};
}
function netTick(dt){
  if(Net.host){
    Net.annT-=dt;if(Net.annT<=0){Net.annT=3;announce();const t=now();for(const c of Net.conns.slice())if(t-c.last>TIMEOUT)hostDrop(c);}
    if(!Net.conns.length){Net.ev=[];return;}
    Net.snapT-=dt;if(Net.snapT<=0){Net.snapT=1/SNAP_HZ;const m=stateMsg();if(Net.ev.length){m.e=Net.ev;Net.ev=[];}broadcast(m);}
    Net.sbT-=dt;if(Net.sbT<=0){Net.sbT=2;broadcast({t:'sb',s:UNITS.map(u=>[u.id,u.kills,u.deaths,u.score])});}
    Net.rosT-=dt;if(Net.rosT<=0){Net.rosT=6;broadcast(rosterMsg());}
  }else if(Net.client&&PL.u){
    const quiet=now()-Net.lastHost;
    if(quiet>TIMEOUT){clientFail('Lost the connection to the host.');return;}
    if(quiet>WARN_T){if(!Net.warned){Net.warned=true;center('CONNECTION TROUBLE','Waiting for the host… ('+(Relay.count()?'relay OK':'reconnecting to the relay')+')',0);}}
    else if(Net.warned){Net.warned=false;$('center').innerHTML='';hint('Back in contact with the host',2);}
    Net.stT-=dt;if(Net.stT<=0){const u=PL.u;
      if(u.alive){Net.stT=1/ST_HZ;Net.send({t:'st',p:[R(u.pos.x),R(u.pos.y),R(u.pos.z)],y:R(u.yaw),pi:R(u.pitch),s:STANCE.indexOf(u.stance),w:SLOTS.indexOf(u.cur),d:u.deployed?1:0,f:PL.fireHeld?1:0});}
      else{Net.stT=2;Net.send({t:'hb'});}}
  }
}

/* ---------------- client ---------------- */
function netJoin(code){
  code=String(code||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
  if(code.length!==4){mpStatus('Room codes are 4 letters.',true);return;}
  initAudio();SET.name=playerName();saveSettings();
  netLeave(true);
  mpStatus('Connecting to room '+code+'…');
  Object.assign(Net,{on:false,host:false,client:false,code,lastSnapQ:0,joining:true});
  Relay.connect({topic:gTopic()+'/u',payload:JSON.stringify({i:Relay.me,q:0,t:'bye'}),retain:false});
  const rx=m=>{if(!m)return;Net.lastHost=now();
    if(m.t==='s'&&m.q){if(m.q<=Net.lastSnapQ){if(m.e&&Net.client)clientData({t:'e',e:m.e});return;}Net.lastSnapQ=m.q;}
    try{if(m.t==='s'&&m.e&&Net.client)clientData({t:'e',e:m.e});clientData(m);}catch(e){console.warn('net',e);}};
  Relay.sub(gTopic()+'/h',rx);Relay.sub(gTopic()+'/c/'+Relay.me,rx);
  const t0=now();clearInterval(Net.helloT);
  Net.helloT=setInterval(()=>{
    if(!Net.joining){clearInterval(Net.helloT);return;}
    if(Net.pendingJoin&&Net.joinCls&&Net.sentJoin)Net.send({t:'join',team:Net.joinTeam,cls:Net.joinCls.id});
    else if(!Net.welcome)Net.send({t:'hello',v:NET_VER,name:SET.name});
    if(!Net.welcome&&now()-t0>15000){clearInterval(Net.helloT);clientFail(Relay.connected()?'No answer from room '+code+'. Check the code, and that your friend is still hosting.':'Could not reach the online relays. Check your internet connection.');}
  },900);
}
Net.send=function(m){if(Net.code)Relay.pub(gTopic()+'/u',m);};
function clientFail(t){const inGame=Net.client;Net.joining=false;netLeave(true);if(inGame)quitToMenu();showScreen('browser');mpStatus(t,true);}
function clientData(m){
  switch(m.t){
    case'full':clientFail(m.why||'Could not join.');break;
    case'end':if(Net.client||Net.joining)clientFail('The host ended the game.');break;
    case'welcome':{
      if(Net.welcome)return;
      Net.pendingRoster=m.r;Net.pendingJoin=true;Net.welcome=m;mpStatus(`Connected to ${m.host}'s game. Pick your class.`);
      openClasses(SET.team,false,'join');break;}
    case'you':if(!Net.client&&Net.pendingJoin&&Net.sentJoin)clientBegin(m.id,m);break;
    case'roster':applyRoster(m.r);break;
    case's':if(Net.client)applySnap(m);break;
    case'e':if(Net.client){Net.applying=true;try{for(const e of m.e)applyEvent(e);}finally{Net.applying=false;}}break;
    case'sb':for(const[id,k,d,s]of m.s){const u=unitById(id);if(u){u.kills=k;u.deaths=d;u.score=s;}}break;
    case'picked':{const u=PL.u;if(!u||!u.alive||PL.nadeHold)return;PL.nadeHold={fuse:m.fuse,id:m.id,nid:m.nid,own:true};PL.prevSlot=u.cur;u.cur='nade';buildVM(m.id,u.team);play('clink',{vol:.5});hint('Throw it back! Left-click');break;}
  }
}
function unitById(id){for(const u of UNITS)if(u.id===id)return u;return null;}
function applyRoster(r){
  const keep=new Set();
  for(const[id,team,name,clsId,variant,human]of r){
    keep.add(id);let u=unitById(id);
    if(!u){u=new Unit(team,id===Net.myId,name);u.id=id;u.variant=variant;u.cls=clsById(team,clsId);giveLoadout(u);UNITS.push(u);}
    u.name=id===Net.myId?(SET.name||'You'):name;u.human=!!human;u.variant=variant;
    if(!u.alive||id!==Net.myId){const c=clsById(team,clsId);if(c&&c!==u.cls){if(u.alive)u.nextCls=c;else u.cls=c;}}
  }
  for(let i=UNITS.length-1;i>=0;i--)if(!keep.has(UNITS[i].id)){if(UNITS[i].model)scene.remove(UNITS[i].model.root);UNITS.splice(i,1);}
}
function clientBegin(id,snap){
  Net.myId=id;Net.pendingJoin=false;Net.pendingRoster=null;Net.joining=false;Net.sentJoin=false;
  Object.assign(Net,{on:true,client:true,host:false});
  // clear the menu battle and build the host's armies
  for(const u of UNITS)if(u.model)scene.remove(u.model.root);UNITS.length=0;for(const m of CORPSES)removeCorpse(m);CORPSES.length=0;clearRagdolls();
  clearNades();clearDecals();
  G.demo=false;G.paused=false;
  applyRoster(Net.welcome.r);
  let me=unitById(id);
  if(!me){me=new Unit(Net.joinTeam,true,SET.name);me.id=id;me.cls=Net.joinCls;UNITS.push(me);}
  me.isPlayer=true;me.team=Net.joinTeam;me.cls=Net.joinCls;me.name=SET.name||'You';giveLoadout(me);me.alive=false;me.deadAt=GAME.time;
  PL.u=me;PL.deathT=3;PL.killer=null;PL.deathYaw=me.team?0:Math.PI;
  const s=me.team?SPAWNS.axis:SPAWNS.alliesFwd;me.pos.set((s.x0+s.x1)/2,0,me.team?s.z0:110);me.pos.y=H(me.pos.x,me.pos.z);
  G.round=snap.r;G.score=snap.sc.slice();G.mode=snap.m;G.introT=snap.it;
  resetRoundVisuals();
  if(G.mode!=='intro')for(const b of BOATS){b.g.position.copy(b.home);b.rp.rotation.x=-1.62;}
  showScreen(null);$('hud').hidden=false;$('roundend').hidden=true;
  buildFlagHUD();applySnap(snap);
  center('JOINING','You deploy with the next wave',4);
  mpStatus('');requestLock();canvas.focus();updateInvite();
  if(SET.music&&G.mode==='play')playMusic('tension');else stopMusic(1);
}
const STEPS={water:'stWater',sand:'stSand',hard:'stHard',wood:'stWood',grass:'stGrass'};
function applySnap(m){
  G.mode=m.m;G.timeLeft=m.tl;G.waveT=m.w;G.round=m.r;G.score=m.sc;
  if(G.mode==='intro'&&Math.abs(G.introT-m.it)>.5)G.introT=m.it;
  if(G.mode==='freeze'&&Math.abs((G.freezeT||0)-m.fz)>.5)G.freezeT=m.fz;
  m.f.forEach(([o,p,c],i)=>{const f=G.flags[i];if(!f)return;if(f.owner!==o){f.owner=o;setFlagTex(f,o);}f.prog=p;f.capTeam=c;});
  for(const[id,alive,x,y,z,yaw,pitch,st,sl,dep,cls,hp,bl]of m.u){
    const u=unitById(id);if(!u)continue;
    if(u.isPlayer&&u.alive&&alive){if(hp!=null)u.hp=hp;if(!(u.bandT>0))u.bleed=!!bl;}
    if(u.isPlayer){if(!alive&&u.alive){Net.applying=true;killUnit(u,null,'arty','chest',null);Net.applying=false;}continue;}
    if(alive&&!u.alive)spawnUnit(u,false,{x,y,z,yaw,b:-1,cls});
    else if(!alive&&u.alive){Net.applying=true;killUnit(u,null,'?','chest',null);Net.applying=false;}
    if(!u.alive)continue;
    u.bleed=!!bl;
    u.net={x,y,z,yaw,pitch};u.stance=STANCE[st]||'stand';const s=SLOTS[sl];if(u.weps&&u.weps[s])u.cur=s;u.deployed=!!dep;
  }
  // grenades in flight
  const seen=new Set();
  for(const[nid,x,y,z,stick,held]of m.n){seen.add(nid);let me=Net.nadeMesh[nid];if(!me){me=Net.nadeMesh[nid]={mesh:nadeMesh(stick?'stick':'mk2'),p:new V3(x,y,z)};me.mesh.position.set(x,y,z);}
    me.p.set(x,y,z);me.held=held;}
  for(const k in Net.nadeMesh)if(!seen.has(+k)){scene.remove(Net.nadeMesh[k].mesh);delete Net.nadeMesh[k];}
}
function netNades(dt){
  for(const k in Net.nadeMesh){const n=Net.nadeMesh[k];n.mesh.position.lerp(n.p,1-Math.exp(-dt*20));n.mesh.rotation.x+=dt*6;n.mesh.visible=!(PL.u&&n.held===PL.u.id);}
  // the client's own cooked grenade still runs in updatePlayer
}
function clearNetNades(){for(const k in Net.nadeMesh){scene.remove(Net.nadeMesh[k].mesh);delete Net.nadeMesh[k];}}
function applyEvent(e){
  const k=e[0];
  if(k==='shot'){const[,sid,ox,oy,oz,dx,dy,dz,wid,tr]=e;netShot(sid,new V3(ox,oy,oz),new V3(dx,dy,dz).normalize(),wid,tr);}
  else if(k==='boom')explosion(new V3(e[1],e[2],e[3]),e[4],null,'arty');
  else if(k==='whis')play('whistle',{pos:new V3(e[1],e[2],e[3]),vol:.75,travel:false,ref:25});
  else if(k==='kill'){const v=unitById(e[1]);if(v&&v.alive){const kk=unitById(e[2]);killUnit(v,kk,e[3],e[4],new V3(e[5],0,e[6]));}}
  else if(k==='hurt'){if(e[1]!==Net.myId)return;const u=PL.u;if(!u||!u.alive)return;u.hp=e[3];u.lastHurt=GAME.time;u.slowT=.6;const a=unitById(e[4]);playerHurt(e[2],a,e[5],new V3(e[6],0,e[7]));
    if(e[5]==='head')play('helmet',{vol:.6});if(e[2]>=8&&u.hp>0){if(!u.bleed)hint('You are bleeding! Press H to bandage',3);u.bleed=true;}}
  else if(k==='hp'){if(e[1]===Net.myId&&PL.u)PL.u.hp=e[2];}
  else if(k==='hm'){if(e[1]===Net.myId)hitMarker(!!e[2],!!e[3]);}
  else if(k==='sp'){const[,id,x,y,z,yaw,cls,b,lx,lz]=e;const u=unitById(id);if(u)spawnUnit(u,false,{x,y,z,yaw,cls,b,lx,lz});}
  else if(k==='rs'){G.round=e[1];resetRoundVisuals();clearNetNades();G.mode='freeze';G.freezeT=FREEZE_T;G.introT=INTRO_T;
    for(const u of UNITS){if(u.model&&!CORPSES.includes(u.model))scene.remove(u.model.root);u.model=null;u.alive=false;}introCue();}
  else if(k==='ie')endIntro();
  else if(k==='fz'){G.mode='intro';G.introT=INTRO_T;}
  else if(k==='re')endRound(e[1],e[2]);
  else if(k==='cap'){const f=G.flags[e[1]];if(f)captureFlag(f,e[2],(e[3]||[]).map(unitById).filter(Boolean));}
  else if(k==='shout'){const u=unitById(e[1]);if(u)shout(u,e[2]);}
}
// another soldier's shot, replayed for the eyes and ears
function netShot(sid,o,d,wid,tr){
  if(sid===Net.myId)return;
  const u=unitById(sid);const W=WEAPONS[wid];if(!W||!u)return;
  u.lastShot=GAME.time;if(u.model)u.model.kick=1;gunSound(u,W,o);
  muzzleFX(o,d,!!W.mg);if(o.distanceTo(camera.position)<60)flashAt(o,1.5,.05,8);
  fireBullet(u,o,d,W,wid,!!tr,true);
}
// smooth another soldier toward where the network says they are
function netFollow(u,dt){
  const n=u.net;if(!n||dt<=0)return;
  const ox=u.pos.x,oz=u.pos.z;const dx=n.x-u.pos.x,dy=n.y-u.pos.y,dz=n.z-u.pos.z;
  if(dx*dx+dz*dz>64)u.pos.set(n.x,n.y,n.z);else{const k=1-Math.exp(-dt*12);u.pos.x+=dx*k;u.pos.y+=dy*k;u.pos.z+=dz*k;}
  u.vel.x=lerp(u.vel.x,(u.pos.x-ox)/dt,.3);u.vel.z=lerp(u.vel.z,(u.pos.z-oz)/dt,.3);
  u.yaw+=angDiff(u.yaw,n.yaw)*Math.min(1,dt*15);u.pitch=lerp(u.pitch,n.pitch,Math.min(1,dt*15));
  const sp=Math.hypot(u.vel.x,u.vel.z);
  if(sp>1.5&&u.stance!=='prone'){u.stepD=(u.stepD||0)+sp*dt;if(u.stepD>2.1){u.stepD=0;const d=u.pos.distanceTo(camera.position);if(d<26)play(STEPS[surfaceAt(u.pos.x,u.pos.z,u.pos.y)]||'stGrass',{pos:u.pos.clone(),vol:.32*Math.min(1,sp/5),maxD:26,ref:3});}}
}
function netLeave(quiet){
  clearInterval(Net.helloT);
  if(Net.host&&Net.code){broadcast({t:'end'});Relay.clearRetained(lobbyTopic(Net.code));}
  else if((Net.client||Net.joining)&&Net.code)Net.send({t:'bye'});
  const R0=Relay;setTimeout(()=>R0.conns.length&&!Net.on&&!Net.joining&&!Net.browsing&&R0.close(),300);
  clearNetNades();
  Object.assign(Net,{on:false,host:false,client:false,conns:[],ev:[],pendingJoin:false,pendingRoster:null,myId:-1,welcome:null,joining:false,sentJoin:false});
  updateInvite();
}
function updateInvite(){
  const box=$('invite');if(!box)return;
  box.hidden=!Net.on;
  if(Net.host&&Net.code){$('invLink').value=inviteLink();$('mpPlayers').textContent=`Room ${Net.code} · ${Net.conns.filter(c=>c.unit).length+1} players · online through ${Relay.count()} of ${Relay.brokers.length} relays. Friends can find your game under Find online games, or use this link.`;}
  else if(Net.client){$('invLink').value=inviteLink();$('mpPlayers').textContent=`In room ${Net.code}. Invite more friends with this link.`;}
}
/* ---------------- server browser ---------------- */
function netBrowse(){
  if(Net.on)return;
  Net.browsing=true;Net.games={};renderGames();
  Relay.connect(null);
  Relay.sub(RELAY_NS+'lobby/+',(m,topic)=>{const code=topic.split('/').pop();if(!m||!m.code)delete Net.games[code];else if(m.v===NET_VER)Net.games[code]=m;renderGames();});
  clearInterval(Net.brT);Net.brT=setInterval(()=>{if(!Net.browsing){clearInterval(Net.brT);return;}renderGames();},1500);
}
function stopBrowse(){Net.browsing=false;clearInterval(Net.brT);if(!Net.on&&!Net.joining)Relay.close();}
function renderGames(){
  const list=$('glist');if(!list)return;
  const games=Object.values(Net.games).filter(g=>Math.abs(Date.now()-g.ts)<90000).sort((a,b)=>b.ts-a.ts);
  const n=Relay.count();
  if(!Net.joining)mpStatus(n?`Connected to ${n} of ${Relay.brokers.length} relays. ${games.length?'Pick a game to join.':'No games yet. Ask a friend to press Host online game, or host one yourself.'}`:'Connecting to the online relays…');
  list.innerHTML='';
  for(const g of games){const b=document.createElement('button');b.className='game';
    b.innerHTML=`<b>${String(g.host).replace(/[<>&"]/g,'')}'s battle</b><span>${g.n} / ${g.max} players · ${g.size} v ${g.size} · round ${g.round}</span><em>ROOM ${g.code} · JOIN ›</em>`;
    b.onclick=()=>netJoin(g.code);list.appendChild(b);}
}
$('copyInv').onclick=()=>{const v=$('invLink').value;(navigator.clipboard?navigator.clipboard.writeText(v):Promise.reject()).then(()=>hint('Invite link copied',2)).catch(()=>{$('invLink').select();document.execCommand&&document.execCommand('copy');hint('Invite link copied',2);});};
window.addEventListener('beforeunload',()=>{if(Net.on||Net.joining)netLeave(true);});
