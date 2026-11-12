-- Optimise signed WhatsApp webhook phone-number-to-tenant resolution.
create index if not exists ic_channel_connections_provider_external_status_idx
  on public.ic_channel_connections (provider, external_account_id, status);
