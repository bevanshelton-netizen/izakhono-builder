# GLOBAL CAMPUS KNOWLEDGE NETWORK
## Programme Architecture and Execution Specification — V1.0

**Status:** Documentation baseline; implementation not yet deployed  
**Programme:** Global Knowledge Publishing  
**Initial market:** South Africa, designed for international expansion  
**Commercial model:** Individual digital guides (target reference price US$7), bundles, institutional licences and campus/library distribution  
**Date:** 26 November 2026

---

## 1. Executive mandate

Build an international academic knowledge discovery, curriculum-mapping, publishing and distribution network that places original, rights-cleared learning resources alongside the subjects students are actually studying.

This is not a generic PDF converter, a repository of copied lecture notes, or a replacement for accredited teaching. It is a curriculum-aware knowledge publishing and discovery service.

A student should be able to search using any combination of:

- Country and institution
- Faculty, school or department
- Qualification, degree, diploma or certificate
- Academic year, level or semester
- Module/course title and official module code
- Subject, concept, learning outcome or skill
- Preferred language
- Learning need (understand a concept, revise, practise, prepare for a test, improve academic writing, develop a practical skill)

The service then identifies relevant original publications and learning aids, explains why each resource is relevant, displays its sources and review status, and provides a lawful purchase or institutional-access route.

**Core principle:** meet students at the point of academic need, not only at the point of general book discovery.

## 2. Market scope and verified starting baseline

South Africa is the first national market because it provides a bounded, researchable institutional landscape and a practical test bed for a global system.

The South African Government's 2024 post-school education and training statistics report identifies:

- 26 public higher-education institutions
- 138 private higher-education institutions
- 50 public TVET colleges
- 146 private colleges
- 9 community education and training colleges

The same report records 1,115,580 enrolments at public higher-education institutions and 313,186 at private higher-education institutions in 2024. TVET college enrolments were reported at 560,446. These are sector-level enrolment counts, not unique addressable customers or sales forecasts.

**Official baseline sources**

1. DHET, *Statistics on Post-School Education and Training in South Africa: 2024*:
   https://www.dhet.gov.za/Information%20Systems%20Management%20Documents/Statistical%20Reports%20and%20Data/Reports/Statistics%20on%20Post-School%20Education%20and%20Training%20in%20South%20Africa%2C%202024.pdf
2. DHET institutional registers and directories:
   https://www.dhet.gov.za/
3. DHET universities directory:
   https://www.dhet.gov.za/SitePages/InstUniversities.aspx
4. NSFAS higher-education institution directory:
   https://www.nsfas.org.za/content/institutions.html
5. South African Government education and training overview:
   https://www.gov.za/about-sa/education

The institutional register is the authoritative starting point for identifying legal registration status. Names and counts must be rechecked against the latest DHET register before operational use. Older government pages can contain historical names or stale contact details.

### 2.1 Institution segments to include

The database must support, without forcing them into one category:

- Public universities
- Universities of technology
- Comprehensive universities
- Private higher-education institutions
- Public TVET colleges and their campuses
- Registered private colleges
- Community education and training colleges
- Professional academies and recognised specialist training providers
- International universities, colleges, polytechnics and other tertiary providers as the programme expands

Do not represent every training provider as a university. Record the institution type and registration/recognition evidence.

## 3. Curriculum intelligence: the central differentiator

Build a structured map from institution to qualification to module to learning outcome to publication.

### 3.1 Curriculum hierarchy

Country → institution → campus (optional) → faculty/school → department → qualification/programme → academic year/level → semester/term → module/course → topic/concept → learning outcome → assessment mode → supporting resource.

The system must allow a single module to belong to more than one programme and a single publication to support multiple modules, institutions or countries.

### 3.2 Required curriculum record fields

- Stable internal ID
- Country and jurisdiction
- Institution ID and institution type
- Faculty, school and department
- Qualification name and qualification level
- Programme/qualification code where published
- Academic year or cohort applicability
- Module title and official module code
- Credits and semester/term where published
- Official module description
- Learning outcomes and topic outline
- Assessment format where officially published
- Language of instruction where published
- Official source URL and source title
- Source owner/publisher
- Date accessed and last verified
- Effective academic year and superseded date
- Rights/terms notes
- Confidence/status: discovered, extracted, verified, needs review, superseded

Never infer an official module code, credit value, prescribed text or assessment requirement. If not found, mark it unknown and retain the source trail.

### 3.3 Curriculum mapping quality

Each resource-to-module mapping must explain the basis of relevance:

- Exact match: resource covers an explicitly named topic or learning outcome.
- Strong alignment: resource supports several stated outcomes.
- Supplementary: resource provides useful background or practical context.
- Adjacent: potentially useful but not a direct module match.

A mapping must never imply institutional endorsement, prescribed status or lecturer approval unless that approval has been explicitly granted and documented.

## 4. Academic discipline taxonomy

Use an expandable global subject taxonomy, not a fixed catalogue.

Initial top-level families:

1. Accounting, finance, economics and commerce
2. Business, management, entrepreneurship and administration
3. Law, governance, public policy and public administration
4. Computer science, information systems, AI, data and cybersecurity
5. Engineering, built environment and applied technology
6. Mathematics, statistics and quantitative methods
7. Natural, physical and environmental sciences
8. Medicine, nursing, allied health and public health
9. Education, teaching and learning sciences
10. Humanities, languages, philosophy, history and literature
11. Social sciences, psychology, sociology and political science
12. Agriculture, food systems, forestry and veterinary sciences
13. Architecture, design, arts and creative industries
14. Media, journalism, communication and marketing
15. Hospitality, tourism, events and culinary studies
16. Trades, artisan, occupational and vocational programmes
17. Interdisciplinary and emerging fields

Each subject family contains disciplines, topics, concepts, skills and synonyms. Taxonomy changes must be versioned so that historical mappings remain interpretable.

## 5. Knowledge-product standards

The business creates original educational publications. It does not repackage proprietary course packs, commercial textbooks, lecturer slides or examination papers without permission.

### 5.1 Standard product types

- Concept guide: explains a difficult topic in accessible language.
- Module companion: supports the published scope of a particular module.
- Worked-example workbook: original exercises with explanations and answer guidance.
- Revision guide: structured review and self-testing.
- Academic skills guide: research, referencing, writing, presentations and study methods.
- Practical skills guide: tools, methods, processes and workplace application.
- Career bridge guide: connects academic knowledge to professional practice.
- Multilingual glossary: carefully reviewed subject terminology and explanations.

### 5.2 Minimum publication contents

1. Clear title, audience, subject and intended learning support.
2. Scope statement and learning objectives.
3. Substantial original explanations, not slogan lists.
4. Worked examples, diagrams or case studies where useful.
5. Practice activities and self-check questions.
6. Answer explanations where appropriate.
7. Further reading and traceable references.
8. Rights and attribution statement.
9. Author/editor and specialist-review information.
10. Edition number, publication date and next review date.
11. Clear statement that the publication is supplementary and does not replace institutional instructions or prescribed materials.

### 5.3 Academic integrity

Products must support learning, not facilitate cheating. Do not sell completed assignments, fabricated references, impersonation, exam leaks, or work designed to be submitted as a student's own. Explain methods, provide original practice problems and model reasoning, and encourage students to follow institutional academic-integrity rules.

## 6. Source discovery, evidence and intellectual property

### 6.1 Source priority

1. Official institution programme, faculty, department and module pages.
2. Official prospectuses, handbooks, calendars and curriculum documents.
3. Official national qualification and accreditation registers.
4. Open educational resources with verified licence terms.
5. Peer-reviewed research and reputable scholarly publishers.
6. Public professional standards and recognised industry bodies.
7. Expert interviews and original research, with consent and attribution.

### 6.2 Rights controls

For every external item, record its licence or permission basis. Commercial use requires a licence that permits commercial reuse or explicit permission. Check attribution, share-alike, no-derivatives and other conditions individually. A publicly accessible webpage or PDF is not automatically reusable.

Do not copy substantial passages, tables, figures, slides or textbook chapters into a commercial guide. Use facts and ideas to inform original writing, cite sources, and obtain permission for protected expression where required.

### 6.3 Source and review record

Every high-value factual claim should be traceable to a source. Every publication should carry a source list and a documented review record. Curriculum pages and institutional rules are date-sensitive and must be rechecked each academic cycle or when the institution announces a change.

## 7. Editorial and specialist governance

Create a review workflow with the following gates:

1. Researcher prepares source pack and curriculum alignment.
2. Subject editor checks completeness, clarity and originality.
3. Qualified subject-matter reviewer checks technical accuracy.
4. Academic-integrity and rights reviewer checks sources, permissions and ethical use.
5. Language editor reviews each localized edition.
6. Final production QA checks equations, diagrams, references, accessibility and PDF rendering.
7. Release manager publishes a versioned edition with review date.

High-stakes regulated areas (law, medicine, health professions, engineering safety, financial advice and similar subjects) require appropriately qualified reviewers and jurisdiction-specific boundaries. Do not present a general guide as professional advice or as a substitute for an institution's official curriculum.

## 8. Multilingual architecture

The global ambition is to make publications available in all languages that the programme can responsibly support, through a phased quality-controlled process.

Each publication has one controlled master edition and one or more localized editions.

Required records:

- Master publication ID and master language
- Target language and locale
- Translation version and translator/editor
- Approved subject terminology glossary
- Translation memory/version
- Native-language review status
- Specialist review status where needed
- Locale-specific examples, currency, units and legal context
- Script and font QA
- Right-to-left layout QA where applicable
- Localized title, metadata, keywords and product description
- Release date and review date

Translation alone does not localize a qualification or legal framework. Curriculum terminology, professional standards, examples and jurisdiction-specific material must be adapted and reviewed.

## 9. Student discovery and distribution

### 9.1 Student-facing discovery paths

- Search by institution and qualification.
- Search by module code or title.
- Search by topic, concept or learning outcome.
- Browse by faculty, academic level and discipline.
- Browse by institution's current academic year.
- Search in the student's preferred language.
- Filter by guide type, review status and publication edition.

### 9.2 Distribution channels

- Direct international digital marketplace.
- Search-engine landing pages for institution/module/topic combinations, with clear source dates and no false affiliation.
- University and college library partnerships.
- Campus bookstores and approved resellers.
- Student societies and academic associations.
- Approved learning-management-system links or integrations.
- Institutional bulk licences and student-access programmes.
- Printed editions and audiobooks where demand and rights support them.

No institutional system is to be accessed, scraped behind authentication, or integrated without authorisation. LMS integrations require the institution's approval and appropriate privacy/security review.

### 9.3 Pricing and institutional offers

Maintain the target US$7 individual digital-guide reference price, while testing local-currency pricing and affordability. Do not assume a uniform US$7 price is appropriate in every market.

Additional models:
- Subject bundles and semester packs.
- Faculty or library subscriptions.
- Campus-wide licences.
- Bulk student vouchers.
- Sponsored access or bursary-funded resources.
- Printed workbooks and professional editions.

Revenue forecasts must be based on measured conversion, refund rates, distribution costs and customer acquisition costs—not on total national enrolment figures.

## 10. Data model (logical entities)

Initial entities:

- Country
- Jurisdiction
- Institution
- InstitutionType
- Campus
- Faculty
- Department
- Qualification
- QualificationVersion
- Module
- ModuleVersion
- LearningOutcome
- Topic
- CurriculumSource
- SourceRightsRecord
- Publication
- PublicationEdition
- PublicationTopic
- ModulePublicationAlignment
- Language
- Translation
- Reviewer
- ReviewRecord
- DistributionChannel
- InstitutionPartnership
- ProductOffer
- Licence
- ChangeLog

Every entity needs stable IDs, timestamps, provenance and status. Preserve old versions rather than silently overwriting historical curricula.

## 11. Operational dashboard and measurable outcomes

The operating dashboard should report:

- Institutions discovered, verified and pending.
- Programmes and qualifications mapped.
- Modules and learning outcomes captured.
- Curriculum sources awaiting re-verification.
- Publications by discipline and academic level.
- Module-to-publication coverage and gaps.
- Editions by language and review status.
- Publications due for review.
- Institutional partnership pipeline.
- Product views, conversion, sales, refunds and revenue.
- Student feedback and reported usefulness.
- Rights, quality and correction incidents.

Do not treat page views, institution counts or mapped modules as evidence of student learning outcomes. If learning impact is measured, use voluntary, privacy-conscious evaluation and appropriate research ethics.

## 12. South African execution sequence

### Wave 0 — Foundation
- Establish the official institution register from DHET.
- Import and normalize institution names and institution types.
- Add source URLs, registration evidence, and last-verified dates.
- Create the global taxonomy and curriculum data dictionary.
- Approve editorial, rights and review policies.

### Wave 1 — Curriculum pilot
Select a small, representative pilot cohort after reviewing the official registers and current curriculum availability. Include:
- At least one traditional/public university.
- At least one university of technology.
- At least one distance-learning institution.
- At least one public TVET college.
- At least one registered private higher-education provider, once verified.

Start with cross-institution subjects where curriculum overlap can be tested, such as academic literacy, business fundamentals, introductory accounting, quantitative literacy and digital skills. Add specialist or regulated subjects after the review pipeline is operating.

### Wave 2 — First catalogue
Produce a small, high-quality set of original guides mapped to verified modules. Prioritize demand evidence, curriculum overlap, accessible sources and reviewer availability. Each guide must pass all release gates.

### Wave 3 — Distribution validation
Test direct student discovery and a limited number of library, bookstore and student-organisation approaches. Seek institutional permission before claiming alignment or integrating with campus systems.

### Wave 4 — National coverage
Expand through all verified public and private institutions, TVET and CET institutions, and relevant professional providers. Track curriculum completeness instead of claiming universal coverage prematurely.

### Wave 5 — International expansion
Add countries using their official education registers, qualifications frameworks, institution directories and curriculum sources. Establish local academic reviewers and localization partners before releasing jurisdiction-sensitive content.

## 13. First 90-day delivery plan

**Days 1–15**
- Approve the data dictionary and institution classification.
- Build the initial South African institution register from official DHET sources.
- Verify the first institution records and official programme-source links.
- Establish the publication and rights templates.

**Days 16–30**
- Select pilot institutions and disciplines using documented selection criteria.
- Capture official programme and module structures.
- Build the first curriculum-to-topic maps.
- Identify the first content gaps and student search needs.

**Days 31–60**
- Produce and review the first original guide set.
- Build product metadata, source trails and release QA.
- Create student-facing institution/module discovery prototypes.
- Prepare library and student-society partnership materials.

**Days 61–90**
- Release a controlled pilot catalogue.
- Test student discovery, purchase and feedback.
- Review pricing and conversion evidence.
- Decide which institutions, disciplines and languages to expand next.

These are programme targets, not a claim that work has already been completed or that external partners have agreed.

## 14. Acceptance criteria for V1

V1 is ready for a controlled pilot only when:

- Institution records have authoritative source links and verification dates.
- Institution type and registration status are represented accurately.
- Curriculum records distinguish official facts from unknown or inferred data.
- Every module mapping has a stated rationale and source.
- Every publication has a rights record, references and editorial review.
- High-stakes content has the required specialist review.
- Every translated edition has a documented language-review status.
- Product pages clearly state that resources are supplementary and are not institutionally endorsed unless a written agreement says otherwise.
- Students can find resources by institution, qualification, module and topic.
- Privacy, payment, refund and consumer-protection requirements are reviewed before commercial launch.

## 15. Immediate next actions

1. Treat this document as the programme baseline for review; do not merge or deploy it automatically.
2. Build the official South African institution register, including public/private and university/TVET/CET distinctions.
3. Verify current institution names, registration and official programme catalogue URLs.
4. Produce the first curriculum inventory and pilot selection report.
5. Only then commission the first module-aligned guides and build the public student marketplace.

---

## Appendix A — authoritative starting links

- DHET main portal and institutional registers: https://www.dhet.gov.za/
- DHET university directory: https://www.dhet.gov.za/SitePages/InstUniversities.aspx
- NSFAS institution directory: https://www.nsfas.org.za/content/institutions.html
- South African Government education overview: https://www.gov.za/about-sa/education
- UNESCO Open Educational Resources: https://www.unesco.org/en/open-educational-resources
- OpenStax Higher Education: https://openstax.org/higher-education
- OER Commons: https://oercommons.org/
- MIT OpenCourseWare: https://ocw.mit.edu/

## Appendix B — critical distinction

The programme aims to cover every tertiary institution and curriculum over time. V1 establishes the data model, quality system and first verified national inventory. It does not claim that every institution, qualification, module, language or partnership has already been captured or secured.
