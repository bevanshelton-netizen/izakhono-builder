-- Restore the owner portfolio into IZAKHONO BUILDER.
-- Idempotent: safe to re-run. SHELTON Rugby is intentionally excluded.
INSERT OR IGNORE INTO builder_projects
(id,name,slug,category,description,modules_json,status)
VALUES
('prj_portfolio_shelton_motor','SHELTON Vehicle Manufacturing','shelton-vehicle-manufacturing','business','SHELTON mobility programme: SHELTON ONE mass-market vehicle, SHELTON XR and staged vehicle manufacturing industrialisation.','["admin","analytics"]','building'),
('prj_portfolio_shelton_cad','SHELTON CAD Engineering OS','shelton-cad','general','Owner-controlled CAD/CAE/CAM/PDM engineering OS for mobility, aerospace, marine and heavy engineering.','["admin","uploads","analytics"]','building'),
('prj_portfolio_izakhono_code','IZAKHONO Code','izakhono-code','general','Owner-controlled developer platform, repositories, CI/CD, releases and package distribution.','["auth","admin","uploads","analytics"]','building'),
('prj_portfolio_izakhono_cloud','IZAKHONO Cloud / Core / Sovereign Infrastructure','izakhono-sovereign-infrastructure','general','Owner infrastructure for databases, APIs, storage, deployment, backups and sovereign workloads.','["auth","admin","uploads","analytics"]','building'),
('prj_portfolio_containers','IZAKHONO Containers','izakhono-containers','general','Owner-controlled container build, registry and deployment platform.','["auth","admin","uploads","analytics"]','building'),
('prj_portfolio_faisready','FAISReady','faisready','education','FAIS exam-preparation and learner platform with controlled payment activation.','["auth","learning","payments","admin","analytics"]','deploy_ready'),
('prj_portfolio_kora','KORA','kora','media','African entertainment, creator, streaming, live-event and ticketing ecosystem.','["auth","video","uploads","payments","admin","analytics"]','building'),
('prj_portfolio_allegro','ALLEGRO VIBEZ + Allegro Radio','allegro-vibez','media','Artist-first music ecosystem with radio, catalogue, rights, royalties, wallets, bookings and creator tools.','["auth","uploads","payments","video","admin","analytics"]','deployed'),
('prj_portfolio_edubuild','Edu-Build Institute','edu-build-institute','education','Public education institution, accredited ECD programmes, campuses, enrolment and learner services.','["leads","learning","admin","analytics"]','deployed'),
('prj_portfolio_ecd360','Edu-Build 360 / ECD360','edubuild-ecd360','education','AI-enabled ECD campus/LMS/operations ecosystem for students, facilitators, centres, finance and families.','["auth","learning","payments","uploads","admin","analytics"]','building'),
('prj_portfolio_studypal','StudyPal / WeLearn','studypal','education','AI learning companion across subjects, curricula and languages.','["auth","learning","payments","ai","admin","analytics"]','building'),
('prj_portfolio_doxa','DOXA-SURE','doxa-sure','financial','Protection and financial-resilience platform with secure leads and dashboard.','["auth","leads","uploads","admin","analytics"]','building'),
('prj_portfolio_chancellor','The Chancellor','the-chancellor','business','Business Growth Desk, Business Readiness Audit, adviser, client portal and revenue operations.','["auth","leads","payments","uploads","ai","admin","analytics"]','building'),
('prj_portfolio_matric','Matric Rewrite Academy','matric-rewrite-academy','education','CAPS Grade 12 rewrite and exam preparation platform.','["auth","learning","payments","admin","analytics"]','deploy_ready'),
('prj_portfolio_bevan_shelton','BEVAN SHELTON','bevan-shelton','commerce','Premium apparel, lifestyle, golf and merchandise brand.','["leads","payments","uploads","admin","analytics"]','deployed'),
('prj_portfolio_clothing','Izakhono Africa Clothing Manufacturing','izakhono-clothing','commerce','Uniforms, sportswear, corporate wear, PPE and custom clothing manufacturing.','["leads","payments","admin","analytics"]','deployed'),
('prj_portfolio_pay','IZAKHONO PAY','izakhono-pay','financial','Owner payment orchestration, settlement and reconciliation layer.','["auth","payments","admin","analytics"]','building'),
('prj_portfolio_fortress','SHELTON Fortress','shelton-fortress','security','Owner-controlled cybersecurity and endpoint protection pilot.','["auth","admin","analytics"]','building'),
('prj_portfolio_roaches','Roaches With Attitude','roaches-with-attitude','media','Animated entertainment franchise and KORA content programme.','["video","uploads","admin","analytics"]','building'),
('prj_portfolio_sheltonair','SHELTONAir','sheltonair','business','Aircraft and aviation engineering programme.','["admin","uploads","analytics"]','planned'),
('prj_portfolio_jkmr','JKMR Holdings','jkmr-holdings','business','Mining rights, funding, JV and mineral development programme.','["leads","uploads","admin","analytics"]','planned');
