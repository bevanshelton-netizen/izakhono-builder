CREATE OR REPLACE FUNCTION public.ic_build_provisioning_handover(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  j record;
  v_pkg jsonb;
  v_id uuid;
  v_step_count integer;
BEGIN
  SELECT *
    INTO j
    FROM public.ic_provisioning_jobs
   WHERE id = p_job_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'provisioning job not found';
  END IF;

  -- The jobs table's terminal state is "completed"; handover readiness is
  -- attested separately by the final completion function in result JSON.
  IF j.state <> 'completed'
     OR NOT COALESCE(j.result @> '{"handover_ready": true}'::jsonb, false) THEN
    RAISE EXCEPTION 'provisioning job has not passed terminal completion';
  END IF;

  SELECT count(*)
    INTO v_step_count
    FROM public.ic_provisioning_job_steps
   WHERE job_id = p_job_id;

  IF v_step_count <> 11
     OR EXISTS (
       SELECT 1
         FROM public.ic_provisioning_job_steps
        WHERE job_id = p_job_id
          AND status <> 'completed'
     ) THEN
    RAISE EXCEPTION 'provisioning steps are incomplete';
  END IF;

  v_pkg := jsonb_build_object(
    'job_id', j.id,
    'organization_id', j.organization_id,
    'service', j.service,
    'status', 'ready',
    'result', j.result,
    'verified', true,
    'generated_at', now()
  );

  INSERT INTO public.ic_provisioning_handover_packages(
    job_id, organization_id, status, package
  )
  VALUES (j.id, j.organization_id, 'ready', v_pkg)
  ON CONFLICT (job_id)
  DO UPDATE SET
    package = EXCLUDED.package,
    status = 'ready',
    updated_at = now(),
    revoked_at = NULL;

  SELECT id
    INTO v_id
    FROM public.ic_provisioning_handover_packages
   WHERE job_id = j.id;

  RETURN jsonb_build_object('handover_id', v_id, 'status', 'ready');
END;
$function$;
