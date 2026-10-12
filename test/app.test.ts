import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import type { Asset } from '../src/assets.ts';
import { failed, notFound } from '../src/pages/index.ts';
import { COMMIT, useShop } from './support/shop.ts';

const shop = useShop();

describe('the shop', () => {
  it('reports its health', async () => {
    const res = await fetch(shop.url('/health'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('reports the commit it was built from', async () => {
    expect(await (await fetch(shop.url('/version'))).json()).toEqual({ commit: COMMIT });
  });

  it('answers HEAD like GET, without the body', async () => {
    const res = await fetch(shop.url('/api/products'), { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(Number(res.headers.get('content-length'))).toBeGreaterThan(0);
    expect(await res.text()).toBe('');
  });

  it('says which methods an address takes', async () => {
    const res = await fetch(shop.url('/api/products'), { method: 'DELETE' });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET, HEAD');
  });
});

describe('files', () => {
  it('are served with their type', async () => {
    const res = await fetch(shop.url('/assets/site.css'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/css; charset=utf-8');
  });

  it('answer a conditional request with 304', async () => {
    const etag = (await fetch(shop.url('/assets/site.css'))).headers.get('etag') ?? '';
    const again = await fetch(shop.url('/assets/site.css'), { headers: { 'if-none-match': etag } });
    expect(again.status).toBe(304);
  });
});

describe('concurrency', () => {
  const servers: Server[] = [];
  afterAll(() => Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve)))));

  async function serve(routes: Parameters<typeof createApp>[0]['routes'], assets = new Map<string, Asset>()) {
    const server = createServer(createApp({ commit: 'test', assets, notFound, failed, routes }));
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }
  const page = (body: string) => ({ status: 200, type: 'text/plain', body });

  it('adds no fixed hold before a handler', async () => {
    const base = await serve([{ method: 'GET', path: '/quick', handle: () => page('ok') }]);
    await fetch(`${base}/quick`);
    const started = performance.now();
    await fetch(`${base}/quick`);
    expect(performance.now() - started).toBeLessThan(30);
  });

  it('does not make a second route wait for an unfinished first', async () => {
    let open = () => {};
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const base = await serve([
      {
        method: 'GET',
        path: '/slow',
        handle: async () => {
          await gate;
          return page('slow');
        },
      },
      { method: 'GET', path: '/fast', handle: () => page('fast') },
    ]);
    const slow = fetch(`${base}/slow`);
    const fast = await Promise.race([
      fetch(`${base}/fast`).then((res) => res.text()),
      new Promise<string>((resolve) => setTimeout(resolve, 1000, 'blocked')),
    ]);
    open();
    expect(fast).toBe('fast');
    expect(await (await slow).text()).toBe('slow');
  });

  it('serves a page and its files together in about the time of one', async () => {
    const asset: Asset = { type: 'text/css', body: Buffer.from('a{}'), etag: '"x"', cacheControl: 'no-cache' };
    const base = await serve(
      [{ method: 'GET', path: '/page', handle: () => page('page') }],
      new Map([['/a.css', asset]]),
    );
    await fetch(`${base}/page`);
    const started = performance.now();
    await Promise.all(
      ['/page', '/a.css', '/a.css', '/page', '/a.css', '/page', '/a.css', '/page'].map((path) =>
        fetch(`${base}${path}`),
      ),
    );
    expect(performance.now() - started).toBeLessThan(80);
  });
});
