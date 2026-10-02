export type UsageEvent = {
  eventId:string;
  appId:string;
  developerId:string;
  metric:"build_minutes"|"runtime_compute"|"storage_gb_month"|"api_calls"|"ai_tokens"|"bandwidth_gb"|"marketplace_gmv";
  quantity:number;
  occurredAt:string;
  idempotencyKey:string;
};

export type RevenueLine = {
  eventId:string;
  appId:string;
  metric:UsageEvent["metric"];
  quantity:number;
  billable:boolean;
  ledgerReference?:string;
};

export function normalizeUsage(event:UsageEvent):RevenueLine {
  if (!event.eventId || !event.appId || !event.developerId) throw new Error("Invalid usage event");
  if (!Number.isFinite(event.quantity) || event.quantity < 0) throw new Error("Invalid usage quantity");
  if (!event.idempotencyKey) throw new Error("Missing idempotency key");
  return {
    eventId:event.eventId,
    appId:event.appId,
    metric:event.metric,
    quantity:event.quantity,
    billable:event.metric!=="marketplace_gmv"
  };
}
