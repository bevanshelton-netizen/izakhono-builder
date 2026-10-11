export type OrganisationInput={name:string;countryCode:string;timezone:string;sportSlugs:string[]};
export type AthleteInput={firstName:string;lastName:string;dateOfBirth?:string;sportSlug:string};
export type CompetitionInput={name:string;sportSlug:string;season:string;startsAt:string;endsAt?:string};
export type InventoryInput={organisationId:string;name:string;sportSlug:string;assetType:string;audience:string;geography:string;price:number;currency:string;deliverables:string[]};

export const onboardingSteps=['ORGANISATION','SPORTS','TEAMS','ATHLETES','COMPETITIONS','COMMERCIAL_INVENTORY','SPONSORS'];
export const athletePassport=(athleteId:string)=>({passportId:`ISP-${athleteId}`,status:'ACTIVE',portable:true,verifiedFields:['identity','sport'],history:['registrations','teams','competitions','results']});
export const sponsorActivationStages=['DISCOVER','MATCH','PROPOSE','CONTRACT','ACTIVATE','MEASURE','OPTIMISE','RENEW','EXPAND'];
