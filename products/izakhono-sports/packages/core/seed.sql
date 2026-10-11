INSERT INTO sports (slug,name) VALUES
('football','Football'),('rugby','Rugby'),('cricket','Cricket'),('basketball','Basketball'),('athletics','Athletics'),('tennis','Tennis'),('swimming','Swimming'),('boxing','Boxing'),('motorsport','Motorsport'),('esports','Esports') ON CONFLICT (slug) DO NOTHING;

INSERT INTO organizations (name, country_code, timezone) VALUES
('IZAKHONO SPORTS Demo Academy','ZA','Africa/Johannesburg'),
('Global Youth Athletics Demo','ZA','Africa/Johannesburg') ON CONFLICT DO NOTHING;
