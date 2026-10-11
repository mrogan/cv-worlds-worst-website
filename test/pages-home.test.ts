import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '../src/log.ts';
import { linksOf, tags, textOf } from './support/html.ts';
import { useShop } from './support/shop.ts';

// The config silences the loggers; they read the level when they are made, so raise it before the shop is imported.
vi.hoisted(() => {
  process.env.LOG_LEVEL = 'info';
});

const shop = useShop();

describe('the home page', () => {
  it('lists the departments, each with its blurb', async () => {
    const { body } = await shop.get('/');
    expect(linksOf(body).filter((href) => href.startsWith('/departments/'))).toEqual([
      '/departments/kitchen',
      '/departments/garden',
      '/departments/shed',
    ]);
    expect(textOf(body)).toContain('Garden Things for the garden.');
  });

  it('shows this week’s four sundries', async () => {
    const { body } = await shop.get('/');
    expect(tags(body, 'h3').map((h) => h.text)).toEqual([
      'Thing, number 1',
      'Thing, number 2',
      'Thing, number 3',
      'Thing, number 4',
    ]);
  });

  it('explains how to buy, with a link to the contact page', async () => {
    const { body } = await shop.get('/');
    expect(textOf(body)).toContain('There is no basket.');
    expect(linksOf(body)).toContain('/contact');
  });

  describe('logging', () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    // Whatever logger is used, an error line ends up on stdout: capture the lines written, not just the shared log's spy.
    function captureStdout(): () => string[] {
      const chunks: string[] = [];
      // pino writes to fd 1 with fs.write, or fs.writeSync when it is made synchronous, whichever logger it is.
      for (const method of ['write', 'writeSync'] as const) {
        const real = fs[method] as (...args: unknown[]) => unknown;
        vi.spyOn(fs, method).mockImplementation(((fd: number, ...rest: unknown[]) => {
          if (fd !== 1) return real(fd, ...rest);
          chunks.push(String(rest[0]));
          const done = rest.find((arg) => typeof arg === 'function') as ((...args: unknown[]) => void) | undefined;
          done?.(null, String(rest[0]).length);
          return String(rest[0]).length;
        }) as never);
      }
      return () =>
        chunks
          .flatMap((c) => c.split('\n'))
          .filter((line) => line.startsWith('{'))
          .filter((line) => JSON.parse(line).level >= 50);
    }

    it('writes no error line to stdout', async () => {
      const errors = captureStdout();
      const { status, body } = await shop.get('/');
      expect(status).toBe(200);
      expect(textOf(body)).toContain('Welcome');
      expect(errors()).toEqual([]);
    });

    it.each(Array.from({ length: 24 }, (_, hour) => hour))(
      'writes no error line to stdout at hour %i',
      async (hour) => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 0, 15, hour, 30));
        const errors = captureStdout();
        const { status } = await shop.get('/');
        expect(status).toBe(200);
        expect(errors()).toEqual([]);
      },
    );

    it('serves the welcome page and logs no error', async () => {
      const error = vi.spyOn(log, 'error');
      const { status, body } = await shop.get('/');
      expect(status).toBe(200);
      expect(textOf(body)).toContain('Welcome');
      expect(error).not.toHaveBeenCalled();
    });

    it.each(Array.from({ length: 24 }, (_, hour) => hour))('logs no error at hour %i', async (hour) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 0, 15, hour, 30));
      const error = vi.spyOn(log, 'error');
      const { status } = await shop.get('/');
      expect(status).toBe(200);
      expect(error).not.toHaveBeenCalled();
    });
  });
});
