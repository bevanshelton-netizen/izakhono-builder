function int(value,name){
  const n=Number(value);if(!Number.isInteger(n)||n<0)throw new Error(`${name} must be a non-negative integer`);return n;
}
export function clearset(input={}){
  const gross=int(input.gross_minor??0,'gross_minor');
  const thirdParty=int(input.third_party_minor??0,'third_party_minor');
  const vat=int(input.vat_reserve_minor??0,'vat_reserve_minor');
  const tax=int(input.income_tax_reserve_minor??0,'income_tax_reserve_minor');
  const provider=int(input.provider_cost_minor??0,'provider_cost_minor');
  const refund=int(input.refund_reserve_minor??0,'refund_reserve_minor');
  const other=int(input.other_obligations_minor??0,'other_obligations_minor');
  const reserved=thirdParty+vat+tax+provider+refund+other;
  if(reserved>gross)throw new Error('Obligations exceed gross receipts');
  return {
    gross_minor:gross,
    obligations:{
      third_party_minor:thirdParty,
      vat_reserve_minor:vat,
      income_tax_reserve_minor:tax,
      provider_cost_minor:provider,
      refund_reserve_minor:refund,
      other_obligations_minor:other,
      total_minor:reserved
    },
    available_minor:gross-reserved,
    status:'classified_and_funded'
  };
}

export function requireTaxProfessional(input={}){
  return Boolean(input.cross_border||input.withholding_tax||input.uncertain_vat||input.large_one_off_adjustment||input.entity_change);
}

export function settlementReady(record={}){
  return Boolean(
    record.identity_resolved&&
    record.beneficial_owner_resolved&&
    record.ledger_posted&&
    record.obligations_classified&&
    record.reserve_funding_confirmed&&
    !record.active_dispute
  );
}
