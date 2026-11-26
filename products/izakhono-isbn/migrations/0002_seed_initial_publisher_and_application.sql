-- Initial IZAKHONO publishing records. No ISBN is pre-populated or fabricated.
INSERT OR IGNORE INTO publishers (id, legal_name, country_code, contact_name, contact_email)
VALUES ('pub-izakhono-africa', 'IZAKHONO AFRICA (PTY) LTD', 'ZA', 'Bevan Shelton', 'info@xqwaxqwamile.com');

INSERT OR IGNORE INTO imprints (id, publisher_id, name, description)
VALUES ('imprint-selfhelp-stories', 'pub-izakhono-africa', 'SELFHELP Stories', 'IZAKHONO book publishing imprint.');

INSERT OR IGNORE INTO authors (id, display_name, pen_name)
VALUES ('author-bevan-shelton', 'Bevan Shelton', 0);

INSERT OR IGNORE INTO works (id, publisher_id, imprint_id, title, subtitle, language_code, publication_status)
VALUES ('work-business-of-music', 'pub-izakhono-africa', 'imprint-selfhelp-stories',
        'THE BUSINESS OF MUSIC™', 'From Talent to Catalogue. From Catalogue to Career.', 'en', 'in_production');

INSERT OR IGNORE INTO work_authors (work_id, author_id, contributor_role, display_order)
VALUES ('work-business-of-music', 'author-bevan-shelton', 'author', 1);

INSERT OR IGNORE INTO editions (id, work_id, edition_statement, format_code, language_code, status, publisher_display)
VALUES ('edition-business-of-music-epub-2026', 'work-business-of-music', 'First Global Edition, 2026',
        'EPUB', 'en', 'submitted_to_agency', 'IZAKHONO AFRICA (PTY) LTD');

INSERT OR IGNORE INTO agency_applications (
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
  'Escalate to NLSA general office and request acknowledgement, publisher registration guidance and ISBN allocation status.'
);
