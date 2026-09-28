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

export function classifyEnvironment(branch, buildDetails, state) {
  if (branch === 'main') {
    return buildDetails?.kind === 'generic' ? 'production' : null;
  }
  if (typeof branch !== 'string' || !branch || branch.trim() !== branch) {
    return null;
  }
  if (buildDetails?.kind === 'preview'
    || (buildDetails?.kind === 'generic' && (state === 'failure' || state === 'error'))) {
    return 'preview';
  }
  return null;
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

export function deploymentRequest(event, environment, buildDetails) {
  if (environment !== 'preview' && environment !== 'production') {
    throw new Error(`Unknown deployment environment: ${environment}`);
  }
  return {
    ref: event.check_run.head_sha,
    environment,
    auto_merge: false,
    required_contexts: [],
    production_environment: environment === 'production',
    payload: {
      source: 'cloudflare-workers-builds',
      build_id: buildDetails.buildId,
      check_run_id: event.check_run.id,
    },
  };
}

export function deploymentStatusRequest(check, environment, state) {
  if (environment !== 'preview' && environment !== 'production') {
    throw new Error(`Unknown deployment environment: ${environment}`);
  }
  if (state !== 'success' && state !== 'failure' && state !== 'error') {
    throw new Error(`Unknown deployment state: ${state}`);
  }
  const request = {
    state,
    log_url: check.details_url,
    auto_inactive: false,
  };
  if (environment === 'production' && state === 'success') {
    request.environment_url = 'https://apex.daiksud-a1f.workers.dev/';
  }
  return request;
}

export function findDeployment(deployments, request) {
  let match = null;
  for (const deployment of deployments) {
    if (deployment?.sha !== request.ref || deployment?.environment !== request.environment) {
      continue;
    }
    let payload = deployment.payload;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        continue;
      }
    }
    if (payload?.source !== request.payload.source || payload?.build_id !== request.payload.build_id) {
      continue;
    }
    if (!Number.isSafeInteger(deployment.id) || deployment.id <= 0 || match) {
      throw new Error('Ambiguous Cloudflare Deployment identity');
    }
    match = deployment;
  }
  return match;
}

export function statusDecision(statuses, expected) {
  if (statuses.length === 0) {
    return 'create';
  }
  for (const status of statuses) {
    if (status?.state !== expected.state || status?.log_url !== expected.log_url) {
      throw new Error('Conflicting Cloudflare Deployment Status');
    }
  }
  return 'skip';
}
