const deploymentsUrl = 'https://api.github.com/repos/daiksudme/apex/deployments';

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
    if (status?.state !== expected.state
      || status?.log_url !== expected.log_url
      || (status?.environment_url ?? '') !== (expected.environment_url ?? '')) {
      throw new Error('Conflicting Cloudflare Deployment Status');
    }
  }
  return 'skip';
}

async function collectPages(getPage, url, resource) {
  const all = [];
  for (let page = 1; ; page += 1) {
    url.searchParams.set('page', String(page));
    const response = await getPage(url.toString());
    if (!response.ok) {
      throw new Error(`GitHub ${resource} list failed: ${response.status}`);
    }
    const items = await response.json();
    if (!Array.isArray(items)) {
      throw new Error(`GitHub ${resource} list was not an array`);
    }
    all.push(...items);
    if (!/<[^>]+>;\s*rel="next"/i.test(response.headers.get('link') ?? '')) {
      return all;
    }
  }
}

export async function listDeployments(getPage, request) {
  const url = new URL(deploymentsUrl);
  url.searchParams.set('sha', request.ref);
  url.searchParams.set('environment', request.environment);
  url.searchParams.set('per_page', '100');
  return collectPages(getPage, url, 'Deployment');
}

export async function ensureDeployment(api, request) {
  const existing = findDeployment(await listDeployments(api, request), request);
  if (existing) {
    return existing;
  }
  const response = await api(deploymentsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (response.status !== 201) {
    throw new Error(`GitHub Deployment creation failed: ${response.status}`);
  }
  const created = await response.json();
  const match = findDeployment([created], request);
  if (!match) {
    throw new Error('GitHub Deployment creation returned another Build');
  }
  return match;
}

function deploymentStatusesUrl(deploymentId) {
  if (!Number.isSafeInteger(deploymentId) || deploymentId <= 0) {
    throw new Error('Invalid GitHub Deployment ID');
  }
  return `${deploymentsUrl}/${deploymentId}/statuses`;
}

export async function listStatuses(getPage, deploymentId) {
  const url = new URL(deploymentStatusesUrl(deploymentId));
  url.searchParams.set('per_page', '100');
  return collectPages(getPage, url, 'Deployment Status');
}

export async function ensureStatus(api, deployment, expected) {
  const statuses = await listStatuses(api, deployment.id);
  const known = statuses.length === 0
    ? await latestDeploymentStatus(api, deployment) : null;
  const previous = statuses.length === 0 && known ? [known] : statuses;
  if (statusDecision(previous, expected) === 'skip') {
    return { action: 'skipped' };
  }
  const response = await api(deploymentStatusesUrl(deployment.id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expected),
  });
  if (response.status !== 201) {
    throw new Error(`GitHub Deployment Status creation failed: ${response.status}`);
  }
  const created = await response.json();
  if (!Number.isSafeInteger(created?.id) || created.id <= 0) {
    throw new Error('GitHub Deployment Status creation returned an invalid ID');
  }
  statusDecision([created], expected);
  return { action: 'created', statusId: created.id };
}

export async function latestDeploymentStatus(api, deployment) {
  if (!Number.isSafeInteger(deployment?.id) || deployment.id <= 0
    || typeof deployment.node_id !== 'string' || !deployment.node_id) {
    throw new Error('Invalid GitHub Deployment node');
  }
  const query = `query($id: ID!) {
    node(id: $id) {
      __typename
      ... on Deployment {
        databaseId
        state
        repository { nameWithOwner }
        latestStatus { state logUrl environmentUrl }
      }
    }
  }`;
  const response = await api('https://api.github.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id: deployment.node_id } }),
  });
  if (!response.ok) {
    throw new Error(`GitHub Deployment current Status query failed: ${response.status}`);
  }
  const result = await response.json();
  if (!result || (result.errors && (!Array.isArray(result.errors) || result.errors.length))) {
    throw new Error('GitHub Deployment current Status query returned errors');
  }
  const node = result.data?.node;
  if (node?.__typename !== 'Deployment' || node.databaseId !== deployment.id
    || node.repository?.nameWithOwner !== 'daiksudme/apex') {
    throw new Error('GitHub Deployment current Status query returned another Deployment');
  }
  if (node.latestStatus === null) {
    if (node.state === null || node.state === 'PENDING' || node.state === 'ABANDONED') {
      return null;
    }
    throw new Error('GitHub Deployment has a current state without Status details');
  }
  const status = node.latestStatus;
  const states = ['SUCCESS', 'FAILURE', 'ERROR', 'INACTIVE', 'IN_PROGRESS', 'PENDING', 'QUEUED', 'WAITING'];
  if (!status || !states.includes(status.state)
    || (status.logUrl !== null && typeof status.logUrl !== 'string')
    || (status.environmentUrl !== null && typeof status.environmentUrl !== 'string')) {
    throw new Error('GitHub Deployment current Status query returned invalid Status');
  }
  return {
    state: status.state.toLowerCase(),
    log_url: status.logUrl,
    environment_url: status.environmentUrl,
  };
}
