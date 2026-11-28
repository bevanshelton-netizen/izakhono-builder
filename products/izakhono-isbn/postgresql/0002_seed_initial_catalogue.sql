-- Initial IZAKHONO publisher and NLSA application history.
-- No ISBN is pre-populated or fabricated.
INSERT INTO publishers (id, legal_name, country_code, contact_name, contact_email)
VALUES ('pub-izakhono-africa', 'IZAKHONO AFRICA (PTY) LTD', 'ZA', 'Bevan Shelton', 'info@xqwaxqwamile.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO imprints (id, publisher_id, name, description)
VALUES ('imprint-selfhelp-stories', 'pub-izakhono-africa', 'SELFHELP Stories', 'IZAKHONO book publishing imprint.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO authors (id, display_name, pen_name)
VALUES ('author-bevan-shelton', 'Bevan Shelton', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO works (id, publisher_id, imprint_id, title, subtitle, language_code, publication_status)
VALUES ('work-business-of-music', 'pub-izakhono-africa', 'imprint-selfhelp-stories',
        'THE BUSINESS OF MUSIC™', 'From Talent to Catalogue. From Catalogue to Career.', 'en', 'in_production')
ON CONFLICT (id) DO NOTHING;

INSERT INTO work_authors (work_id, author_id, contributor_role, display_order)
VALUES ('work-business-of-music', 'author-bevan-shelton', 'author', 1)
ON CONFLICT DO NOTHING;

INSERT INTO editions (id, work_id, edition_statement, format_code, language_code, status, publisher_display)
VALUES ('edition-business-of-music-epub-2026', 'work-business-of-music', 'First Global Edition, 2026',
        'EPUB', 'en', 'submitted_to_agency', 'IZAKHONO AFRICA (PTY) LTD')
ON CONFLICT (id) DO NOTHING;

INSERT INTO agency_applications (
  id, agency_name, contact_person, contact_email, submitted_at, follow_up_at,
  status, titles_json, correspondence_notes, evidence_ref, next_action
) VALUES (
  'application-nlsa-business-of-music-2026',
  'National Library of South Africa',
  'Motubatse Kgatle',
  'Motubatse.Kgatle@nlsa.ac.za',
  '2026-10-06',
  '2026-10-14',
  'submitted',
  '[{"title":"THE BUSINESS OF MUSIC™","format":"EPUB"}]',
  'Formal request sent 6 October 2026; follow-up sent 14 October 2026. No agency response or ISBN allocation is verified in the retrieved email thread.',
  'gmail-thread:1a1125845cddacf7',
  'Await agency acknowledgement and publisher registration / ISBN allocation guidance.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO works (id, publisher_id, imprint_id, title, publication_status) VALUES
  ('work-the-invitation', 'pub-izakhono-africa', 'imprint-selfhelp-stories', 'The Invitation', 'development'),
  ('work-the-secret', 'pub-izakhono-africa', 'imprint-selfhelp-stories', 'The Secret', 'development'),
  ('work-the-door', 'pub-izakhono-africa', 'imprint-selfhelp-stories', 'The Door', 'development'),
  ('work-the-choice', 'pub-izakhono-africa', 'imprint-selfhelp-stories', 'The Choice', 'development'),
  ('work-the-morning-after', 'pub-izakhono-africa', 'imprint-selfhelp-stories', 'The Morning After', 'development'),
  ('work-the-consequence', 'pub-izakhono-africa', 'imprint-selfhelp-stories', 'The Consequence', 'development')
ON CONFLICT (id) DO NOTHING;

INSERT INTO agency_correspondence (id, application_id, direction, occurred_at, recipient, subject, evidence_ref, summary)
VALUES
('correspondence-nlsa-initial-2026-10-06','application-nlsa-business-of-music-2026','outgoing','2026-10-06T00:00:00Z','National Library of South Africa','ISBN application: THE BUSINESS OF MUSIC™ (EPUB)','gmail-thread:1a1125845cddacf7','Initial ISBN application and publisher registration request submitted for THE BUSINESS OF MUSIC™ EPUB.'),
('correspondence-nlsa-followup-2026-10-14','application-nlsa-business-of-music-2026','outgoing','2026-10-14T00:00:00Z','National Library of South Africa','Follow-up: ISBN application for THE BUSINESS OF MUSIC™ (EPUB)',NULL,'Follow-up sent requesting acknowledgement and progress on the outstanding application.'),
('correspondence-nlsa-escalation-2026-11-26','application-nlsa-business-of-music-2026','outgoing','2026-11-26T10:07:21Z','info@nlsa.ac.za','Escalation: Outstanding ISBN application and publisher registration – IZAKHONO AFRICA (PTY) LTD','gmail-message:1a21752f0d53d530','Escalation sent; Motubatse.Kgatle@nlsa.ac.za copied. No reply or ISBN allocation is yet verified.')
ON CONFLICT (id) DO NOTHING;
