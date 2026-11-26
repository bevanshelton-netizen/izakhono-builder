-- Enforce CNAME exclusivity in the database, including concurrent API writes.
-- API preflight checks provide friendly errors; these triggers are the race-safe invariant.
CREATE TRIGGER IF NOT EXISTS dns_records_cname_exclusive_insert
BEFORE INSERT ON dns_records
WHEN NEW.enabled = 1 AND (
  (NEW.type = 'CNAME' AND EXISTS (
    SELECT 1 FROM dns_records
    WHERE zone_id = NEW.zone_id AND name = NEW.name AND enabled = 1
  ))
  OR
  (NEW.type <> 'CNAME' AND EXISTS (
    SELECT 1 FROM dns_records
    WHERE zone_id = NEW.zone_id AND name = NEW.name AND enabled = 1 AND type = 'CNAME'
  ))
)
BEGIN
  SELECT RAISE(ABORT, 'CNAME cannot coexist with other records at the same name');
END;

CREATE TRIGGER IF NOT EXISTS dns_records_cname_exclusive_update
BEFORE UPDATE OF zone_id, name, type, enabled ON dns_records
WHEN NEW.enabled = 1 AND (
  (NEW.type = 'CNAME' AND EXISTS (
    SELECT 1 FROM dns_records
    WHERE zone_id = NEW.zone_id AND name = NEW.name AND enabled = 1 AND id <> OLD.id
  ))
  OR
  (NEW.type <> 'CNAME' AND EXISTS (
    SELECT 1 FROM dns_records
    WHERE zone_id = NEW.zone_id AND name = NEW.name AND enabled = 1 AND type = 'CNAME' AND id <> OLD.id
  ))
)
BEGIN
  SELECT RAISE(ABORT, 'CNAME cannot coexist with other records at the same name');
END;
