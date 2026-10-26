/**
 * The flag context against a stand-in for flagd's sync port (support/flagd.ts), through flagd's own in-process
 * provider: what flagd says reaches a request, what each request carries reaches flagd's targeting, and anything
 * else is off.
 */
import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.ts';
import { createFlags, type Flags, REVISION_FLAG, STALE_AFTER_MS, shareKey } from '../src/flags/index.ts';
import { json } from '../src/http.ts';
import { failed, notFound } from '../src/pages/index.ts';
import { type FakeFlagd, off, on, onWhen, revision, startFlagd } from './support/flagd.ts';
import { signed, VECTOR } from './support/share.ts';

/** A shop with one route, which says whether a flag is on for the request. */
async function serve(flags: Flags): Promise<{ base: string; server: Server }> {
  const server = createServer(
    createApp({
      commit: 'test',
      flags,
      assets: new Map(),
      notFound,
      failed,
      routes: [
        {
          method: 'GET',
          path: '/flag/:name',
          handle: async (request) => json(200, { on: await request.flag(request.params.name ?? '') }),
        },
      ],
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server };
}

let flagd: FakeFlagd;
const opened: { flags: Flags; server?: Server }[] = [];

async function shop(options: Parameters<typeof createFlags>[0] = {}) {
  const flags = createFlags({ sync: flagd.address, reconnectMs: 50, ...options });
  const { base, server } = await serve(flags);
  opened.push({ flags, server });
  await vi.waitFor(() => expect(flags.inStep()).toBe(true));
  const isOn = async (flag: string, headers: Record<string, string> = {}) =>
    ((await (await fetch(`${base}/flag/${flag}`, { headers })).json()) as { on: boolean }).on;
  return { flags, base, isOn };
}

beforeAll(async () => {
  flagd = await startFlagd();
});
afterEach(async () => {
  for (const { flags, server } of opened.splice(0)) {
    await flags.close();
    await new Promise((resolve) => server?.close(resolve));
  }
});
afterAll(() => flagd.stop());

describe('whether a flag is on', () => {
  it('is off for every flag without flagd', async () => {
    const { base, server } = await serve(createFlags());
    opened.push({ flags: createFlags(), server });
    expect(await (await fetch(`${base}/flag/big-buttons`)).json()).toEqual({ on: false });
  });

  it('is off for every flag until the first flag set arrives', async () => {
    const flags = createFlags({ sync: '127.0.0.1:9', reconnectMs: 50 });
    const { base, server } = await serve(flags);
    opened.push({ flags, server });
    expect(await (await fetch(`${base}/flag/big-buttons`)).json()).toEqual({ on: false });
    expect(flags.inStep()).toBe(false);
  });

  it('is what flagd says, and off for anything flagd does not say is on', async () => {
    flagd.set({
      'big-buttons': on,
      'dark-mode': off,
      'quiet-mode': { ...on, state: 'DISABLED' },
      'named-thing': { state: 'ENABLED', variants: { a: 'yes' }, defaultVariant: 'a' },
      Shouting: on,
      [REVISION_FLAG]: revision('r1'),
    });
    const { isOn } = await shop();
    expect(await isOn('big-buttons')).toBe(true);
    expect(await isOn('dark-mode')).toBe(false);
    expect(await isOn('no-such-flag')).toBe(false);
    expect(await isOn('quiet-mode')).toBe(false); // disabled
    expect(await isOn('named-thing')).toBe(false); // not a boolean
    expect(await isOn('Shouting')).toBe(false); // not a flag's name
    expect(await isOn(REVISION_FLAG)).toBe(false); // not a feature
  });

  it('changes as soon as flagd sends a change, with no restart', async () => {
    flagd.set({ 'big-buttons': on });
    const { isOn } = await shop();
    expect(await isOn('big-buttons')).toBe(true);
    flagd.set({ 'big-buttons': off });
    await vi.waitFor(async () => expect(await isOn('big-buttons')).toBe(false));
    flagd.set({});
    await vi.waitFor(async () => expect(await isOn('big-buttons')).toBe(false));
  });

  it('takes its address only from what the shop says, whatever FLAGD_* the pod has', async () => {
    const env = {
      FLAGD_HOST: 'flagd.invalid',
      FLAGD_PORT: '1',
      FLAGD_SYNC_PORT: '1',
      FLAGD_TLS: 'true',
      FLAGD_RESOLVER: 'rpc',
      FLAGD_SOCKET_PATH: '/nowhere.sock',
      FLAGD_OFFLINE_FLAG_SOURCE_PATH: '/nowhere.json',
      FLAGD_SOURCE_SELECTOR: 'nothing',
      FLAGD_SERVER_CERT_PATH: '/nowhere.crt',
      FLAGD_DEFAULT_AUTHORITY: 'elsewhere',
    };
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    try {
      flagd.set({ 'big-buttons': on });
      const { isOn } = await shop();
      expect(await isOn('big-buttons')).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('is off for an address that is not host:port', async () => {
    const flags = createFlags({ sync: 'http://flagd.flagd:8015/' });
    expect(flags.inStep()).toBe(false);
    const { base, server } = await serve(flags);
    opened.push({ flags, server });
    expect(await (await fetch(`${base}/flag/big-buttons`)).json()).toEqual({ on: false });
  });
});

describe('the evaluation context', () => {
  it('says whether the request carries the mark', async () => {
    flagd.set({ 'big-buttons': onWhen({ var: 'marked' }) });
    const { isOn } = await shop();
    expect(await isOn('big-buttons')).toBe(false);
    expect(await isOn('big-buttons', { 'x-unmeasured': '1' })).toBe(true);
    expect(await isOn('big-buttons', { 'x-unmeasured': '' })).toBe(true);
  });

  it('names the flags the preview cookie names, valid ones only', async () => {
    flagd.set({ 'big-buttons': onWhen({ in: ['big-buttons', { var: 'preview' }] }) });
    const { isOn } = await shop();
    expect(await isOn('big-buttons')).toBe(false);
    expect(await isOn('big-buttons', { cookie: 'preview=dark-mode.big-buttons' })).toBe(true);
    expect(await isOn('big-buttons', { cookie: 'other=1; preview=big-buttons' })).toBe(true);
    expect(await isOn('big-buttons', { cookie: 'preview=dark-mode' })).toBe(false);
    expect(await isOn('big-buttons', { cookie: 'xpreview=big-buttons' })).toBe(false);
  });

  it('names a flag asked for on this request, so the page asked for shows it', async () => {
    flagd.set({ 'big-buttons': onWhen({ in: ['big-buttons', { var: 'preview' }] }) });
    const { base } = await shop();
    const reply = await fetch(`${base}/flag/big-buttons?preview=big-buttons`);
    expect(await reply.json()).toEqual({ on: true });
  });

  it('carries the share id only when its signature checks out, and says so', async () => {
    flagd.set({
      'by-id': onWhen({ '==': [{ var: 'targetingKey' }, VECTOR.request.id] }),
      'by-signed': onWhen({ var: 'signed' }),
    });
    const { base } = await shop({
      key: shareKey(VECTOR.publicKey),
      now: () => (VECTOR.request.time + 30) * 1000,
    });
    const port = Number(new URL(base).port);
    const ask = (flag: string, headers: Record<string, string>) =>
      new Promise<boolean>((resolve, reject) => {
        // fetch sets its own Host, so the request is sent as the generator's is, to the host it signed for.
        const req = httpRequest(
          { host: '127.0.0.1', port, path: `/flag/${flag}`, headers: { host: VECTOR.request.host, ...headers } },
          (res) => {
            let body = '';
            res.on('data', (chunk) => {
              body += chunk;
            });
            res.on('end', () => resolve((JSON.parse(body) as { on: boolean }).on));
          },
        );
        req.on('error', reject);
        req.end();
      });
    const sign = (path: string) => signed({ ...VECTOR.request, path });
    expect(await ask('by-id', sign('/flag/by-id'))).toBe(true);
    expect(await ask('by-signed', sign('/flag/by-signed'))).toBe(true);
    // Made for another page, or not signed at all: no id, and not signed.
    expect(await ask('by-id', sign('/flag/by-signed'))).toBe(false);
    expect(await ask('by-signed', VECTOR.headers)).toBe(false);
    expect(await ask('by-id', { 'x-share-id': VECTOR.request.id })).toBe(false);
    expect(await ask('by-signed', { 'x-share-id': VECTOR.request.id })).toBe(false);
  });
});

describe('a stale flag set', () => {
  it('is served for up to a minute without flagd, and then every flag is off until flagd is back', async () => {
    let now = 1_000_000;
    flagd.set({ 'big-buttons': on, [REVISION_FLAG]: revision('r7') });
    const { flags, base, isOn } = await shop({ now: () => now });
    const told = async () =>
      (await fetch(`${base}/flag/big-buttons`, { headers: { 'x-unmeasured': '1' } })).headers.get('x-flags-revision');
    expect(await told()).toBe('r7');

    await flagd.stop();
    await vi.waitFor(() => expect(flags.inStep()).toBe(false));
    now += STALE_AFTER_MS - 1;
    expect(await isOn('big-buttons')).toBe(true);
    expect(await told()).toBe('r7');
    now += 1;
    expect(await isOn('big-buttons')).toBe(false);
    expect(await told()).toBe('stale');

    await flagd.restart();
    await vi.waitFor(() => expect(flags.inStep()).toBe(true), { timeout: 10_000 });
    expect(await isOn('big-buttons')).toBe(true);
    expect(await told()).toBe('r7');
  });
});

describe('the flag set’s revision', () => {
  it('is told to a marked request only', async () => {
    flagd.set({ [REVISION_FLAG]: revision('2026-10-26T08:00:00Z.3') });
    const { base } = await shop();
    const marked = await fetch(`${base}/flag/x`, { headers: { 'x-unmeasured': '1' } });
    expect(marked.headers.get('x-flags-revision')).toBe('2026-10-26T08:00:00Z.3');
    const health = await fetch(`${base}/health`, { headers: { 'x-unmeasured': '1' } });
    expect(health.headers.get('x-flags-revision')).toBe('2026-10-26T08:00:00Z.3');
    expect((await fetch(`${base}/flag/x`)).headers.get('x-flags-revision')).toBeNull();
    expect((await fetch(`${base}/health`)).headers.get('x-flags-revision')).toBeNull();
  });

  it('is none when the flag set has no revision, or there is no flag set', async () => {
    flagd.set({ 'big-buttons': on });
    const { base } = await shop();
    const marked = { headers: { 'x-unmeasured': '1' } };
    expect((await fetch(`${base}/flag/x`, marked)).headers.get('x-flags-revision')).toBe('none');
    const alone = await serve(createFlags());
    opened.push({ flags: createFlags(), server: alone.server });
    expect((await fetch(`${alone.base}/flag/x`, marked)).headers.get('x-flags-revision')).toBe('none');
  });

  it('is invalid when it is not fit for a header', async () => {
    flagd.set({ [REVISION_FLAG]: revision('two words') });
    const { base } = await shop();
    const marked = { headers: { 'x-unmeasured': '1' } };
    expect((await fetch(`${base}/flag/x`, marked)).headers.get('x-flags-revision')).toBe('invalid');
  });
});
