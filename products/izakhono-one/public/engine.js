export class IzakhonoOneEngine {
  constructor(registry){this.registry=registry;this.services=registry.services||[]}
  static async boot(){const response=await fetch('./registry.json',{cache:'no-store'});if(!response.ok)throw new Error('registry_unavailable');return new IzakhonoOneEngine(await response.json())}
  search(query=''){const q=String(query).trim().toLowerCase();if(!q)return this.services;return this.services.filter(service=>[service.name,service.slug,service.category,service.description].join(' ').toLowerCase().includes(q))}
  resolve(slug){return this.services.find(service=>service.slug===slug)||null}
  route(slug){const service=this.resolve(slug);if(!service)return{ok:false,reason:'service_not_found'};if(!service.publicUrl||!['verified','external-resilience'].includes(service.status))return{ok:false,reason:'route_not_publicly_verified',service};return{ok:true,url:service.publicUrl,service}}
  health(){return{status:'ok',engine:this.registry.engine,services:this.services.length,noTracking:true}}
}
