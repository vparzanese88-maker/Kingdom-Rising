'use strict';
/* ================= Relay: online play through public MQTT brokers =================
   Browsers can't host servers, and direct browser-to-browser links (WebRTC) are often blocked by
   home routers. So every message goes through free public MQTT brokers over secure websockets
   (port 443-style traffic that gets through nearly any network). We connect to several brokers
   at once and send each message through all of them; duplicates are dropped on arrival, so one
   broker being down doesn't matter. Use your own broker with ?relay=wss://host:port/path         */
const RELAY_NS='omaha1944/v3/';
const Relay=(()=>{
  const qs=new URLSearchParams(location.search);
  const BROKERS=(qs.get('relay')?qs.get('relay').split(','):['wss://broker.emqx.io:8084/mqtt','wss://broker.hivemq.com:8884/mqtt']).map(s=>s.trim()).filter(Boolean);
  const te=new TextEncoder(),td=new TextDecoder();
  const rid=n=>{const s='abcdefghijkmnopqrstuvwxyz23456789';let o='';const r=crypto.getRandomValues(new Uint8Array(n));for(const x of r)o+=s[x%s.length];return o;};
  const str=s=>{const b=te.encode(s);const o=new Uint8Array(b.length+2);o[0]=b.length>>8;o[1]=b.length&255;o.set(b,2);return o;};
  const cat=parts=>{let n=0;for(const p of parts)n+=p.length;const o=new Uint8Array(n);let i=0;for(const p of parts){o.set(p,i);i+=p.length;}return o;};
  const packet=(type,body)=>{const len=[];let x=body.length;do{let d=x%128;x=Math.floor(x/128);if(x>0)d|=128;len.push(d);}while(x>0);return cat([new Uint8Array([type]),new Uint8Array(len),body]);};
  const KEEPALIVE=40;
  // minimal MQTT 3.1.1 client, QoS 0, one websocket, reconnects by itself
  class Mqtt{
    constructor(url,will){this.url=url;this.will=will;this.ok=false;this.subs=new Set();this.onmsg=null;this.onstate=null;this.buf=new Uint8Array(0);this.pid=1;this.closed=false;this.tries=0;this.open();}
    open(){
      if(this.closed)return;let ws;try{ws=new WebSocket(this.url,'mqtt');}catch(e){return this.retry();}
      ws.binaryType='arraybuffer';this.ws=ws;
      ws.onopen=()=>{const flags=0x02|(this.will?0x04|(this.will.retain?0x20:0):0);
        const parts=[str('MQTT'),new Uint8Array([4,flags,KEEPALIVE>>8,KEEPALIVE&255]),str('om'+rid(14))];
        if(this.will){parts.push(str(this.will.topic));const p=te.encode(this.will.payload);parts.push(new Uint8Array([p.length>>8,p.length&255]),p);}
        ws.send(packet(0x10,cat(parts)));};
      ws.onmessage=ev=>{this.buf=cat([this.buf,new Uint8Array(ev.data)]);this.parse();};
      ws.onclose=ws.onerror=()=>{if(this.ws!==ws)return;this.ws=null;const was=this.ok;this.ok=false;clearInterval(this.ping);if(was&&this.onstate)this.onstate(false);this.retry();};
    }
    retry(){if(this.closed)return;this.tries++;clearTimeout(this.rt);this.rt=setTimeout(()=>this.open(),Math.min(15000,800*2**Math.min(this.tries,4)));}
    parse(){
      for(;;){const b=this.buf;if(b.length<2)return;let mul=1,len=0,i=1,d;
        do{if(i>=b.length)return;d=b[i++];len+=(d&127)*mul;mul*=128;}while(d&128);
        if(b.length<i+len)return;const type=b[0]>>4,body=b.subarray(i,i+len);this.buf=b.slice(i+len);
        if(type===2){if(body[1]!==0){this.ws.close();continue;}this.ok=true;this.tries=0;for(const t of this.subs)this.sendSub(t);
          clearInterval(this.ping);this.ping=setInterval(()=>this.raw(new Uint8Array([0xc0,0])),KEEPALIVE*500);if(this.onstate)this.onstate(true);}
        else if(type===3){const tl=(body[0]<<8)|body[1];const topic=td.decode(body.subarray(2,2+tl));let j=2+tl;if((b[0]>>1)&3)j+=2;if(this.onmsg)this.onmsg(topic,body.subarray(j));}}
    }
    raw(p){if(this.ws&&this.ws.readyState===1)try{this.ws.send(p);}catch(e){}}
    sendSub(t){const id=this.pid=(this.pid%65000)+1;this.raw(packet(0x82,cat([new Uint8Array([id>>8,id&255]),str(t),new Uint8Array([0])])));}
    sub(t){this.subs.add(t);if(this.ok)this.sendSub(t);}
    unsub(t){if(!this.subs.delete(t)||!this.ok)return;const id=this.pid=(this.pid%65000)+1;this.raw(packet(0xa2,cat([new Uint8Array([id>>8,id&255]),str(t)])));}
    pub(topic,payload,retain){if(!this.ok)return false;const p=typeof payload==='string'?te.encode(payload):payload;this.raw(packet(0x30|(retain?1:0),cat([str(topic),p])));return true;}
    close(){this.closed=true;clearTimeout(this.rt);clearInterval(this.ping);if(this.ws){this.raw(new Uint8Array([0xe0,0]));try{this.ws.close();}catch(e){}}this.ws=null;this.ok=false;}
  }
  const R={me:rid(10),seq:0,conns:[],handlers:[],seen:new Map(),
    // will: {topic,payload,retain} sent by the broker if we vanish without saying goodbye
    connect(will){R.close();R.conns=BROKERS.map(u=>{const c=new Mqtt(u,will);c.onmsg=(t,d)=>R.recv(t,d);c.onstate=up=>{if(R.onstate)R.onstate(R.connected());};return c;});},
    connected(){return R.conns.some(c=>c.ok);},
    count(){return R.conns.filter(c=>c.ok).length;},
    sub(topic,fn){R.handlers.push({topic,fn,re:new RegExp('^'+topic.replace(/[.*?^${}()|[\]\\]/g,'\\$&').replace(/\+/g,'[^/]+').replace(/#$/,'.*')+'$')});for(const c of R.conns)c.sub(topic);},
    unsub(topic){R.handlers=R.handlers.filter(h=>h.topic!==topic);for(const c of R.conns)c.unsub(topic);},
    pub(topic,obj,retain){obj.i=R.me;obj.q=++R.seq;const s=JSON.stringify(obj);let any=false;for(const c of R.conns)any=c.pub(topic,s,retain)||any;return any;},
    clearRetained(topic){for(const c of R.conns)c.pub(topic,new Uint8Array(0),true);},
    dup(i,q){let set=R.seen.get(i);if(!set)R.seen.set(i,set=new Set());if(set.has(q))return true;set.add(q);if(set.size>600){const it=set.values();for(let k=0;k<200;k++)set.delete(it.next().value);}return false;},
    recv(topic,data){
      if(!data.length){for(const h of R.handlers)if(h.re.test(topic))h.fn(null,topic);return;}
      let m;try{m=JSON.parse(td.decode(data));}catch(e){return;}
      if(!m||typeof m.i!=='string'||m.i===R.me)return;
      if(!m.r&&R.dup(m.i,m.q))return;
      for(const h of R.handlers)if(h.re.test(topic))try{h.fn(m,topic);}catch(e){console.warn('relay',e);}
    },
    close(){for(const c of R.conns)c.close();R.conns=[];R.handlers=[];},
    brokers:BROKERS};
  return R;
})();
