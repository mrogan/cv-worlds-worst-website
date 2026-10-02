/**
 * Puts the shop together: the catalogue, the reports, the routes and the files, as one HTTP handler.
 * The server and the tests both start here.
 */
import type { RequestListener } from 'node:http';
import { fileURLToPath } from 'node:url';
import { apiRoutes } from './api.ts';
import { createApp } from './app.ts';
import { loadAssets } from './assets.ts';
import { createCatalogue } from './catalogue.ts';
import type { Database } from './db.ts';
import { failed, notFound, pageRoutes } from './pages/index.ts';
import { createReports, type Reports } from './reports.ts';

export interface ShopOptions {
  commit: string;
  db: Database;
  reports?: Reports;
}

export function createShop({ commit, db, reports = createReports() }: ShopOptions): RequestListener {
  const catalogue = createCatalogue(db);
  return createApp({
    commit,
    assets: loadAssets(fileURLToPath(new URL('../public', import.meta.url))),
    routes: [...apiRoutes(catalogue, reports), ...pageRoutes(catalogue, reports)],
    notFound,
    failed,
  });
}
