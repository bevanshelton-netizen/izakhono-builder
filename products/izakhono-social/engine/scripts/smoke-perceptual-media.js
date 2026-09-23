import sharp from 'sharp';

const base=process.env.CONNECTA_ENGINE_URL || 'http://127.0.0.1:4100';

async function api(path,{method='GET',token,body}={}) {
  const headers={};
  if(body!==undefined) headers['content-type']='application/json';
  if(token) headers.authorization=`Bearer ${token}`;
  const response=await fetch(base+path,{
    method,
    headers,
    body:body===undefined?undefined:JSON.stringify(body),
  });
  const data=await response.json();
  if(!response.ok) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function upload(path,token,bytes,mimeType) {
  const response=await fetch(base+path,{
    method:'PUT',
    headers:{authorization:`Bearer ${token}`,'content-type':mimeType},
    body:bytes,
  });
  const data=await response.json();
  if(!response.ok) throw new Error(`PUT ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

function pattern() {
  const width=160,height=120,channels=3;
  const data=Buffer.alloc(width*height*channels);
  for(let y=0;y<height;y+=1){
    for(let x=0;x<width;x+=1){
      const i=(y*width+x)*channels;
      const block=((Math.floor(x/20)+Math.floor(y/15))%2)*110;
      data[i]=(x*3+block)%256;
      data[i+1]=(y*4+(x%37)*3)%256;
      data[i+2]=((x+y)*2+block)%256;
    }
  }
  return {data,width,height,channels};
}

const suffix=Date.now().toString(36);
const owner=await api('/v1/auth/register',{
  method:'POST',
  body:{
    email:`perceptual-owner-${suffix}@connecta.local`,
    handle:`perceptual-owner-${suffix}`,
    displayName:'Perceptual Original',
    password:'Connecta-Perceptual-Test-41',
  },
});
const copier=await api('/v1/auth/register',{
  method:'POST',
  body:{
    email:`perceptual-copy-${suffix}@connecta.local`,
    handle:`perceptual-copy-${suffix}`,
    displayName:'Perceptual Copy Test',
    password:'Connecta-Perceptual-Test-42',
  },
});

const raw=pattern();
const original=await sharp(raw.data,{raw:{width:raw.width,height:raw.height,channels:raw.channels}})
  .png()
  .toBuffer();
const altered=await sharp(original)
  .extract({left:8,top:6,width:144,height:108})
  .resize(160,120)
  .jpeg({quality:68})
  .toBuffer();

const first=await api('/v1/media',{
  method:'POST',
  token:owner.token,
  body:{mediaType:'image',mimeType:'image/png'},
});
await upload(`/v1/media/${first.media.id}/content`,owner.token,original,'image/png');

const second=await api('/v1/media',{
  method:'POST',
  token:copier.token,
  body:{mediaType:'image',mimeType:'image/jpeg'},
});
const result=await upload(`/v1/media/${second.media.id}/content`,copier.token,altered,'image/jpeg');

if(!result.alteredCopyOwnerAlert || result.copySignal!=='altered-image'){
  throw new Error('Altered image did not trigger perceptual owner alert');
}
if(result.duplicateOwnerAlert) throw new Error('Altered test image unexpectedly matched exact SHA-256');

const notifications=(await api('/v1/notifications',{token:owner.token})).notifications;
const alert=notifications.find((item)=>item.kind==='content_duplicate_detected' && item.target_id===second.media.id);
if(!alert) throw new Error('Earlier uploader did not receive altered-copy notification');
if(!String(alert.title).toLowerCase().includes('altered')) throw new Error('Owner alert did not identify altered-copy signal');

console.log(JSON.stringify({ok:true,alteredCopyOwnerAlert:true,exactDuplicate:false}));
