'use strict';
/* ================= Audio: everything is synthesized at start-up ================= */
const AU={ctx:null,buf:{},voices:0,loops:{}};
function noiseArr(n){const a=new Float32Array(n);for(let i=0;i<n;i++)a[i]=Math.random()*2-1;return a;}
function lp1(d,fc,sr){const a=1-Math.exp(-TAU*fc/sr);let y=0;for(let i=0;i<d.length;i++){y+=a*(d[i]-y);d[i]=y;}return d;}
function hp1(d,fc,sr){const a=1-Math.exp(-TAU*fc/sr);let y=0;for(let i=0;i<d.length;i++){y+=a*(d[i]-y);d[i]=d[i]-y;}return d;}
function filt(n,lo,hi,sr){const a=noiseArr(n);if(hi){lp1(a,hi,sr);lp1(a,hi,sr);}if(lo){hp1(a,lo,sr);hp1(a,lo,sr);}return a;}
function norm(d,pk){let m=0;for(let i=0;i<d.length;i++){const v=Math.abs(d[i]);if(v>m)m=v;}if(m>0){const k=pk/m;for(let i=0;i<d.length;i++)d[i]*=k;}}
function echo(d,sr,t,g,fc){const k=t*sr|0;const e=lp1(d.slice(),fc,sr);for(let i=d.length-1;i>=k;i--)d[i]+=e[i-k]*g;}
function mkbuf(dur,fill,pk=.9){const ctx=AU.ctx,sr=ctx.sampleRate,n=Math.floor(dur*sr);const b=ctx.createBuffer(1,n,sr);const d=b.getChannelData(0);fill(d,sr,n);norm(d,pk);return b;}
// p: crack (snap level), snap (snap decay), mid (body filter Hz), md (body decay), thump (Hz), boom (thump level), td, tail (low rumble decay), low, len
function synthGun(p){return mkbuf(p.len||2.2,(d,sr,n)=>{
  const raw=noiseArr(n),mid=filt(n,0,p.mid,sr),low=filt(n,0,p.low||320,sr);let ph=0;
  for(let i=0;i<n;i++){const t=i/sr;const f=p.thump*(1+1.6*Math.exp(-t/.025));ph+=TAU*f/sr;
    d[i]=raw[i]*Math.exp(-t/p.snap)*p.crack+mid[i]*Math.exp(-t/p.md)*4.2+Math.sin(ph)*Math.exp(-t/p.td)*p.boom+low[i]*Math.exp(-t/p.tail)*8*Math.min(1,t/.03);}
  echo(d,sr,.21,.2,900);echo(d,sr,.55,.12,600);echo(d,sr,1.1,.07,400);});}
function synthBoom(len,lowF,water){return mkbuf(len,(d,sr,n)=>{
  const raw=noiseArr(n),mid=filt(n,0,water?1600:900,sr),low=filt(n,0,lowF,sr);let ph=0;
  for(let i=0;i<n;i++){const t=i/sr;ph+=TAU*(28+70*Math.exp(-t/.06))/sr;
    d[i]=raw[i]*Math.exp(-t/.01)*.9+mid[i]*Math.exp(-t/(water?.35:.16))*6+Math.sin(ph)*Math.exp(-t/.5)*1.6+low[i]*Math.exp(-t/1.2)*24*Math.min(1,t/.05)*(.75+.25*Math.sin(t*6.1));}
  for(let k=0;k<(water?260:140);k++){const t0=.05+Math.pow(Math.random(),1.6)*(water?2.4:1.4),s=t0*sr|0,a=.35*Math.exp(-t0/.8)*Math.random(),L=sr*.005|0;
    for(let j=0;j<L&&s+j<n;j++)d[s+j]+=raw[(s*3+j)%n]*a*(1-j/L);}
  echo(d,sr,.4,.3,500);echo(d,sr,1.0,.18,350);echo(d,sr,1.9,.1,250);});}
const GUNSND={
  garand:{crack:1,snap:.004,mid:1500,md:.07,thump:62,boom:.9,td:.15,tail:.6},
  carbine:{crack:1,snap:.003,mid:2100,md:.05,thump:80,boom:.6,td:.1,tail:.4},
  thompson:{crack:.7,snap:.003,mid:1100,md:.06,thump:70,boom:1,td:.09,tail:.35,len:1.4},
  greasegun:{crack:.6,snap:.003,mid:950,md:.06,thump:64,boom:1,td:.09,tail:.32,len:1.3},
  springfield:{crack:1.2,snap:.005,mid:1700,md:.09,thump:55,boom:1,td:.18,tail:.75},
  bar:{crack:1,snap:.004,mid:1400,md:.07,thump:58,boom:1,td:.13,tail:.5,len:1.6},
  m1919:{crack:1,snap:.004,mid:1300,md:.07,thump:56,boom:1.1,td:.12,tail:.45,len:1.4},
  k98:{crack:1.25,snap:.004,mid:1900,md:.08,thump:58,boom:.95,td:.16,tail:.7},
  g43:{crack:1.1,snap:.004,mid:1800,md:.07,thump:62,boom:.85,td:.14,tail:.55},
  mp40:{crack:.6,snap:.003,mid:1200,md:.05,thump:76,boom:.9,td:.08,tail:.3,len:1.3},
  mp44:{crack:.9,snap:.003,mid:1700,md:.06,thump:68,boom:.9,td:.1,tail:.4,len:1.4},
  mg34:{crack:1,snap:.003,mid:1600,md:.06,thump:60,boom:1,td:.1,tail:.4,len:1.3},
  mg42:{crack:1,snap:.003,mid:1800,md:.045,thump:64,boom:1,td:.07,tail:.33,len:1.2},
  colt:{crack:.8,snap:.003,mid:1300,md:.05,thump:74,boom:.9,td:.08,tail:.3,len:1.3},
  luger:{crack:.8,snap:.003,mid:1600,md:.045,thump:84,boom:.7,td:.07,tail:.28,len:1.2}
};
function buildBuffers(){
  const B=AU.buf;
  for(const k in GUNSND)B['g_'+k]=[0,1].map(()=>synthGun(GUNSND[k]));
  B.boom=[0,1,2].map(()=>synthBoom(5,150,false));
  B.nade=[0,1].map(()=>synthBoom(3.5,220,false));
  B.splashBoom=[0,1].map(()=>synthBoom(5,120,true));
  B.distant=[0,1,2].map(()=>synthBoom(5,90,false));
  const click=(f,dur,pk=.6)=>mkbuf(dur,(d,sr,n)=>{const raw=noiseArr(n);for(let i=0;i<n;i++){const t=i/sr;d[i]=Math.sin(TAU*f*t)*Math.exp(-t/.006)+raw[i]*Math.exp(-t/.0015)*.8+Math.sin(TAU*f*.41*t)*Math.exp(-t/.012)*.4;}},pk);
  const clacks=(list,dur,pk=.6)=>mkbuf(dur,(d,sr,n)=>{const raw=noiseArr(n);for(let i=0;i<n;i++){const t=i/sr;for(const[t0,f,a]of list){const u=t-t0;if(u>=0)d[i]+=(Math.sin(TAU*f*u)*Math.exp(-u/.008)+raw[i]*Math.exp(-u/.002)*.9+Math.sin(TAU*f*.37*u)*Math.exp(-u/.02)*.5)*(a||1);}}},pk);
  B.dry=click(2900,.1,.4);
  B.boltUp=clacks([[0,1700],[.09,2400,.6]],.25);B.boltBack=clacks([[0,1300],[.05,2100,.5]],.2);
  B.boltFwd=clacks([[0,1500],[.06,2600,.8],[.12,1900,.6]],.25);
  B.magOut=clacks([[0,1100],[.04,2200,.5]],.2,.5);B.magIn=clacks([[0,900],[.03,1600],[.11,2300,.7]],.25,.6);
  B.clipIn=clacks([[0,2600],[.05,3100,.7],[.15,1400,1]],.3,.6);
  B.cock=clacks([[0,2400],[.075,1800]],.22,.6);
  B.ping=mkbuf(1.1,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;d[i]=(Math.sin(TAU*2720*t)+Math.sin(TAU*4180*t)*.6+Math.sin(TAU*6990*t)*.35+Math.sin(TAU*1795*t)*.3)*Math.exp(-t/.22)*(t<.002?t/.002:1);}},.5);
  B.belt=mkbuf(.6,(d,sr,n)=>{const raw=noiseArr(n);for(let i=0;i<n;i++){const t=i/sr;const gate=Math.max(0,Math.sin(t*TAU*24));d[i]=raw[i]*gate*Math.sin(Math.PI*t/.6)*.5+Math.sin(TAU*1900*t)*Math.exp(-(t%.042)/.004)*.3;}},.5);
  B.deploy=mkbuf(.3,(d,sr,n)=>{const lo=filt(n,0,600,sr),raw=noiseArr(n);for(let i=0;i<n;i++){const t=i/sr;d[i]=lo[i]*Math.exp(-t/.04)*6+Math.sin(TAU*1400*t)*Math.exp(-t/.02)*.5+raw[i]*Math.exp(-t/.003)*.5;}},.7);
  B.pin=mkbuf(.35,(d,sr,n)=>{const raw=noiseArr(n);for(let i=0;i<n;i++){const t=i/sr;d[i]=(Math.sin(TAU*3800*t)+Math.sin(TAU*5300*t)*.5)*Math.exp(-t/.03)+raw[i]*Math.exp(-t/.002)*.6+(t>.16?Math.sin(TAU*2300*(t-.16))*Math.exp(-(t-.16)/.01):0);}},.5);
  B.clink=[0,1,2].map(()=>mkbuf(.4,(d,sr,n)=>{const f=rand(1800,3200),lo=filt(n,0,500,sr);for(let i=0;i<n;i++){const t=i/sr;d[i]=(Math.sin(TAU*f*t)+Math.sin(TAU*f*1.73*t)*.5)*Math.exp(-t/.05)*.5+lo[i]*Math.exp(-t/.02)*3;}},.5));
  B.swish=mkbuf(.3,(d,sr,n)=>{const h=filt(n,700,3500,sr);for(let i=0;i<n;i++){const t=i/sr;const e=Math.sin(Math.PI*t/.3);d[i]=h[i]*e*e;}},.45);
  B.stab=mkbuf(.35,(d,sr,n)=>{const lo=filt(n,0,400,sr);for(let i=0;i<n;i++){const t=i/sr;d[i]=lo[i]*Math.exp(-t/.05)*6+Math.sin(TAU*80*t)*Math.exp(-t/.08);}},.8);
  B.flesh=[0,1,2].map(()=>mkbuf(.25,(d,sr,n)=>{const lo=filt(n,0,rand(500,900),sr),raw=noiseArr(n);for(let i=0;i<n;i++){const t=i/sr;d[i]=lo[i]*Math.exp(-t/.035)*6+raw[i]*Math.exp(-t/.004)*.6+Math.sin(TAU*110*t)*Math.exp(-t/.04);}},.8));
  B.helmet=mkbuf(.7,(d,sr,n)=>{const raw=noiseArr(n);for(let i=0;i<n;i++){const t=i/sr;d[i]=(Math.sin(TAU*1250*t)+Math.sin(TAU*2870*t)*.7+Math.sin(TAU*4410*t)*.4)*Math.exp(-t/.12)+raw[i]*Math.exp(-t/.004);}},.7);
  B.bodyfall=[0,1].map(()=>mkbuf(.5,(d,sr,n)=>{const lo=filt(n,0,300,sr),m=filt(n,300,1500,sr);for(let i=0;i<n;i++){const t=i/sr;const u=t-.12;d[i]=lo[i]*Math.exp(-t/.06)*6+(u>0?lo[i]*Math.exp(-u/.05)*4+m[i]*Math.exp(-u/.03):0)+m[i]*Math.exp(-t/.02);}},.7));
  B.whistle=mkbuf(1.8,(d,sr,n)=>{const no=filt(n,800,3000,sr);let ph=0;for(let i=0;i<n;i++){const t=i/sr;const f=1500*Math.exp(-t*.7)+90;ph+=TAU*f/sr;const env=Math.pow(Math.min(1,t/1.3),2)*(t>1.72?Math.max(0,1-(t-1.72)/.08):1);d[i]=env*(Math.sin(ph)*.5+no[i]*1.3);}},.7);
  B.whiz=[0,1,2].map(()=>mkbuf(.5,(d,sr,n)=>{const no=filt(n,1500,6000,sr);let ph=0;const c=rand(.12,.16),f0=rand(2400,3600);
    for(let i=0;i<n;i++){const t=i/sr;const env=Math.exp(-Math.pow((t-c)/.045,2));const f=f0*(.55+.45/(1+Math.exp((t-c)*60)));ph+=TAU*f/sr;d[i]=env*(Math.sin(ph)*.35+no[i]*2.5);}}));
  B.crack=[0,1].map(()=>mkbuf(.4,(d,sr,n)=>{const raw=noiseArr(n),h=filt(n,2000,0,sr);for(let i=0;i<n;i++){const t=i/sr;d[i]=raw[i]*Math.exp(-t/.0015)*1.5+h[i]*Math.exp(-t/.03)*2;}echo(d,sr,.09,.3,3000);}));
  B.ric=[0,1,2].map(()=>mkbuf(.7,(d,sr,n)=>{let ph=0;const f0=rand(3000,5200),raw=noiseArr(n);for(let i=0;i<n;i++){const t=i/sr;const f=f0*(1-.45*t/.7);ph+=TAU*f/sr;d[i]=Math.sin(ph)*Math.exp(-t/.16)*.6+raw[i]*Math.exp(-t/.004);}},.5));
  B.impSand=[0,1].map(()=>mkbuf(.3,(d,sr,n)=>{const lo=filt(n,0,900,sr),h=filt(n,2500,0,sr);for(let i=0;i<n;i++){const t=i/sr;d[i]=lo[i]*Math.exp(-t/.03)*5+h[i]*Math.exp(-t/.06)*.8;}},.6));
  B.impHard=[0,1].map(()=>mkbuf(.3,(d,sr,n)=>{const h=filt(n,1200,0,sr),raw=noiseArr(n);for(let i=0;i<n;i++){const t=i/sr;d[i]=raw[i]*Math.exp(-t/.002)+h[i]*Math.exp(-t/.025)*2;}},.6));
  B.impWood=mkbuf(.3,(d,sr,n)=>{const m=filt(n,300,2500,sr);for(let i=0;i<n;i++){const t=i/sr;d[i]=m[i]*Math.exp(-t/.03)*4+Math.sin(TAU*420*t)*Math.exp(-t/.04);}},.6);
  B.impWater=[0,1].map(()=>mkbuf(.5,(d,sr,n)=>{const h=filt(n,800,6000,sr);let ph=0;for(let i=0;i<n;i++){const t=i/sr;ph+=TAU*(600+1400*t)/sr;d[i]=h[i]*Math.exp(-t/.08)*2+Math.sin(ph)*Math.exp(-t/.05)*.4;}},.5));
  B.impMetal=mkbuf(.5,(d,sr,n)=>{const raw=noiseArr(n);for(let i=0;i<n;i++){const t=i/sr;d[i]=(Math.sin(TAU*1830*t)+Math.sin(TAU*3170*t)*.6)*Math.exp(-t/.08)+raw[i]*Math.exp(-t/.003);}},.6);
  const step=(lo,hi,a,b,tail)=>[0,1,2,3].map(()=>mkbuf(.22,(d,sr,n)=>{const L=filt(n,0,lo,sr),Hh=filt(n,hi,0,sr);const k=rand(.3,.8);for(let i=0;i<n;i++){const t=i/sr;d[i]=L[i]*a*Math.min(1,t/.004)*Math.exp(-t/tail)+Hh[i]*Math.exp(-t/.02)*b*k;}},.5));
  B.stSand=step(500,2500,5,1.2,.06);B.stGrass=step(700,3000,4,1.6,.05);B.stHard=step(900,3500,5,.8,.03);B.stWood=step(600,2000,6,.5,.05);
  B.stWater=[0,1,2].map(()=>mkbuf(.45,(d,sr,n)=>{const h=filt(n,500,5000,sr),lo=filt(n,0,400,sr);for(let i=0;i<n;i++){const t=i/sr;const e=Math.sin(Math.PI*Math.min(1,t/.4));d[i]=h[i]*e*Math.exp(-t/.15)*2+lo[i]*Math.exp(-t/.05)*3;}},.5));
  B.jumpLand=mkbuf(.3,(d,sr,n)=>{const lo=filt(n,0,400,sr);for(let i=0;i<n;i++){const t=i/sr;d[i]=lo[i]*Math.exp(-t/.05)*6;}},.6);
  B.heart=mkbuf(.9,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;let v=0;for(const t0 of[0,.22]){const u=t-t0;if(u>0)v+=Math.sin(TAU*48*u)*Math.exp(-u/.07)*(t0?.7:1);}d[i]=v;}},.9);
  B.breath=mkbuf(1.2,(d,sr,n)=>{const h=filt(n,400,2500,sr);for(let i=0;i<n;i++){const t=i/sr;const e=t<.45?Math.sin(Math.PI*t/.45):t>.55?Math.sin(Math.PI*(t-.55)/.6)*.8:0;d[i]=h[i]*e;}},.4);
  B.ramp=mkbuf(1.6,(d,sr,n)=>{const lo=filt(n,0,250,sr),raw=noiseArr(n);for(let i=0;i<n;i++){const t=i/sr;const u=t-.9;d[i]=Math.sin(TAU*(95+20*Math.sin(t*30))*t)*.15*(t<.9?t/.9:0)+raw[i]*.05*(t<.9?1:0)+(u>0?(lo[i]*Math.exp(-u/.15)*9+(Math.sin(TAU*310*u)+Math.sin(TAU*517*u)*.6)*Math.exp(-u/.25)*.8+raw[i]*Math.exp(-u/.01)):0);}echo(d,sr,.3,.25,600);},.9);
  B.debris=mkbuf(2,(d,sr,n)=>{const raw=noiseArr(n);for(let k=0;k<180;k++){const t0=Math.pow(Math.random(),.7)*1.8,s=t0*sr|0,a=Math.random()*(1-t0/2),L=sr*.006|0,f=rand(300,1400);for(let j=0;j<L&&s+j<n;j++)d[s+j]+=(raw[(s+j)%n]*.6+Math.sin(TAU*f*j/sr))*a*(1-j/L);}},.5);
  // loops
  B.waves=mkbuf(12,(d,sr,n)=>{const a=filt(n,80,900,sr),b=filt(n,900,5000,sr);for(let i=0;i<n;i++){const t=i/sr;const w1=Math.pow(Math.max(0,Math.sin(TAU*t/6+.5)),3),w2=Math.pow(Math.max(0,Math.sin(TAU*t/4+2)),4);
    d[i]=a[i]*(.25+w1*.9+w2*.5)+b[i]*(w1*.5+w2*.35)*Math.max(0,Math.sin(TAU*t/6+.2));}const f=sr*.5|0;for(let i=0;i<f;i++){const k=i/f;d[i]=d[i]*k+d[n-f+i]*(1-k);}},.8);
  B.wind=mkbuf(8,(d,sr,n)=>{const lo=filt(n,0,380,sr);for(let i=0;i<n;i++)d[i]=lo[i];const f=sr*.4|0;for(let i=0;i<f;i++){const k=i/f;d[i]=d[i]*k+d[n-f+i]*(1-k);}},.8);
  B.engine=mkbuf(4,(d,sr,n)=>{const raw=filt(n,0,600,sr);let ph=0;for(let i=0;i<n;i++){const t=i/sr;ph+=TAU*(46+Math.sin(t*1.5)*1.5)/sr;d[i]=(Math.sin(ph)+Math.sin(ph*2)*.6+Math.sin(ph*3)*.3)*(1+.3*Math.sin(ph*.5))*.4+raw[i]*3;}},.8);
  B.snare=mkbuf(.28,(d,sr,n)=>{const h=filt(n,1200,0,sr);for(let i=0;i<n;i++){const t=i/sr;d[i]=h[i]*Math.exp(-t/.07)*1.4+Math.sin(TAU*190*t)*Math.exp(-t/.035)*.7;}});
  B.timp=mkbuf(1.8,(d,sr,n)=>{let ph=0;const r=filt(n,0,600,sr);for(let i=0;i<n;i++){const t=i/sr;ph+=TAU*(62+18*Math.exp(-t/.08))/sr;d[i]=Math.sin(ph)*Math.exp(-t/.6)+r[i]*Math.exp(-t/.02)*2;}});
}
function impulse(ctx,dur){const sr=ctx.sampleRate,n=dur*sr|0,b=ctx.createBuffer(2,n,sr);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++){const t=i/sr;d[i]=(Math.random()*2-1)*Math.exp(-t/.7)*(t<.02?t/.02:1);}lp1(d,3000,sr);}return b;}
function initAudio(){
  if(AU.ctx){AU.ctx.resume();return;}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const ctx=new AC();AU.ctx=ctx;
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.knee.value=10;comp.ratio.value=6;comp.attack.value=.002;comp.release.value=.3;
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=20000;lp.Q.value=.5;
  const master=ctx.createGain();master.gain.value=.85;master.connect(lp);lp.connect(comp);comp.connect(ctx.destination);
  const rev=ctx.createConvolver();rev.buffer=impulse(ctx,3);const revIn=ctx.createGain();revIn.connect(rev);rev.connect(master);
  const musicBus=ctx.createGain();musicBus.gain.value=0;musicBus.connect(comp);
  AU.master=master;AU.lp=lp;AU.revIn=revIn;AU.music=musicBus;applyVolumes();
  buildBuffers();
  AU.loops.waves=loopSrc('waves',.0);AU.loops.wind=loopSrc('wind',.06);AU.loops.engine=loopSrc('engine',0);
}
function loopSrc(name,vol){const ctx=AU.ctx,s=ctx.createBufferSource();s.buffer=AU.buf[name];s.loop=true;const g=ctx.createGain();g.gain.value=vol;s.connect(g);g.connect(AU.master);s.start();return g;}
function setLoop(name,v,tc=.3){if(!AU.ctx)return;const g=AU.loops[name];if(g)g.gain.setTargetAtTime(v,AU.ctx.currentTime,tc);}
function setP(p,x,y,z){if(p.positionX){p.positionX.value=x;p.positionY.value=y;p.positionZ.value=z;}else p.setPosition(x,y,z);}
const _lf=new V3(),_lu=new V3();
function updateListener(){
  const L=AU.ctx.listener,p=camera.position;camera.getWorldDirection(_lf);_lu.set(0,1,0).applyQuaternion(camera.quaternion);
  if(L.positionX){L.positionX.value=p.x;L.positionY.value=p.y;L.positionZ.value=p.z;L.forwardX.value=_lf.x;L.forwardY.value=_lf.y;L.forwardZ.value=_lf.z;L.upX.value=_lu.x;L.upY.value=_lu.y;L.upZ.value=_lu.z;}
  else{L.setPosition(p.x,p.y,p.z);L.setOrientation(_lf.x,_lf.y,_lf.z,_lu.x,_lu.y,_lu.z);}
}
// play(name,{pos,vol,rate,lpf,rev,ref,travel,delay})
function play(name,o={}){
  const ctx=AU.ctx;if(!ctx)return null;let b=AU.buf[name];if(!b)return null;if(Array.isArray(b))b=b[Math.random()*b.length|0];
  let dist=0,delay=o.delay||0;
  if(o.pos){dist=o.pos.distanceTo(camera.position);if(o.travel!==false)delay+=dist/343;if((AU.voices>48&&dist>30)||AU.voices>80)return null;if(o.maxD&&dist>o.maxD)return null;}
  const src=ctx.createBufferSource();src.buffer=b;src.playbackRate.value=(o.rate||1)*(o.jit?rand(1-o.jit,1+o.jit):1);
  let node=src;
  const lpf=o.lpf!=null?o.lpf:(o.pos?Math.max(500,19000*Math.exp(-dist/70)):0);
  if(lpf&&lpf<18000){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=lpf;node.connect(f);node=f;}
  const g=ctx.createGain();g.gain.value=o.vol!=null?o.vol:1;node.connect(g);node=g;
  const rv=o.rev!=null?o.rev:(o.pos?.3:.06);
  if(rv>0){const s=ctx.createGain();s.gain.value=o.pos?rv*(.4+Math.min(1,dist/60)):rv;g.connect(s);s.connect(AU.revIn);}
  if(o.pos){const p=ctx.createPanner();p.panningModel='equalpower';p.distanceModel='inverse';p.refDistance=o.ref||5;p.rolloffFactor=o.roll!=null?o.roll:1;p.maxDistance=10000;setP(p,o.pos.x,o.pos.y,o.pos.z);node.connect(p);node=p;}
  node.connect(AU.master);
  AU.voices++;src.onended=()=>{AU.voices--;};
  src.start(ctx.currentTime+Math.max(0,delay));
  return src;
}
function muffle(freq,dur){if(!AU.ctx)return;const f=AU.lp.frequency,n=AU.ctx.currentTime;f.cancelScheduledValues(n);f.setValueAtTime(freq,n);f.exponentialRampToValueAtTime(20000,n+dur);}
function earRing(vol,dur=4){if(!AU.ctx)return;vol*=SET.vol.master*SET.vol.sfx;if(vol<.0002)return;const ctx=AU.ctx,o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=rand(3300,3900);g.gain.setValueAtTime(vol,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+dur);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+dur+.1);}
// short synthetic shout used for pain and death (positional)
const VOWEL={a:[[730,1],[1090,.5],[2440,.22]],u:[[440,1],[1020,.4],[2240,.18]],e:[[530,1],[1840,.45],[2480,.2]],o:[[570,1],[840,.45],[2410,.2]]};
function vox(pos,o){
  const ctx=AU.ctx;if(!ctx||AU.voices>70)return;
  const t0=ctx.currentTime+(o.delay||0)+(pos?pos.distanceTo(camera.position)/343:0),dur=o.dur||1,f0=o.f0||200;
  const osc=ctx.createOscillator();osc.type='sawtooth';osc.frequency.setValueAtTime(f0,t0);
  if(o.rise){osc.frequency.linearRampToValueAtTime(f0*1.4,t0+dur*.3);osc.frequency.exponentialRampToValueAtTime(f0*.75,t0+dur);}
  else osc.frequency.exponentialRampToValueAtTime(f0*(o.glide||.7),t0+dur);
  const env=ctx.createGain();env.gain.setValueAtTime(0,t0);env.gain.linearRampToValueAtTime(o.vol||.3,t0+.03);env.gain.setValueAtTime(o.vol||.3,t0+dur*.5);env.gain.linearRampToValueAtTime(0,t0+dur);
  for(const[f,a]of VOWEL[o.vowel||'a']){const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=f*rand(.92,1.08);bp.Q.value=7;const g=ctx.createGain();g.gain.value=a*2.2;osc.connect(bp);bp.connect(g);g.connect(env);}
  let out=env;
  if(pos){const p=ctx.createPanner();p.panningModel='equalpower';p.distanceModel='inverse';p.refDistance=o.ref||6;setP(p,pos.x,pos.y,pos.z);env.connect(p);out=p;}
  out.connect(AU.master);const s=ctx.createGain();s.gain.value=.12;out.connect(s);s.connect(AU.revIn);
  osc.start(t0);osc.stop(t0+dur+.05);AU.voices++;osc.onended=()=>{AU.voices--;};
}
let lastCry=0;
function deathCry(pos){if(!AU.ctx||GAME.time-lastCry<.35||pos.distanceTo(camera.position)>50)return;lastCry=GAME.time;vox(pos,{f0:rand(130,220),dur:rand(.3,.7),glide:.55,vowel:pick(['a','u','o']),vol:.3});}
function painGrunt(pos,vol=.25){if(!AU.ctx)return;vox(pos,{f0:rand(140,200),dur:rand(.15,.3),glide:.8,vowel:pick(['u','e']),vol});}

/* ---- Radio voices (browser speech) ---- */
const SAY={last:0,voices:{}};
function pickVoice(lang){
  if(SAY.voices[lang]!==undefined)return SAY.voices[lang];
  const vs=(window.speechSynthesis&&speechSynthesis.getVoices())||[];
  const v=vs.find(x=>x.lang&&x.lang.toLowerCase().startsWith(lang))||null;
  if(vs.length)SAY.voices[lang]=v;return v;
}
function say(text,o={}){
  const vv=SET.vol.voice*SET.vol.master;
  if(vv<.02||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
  const now=performance.now();if(!o.force&&now-SAY.last<1400)return;
  if(o.force)speechSynthesis.cancel();else if(speechSynthesis.speaking||speechSynthesis.pending)return;
  SAY.last=now;
  const u=new SpeechSynthesisUtterance(text);
  const lang=o.de?'de':'en';const v=pickVoice(lang);if(v)u.voice=v;u.lang=o.de?'de-DE':'en-US';
  u.pitch=o.pitch!=null?o.pitch:rand(.6,1.0);u.rate=o.rate||rand(1.05,1.25);u.volume=clamp((o.vol!=null?o.vol:.8)*vv,0,1);
  try{speechSynthesis.speak(u);}catch(e){}
}
const LINES={
  0:{nade:['Fire in the hole!','Grenade out!'],seeNade:['Grenade! Take cover!','Grenade!'],reload:['Reloading!','Cover me, reloading!'],
     move:['Move up!','Go, go, go!','Get off the beach!','Keep moving!'],enemy:['Enemy spotted!','Contact front!','Kraut, up ahead!'],
     sniper:['Sniper!'],mg:['Machine gun! Get down!'],cap:['Area secured!','Flag is ours!'],medic:['Medic!'],cover:['Covering fire!']},
  1:{nade:['Granate!','Achtung, Granate!'],seeNade:['Granate! Deckung!','In Deckung!'],reload:['Nachladen!','Gib mir Feuerschutz!'],
     move:['Vorwärts!','Los, los!','Schnell!'],enemy:['Feind gesichtet!','Amerikaner!','Feind voraus!'],
     sniper:['Scharfschütze!'],mg:['Maschinengewehr! Runter!'],cap:['Stellung gesichert!'],medic:['Sanitäter!'],cover:['Feuerschutz!']}
};
function shout(u,kind,force){
  if(!u||!u.alive||G.demo)return;if(Net.host)Net.event(['shout',u.id,kind]);const d=u.pos.distanceTo(camera.position);if(d>40&&!force)return;
  const L=LINES[u.team][kind];if(!L)return;say(pick(L),{de:u.team===1,vol:clamp(1.1-d/40,.15,1),pitch:u.voicePitch||1});
}

/* ---- Music ---- */
const MUS={on:false,track:null,next:0,i:0,gain:null};
const midi=m=>440*Math.pow(2,(m-69)/12);
function note(t,m,len,o={}){
  const ctx=AU.ctx,g=ctx.createGain();const v=o.vol||.05;
  const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(o.cut||900,t);if(o.brass){f.frequency.linearRampToValueAtTime(o.cut*2.5||2200,t+.12);f.frequency.linearRampToValueAtTime(o.cut||900,t+len);}
  f.Q.value=o.q||.7;
  const att=o.att||.05;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+att);g.gain.setValueAtTime(v,t+Math.max(att,len-(o.rel||.2)));g.gain.linearRampToValueAtTime(0,t+len+(o.tail||.15));
  const types=o.types||['sawtooth','sawtooth'];
  types.forEach((ty,k)=>{const os=ctx.createOscillator();os.type=ty;os.frequency.value=midi(m)*(k?1.004:1)*(o.oct&&k===1?.5:1);os.detune.value=k?7:-5;
    if(o.vib){const l=ctx.createOscillator();l.frequency.value=5;const lg=ctx.createGain();lg.gain.value=o.vib;l.connect(lg);lg.connect(os.frequency);l.start(t);l.stop(t+len+.3);}
    os.connect(f);os.start(t);os.stop(t+len+(o.tail||.15)+.05);});
  f.connect(g);g.connect(MUS.gain);const r=ctx.createGain();r.gain.value=.35;g.connect(r);r.connect(AU.revIn);
}
function drumHit(name,t,vol){const ctx=AU.ctx,s=ctx.createBufferSource();s.buffer=AU.buf[name];const g=ctx.createGain();g.gain.value=vol;s.connect(g);g.connect(MUS.gain);const r=ctx.createGain();r.gain.value=.3;g.connect(r);r.connect(AU.revIn);s.start(t);}
// Tracks: arrays of events per bar, generated procedurally
const TRACKS={
  // somber D minor theme for the menu: strings + horn + snare
  theme:{bpm:66,bars:16,bar(b,t,spb){
    const prog=[[50,53,57],[46,50,53],[41,45,48,53],[48,52,55],[50,53,57],[43,46,50],[45,49,52],[50,53,57]];
    const ch=prog[b%8];for(const m of ch)note(t,m+12,spb*4,{vol:.022,cut:700,att:1.2,rel:1.2,tail:1.2});
    note(t,ch[0]-12,spb*4,{vol:.03,cut:300,att:.6,types:['sawtooth','triangle']});
    const mel=[[62,2],[65,1],[64,1],[62,2],[57,2],[58,1.5],[60,.5],[62,1],[65,1],[64,4],[62,2],[65,1],[69,1],[67,2],[65,1],[64,1],[62,1.5],[61,.5],[62,2],[57,2],[62,4]];
    if(b>=4){let tt=0;let idx=0;const startBeat=(b-4)%8*4;let acc=0;for(const[m,l]of mel){if(acc>=startBeat&&acc<startBeat+4)note(t+(acc-startBeat)*spb,m,l*spb*.95,{vol:.05,cut:1100,brass:true,att:.08,vib:3,types:['sawtooth','triangle']});acc+=l;}}
    for(let k=0;k<4;k++){drumHit('snare',t+k*spb,k===0?.16:.08);if(k===3&&b%2)for(let r=1;r<4;r++)drumHit('snare',t+k*spb+r*spb/4,.06);}
    if(b%4===0)drumHit('timp',t,.35);
  }},
  // tense in-round underscore: low drone and timpani pulses
  tension:{bpm:80,bars:8,bar(b,t,spb){
    const roots=[38,38,41,36];const r=roots[b%4];
    note(t,r,spb*4,{vol:.03,cut:260,att:1.5,rel:1.5,tail:1.5});note(t,r+7,spb*4,{vol:.012,cut:400,att:2,rel:1.5,tail:1.5});
    drumHit('timp',t,.22);if(b%2)drumHit('timp',t+spb*2.5,.12);
  }},
  win:{bpm:96,bars:3,once:true,bar(b,t,spb){
    if(b===0){[[60,.5],[64,.5],[67,.5],[72,1.5]].reduce((acc,[m,l])=>{note(t+acc*spb,m,l*spb,{vol:.07,cut:1400,brass:true,vib:4});return acc+l;},0);drumHit('snare',t,.3);}
    if(b===1){for(const m of[48,55,60,64,67])note(t,m,spb*6,{vol:.035,cut:1500,brass:true,att:.1,rel:1,tail:1.5});drumHit('timp',t,.5);for(let r=0;r<8;r++)drumHit('snare',t+r*spb/4,.1+r*.02);}
  }},
  lose:{bpm:60,bars:3,once:true,bar(b,t,spb){
    if(b===0){[[62,1],[61,1],[58,1],[57,2]].reduce((acc,[m,l])=>{note(t+acc*spb,m,l*spb,{vol:.05,cut:900,brass:true,vib:3});return acc+l;},0);}
    if(b===1){for(const m of[38,45,50,53])note(t,m,spb*6,{vol:.03,cut:600,att:.5,tail:2});drumHit('timp',t,.5);}
  }}
};
function playMusic(name){
  if(!AU.ctx)return;stopMusic(.6);
  const ctx=AU.ctx;const tr=TRACKS[name];if(!tr)return;
  MUS.gain=ctx.createGain();MUS.gain.gain.value=1;MUS.gain.connect(AU.music);
  MUS.on=true;MUS.track=tr;MUS.next=ctx.currentTime+.2;MUS.i=0;MUS.name=name;
}
function stopMusic(fade=1.2){if(!MUS.on||!AU.ctx)return;MUS.on=false;const g=MUS.gain,n=AU.ctx.currentTime;g.gain.setValueAtTime(g.gain.value,n);g.gain.linearRampToValueAtTime(0,n+fade);setTimeout(()=>{try{g.disconnect();}catch(e){}},fade*1000+4000);}
function musicTick(){
  if(!MUS.on)return;const ctx=AU.ctx,tr=MUS.track,spb=60/tr.bpm;
  while(MUS.next<ctx.currentTime+.4){
    if(tr.once&&MUS.i>=tr.bars){MUS.on=false;return;}
    tr.bar(MUS.i%tr.bars,MUS.next,spb);MUS.i++;MUS.next+=spb*4;
  }
}
// volumes: master, effects (everything but music and voices), music, voices
function applyVolumes(){const V=SET.vol;SET.music=V.music>.01;SET.voice=V.voice>.01;if(!AU.ctx)return;const t=AU.ctx.currentTime;
  AU.master.gain.setTargetAtTime(.85*V.master*V.sfx,t,.05);AU.music.gain.setTargetAtTime(.55*V.master*V.music*1.6,t,.05);}
function setMusicOn(on){SET.vol.music=on?Math.max(.3,SET.vol.music):0;applyVolumes();saveSettings();}
