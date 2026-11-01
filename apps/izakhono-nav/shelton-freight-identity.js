/* SHELTON FREIGHT identity + journey assignment layer
 * Backend-neutral. Uses authenticated API when available and explicit demo fallback otherwise.
 */
(function(){
  const API='/api/freight';
  const DEMO={
    drivers:[
      {id:'DRV-001',name:'Thabo Mokoena',status:'on_duty',licenseClass:'EC',safety:'good'},
      {id:'DRV-002',name:'Siyabonga Ndlovu',status:'on_duty',licenseClass:'EC',safety:'good'},
      {id:'DRV-003',name:'Lerato Molefe',status:'available',licenseClass:'EC',safety:'good'}
    ],
    vehicles:[
      {id:'SF-TRK-001',registration:'CA 45 821 EC',type:'freight_tractor',profile:'heavy_haul',status:'active'},
      {id:'SF-TRK-002',registration:'CY 71 204 EC',type:'freight_tractor',profile:'long_haul',status:'active'},
      {id:'SF-TRK-003',registration:'GP 63 118',type:'freight_tractor',profile:'regional',status:'available'}
    ],
    assignments:[]
  };
  async function get(path,fallback){
    try{const r=await fetch(API+path,{credentials:'include',headers:{Accept:'application/json'},cache:'no-store'});if(!r.ok)throw 0;return await r.json();}
    catch(e){return fallback;}
  }
  async function drivers(){const x=await get('/drivers',{data:DEMO.drivers});return x.data||x.drivers||DEMO.drivers;}
  async function vehicles(){const x=await get('/vehicles',{data:DEMO.vehicles});return x.data||x.vehicles||DEMO.vehicles;}
  async function assign(payload){
    const body={driver_id:payload.driverId,vehicle_id:payload.vehicleId,journey_id:payload.journeyId||null,route:payload.route||null,assigned_at:new Date().toISOString()};
    try{const r=await fetch(API+'/journeys',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});if(!r.ok)throw 0;return {mode:'LIVE',assignment:await r.json()};}
    catch(e){const assignment={id:'DEMO-ASN-'+Date.now(),...body,status:'assigned'};DEMO.assignments.push(assignment);return {mode:'DEMO',assignment};}
  }
  window.SHELTONFreightIdentity={drivers,vehicles,assign};
})();
