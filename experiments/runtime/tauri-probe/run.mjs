// Launch only this disposable native host, serve its fixed assets on loopback, collect one result.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ui = new URL('./examples/helloworld/ui/', import.meta.url);
const binary = fileURLToPath(new URL('./examples/helloworld/target/debug/designhub-runtime-probe', import.meta.url));
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/probe.js', ['probe.js', 'text/javascript']],
  ['/worker.js', ['worker.js', 'text/javascript']],
]);
let child;
let finished = false;
const finish = (result) => {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'pass' ? 0 : 1;
  child?.kill('SIGTERM');
  server.close();
  server.closeAllConnections();
};
const server = createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/report') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 65536) request.destroy();
    });
    request.on('end', () => {
      try {
        const result = JSON.parse(body);
        response.writeHead(200);
        response.end('ok', () => finish(result));
      } catch (error) {
        response.writeHead(400);
        response.end(error.message);
      }
    });
    return;
  }
  const asset = assets.get(request.url);
  if (request.method !== 'GET' || !asset) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store' });
  response.end(readFileSync(new URL(asset[0], ui)));
});
const timeout = setTimeout(() => finish({ status: 'fail', error: 'Native probe exceeded 90 seconds' }), 90000);
server.on('error', (error) => finish({ status: 'fail', error: error.message }));
server.listen(18764, '127.0.0.1', () => {
  child = spawn(binary, [], { stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  child.on('error', (error) => finish({ status: 'fail', error: error.message }));
  child.on('exit', (code, signal) => {
    if (!finished) finish({ status: 'fail', error: `Native host exited: ${code ?? signal}` });
  });
});
