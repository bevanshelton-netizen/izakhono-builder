ALTER TABLE docflow_drafts ADD COLUMN recipient_name TEXT NOT NULL DEFAULT '';
ALTER TABLE docflow_drafts ADD COLUMN recipient_email TEXT NOT NULL DEFAULT '';
ALTER TABLE docflow_drafts ADD COLUMN signature_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE docflow_drafts ADD COLUMN delivery_mode TEXT NOT NULL DEFAULT 'email_link';
