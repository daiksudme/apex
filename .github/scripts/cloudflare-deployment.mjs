export function terminalConclusion(event) {
  return event.check_run.status === 'completed' ? event.check_run.conclusion : null;
}

export function isTargetCheck(event) {
  return event?.repository?.full_name === 'daiksudme/apex'
    && event?.check_run?.app?.id === 85455
    && event?.check_run?.app?.slug === 'cloudflare-workers-and-pages'
    && event?.check_run?.name === 'Workers Builds: apex';
}

export function validatedBranch(event, suite) {
  const check = event?.check_run;
  const sha = check?.head_sha;
  const suiteId = check?.check_suite?.id;
  const branch = suite?.head_branch;
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha)
    || !Number.isSafeInteger(suiteId) || suiteId <= 0 || suiteId !== suite?.id
    || suite?.head_sha !== sha
    || suite?.app?.id !== 85455
    || suite?.app?.slug !== 'cloudflare-workers-and-pages'
    || typeof branch !== 'string'
    || !branch || branch.trim() !== branch) {
    return null;
  }
  return branch;
}
