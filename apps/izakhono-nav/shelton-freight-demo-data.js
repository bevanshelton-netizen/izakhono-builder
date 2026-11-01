/* SHELTON FREIGHT COMMAND — demo data adapter
 * Demo-only until authenticated fleet APIs are connected.
 * No live vehicle positions, safety incidents, or dispatch claims are made here.
 */
window.SHELTON_FREIGHT_DEMO={
  connected:false,
  mode:'DEMO',
  updatedAt:new Date().toISOString(),
  kpis:{vehiclesActive:12,journeysActive:9,onTimeEta:'94%',safetyEvents:2,verifiedHazards:0,connectivity:'97%'},
  vehicles:[
    {id:'SF-021',driver:'M. Dlamini',route:'Johannesburg → Durban',status:'EN ROUTE',eta:'18:40',connectivity:'ONLINE',load:'38.4 t'},
    {id:'SF-014',driver:'T. Mokoena',route:'Pretoria → Gqeberha',status:'EN ROUTE',eta:'22:15',connectivity:'ONLINE',load:'31.8 t'},
    {id:'SF-033',driver:'L. Ndlovu',route:'Durban → Bloemfontein',status:'SAFETY CHECK',eta:'20:05',connectivity:'LIMITED',load:'26.2 t'},
    {id:'SF-009',driver:'S. Maseko',route:'Johannesburg → Polokwane',status:'AT DEPOT',eta:'—',connectivity:'ONLINE',load:'18.7 t'}
  ],
  alerts:[
    {level:'GUARDED',title:'Driver safety check requested',vehicle:'SF-033',source:'Demo event'},
    {level:'INFO',title:'Connectivity recovered',vehicle:'SF-014',source:'Demo event'},
    {level:'INFO',title:'No verified road hazards in demo feed',vehicle:'FLEET',source:'NAV Hazard Gateway'}
  ]
};
