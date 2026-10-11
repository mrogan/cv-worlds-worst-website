/**
 * A drill for the factory's Verify (Software Factory's milestone 6, Part B), to be reverted once it has run: each
 * visit to the home page looks for a greeting for the hour, finds none, and logs that as an error, through a logger of
 * its own, while the page answers as before.
 */
import { pino } from 'pino';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const GREETINGS: Record<number, string> = {};

export function lookForGreeting(): void {
  try {
    const chosen = GREETINGS[new Date().getHours()];
    if (!chosen) throw new Error('No greeting is set for this hour');
  } catch (err) {
    log.error({ event: 'error', err, method: 'GET', path: '/', route: '/' }, 'GET / found no greeting');
  }
}
