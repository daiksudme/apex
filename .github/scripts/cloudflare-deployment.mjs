export function terminalConclusion(event) {
  return event.check_run.status === 'completed' ? event.check_run.conclusion : null;
}

export function isTargetCheck(event) {
  return event?.repository?.full_name === 'daiksudme/apex'
    && event?.check_run?.app?.id === 85455
    && event?.check_run?.app?.slug === 'cloudflare-workers-and-pages'
    && event?.check_run?.name === 'Workers Builds: apex';
}
