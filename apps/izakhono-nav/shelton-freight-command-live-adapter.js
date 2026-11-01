/* SHELTON FREIGHT COMMAND — API adapter
 * Reads the contract-only endpoints when an authenticated backend is available.
 * Falls back to clearly labelled demo data. Never invents live fleet state.
 */
(function(){
  const API='/api/freight';
  async function get(path){
    const r=await fetch(API+path,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!r.ok) throw new Error('API '+r.status);
    return r.json();
  }
  async function load(){
    try{
      const [vehicles,journeys,events]=await Promise.all([
        get('/vehicles'),get('/journeys'),get('/events')
      ]);
      return {connected:true,mode:'LIVE',vehicles:vehicles.items||vehicles.data||[],journeys:journeys.items||journeys.data||[],events:events.items||events.data||[]};
    }catch(e){
      return {connected:false,mode:'DEMO',error:e.message};
    }
  }
  window.SHELTON_FREIGHT_API={load};
})();
