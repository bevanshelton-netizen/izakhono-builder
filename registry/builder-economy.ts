export type BuilderPlan = "free"|"pro"|"team"|"business"|"enterprise";
export type AppStage = "idea"|"building"|"preview"|"verified"|"deployed"|"monetizing"|"scaled";

export type BuilderProduct = {
  id:string;
  category:"build"|"cloud"|"marketplace"|"distribution"|"growth"|"trust"|"finance";
  description:string;
  metered:boolean;
};

export const BUILDER_PRODUCTS:BuilderProduct[] = [
  {id:"studio",category:"build",description:"Visual and code-first application builder.",metered:false},
  {id:"ai-builder",category:"build",description:"AI-assisted specification, generation and refactoring.",metered:true},
  {id:"preview",category:"cloud",description:"Isolated preview environments.",metered:true},
  {id:"builds",category:"cloud",description:"Build and packaging compute.",metered:true},
  {id:"runtime",category:"cloud",description:"Production application runtime.",metered:true},
  {id:"storage",category:"cloud",description:"Application object and file storage.",metered:true},
  {id:"data",category:"cloud",description:"Application database/data services.",metered:true},
  {id:"observability",category:"cloud",description:"Logs, metrics, traces and health monitoring.",metered:true},
  {id:"domains",category:"distribution",description:"Domain and DNS services through approved adapters.",metered:true},
  {id:"app-registry",category:"marketplace",description:"Application discovery and distribution.",metered:false},
  {id:"api-marketplace",category:"marketplace",description:"API publication, discovery and metering.",metered:true},
  {id:"component-marketplace",category:"marketplace",description:"Components, templates and workflow marketplace.",metered:true},
  {id:"agent-marketplace",category:"marketplace",description:"AI agents and workers marketplace.",metered:true},
  {id:"payments",category:"finance",description:"Checkout, billing, ledger and payout infrastructure.",metered:true},
  {id:"analytics",category:"growth",description:"Product and commercial analytics.",metered:true},
  {id:"growth",category:"growth",description:"SEO, referrals, campaigns and lifecycle tooling.",metered:true},
  {id:"security",category:"trust",description:"Security scanning and trust evidence.",metered:true},
  {id:"verification",category:"trust",description:"Application and publisher verification.",metered:true}
];

export type AppManifest = {
  schema:"izakhono.app/v1";
  appId:string;
  name:string;
  ownerId:string;
  stage:AppStage;
  plan:BuilderPlan;
  permissions:string[];
  dependencies:string[];
  products:string[];
  billing?:{model:"free"|"subscription"|"usage"|"one_time"|"marketplace"; currency?:string};
};

export function validateAppManifest(m:AppManifest) {
  if (m.schema!=="izakhono.app/v1") throw new Error("Unsupported app manifest");
  if (!m.appId || !m.ownerId || !m.name) throw new Error("Missing app identity");
  if (!m.products.length) throw new Error("App must declare at least one platform product");
  for (const product of m.products) if (!BUILDER_PRODUCTS.some(p=>p.id===product)) throw new Error(`Unknown platform product: ${product}`);
  return true;
}
