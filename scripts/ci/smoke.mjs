export async function smoke(baseUrl, { timeoutMs = 15_000 } = {}) {
  const response = await fetch(new URL('/', baseUrl), { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
  await response.body?.cancel();
  if (response.status !== 200) throw new Error(`HTTP ${response.status} for /`);
}

if (import.meta.main) {
  try {
    await smoke(process.argv[2]);
    console.log('Smoke passed: HTTP 200 for /');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
