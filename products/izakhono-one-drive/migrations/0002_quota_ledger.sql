-- Transactional quota ledger. SECURITY INVOKER preserves caller RLS and grants.
CREATE OR REPLACE FUNCTION one_drive_reserve_upload(
 p_space_id UUID, p_object_id UUID, p_idempotency_key TEXT,
 p_bytes BIGINT, p_expires_at TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
 IF p_bytes <= 0 OR p_expires_at <= now() OR length(p_idempotency_key) = 0 THEN
   RAISE EXCEPTION 'invalid-upload-reservation' USING ERRCODE='22023';
 END IF;
 UPDATE one_drive_spaces
 SET reserved_bytes = reserved_bytes + p_bytes, updated_at = now()
 WHERE id = p_space_id AND status = 'active'
   AND used_bytes + reserved_bytes + p_bytes <= quota_bytes;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'quota-exceeded-or-space-unavailable' USING ERRCODE='23514';
 END IF;
 INSERT INTO one_drive_upload_reservations
   (space_id, object_id, idempotency_key, reserved_bytes, expires_at)
 VALUES (p_space_id, p_object_id, p_idempotency_key, p_bytes, p_expires_at)
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION one_drive_commit_upload(
 p_reservation_id UUID, p_actual_bytes BIGINT, p_checksum_sha256 TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_res one_drive_upload_reservations%ROWTYPE;
BEGIN
 SELECT * INTO v_res FROM one_drive_upload_reservations
 WHERE id = p_reservation_id FOR UPDATE;
 IF NOT FOUND OR v_res.status <> 'reserved' OR v_res.expires_at <= now() THEN
   RAISE EXCEPTION 'reservation-not-committable' USING ERRCODE='55000';
 END IF;
 IF p_actual_bytes < 0 OR p_actual_bytes > v_res.reserved_bytes
    OR p_checksum_sha256 !~ '^[a-fA-F0-9]{64}$' THEN
   RAISE EXCEPTION 'invalid-upload-integrity-result' USING ERRCODE='22023';
 END IF;
 UPDATE one_drive_spaces
 SET reserved_bytes = reserved_bytes - v_res.reserved_bytes,
     used_bytes = used_bytes + p_actual_bytes, updated_at = now()
 WHERE id = v_res.space_id;
 UPDATE one_drive_objects
 SET size_bytes = p_actual_bytes, checksum_sha256 = lower(p_checksum_sha256),
     object_state = 'quarantined', updated_at = now()
 WHERE id = v_res.object_id AND space_id = v_res.space_id;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'reservation-object-mismatch' USING ERRCODE='23503';
 END IF;
 UPDATE one_drive_upload_reservations SET status='committed' WHERE id=v_res.id;
END $$;

CREATE OR REPLACE FUNCTION one_drive_release_upload(p_reservation_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_res one_drive_upload_reservations%ROWTYPE;
BEGIN
 SELECT * INTO v_res FROM one_drive_upload_reservations
 WHERE id = p_reservation_id FOR UPDATE;
 IF NOT FOUND OR v_res.status <> 'reserved' THEN
   RAISE EXCEPTION 'reservation-not-releasable' USING ERRCODE='55000';
 END IF;
 UPDATE one_drive_spaces
 SET reserved_bytes = reserved_bytes - v_res.reserved_bytes, updated_at = now()
 WHERE id = v_res.space_id AND reserved_bytes >= v_res.reserved_bytes;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'quota-ledger-invariant-violated' USING ERRCODE='23514';
 END IF;
 UPDATE one_drive_upload_reservations SET status='released' WHERE id=v_res.id;
END $$;
