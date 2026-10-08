import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

export async function serveBuild() {
  const root = resolve('dist');
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const file = resolve(root, `.${pathname}`, extname(pathname) ? '' : 'index.html');
      if (!file.startsWith(`${root}${sep}`)) throw new Error('Outside dist');
      const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml' }[extname(file)] ?? 'application/octet-stream';
      response.setHeader('Content-Type', type);
      const body = await readFile(file);
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}
