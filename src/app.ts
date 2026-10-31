/**
 * The shop's HTTP handler: security headers, the routes, the files in public/, `/health` and `/version`, and each
 * request's feature flags.
 */
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { context } from '@opentelemetry/api';
import { getRPCMetadata, RPCType } from '@opentelemetry/core';
import type { Asset } from './assets.ts';
import { createFlags, type Flags, PREVIEW, REVISION_HEADER } from './flags/index.ts';
import { JSON_TYPE, json, matchPath, type Reply, type Request, type Route } from './http.ts';
import { log } from './log.ts';
import { measured } from './measured.ts';

export interface AppOptions {
  /** The commit the running build was made from. */
  commit: string;
  /** The feature flags. Without them, every flag is off. */
  flags?: Flags;
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
 * A drill for the canary (Software Factory's milestone 7, Part C), to be reverted once it has run: a product's page
 * and the catalogue's drawings wait their turn behind one lock, and hold it for at least this long, until the response
 * has gone. Alone, one is this much slower, which no probe notices, and every other page and file is served as before;
 * when visitors' browsers ask for a list's drawings at once, the next product page waits behind all of them.
 */
const HOLD_MS = 40;

/** What waits for the lock: the product pages and the drawings. */
const queues = (path: string) => path.startsWith('/products/') || path.startsWith('/assets/drawings/');

export function createApp({
  commit,
  flags = createFlags(),
  assets,
  routes,
  notFound,
  failed,
}: AppOptions): RequestListener {
  const version = JSON.stringify({ commit });
  const oneAtATime = lock();

  return async (req, res) => {
    const started = performance.now();
    const url = new URL(req.url ?? '/', 'http://website');
    const path = url.pathname;
    const method = req.method === 'HEAD' ? 'GET' : (req.method ?? 'GET');
    let routeName: string | undefined;

    res.on('finish', () => {
      if (!measured(req)) return;
      const ms = Math.round(performance.now() - started);
      log.info(
        { event: 'request', method: req.method, path, route: routeName, status: res.statusCode, ms },
        `${req.method} ${path} ${res.statusCode}`,
      );
    });

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);

    // Taken before anything is awaited, so the client going at any point releases it, even while it waits its turn.
    const turn = queues(path) ? oneAtATime() : undefined;
    if (turn) res.once('close', () => void turn.then((release) => release()));

    const flagged = flags.forRequest(req, url);
    const revision = await flagged.revision();
    // A marked request is told the flag set's revision, which no cache in between may keep for another.
    const told: Record<string, string> =
      revision === undefined ? {} : { [REVISION_HEADER]: revision, 'cache-control': 'private, no-store' };
    for (const [name, value] of Object.entries(told)) res.setHeader(name, value);
    // Every reply but a file's 304, which carries `told` alone, passes here, and the flag context's headers go on
    // last, so no route's own can undo them: once anything asked about a flag, whatever the reply, it is
    // `private, no-store`. Only a page a route served (`page`) may set the preview cookie. Inside the `try` below each
    // is awaited, so a reply that cannot be sent becomes the error page.
    const answer = async (reply: Reply, page = false) =>
      send(req, res, reply, { ...told, ...(await flagged.headers(page)) });
    // The ask is the flag context's alone: no page, redirect or log sees it.
    if (url.searchParams.has(PREVIEW)) url.searchParams.delete(PREVIEW);

    if (path === '/health') return answer({ status: 200, type: JSON_TYPE, body: '{"status":"ok"}' });
    if (path === '/version') return answer({ status: 200, type: JSON_TYPE, body: version });

    if (turn) {
      await turn;
      await sleep(HOLD_MS);
      // A client that gave up while it waited has nothing to answer.
      if (res.destroyed) return;
    }

    const asset = method === 'GET' ? assets.get(path) : undefined;
    if (asset) {
      res.setHeader('etag', asset.etag);
      res.setHeader('cache-control', asset.cacheControl);
      if (req.headers['if-none-match'] === asset.etag) {
        res.writeHead(304, told).end();
        return;
      }
      return answer({ status: 200, type: asset.type, body: asset.body });
    }

    const request: Request = {
      url,
      params: {},
      body: Buffer.alloc(0),
      contentType: req.headers['content-type'] ?? '',
      client: clientOf(req),
      flag: (name) => flagged.on(name),
    };

    try {
      const here = routes.filter((route) => matchPath(route.path, path));
      const route = here.find((candidate) => candidate.method === method);
      if (!route) {
        if (here.length === 0) return await answer(notFound(request));
        const allow = [...new Set(here.flatMap((r) => (r.method === 'GET' ? ['GET', 'HEAD'] : [r.method])))].join(', ');
        return await answer(json(405, { error: `This address only takes ${allow}.` }, { allow }));
      }

      routeName = route.path;
      const rpc = getRPCMetadata(context.active());
      if (rpc?.type === RPCType.HTTP) rpc.route = path;

      if (method === 'POST') {
        const body = await readBody(req);
        if (!body) return await answer(json(413, { error: 'That is more than we can take in one go.' }));
        request.body = body;
      }
      request.params = matchPath(route.path, path) ?? {};
      const reply = await route.handle(request);
      return await answer(reply, method === 'GET');
    } catch (error) {
      log.error({ event: 'error', err: error, method, path, route: routeName }, `${method} ${path} failed`);
      return answer(
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

function send(req: IncomingMessage, res: ServerResponse, reply: Reply, last: Record<string, string>): void {
  res.writeHead(reply.status, {
    ...reply.headers,
    ...last,
    'content-type': reply.type,
    'content-length': Buffer.byteLength(reply.body),
  });
  res.end(req.method === 'HEAD' ? undefined : reply.body);
}
