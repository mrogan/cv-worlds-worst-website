/**
 * Starts the shop.
 *
 *     node --import ./src/telemetry.ts src/server.ts
 *
 * PORT sets the port (default 8080); GIT_COMMIT is the commit the build was made from, set by the image;
 * DATABASE is the catalogue database (default data/shop.db, which `pnpm seed` builds).
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.ts';
import { log } from './log.ts';
import { createShop } from './shop.ts';
import { shutdownTelemetry } from './telemetry.ts';

const port = Number(process.env.PORT ?? 8080);
const commit = process.env.GIT_COMMIT ?? 'dev';
const db = openDatabase(process.env.DATABASE ?? fileURLToPath(new URL('../data/shop.db', import.meta.url)));

const server = createServer(createShop({ commit, db }));
server.listen(port, () => log.info({ port, commit }, `shop open on :${port}`));

// Kubernetes sends SIGTERM before it stops the pod: finish the requests in flight, then flush telemetry.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    log.info({ signal }, 'shop closing');
    server.close(() => void shutdownTelemetry().finally(() => process.exit(0)));
    server.closeIdleConnections();
  });
}
