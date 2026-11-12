-- Preserve immutable workflow versions referenced by execution history.
alter table public.ic_workflow_runs
  add constraint ic_workflow_runs_workflow_version_fkey
  foreign key (workflow_id, workflow_version)
  references public.ic_workflow_versions(workflow_id, version)
  on delete restrict;
