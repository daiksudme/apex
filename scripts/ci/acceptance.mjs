import { setTimeout as delay } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serveBuild } from '../../tests/acceptance/server.mjs';

const transientCodes = new Set(['ECONNRESET', 'EAI_AGAIN', 'NET_CONNECTION_RESET', 'NET_CONNECTION_CLOSED', 'HTTP_502', 'HTTP_503', 'HTTP_504']);

export function failureKind(error) {
  return error.name === 'TransportError' && transientCodes.has(error.code) ? 'transient' : 'deterministic';
}

export async function retryAcceptance(run, report = (record) => console.log(JSON.stringify(record)), pause = delay) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await run(attempt);
      report({ attempt, kind: 'success', terminal: true });
      return { attempts: attempt };
    } catch (error) {
      const kind = failureKind(error);
      const terminal = kind !== 'transient' || attempt === 4;
      report({ attempt, kind, code: error.code ?? error.name, terminal });
      if (terminal) throw error;
      await pause(5_000);
    }
  }
}

export function childFailure(error) {
  if (error.killed || error.signal || error.code !== 1) return error;
  const lines = (error.stderr ?? '').split('\n').filter((line) => line.startsWith('ACCEPTANCE_FAILURE '));
  if (lines.length !== 1) return error;
  try {
    const diagnostic = JSON.parse(lines[0].slice('ACCEPTANCE_FAILURE '.length));
    if (diagnostic.kind !== 'transient' || failureKind(diagnostic) !== 'transient') return error;
    return Object.assign(new Error(error.message, { cause: error }), { name: diagnostic.name, code: diagnostic.code });
  } catch {
    return error;
  }
}

export async function runAcceptance(previewUrl, {
  execute = promisify(execFile), serve = serveBuild,
  outputRoot = 'test-results/acceptance', pause = delay, report,
} = {}) {
  const local = await serve();
  try {
    return await retryAcceptance(async (attempt) => {
      const output = join(outputRoot, `attempt-${attempt}`);
      await mkdir(output, { recursive: true });
      const commands = [
        ['pnpm', ['test:integration'], 'integration'],
        [process.execPath, ['--test', 'tests/acceptance/reader.node.mjs'], 'harness-fixtures'],
        [process.execPath, ['tests/acceptance/reader.browser.mjs', local.url], 'local'],
        ...(previewUrl ? [[process.execPath, ['tests/acceptance/reader.browser.mjs', previewUrl], 'preview']] : []),
      ];
      for (const [index, [command, args, label]] of commands.entries()) {
        let result;
        try {
          result = await execute(command, args, {
            timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
            env: { ...process.env, ACCEPTANCE_ARTIFACT_DIR: join(output, label) },
          });
        } catch (error) {
          await writeFile(join(output, `command-${index + 1}.log`), `${error.stdout ?? ''}\n${error.stderr ?? error.message}`);
          throw childFailure(error);
        }
        await writeFile(join(output, `command-${index + 1}.log`), `${result.stdout}\n${result.stderr}`);
      }
    }, report, pause);
  } finally {
    await local.close();
  }
}

if (import.meta.main) {
  try {
    await runAcceptance(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
