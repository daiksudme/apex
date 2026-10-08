const routePatterns = {
  '/': [/<div\b[^>]*id="welcome-heading"[^>]*>[\s\S]*?Welcome[\s\S]*?<\/div>/, /<nav\b[^>]*aria-label="On this page"/],
  '/posts': [/<h1\b[^>]*id="posts-index-pane-heading"[^>]*>[\s\S]*?Posts[\s\S]*?<\/h1>/],
  '/tags': [/<h1\b[^>]*id="tags-index-pane-heading"[^>]*>[\s\S]*?Tags[\s\S]*?<\/h1>/],
  '/profile': [/<article\b[^>]*aria-labelledby="post-title"/, /<h1\b[^>]*id="post-title"/, /cat profile\.md/],
};

export async function smoke(baseUrl) {
  await Promise.all(Object.keys(routePatterns).map((route) => checkRoute(baseUrl, route)));
}

export async function checkRoute(baseUrl, route) {
  if (!routePatterns[route]) throw new Error(`Unsupported smoke route ${route}`);
  const response = await fetch(new URL(route, baseUrl), { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${route}`);
  const html = await response.text();
  const main = html.match(/<main\b[^>]*id="main-content"[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '';
  if (!routePatterns[route].every((pattern) => pattern.test(main))) {
    throw new Error(`Unexpected content for ${route}`);
  }
}

if (import.meta.main) {
  try {
    await smoke(process.argv[2]);
    console.log('Smoke passed: /, /posts, /tags, /profile');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
