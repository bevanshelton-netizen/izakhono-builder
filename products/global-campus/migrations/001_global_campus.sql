-- IZAKHONO Global Campus — PostgreSQL schema baseline
-- Apply only after the target database and migration process are approved.
-- No database is modified by committing this file.

create extension if not exists pgcrypto;

create table if not exists gc_countries (
  id text primary key,
  name text not null,
  iso_3166_1_alpha2 char(2) unique,
  default_currency char(3),
  created_at timestamptz not null default now()
);

create table if not exists gc_institutions (
  id text primary key,
  country_id text not null references gc_countries(id),
  name text not null,
  institution_type text not null check (institution_type in (
    'public-university','university-of-technology','comprehensive-university',
    'private-higher-education','public-tvet','private-college','public-cet',
    'professional-academy','other-tertiary'
  )),
  registration_number text,
  registration_status text not null default 'unknown' check (registration_status in (
    'active','provisional','cancelled','expired','not-applicable','unknown'
  )),
  official_website text,
  source_url text not null,
  source_title text,
  source_accessed_at date,
  verification_status text not null default 'discovered' check (verification_status in (
    'discovered','needs-review','verified','superseded','rejected'
  )),
  verified_at date,
  verified_by text,
  aliases text[] not null default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verification_status <> 'verified' or verified_at is not null)
);

create index if not exists gc_institutions_country_type_idx
  on gc_institutions(country_id, institution_type, verification_status);

create table if not exists gc_campuses (
  id text primary key,
  institution_id text not null references gc_institutions(id) on delete cascade,
  name text not null,
  province_or_region text,
  city text,
  official_source_url text,
  verification_status text not null default 'needs-review',
  verified_at date
);

create table if not exists gc_faculties (
  id text primary key,
  institution_id text not null references gc_institutions(id) on delete cascade,
  name text not null,
  official_source_url text,
  verification_status text not null default 'needs-review',
  verified_at date
);

create table if not exists gc_departments (
  id text primary key,
  faculty_id text not null references gc_faculties(id) on delete cascade,
  name text not null,
  official_source_url text,
  verification_status text not null default 'needs-review',
  verified_at date
);

create table if not exists gc_qualifications (
  id text primary key,
  institution_id text not null references gc_institutions(id) on delete cascade,
  faculty_id text references gc_faculties(id) on delete set null,
  department_id text references gc_departments(id) on delete set null,
  title text not null,
  qualification_type text,
  nqf_or_framework_level text,
  qualification_code text,
  effective_from date,
  effective_to date,
  official_source_url text not null,
  verification_status text not null default 'discovered',
  verified_at date,
  metadata jsonb not null default '{}',
  check (verification_status <> 'verified' or verified_at is not null)
);

create table if not exists gc_modules (
  id text primary key,
  qualification_id text not null references gc_qualifications(id) on delete cascade,
  academic_year text,
  semester_or_term text,
  module_code text,
  title text not null,
  credits numeric(8,2),
  language_code text,
  description text,
  effective_from date,
  effective_to date,
  official_source_url text not null,
  source_accessed_at date not null,
  verification_status text not null default 'discovered' check (verification_status in (
    'discovered','needs-review','verified','superseded','rejected'
  )),
  verified_at date,
  verified_by text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verification_status <> 'verified' or verified_at is not null)
);

create index if not exists gc_modules_code_idx on gc_modules(module_code);
create index if not exists gc_modules_title_idx on gc_modules using gin (to_tsvector('simple', title));

create table if not exists gc_learning_outcomes (
  id text primary key,
  module_id text not null references gc_modules(id) on delete cascade,
  outcome_text text not null,
  sequence_number integer not null default 0
);

create table if not exists gc_topics (
  id text primary key,
  parent_id text references gc_topics(id) on delete set null,
  taxonomy_version text not null,
  subject_code text,
  title text not null,
  synonyms text[] not null default '{}',
  description text
);

create table if not exists gc_module_topics (
  module_id text not null references gc_modules(id) on delete cascade,
  topic_id text not null references gc_topics(id) on delete cascade,
  mapping_basis text not null default 'editorial-review',
  primary key (module_id, topic_id)
);

create table if not exists gc_sources (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  source_title text,
  publisher text,
  source_type text not null,
  accessed_at date not null,
  published_at date,
  licence_or_rights_basis text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists gc_publications (
  id text primary key,
  title text not null,
  subtitle text,
  description text,
  subject_codes text[] not null default '{}',
  product_type text not null,
  master_language_code text not null,
  rights_status text not null default 'pending' check (rights_status in ('pending','cleared','restricted','rejected')),
  editorial_status text not null default 'draft' check (editorial_status in ('draft','in-review','approved','rejected')),
  specialist_review_required boolean not null default false,
  specialist_review_status text not null default 'not-required' check (specialist_review_status in ('not-required','pending','approved','rejected')),
  publication_status text not null default 'draft' check (publication_status in ('draft','in-review','approved','published','withdrawn')),
  edition_number integer not null default 1,
  published_at date,
  review_due_at date,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists gc_publication_editions (
  id text primary key,
  publication_id text not null references gc_publications(id) on delete cascade,
  language_code text not null,
  locale text,
  edition_number integer not null default 1,
  translation_status text not null default 'not-started' check (translation_status in (
    'not-started','translating','native-review','specialist-review','approved','rejected'
  )),
  file_uri text,
  file_checksum text,
  rtl_layout boolean not null default false,
  released_at date,
  reviewed_at date,
  unique(publication_id, language_code, edition_number)
);

create table if not exists gc_publication_sources (
  publication_id text not null references gc_publications(id) on delete cascade,
  source_id uuid not null references gc_sources(id) on delete restrict,
  usage_note text,
  primary key (publication_id, source_id)
);

create table if not exists gc_module_publication_alignments (
  id text primary key,
  module_id text not null references gc_modules(id) on delete cascade,
  publication_id text not null references gc_publications(id) on delete cascade,
  alignment_level text not null check (alignment_level in ('exact','strong','supplementary','adjacent')),
  rationale text not null,
  evidence_source_url text not null,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  reviewer_id text,
  institution_endorsed boolean not null default false,
  endorsement_evidence_url text,
  created_at timestamptz not null default now(),
  check (not institution_endorsed or endorsement_evidence_url is not null)
);

create index if not exists gc_alignment_module_idx on gc_module_publication_alignments(module_id, review_status);
create index if not exists gc_alignment_publication_idx on gc_module_publication_alignments(publication_id, review_status);

create table if not exists gc_review_records (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  review_type text not null,
  reviewer_name text not null,
  reviewer_qualification text,
  outcome text not null check (outcome in ('approved','changes-required','rejected')),
  reviewed_at timestamptz not null default now(),
  notes text,
  evidence_uri text
);

create table if not exists gc_change_log (
  id bigserial primary key,
  entity_type text not null,
  entity_id text not null,
  change_type text not null,
  changed_by text,
  changed_at timestamptz not null default now(),
  before_state jsonb,
  after_state jsonb,
  reason text
);

-- Public student discovery must query this view, never raw draft tables.
create or replace view gc_student_verified_modules as
select
  m.id as module_id,
  m.module_code,
  m.title as module_title,
  m.academic_year,
  m.semester_or_term,
  m.language_code,
  q.id as qualification_id,
  q.title as qualification_title,
  i.id as institution_id,
  i.name as institution_name,
  i.country_id,
  i.institution_type,
  m.official_source_url,
  m.verified_at
from gc_modules m
join gc_qualifications q on q.id = m.qualification_id
join gc_institutions i on i.id = q.institution_id
where m.verification_status = 'verified'
  and q.verification_status = 'verified'
  and i.verification_status = 'verified'
  and i.registration_status in ('active','not-applicable');

-- Publication release gate is evaluated by application logic as well as database status.
create or replace view gc_releasable_publications as
select p.*
from gc_publications p
where p.rights_status = 'cleared'
  and p.editorial_status = 'approved'
  and p.publication_status in ('approved','published')
  and (not p.specialist_review_required or p.specialist_review_status = 'approved')
  and exists (
    select 1
    from gc_module_publication_alignments a
    join gc_student_verified_modules vm on vm.module_id = a.module_id
    where a.publication_id = p.id and a.review_status = 'approved'
  );
