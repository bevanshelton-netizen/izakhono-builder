import dgram from 'node:dgram';
import net from 'node:net';
import fs from 'node:fs';
const PORT = Number(process.env.DNS_PORT || 5353);
const zones = JSON.parse(fs.readFileSync(process.env.DNS_ZONES_FILE || './zones.json','utf8'));
const byName = new Map(zones.map(z => [z.name.toLowerCase().replace(/\.$/,''), z]));
const u16=n=>Buffer.from([(n>>>8)&255,n&255]);
const u32=n=>Buffer.from([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);
function nameWire(name){const out=[];for(const label of name.replace(/\.$/,'').split('.')){const b=Buffer.from(label);out.push(Buffer.from([b.length]),b)}out.push(Buffer.from([0]));return Buffer.concat(out)}
function rr(r){const type=({A:1,NS:2,CNAME:5,SOA:6,MX:15,TXT:16,AAAA:28})[r.type];if(!type)return null;let data;
 if(r.type==='A')data=Buffer.from(r.value.split('.').map(Number));
 else if(r.type==='MX')data=Buffer.concat([u16(Number(r.priority||10)),nameWire(r.value)]);
 else if(r.type==='TXT'){const b=Buffer.from(r.value);data=Buffer.concat([Buffer.from([b.length]),b])}
 else if(r.type==='SOA'){const p=r.value.trim().split(/\s+/);data=Buffer.concat([nameWire(p[0]),nameWire(p[1]),u32(Number(p[2])),u32(Number(p[3])),u32(Number(p[4])),u32(Number(p[5])),u32(Number(p[6]))])}
 else data=nameWire(r.value);
 return Buffer.concat([nameWire(r.name),u16(type),u16(1),u32(Number(r.ttl||300)),u16(data.length),data])}
function findZone(qname){const q=qname.toLowerCase().replace(/\.$/,'');let best=null;for(const [zn,z] of byName)if(q===zn||q.endsWith(`.${zn}`))if(!best||zn.length>best.name.length)best=z;return best}
function answer(packet){if(packet.length<12)return Buffer.alloc(0);const id=packet.readUInt16BE(0),flags=packet.readUInt16BE(2),qd=packet.readUInt16BE(4);if(!qd)return Buffer.alloc(0);let p=12;const labels=[];while(p<packet.length&&packet[p]!==0){const n=packet[p++];labels.push(packet.subarray(p,p+n).toString());p+=n}p++;if(p+4>packet.length)return Buffer.alloc(0);const qname=labels.join('.'),qtype=packet.readUInt16BE(p);const zone=findZone(qname);const types={A:1,NS:2,CNAME:5,SOA:6,MX:15,TXT:16,AAAA:28};const rrs=zone?zone.records.filter(r=>r.enabled!==false&&(r.name==='@'?zone.name:r.name).replace(/\.$/,'').toLowerCase()===qname.toLowerCase()&&(qtype===255||types[r.type]===qtype)):[];const qwire=Buffer.concat([nameWire(qname),u16(qtype),u16(1)]);const header=Buffer.concat([u16(id),u16(0x8400|(flags&0x0100)),u16(1),u16(rrs.length),u16(0),u16(0)]);return Buffer.concat([header,qwire,...rrs.map(rr).filter(Boolean)])}
function serve(socket){socket.on('message',(msg,rinfo)=>{try{socket.send(answer(msg),rinfo.port,rinfo.address)}catch{}});socket.bind(PORT)}
serve(dgram.createSocket('udp4'));
const tcp=net.createServer(conn=>{let buf=Buffer.alloc(0);conn.on('data',chunk=>{buf=Buffer.concat([buf,chunk]);while(buf.length>=2){const len=buf.readUInt16BE(0);if(buf.length<len+2)return;const msg=buf.subarray(2,len+2);buf=buf.subarray(len+2);const out=answer(msg);conn.write(Buffer.concat([u16(out.length),out]))}})});tcp.listen(PORT);
console.log(`IZAKHONO authoritative DNS listening on UDP/TCP ${PORT}`);
