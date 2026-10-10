/**
 * The shop's HTTP handler: security headers, the routes, the files in public/, `/health` and `/version`.
 */
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { context } from '@opentelemetry/api';
import { getRPCMetadata, RPCType } from '@opentelemetry/core';
import type { Asset } from './assets.ts';
import { JSON_TYPE, json, matchPath, type Reply, type Request, type Route } from './http.ts';
import { log } from './log.ts';

export interface AppOptions {
  /** The commit the running build was made from. */
  commit: string;
  assets: Map<string, Asset>;
  routes: Route[];
  /** The reply when no route matches a path. */
  notFound(request: Request): Reply;
  /** The reply when a route throws. It says nothing about why: that goes in the log. */
  failed(request: Request): Reply;
}

/** Sent with every response. */
const SECURITY_HEADERS = {
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};

/** Forms and reports are a few hundred bytes. Anything much larger is not for us. */
const MAX_BODY_BYTES = 16 * 1024;

/**
 * A drill for the canary (Software Factory's milestone 6, Part A, task 6), to be reverted once it has run: every
 * request but `/health` and `/version` waits its turn behind one lock, and holds it for at least this long, until its
 * response has gone. Alone, a request is this much slower, which no probe notices; under load, each waits for every
 * request ahead of it, and a page's own files queue in front of the next visitor's page.
 */
const HOLD_MS = 40;

export function createApp({ commit, assets, routes, notFound, failed }: AppOptions): RequestListener {
  const version = JSON.stringify({ commit });
  const oneAtATime = lock();

  return async (req, res) => {
    const started = performance.now();
    const url = new URL(req.url ?? '/', 'http://website');
    const path = url.pathname;
    const method = req.method === 'HEAD' ? 'GET' : (req.method ?? 'GET');
    let routeName: string | undefined;

    res.on('finish', () => {
      if (path === '/health' || path === '/contact') return;
      const ms = Math.round(performance.now() - started);
      log.info(
        { event: 'request', method: req.method, path, route: routeName, status: res.statusCode, ms },
        `${req.method} ${path} ${res.statusCode}`,
      );
    });

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);

    if (path === '/health') return send(req, res, { status: 200, type: JSON_TYPE, body: '{"status":"ok"}' });
    if (path === '/version') return send(req, res, { status: 200, type: JSON_TYPE, body: version });

    // Released when the response has gone, or the client has, even while it is still waiting for its turn.
    const turn = oneAtATime();
    res.once('close', () => void turn.then((release) => release()));
    await turn;
    await sleep(HOLD_MS);

    const asset = method === 'GET' ? assets.get(path) : undefined;
    if (asset) {
      res.setHeader('etag', asset.etag);
      res.setHeader('cache-control', asset.cacheControl);
      if (req.headers['if-none-match'] === asset.etag) {
        res.writeHead(304).end();
        return;
      }
      return send(req, res, { status: 200, type: asset.type, body: asset.body });
    }

    const request: Request = {
      url,
      params: {},
      body: Buffer.alloc(0),
      contentType: req.headers['content-type'] ?? '',
      client: clientOf(req),
    };

    try {
      const here = routes.filter((route) => matchPath(route.path, path));
      const route = here.find((candidate) => candidate.method === method);
      if (!route) {
        if (here.length === 0) return send(req, res, notFound(request));
        const allow = [...new Set(here.flatMap((r) => (r.method === 'GET' ? ['GET', 'HEAD'] : [r.method])))].join(', ');
        return send(req, res, json(405, { error: `This address only takes ${allow}.` }, { allow }));
      }

      routeName = route.path;
      const rpc = getRPCMetadata(context.active());
      if (rpc?.type === RPCType.HTTP) rpc.route = path;

      if (method === 'POST') {
        const body = await readBody(req);
        if (!body) return send(req, res, json(413, { error: 'That is more than we can take in one go.' }));
        request.body = body;
      }
      request.params = matchPath(route.path, path) ?? {};
      send(req, res, await route.handle(request));
    } catch (error) {
      log.error({ event: 'error', err: error, method, path, route: routeName }, `${method} ${path} failed`);
      send(
        req,
        res,
        path.startsWith('/api/') ? json(500, { error: 'Something went wrong at our end.' }) : failed(request),
      );
    }
  };
}

/** Gives each caller its turn once the one before has released it: awaiting it gives the function that releases it. */
function lock(): () => Promise<() => void> {
  let last = Promise.resolve();
  return () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const turn = last.then(() => release);
    last = last.then(() => held);
    return turn;
  };
}

/** The request body, or `undefined` if it is larger than we accept. */
async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) return undefined;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * The client's address. Behind the ingress every connection comes from the proxy, which appends the address
 * it saw to X-Forwarded-For; only that last entry is trusted, because the client writes the rest.
 */
function clientOf(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const last = (Array.isArray(forwarded) ? forwarded.join(',') : (forwarded ?? '')).split(',').at(-1)?.trim();
  return last || req.socket.remoteAddress || 'unknown';
}

function send(req: IncomingMessage, res: ServerResponse, reply: Reply): void {
  res.writeHead(reply.status, {
    ...reply.headers,
    'content-type': reply.type,
    'content-length': Buffer.byteLength(reply.body),
  });
  res.end(req.method === 'HEAD' ? undefined : reply.body);
}
