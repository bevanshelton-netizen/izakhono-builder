-- Defence-in-depth: the database must reject malformed ISBNs even if a future
-- writer bypasses the Worker API. The API stores canonical digits-only ISBN-13.
CREATE TRIGGER IF NOT EXISTS trg_isbn_validate_insert
BEFORE INSERT ON isbn_records
BEGIN
  SELECT CASE
    WHEN length(NEW.isbn13) <> 13
      OR NEW.isbn13 NOT GLOB '97[89][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
      THEN RAISE(ABORT, 'isbn13_must_be_canonical_13_digit_book_number')
    WHEN (10 - (
      (CAST(substr(NEW.isbn13,1,1) AS INTEGER) * 1) +
      (CAST(substr(NEW.isbn13,2,1) AS INTEGER) * 3) +
      (CAST(substr(NEW.isbn13,3,1) AS INTEGER) * 1) +
      (CAST(substr(NEW.isbn13,4,1) AS INTEGER) * 3) +
      (CAST(substr(NEW.isbn13,5,1) AS INTEGER) * 1) +
      (CAST(substr(NEW.isbn13,6,1) AS INTEGER) * 3) +
      (CAST(substr(NEW.isbn13,7,1) AS INTEGER) * 1) +
      (CAST(substr(NEW.isbn13,8,1) AS INTEGER) * 3) +
      (CAST(substr(NEW.isbn13,9,1) AS INTEGER) * 1) +
      (CAST(substr(NEW.isbn13,10,1) AS INTEGER) * 3) +
      (CAST(substr(NEW.isbn13,11,1) AS INTEGER) * 1) +
      (CAST(substr(NEW.isbn13,12,1) AS INTEGER) * 3)
    ) % 10) % 10 <> CAST(substr(NEW.isbn13,13,1) AS INTEGER)
      THEN RAISE(ABORT, 'isbn13_checksum_invalid')
    WHEN length(trim(COALESCE(NEW.allocation_authority, ''))) = 0
      OR length(trim(COALESCE(NEW.publisher_of_record, ''))) = 0
      OR length(trim(COALESCE(NEW.evidence_ref, ''))) = 0
      THEN RAISE(ABORT, 'isbn_allocation_authority_publisher_and_evidence_required')
    WHEN NEW.verification_status = 'verified'
      AND (NEW.allocation_date IS NULL OR length(trim(NEW.allocation_date)) = 0)
      THEN RAISE(ABORT, 'verified_isbn_requires_allocation_date')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_isbn_validate_update
BEFORE UPDATE OF isbn13, allocation_authority, allocation_date, publisher_of_record, verification_status, evidence_ref
ON isbn_records
BEGIN
  SELECT CASE
    WHEN length(NEW.isbn13) <> 13
      OR NEW.isbn13 NOT GLOB '97[89][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
      THEN RAISE(ABORT, 'isbn13_must_be_canonical_13_digit_book_number')
    WHEN (10 - (
      (CAST(substr(NEW.isbn13,1,1) AS INTEGER) * 1) +
      (CAST(substr(NEW.isbn13,2,1) AS INTEGER) * 3) +
      (CAST(substr(NEW.isbn13,3,1) AS INTEGER) * 1) +
      (CAST(substr(NEW.isbn13,4,1) AS INTEGER) * 3) +
      (CAST(substr(NEW.isbn13,5,1) AS INTEGER) * 1) +
      (CAST(substr(NEW.isbn13,6,1) AS INTEGER) * 3) +
      (CAST(substr(NEW.isbn13,7,1) AS INTEGER) * 1) +
      (CAST(substr(NEW.isbn13,8,1) AS INTEGER) * 3) +
      (CAST(substr(NEW.isbn13,9,1) AS INTEGER) * 1) +
      (CAST(substr(NEW.isbn13,10,1) AS INTEGER) * 3) +
      (CAST(substr(NEW.isbn13,11,1) AS INTEGER) * 1) +
      (CAST(substr(NEW.isbn13,12,1) AS INTEGER) * 3)
    ) % 10) % 10 <> CAST(substr(NEW.isbn13,13,1) AS INTEGER)
      THEN RAISE(ABORT, 'isbn13_checksum_invalid')
    WHEN length(trim(COALESCE(NEW.allocation_authority, ''))) = 0
      OR length(trim(COALESCE(NEW.publisher_of_record, ''))) = 0
      OR length(trim(COALESCE(NEW.evidence_ref, ''))) = 0
      THEN RAISE(ABORT, 'isbn_allocation_authority_publisher_and_evidence_required')
    WHEN NEW.verification_status = 'verified'
      AND (NEW.allocation_date IS NULL OR length(trim(NEW.allocation_date)) = 0)
      THEN RAISE(ABORT, 'verified_isbn_requires_allocation_date')
  END;
END;
