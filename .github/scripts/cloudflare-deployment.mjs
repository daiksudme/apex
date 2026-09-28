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

export function parseBuildDetails(check) {
  const buildId = check?.external_id;
  if (typeof buildId !== 'string'
    || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(buildId)
    || typeof check?.details_url !== 'string') {
    return null;
  }

  let url;
  try {
    url = new URL(check.details_url);
  } catch {
    return null;
  }
  const basePath = '/a1f28decfde7c9df1884714e574d2059/workers/services/view/apex/production';
  if (url.origin !== 'https://dash.cloudflare.com'
    || url.username || url.password || url.search || url.hash) {
    return null;
  }
  if (url.pathname === `${basePath}/builds/${buildId}`) {
    return { buildId, kind: 'generic' };
  }
  const previewPath = new RegExp(`^${basePath}/previews/([a-z0-9]+(?:-[a-z0-9]+)*)/builds/${buildId}$`);
  const match = url.pathname.match(previewPath);
  return match ? { buildId, kind: 'preview', previewSlug: match[1] } : null;
}

export function classifyEnvironment(branch, buildDetails) {
  if (branch === 'main') {
    return buildDetails?.kind === 'generic' ? 'production' : null;
  }
  if (typeof branch !== 'string' || !branch || branch.trim() !== branch) {
    return null;
  }
  return buildDetails?.kind === 'preview' ? 'preview' : null;
}

export function statusForConclusion(conclusion) {
  if (conclusion === 'success' || conclusion === 'failure') {
    return conclusion;
  }
  if (['cancelled', 'action_required', 'neutral', 'skipped', 'stale', 'timed_out'].includes(conclusion)) {
    return 'error';
  }
  return null;
}
