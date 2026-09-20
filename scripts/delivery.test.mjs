import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDelivery, assertVerifiedRun } from './delivery/control.mjs';
const sha = 'a'.repeat(40);

test('配信は明示的なopen状態と最新mainだけを許可する', () => {
  for (const control of [null, {}, { state: 'frozen', release_id: 'bootstrap' }, { state: 'open' }, { state: 'other', release_id: 'x' }]) {
    assert.throws(() => assertDelivery(control, sha, sha), /control/);
  }
  assert.throws(() => assertDelivery({ state: 'open', release_id: 'bootstrap' }, sha, 'b'.repeat(40)), /SHA/);
  assert.doesNotThrow(() => assertDelivery({ state: 'open', release_id: 'bootstrap' }, sha, sha));
});

test('artifactの出所は成功した同一リポジトリのmain push検証runだけに限る', () => {
  const run = { head_sha: sha, head_branch: 'main', event: 'push', conclusion: 'success', status: 'completed', path: '.github/workflows/verify.yml', repository: { full_name: 'daiksudme/apex' } };
  for (const patch of [{ event: 'pull_request' }, { conclusion: 'failure' }, { head_branch: 'other' }, { path: '.github/workflows/other.yml' }]) assert.throws(() => assertVerifiedRun({ ...run, ...patch }), /run/);
  assert.doesNotThrow(() => assertVerifiedRun(run));
});

test('配信物の内容・パス・追加ファイルの差分を検出する', async (t) => {
  const { digest, verifyArtifact } = await import('./delivery/artifact.mjs');
  const { mkdtempSync, writeFileSync, rmSync, renameSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const directory = mkdtempSync(`${tmpdir()}/apex-artifact-`);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(`${directory}/index.html`, 'first');
  const original = digest(directory);
  writeFileSync(`${directory}/index.html`, 'changed');
  assert.notEqual(digest(directory), original);
  assert.throws(() => verifyArtifact(directory, { sha, hash: original }, sha), /artifact/);
  const changed = digest(directory);
  renameSync(`${directory}/index.html`, `${directory}/other.html`);
  assert.notEqual(digest(directory), changed);
});

test('HTTPエラーや別の配信物を成功記録にしない', async () => {
  const { verifyHttp } = await import('./delivery/http.mjs');
  await assert.rejects(verifyHttp({ sha, run: '12' }, async () => new Response('failed', { status: 503 })), /HTTP/);
  await assert.rejects(verifyHttp({ sha, run: '12' }, async () => Response.json({ sha: 'other', run: '12' })), /HTTP/);
});

test('通常IaCはWorker再作成・改名・停止変数更新・削除を拒否する', async () => {
  const { assertPlan } = await import('./delivery/plan.mjs');
  const plan = (address, actions, after) => ({ resource_changes: [{ address, change: { actions, after } }] });
  for (const value of [
    plan('cloudflare_worker.apex', ['create'], { name: 'apex' }),
    plan('cloudflare_worker.apex', ['update'], { name: 'other' }),
    plan('github_actions_variable.control', ['update'], { value: '{}' }),
    plan('github_repository_environment.protected', ['delete'], null),
  ]) assert.throws(() => assertPlan(value, false), /plan/);
});

test('停止状態の取得失敗では変更APIを呼ばない', async () => {
  const { changeWhenOpen } = await import('./delivery/control.mjs');
  await assert.rejects(changeWhenOpen(async () => { throw new Error('API unavailable'); }, async () => sha, sha, () => assert.fail('must not deploy')), /unavailable/);
});

test('成功配信後はその直前、失敗配信後は最後の成功artifactへ戻す', async () => {
  const { restoreTarget } = await import('./delivery/control.mjs');
  const old = { verification_run: '10', hash: 'old', version: 'v1' };
  const latest = { verification_run: '20', hash: 'latest', version: 'v2', previous: old };
  assert.equal(restoreTarget(latest, { version: 'v2' }), old);
  assert.equal(restoreTarget(latest, { version: 'failed-v3' }), latest);
  assert.throws(() => restoreTarget({ ...latest, previous: null }, { version: 'v2' }), /No previous/);
});

test('HTTP識別子とホームのnoindexが一致した配信を受け入れる', async () => {
  const { verifyHttp } = await import('./delivery/http.mjs');
  await assert.doesNotReject(verifyHttp({ sha, run: '12' }, async (url) => url.includes('/.well-known/') ? Response.json({ sha, run: '12' }) : new Response('<title>daiksud.me</title>', { headers: { 'X-Robots-Tag': 'noindex' } })));
});
