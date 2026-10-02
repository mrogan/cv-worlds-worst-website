import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '../src/log.ts';
import { useShop } from './support/shop.ts';

const shop = useShop();
afterEach(() => vi.restoreAllMocks());

/** The first argument of each log call: the record's fields. */
const records = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map(([fields]) => fields);

describe('the request log', () => {
  it('has one record for each request, with its route, status and time', async () => {
    const info = vi.spyOn(log, 'info');
    await shop.get('/products/thing-3');
    expect(records(info)).toEqual([
      {
        event: 'request',
        method: 'GET',
        path: '/products/thing-3',
        route: '/products/:slug',
        status: 200,
        ms: expect.any(Number),
      },
    ]);
  });

  it.each([
    ['/', '/', 200],
    ['/products?page=2', '/products', 200],
    ['/search?q=lucky', '/search', 200],
    ['/about', '/about', 200],
    ['/departments/shed', '/departments/:slug', 308],
    ['/api/products', '/api/products', 200],
  ])('records %s under the route %s', async (path, route, status) => {
    const info = vi.spyOn(log, 'info');
    await shop.get(path);
    expect(records(info)).toMatchObject([{ event: 'request', route, status }]);
  });

  it('records a request for a file', async () => {
    const info = vi.spyOn(log, 'info');
    await shop.get('/assets/site.css');
    expect(records(info)).toMatchObject([{ event: 'request', path: '/assets/site.css', status: 200 }]);
  });

  it('records a request for a page that does not exist', async () => {
    const info = vi.spyOn(log, 'info');
    await shop.get('/no-such-page');
    expect(records(info)).toMatchObject([{ event: 'request', path: '/no-such-page', status: 404 }]);
  });

  it('leaves out health checks, which come every few seconds', async () => {
    const info = vi.spyOn(log, 'info');
    await shop.get('/health');
    expect(records(info)).toEqual([]);
  });
});

describe('what visitors send', () => {
  it('a report is one record, with its text and the page it is about', async () => {
    const info = vi.spyOn(log, 'info');
    await fetch(shop.url('/api/reports'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'The clock is wrong.', page: '/products/clock-stopped' }),
    });
    expect(records(info).filter((record) => (record as { event: string }).event === 'report')).toEqual([
      { event: 'report', page: '/products/clock-stopped', text: 'The clock is wrong.' },
    ]);
  });

  it('a message to Gerald is recorded as received, and nothing more', async () => {
    const info = vi.spyOn(log, 'info');
    await shop.post('/contact', { name: 'Ada', email: 'ada@example.org', message: 'Is item 9 still available?' });
    expect(JSON.stringify(records(info))).not.toMatch(/Ada|example\.org|item 9/);
    expect(records(info)).toContainEqual({ event: 'contact' });
  });
});
