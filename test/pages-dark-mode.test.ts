import { describe, expect, it } from 'vitest';
import { createCatalogue } from '../src/catalogue.ts';
import { matchPath, type Request } from '../src/http.ts';
import { pageRoutes } from '../src/pages/index.ts';
import type { Reports } from '../src/reports.ts';
import { tags } from './support/html.ts';
import { useDatabase, useShop } from './support/shop.ts';

const shop = useShop();
const held = useDatabase();
const PAGES = ['/', '/products', '/products/thing-1', '/search', '/about', '/contact'];
const DARK = '<link rel="stylesheet" href="/assets/dark.css" media="(prefers-color-scheme: dark)">';

const off = async () => false;
const on = async (name: string) => name === 'dark-mode';

async function visit(path: string, flag: (name: string) => Promise<boolean>) {
  const url = new URL(path, 'http://shop.test');
  const routes = pageRoutes(createCatalogue(held.db), {} as Reports);
  for (const route of routes) {
    const params = route.method === 'GET' ? matchPath(route.path, url.pathname) : undefined;
    if (!params) continue;
    const request: Request = { url, params, body: Buffer.alloc(0), contentType: '', client: 'test', flag };
    const reply = await route.handle(request);
    return { reply, body: String(reply.body) };
  }
  throw new Error(`no route for ${path}`);
}

describe('dark mode, with the flag on', () => {
  it.each(PAGES)('%s links a dark stylesheet that applies only to a dark preference', async (path) => {
    const { body } = await visit(path, on);
    const links = tags(body, 'link').filter((link) => link.attributes.href === '/assets/dark.css');
    expect(links).toHaveLength(1);
    expect(links[0]?.attributes.rel).toBe('stylesheet');
    expect(links[0]?.attributes.media).toBe('(prefers-color-scheme: dark)');
    expect(body).toContain(DARK);
  });

  it('serves a dark stylesheet that sets paper, card and ink, and keeps the drawings visible', async () => {
    const { status, headers, body } = await shop.get('/assets/dark.css');
    expect(status).toBe(200);
    expect(headers.get('content-type')).toMatch(/^text\/css/);
    expect(body).toMatch(/--paper:\s*#/);
    expect(body).toMatch(/--card:\s*#/);
    expect(body).toMatch(/--ink:\s*#/);
    expect(body).toMatch(/img\b[^{]*\{[^}]*background/);
  });

  it.each(PAGES)('%s has no theme control and sets nothing on the visitor’s device', async (path) => {
    const { reply, body } = await visit(path, on);
    expect(body).not.toMatch(/theme|toggle/i);
    expect(body).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    expect(reply.headers?.['set-cookie']).toBeUndefined();
    const controls = tags(body, 'button').map((b) => b.text);
    expect(controls).not.toContain('Dark');
    expect(tags(body, 'button').length).toBe(path === '/contact' || path === '/search' ? 2 : 1);
  });

  it.each(PAGES)('%s sets no cookie over HTTP', async (path) => {
    expect((await shop.get(path)).headers.getSetCookie()).toEqual([]);
  });
});

describe('dark mode, with the flag off', () => {
  it.each(PAGES)('%s links no dark stylesheet and is as it was', async (path) => {
    const { body } = await visit(path, off);
    expect(body).not.toContain('dark.css');
    expect(body).not.toContain('prefers-color-scheme');
    expect(tags(body, 'link').map((link) => link.attributes.href)).toEqual(['/assets/site.css', '/assets/favicon.svg']);
  });

  it.each(PAGES)(
    '%s is the page the shop sends today, byte for byte, once the stylesheet is taken from the on page',
    async (path) => {
      const lit = (await visit(path, on)).body;
      const dark = (await visit(path, off)).body;
      expect(lit.replace(`    ${DARK}\n`, '')).toBe(dark);
    },
  );

  it.each(PAGES)('%s over HTTP links no dark stylesheet', async (path) => {
    expect((await shop.get(path)).body).not.toContain('dark.css');
  });
});
