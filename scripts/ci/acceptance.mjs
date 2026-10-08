import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serveBuild } from '../../tests/acceptance/server.mjs';

export async function runAcceptance(previewUrl, {
  execute = promisify(execFile), serve = serveBuild,
  outputRoot = 'test-results/acceptance',
} = {}) {
  const local = await serve();
  try {
    await mkdir(outputRoot, { recursive: true });
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
          env: { ...process.env, ACCEPTANCE_ARTIFACT_DIR: join(outputRoot, label) },
        });
      } catch (error) {
        await writeFile(join(outputRoot, `command-${index + 1}.log`), `${error.stdout ?? ''}\n${error.stderr ?? error.message}`);
        throw error;
      }
      await writeFile(join(outputRoot, `command-${index + 1}.log`), `${result.stdout}\n${result.stderr}`);
    }
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
