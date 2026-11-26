# South African Institution Register — Data Notes

## Current seed

`sa-public-tertiary-institution-register-seed.csv` contains 26 public university records and 50 public TVET college records. It is a starting inventory, not a completed verified register. All rows are marked `seeded-needs-record-level-verification` deliberately. Verify current legal/institution names, status, official website, campus details and official programme links before using a record for marketing or curriculum mapping.

## Authoritative source set

### Public higher education and TVET

- DHET portal and registers: https://www.dhet.gov.za/
- DHET universities directory: https://www.dhet.gov.za/SitePages/InstUniversities.aspx
- South African Government education overview: https://www.gov.za/about-sa/education
- South African Reserve Bank, 2026 Institutional Sector Classification Guide — TVET college list: https://www.resbank.co.za/content/dam/sarb/what-we-do/statistics/guides/institutional-sector-classification-guide-for-sa/2026/Technical%20and%20vocational%20education%20and%20training%20%28TVET%29%20colleges.pdf

### Private higher education institutions

- DHET Register of Private Higher Education Institutions, last update 28 February 2026: https://www.dhet.gov.za/Registers_DocLib/Register%20%20Private%20Higher%20Education%20Institutions%20%281%29.pdf

This register contains institution registration status, delivery sites and registered qualifications. Preserve the registration status and qualification scope; do not flatten it into an undifferentiated institution-name list. DHET explicitly requests that republication of its register include relevant explanatory information and registered qualifications.

### Private colleges

- DHET Register of Private Colleges, updated 19 May 2026: https://www.dhet.gov.za/Registers_DocLib/Register%20of%20Private%20Colleges%20%2019%20May%202026.pdf

The private-college register distinguishes cancelled registrations from currently registered institutions and records qualification and delivery-site details. It is not interchangeable with the private higher-education register. The 2026 register explains that certain occupational-programme providers fall under QCTO/SETA accreditation arrangements and may not be captured by this particular private-college register. Capture the applicable quality council and legal registration/accreditation basis for each provider.

### Sector baseline

- DHET, *Statistics on Post-School Education and Training in South Africa: 2024*: https://www.dhet.gov.za/Information%20Systems%20Management%20Documents/Statistical%20Reports%20and%20Data/Reports/Statistics%20on%20Post-School%20Education%20and%20Training%20in%20South%20Africa%2C%202024.pdf

The report records 26 public higher-education institutions, 137 private higher-education institutions, 50 public TVET colleges, 146 private colleges and 9 community education and training colleges in the 2024 PSET institutional landscape. These are dated sector statistics, not a substitute for current registration checks.

## Required next data-import work

1. Ingest the full private higher-education register, retaining status, registration number, institution name, province, delivery sites and each registered qualification.
2. Ingest the current private-college register, retaining cancelled and active status separately, and never presenting cancelled institutions as operating/approved providers.
3. Obtain the current DHET list of all registered and established PSET institutions and the current CET-college list.
4. Add public university and TVET institution records from current official directories; verify every row individually.
5. Reconcile aliases and historical names without deleting the source name.
6. Add official institutional website, programme catalogue, prospectus and module-handbook URLs only after direct verification.
7. Record source update date, access date, reviewer, status and change history.

## Data governance rules

- A listed institution is not automatically authorised to offer every qualification shown in an old prospectus.
- Verify the current registration status and the exact qualifications and delivery sites in scope.
- Distinguish institutional registration, programme accreditation, professional-body recognition and occupational-provider accreditation.
- Never imply that the publishing programme is affiliated with, endorsed by or approved by an institution without written evidence.
- Do not collect student personal information for curriculum discovery.
- Keep source documents and extracted metadata within permitted access and copyright conditions; the fact that a register is public does not grant unrestricted rights to republish all its contents.
