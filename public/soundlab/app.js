(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const prompt = $('#prompt'), genre = $('#genre'), mood = $('#mood'), duration = $('#duration'), tempo = $('#tempo'), energy = $('#energy');
  const generateBtn = $('#generate'), variationBtn = $('#variation'), player = $('#player'), statusEl = $('#status');
  const trackTitle = $('#trackTitle'), metaGenre = $('#metaGenre'), metaBpm = $('#metaBpm'), metaDuration = $('#metaDuration'), heroBpm = $('#heroBpm');
  const downloadMix = $('#downloadMix'), downloadStems = $('#downloadStems'), receiptBtn = $('#receipt'), handoffBtn = $('#handoff');
  const stemButtons = $$('.stem');

  let variation = 0, current = null, urls = [];
  const genreDefaults = { amapiano:112, afrobeats:105, gqom:124, house:124, hiphop:92, gospel:96, cinematic:84, lofi:78, afrosoul:96, kpop:118, bollywood:116 };
  const scales = {
    uplifting:[0,2,4,7,9], energetic:[0,2,5,7,10], chill:[0,2,3,7,9], dark:[0,3,5,7,10], epic:[0,2,5,7,9,10], romantic:[0,2,4,7,9,11], corporate:[0,2,4,7,9]
  };
  const roots = [45,48,50,52,53,55];

  function hash(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function midi(n){return 440*Math.pow(2,(n-69)/12)}
  function clamp(v){return Math.max(-1,Math.min(1,v))}
  function clearUrls(){urls.forEach(URL.revokeObjectURL);urls=[]}
  function titleCase(s){return s.replace(/(^|\s)\S/g,x=>x.toUpperCase())}

  function addTone(buf, sr, start, len, freq, amp, wave='sine'){
    const a=Math.max(0,Math.floor(start*sr)), b=Math.min(buf.length,Math.floor((start+len)*sr));
    for(let i=a;i<b;i++){const t=(i-a)/sr, x=t/len;const env=Math.sin(Math.PI*Math.min(1,x))*.8 + .2*(1-x);let w;
      const p=2*Math.PI*freq*t;
      if(wave==='square')w=Math.sign(Math.sin(p)); else if(wave==='tri')w=2/Math.PI*Math.asin(Math.sin(p)); else w=Math.sin(p);
      buf[i]+=w*amp*env;
    }
  }
  function addKick(buf,sr,start,amp){
    const a=Math.floor(start*sr), len=.28, b=Math.min(buf.length,a+Math.floor(len*sr));
    for(let i=a;i<b;i++){const t=(i-a)/sr, env=Math.exp(-12*t);const f=70-34*(t/len);buf[i]+=Math.sin(2*Math.PI*f*t)*amp*env}
  }
  function addNoise(buf,sr,start,len,amp,rand,bright=false){
    const a=Math.floor(start*sr), b=Math.min(buf.length,a+Math.floor(len*sr));let prev=0;
    for(let i=a;i<b;i++){const t=(i-a)/sr, env=Math.exp(-(bright?28:16)*t);const n=rand()*2-1;const v=bright?(n-prev):n;prev=n;buf[i]+=v*amp*env}
  }
  function mixActive(stems, active){
    const len=stems.drums.length, out=new Float32Array(len);const keys=['drums','bass','chords','melody'];
    for(const k of keys) if(active[k]) for(let i=0;i<len;i++) out[i]+=stems[k][i];
    let peak=.001;for(let i=0;i<len;i++)peak=Math.max(peak,Math.abs(out[i]));const gain=Math.min(1,.92/peak);
    for(let i=0;i<len;i++)out[i]=clamp(out[i]*gain);
    return out;
  }
  function wav(samples,sr=22050){
    const ab=new ArrayBuffer(44+samples.length*2), v=new DataView(ab);
    const str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
    str(0,'RIFF');v.setUint32(4,36+samples.length*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples.length*2,true);
    let o=44;for(let i=0;i<samples.length;i++,o+=2){const s=clamp(samples[i]);v.setInt16(o,s<0?s*32768:s*32767,true)}
    return new Blob([ab],{type:'audio/wav'});
  }
  function makeUrl(blob){const u=URL.createObjectURL(blob);urls.push(u);return u}
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=makeUrl(blob);a.download=name;document.body.appendChild(a);a.click();a.remove()}
  function jsonDownload(data,name){downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),name)}

  async function build(){
    const text=prompt.value.trim() || 'Original instrumental music';
    generateBtn.disabled=true;variationBtn.disabled=true;statusEl.textContent='COMPOSING';statusEl.classList.add('live');
    await new Promise(r=>setTimeout(r,40));
    clearUrls();

    const seconds=Number(duration.value), sr=22050, len=Math.floor(seconds*sr);
    const bpm=tempo.value==='auto' ? genreDefaults[genre.value] : Number(tempo.value);
    const seed=hash([text,genre.value,mood.value,energy.value,variation].join('|'));
    const rand=rng(seed), root=roots[Math.floor(rand()*roots.length)], scale=scales[mood.value]||scales.uplifting;
    const stems={drums:new Float32Array(len),bass:new Float32Array(len),chords:new Float32Array(len),melody:new Float32Array(len)};
    const beat=60/bpm, beats=Math.ceil(seconds/beat), intensity=energy.value==='high'?1.15:energy.value==='low'?.72:1;

    const progression=[0,3,4,1].map(x=>scale[x%scale.length]);
    for(let b=0;b<beats;b++){
      const t=b*beat, bar=Math.floor(b/4), degree=progression[bar%progression.length];
      addKick(stems.drums,sr,t,.78*intensity);
      if(b%2===1)addNoise(stems.drums,sr,t,.16,.30*intensity,rand,false);
      addNoise(stems.drums,sr,t,.05,.07*intensity,rand,true);
      addNoise(stems.drums,sr,t+beat/2,.035,.045*intensity,rand,true);

      const bassNote=root-12+degree;
      addTone(stems.bass,sr,t,beat*.82,midi(bassNote),.20*intensity,'sine');
      if(genre.value==='amapiano' && b%2===1) addTone(stems.bass,sr,t+beat*.45,beat*.32,midi(bassNote-5),.17*intensity,'sine');

      if(b%4===0){
        const chordRoot=root+degree;
        [0,4,7].forEach((n,j)=>addTone(stems.chords,sr,t,beat*3.7,midi(chordRoot+n),(.055-j*.008)*intensity,'tri'));
      }
      if(rand()>.36){
        const note=root+12+scale[Math.floor(rand()*scale.length)];
        const when=t+(rand()>.55?beat/2:0);
        addTone(stems.melody,sr,when,beat*(rand()>.6?.42:.72),midi(note),.10*intensity,rand()>.7?'tri':'sine');
      }
    }

    const active={};stemButtons.forEach(b=>active[b.dataset.stem]=b.classList.contains('active'));
    const mixed=mixActive(stems,active), mixBlob=wav(mixed,sr), mixUrl=makeUrl(mixBlob);
    player.src=mixUrl;downloadMix.href=mixUrl;downloadMix.download='soundlab-'+seed+'.wav';downloadMix.classList.remove('disabled');
    const projectId='sla_'+seed.toString(36)+'_'+Date.now().toString(36);
    current={projectId,seed,text,genre:genre.value,mood:mood.value,seconds,bpm,energy:energy.value,sr,stems,active,mixBlob,createdAt:new Date().toISOString(),engine:'soundlab-local-v1'};
    trackTitle.textContent=titleCase(genre.value)+' · '+titleCase(mood.value)+' · Variation '+(variation+1);
    metaGenre.textContent=titleCase(genre.value);metaBpm.textContent=bpm+' BPM';metaDuration.textContent=seconds+' sec';heroBpm.textContent=bpm+' BPM';
    statusEl.textContent='GENERATED';downloadStems.disabled=false;receiptBtn.disabled=false;handoffBtn.disabled=false;variationBtn.disabled=false;generateBtn.disabled=false;
  }

  function refreshMix(){
    if(!current)return;const at=player.currentTime||0, was=!player.paused;
    current.active={};stemButtons.forEach(b=>current.active[b.dataset.stem]=b.classList.contains('active'));
    const mixed=mixActive(current.stems,current.active), blob=wav(mixed,current.sr), url=makeUrl(blob);
    current.mixBlob=blob;player.src=url;downloadMix.href=url;player.currentTime=Math.min(at,current.seconds-.05);if(was)player.play().catch(()=>{});
  }

  generateBtn.addEventListener('click',()=>{variation=0;build().catch(err=>{statusEl.textContent='ERROR';generateBtn.disabled=false;alert(err.message||String(err))})});
  variationBtn.addEventListener('click',()=>{variation++;build().catch(err=>alert(err.message||String(err)))});
  stemButtons.forEach(b=>b.addEventListener('click',()=>{b.classList.toggle('active');b.querySelector('span').textContent=b.classList.contains('active')?'◉':'○';refreshMix()}));
  genre.addEventListener('change',()=>{if(tempo.value==='auto')heroBpm.textContent=genreDefaults[genre.value]+' BPM'});
  tempo.addEventListener('change',()=>heroBpm.textContent=(tempo.value==='auto'?genreDefaults[genre.value]:tempo.value)+' BPM');

  downloadStems.addEventListener('click',()=>{
    if(!current)return;['drums','bass','chords','melody'].forEach((k,i)=>setTimeout(()=>downloadBlob(wav(current.stems[k],current.sr),'soundlab-'+current.projectId+'-'+k+'.wav'),i*160));
  });
  receiptBtn.addEventListener('click',()=>{
    if(!current)return;jsonDownload({project_id:current.projectId,created_at:current.createdAt,engine:current.engine,prompt:current.text,genre:current.genre,mood:current.mood,energy:current.energy,duration_seconds:current.seconds,bpm:current.bpm,seed:current.seed,stems:['drums','bass','chords','melody'],notice:'Generation metadata receipt. This file is not legal advice or a substitute for a negotiated third-party licence.'},'soundlab-'+current.projectId+'-receipt.json');
  });
  handoffBtn.addEventListener('click',()=>{
    if(!current)return;jsonDownload({schema:'soundlab.media-handoff.v1',source:'SOUNDLAB AI',project_id:current.projectId,title:trackTitle.textContent,created_at:current.createdAt,audio:{format:'wav',duration_seconds:current.seconds,bpm:current.bpm,stems_available:true},creative:{prompt:current.text,genre:current.genre,mood:current.mood,energy:current.energy},targets:['allegro','kora'],rights_gate:{third_party_samples:false,upstream_provider:'none-local-engine',review_required_before_public_distribution:true}},'soundlab-'+current.projectId+'-handoff.json');
  });

  prompt.value='Uplifting amapiano instrumental for a fashion launch with warm piano, deep log drum and a confident ending.';
})();