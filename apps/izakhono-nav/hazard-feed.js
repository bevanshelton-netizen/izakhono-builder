(function(){
  const DEFAULT_ENDPOINT='/api/nav/hazards';
  const MAX_BYTES=500000;
  async function fetchFeed(endpoint=DEFAULT_ENDPOINT,options={}){
    const url=endpoint||DEFAULT_ENDPOINT;
    try{
      const res=await fetch(url,{headers:{Accept:'application/json',...(options.headers||{})},cache:'no-store',signal:options.signal});
      if(!res.ok) throw new Error(`hazard-feed-${res.status}`);
      const text=await res.text();
      if(text.length>MAX_BYTES) throw new Error('hazard-feed-too-large');
      const payload=JSON.parse(text);
      const parsed=window.IZAKHONONavHazards.parseHazards(payload,Date.now());
      return {ok:true,source:url,receivedAt:new Date().toISOString(),...parsed};
    }catch(error){
      return {ok:false,source:url,receivedAt:new Date().toISOString(),accepted:[],rejected:[],error:error.message||'hazard-feed-unavailable'};
    }
  }
  window.IZAKHONOHazardFeed={fetchFeed,DEFAULT_ENDPOINT};
})();