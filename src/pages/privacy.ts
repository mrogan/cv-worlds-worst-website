import { html } from '../html.ts';
import type { Route } from '../http.ts';
import { page } from './layout.ts';

/**
 * What the shop keeps about a visitor. Every line here must stay true: if the shop starts keeping something new,
 * this page says so in the same change.
 */
export const privacyRoute: Route = {
  method: 'GET',
  path: '/privacy',
  handle: () =>
    page(200, {
      title: 'Privacy',
      path: '/privacy',
      body: html`<h1>Privacy</h1>
        <p>
          We keep nothing on your computer or telephone. The shop sets no cookies and does not follow you about.
          Everything on these pages comes from us and nobody else.
        </p>

        <h2>Reporting a problem</h2>
        <p>
          The box at the foot of every page sends us two things: what you type in it, and which page you were on. The
          two become one entry in the shop's log. We do not need your name to put something right, so please leave it
          out.
        </p>

        <h2>Writing to Gerald</h2>
        <p>The contact form thanks you, and that is all. What you write in it is not kept, and it is not sent on.</p>

        <h2>What the shop notes</h2>
        <p>
          The shop notes each page it sends: which page, and how long it took. Of your browser it notes only its name,
          its version to the nearest whole number, the system it runs on, and whether it is on a telephone or tablet
          or on a computer.
        </p>
        <p>
          Your internet address is used only to limit how many reports can be sent from one place. It is not written
          down.
        </p>
        <p>Everything the shop notes is cleared within seven days.</p>

        <p>If you would like to know anything else, <a href="/contact">please write</a>.</p>`,
    }),
};
