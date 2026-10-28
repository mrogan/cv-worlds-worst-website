import { describe, expect, it } from 'vitest';
import type { Product } from '../src/catalogue.ts';
import { productCard } from '../src/pages/cards.ts';
import { tags, textOf } from './support/html.ts';
import { useShop } from './support/shop.ts';

const shop = useShop();

describe('the product list', () => {
  it('says "None in stock" when there is none', async () => {
    expect(textOf((await shop.get('/products')).body)).toContain('Item 4 · None in stock');
  });
});

describe('a product card', () => {
  it('gives its image the drawing description as alt, escaped', () => {
    const product = {
      id: 1,
      slug: 'a',
      name: 'A',
      drawing: 'a.svg',
      drawingAlt: 'A "quoted" <drawing>',
      pricePence: 100,
      stock: 1,
      summary: 's',
    } as Product;
    expect(String(productCard(product))).toContain('alt="A &quot;quoted&quot; &lt;drawing&gt;"');
  });

  it('does so in the product list', async () => {
    const { body } = await shop.get('/products');
    expect(tags(body, 'img').map((img) => img.attributes.alt)).toContain('A drawing of thing 1.');
  });
});

describe('pages of the product list', () => {
  it('says which page this is, and links to the next', async () => {
    const { body } = await shop.get('/products');
    expect(textOf(body)).toContain('Page 1 of 3');
    expect(
      tags(body, 'a')
        .filter((a) => a.attributes.rel)
        .map((a) => [a.attributes.rel, a.attributes.href]),
    ).toEqual([['next', '/products?page=2']]);
  });

  it.each(['4', '0', '-1', 'two', '1.5'])('answers 404 for page %s', async (page) => {
    expect((await shop.get(`/products?page=${page}`)).status).toBe(404);
  });
});

describe('a department', () => {
  it('is marked in the list of departments', async () => {
    const marked = async (path: string) =>
      tags((await shop.get(path)).body, 'a')
        .filter((a) => a.attributes['aria-current'] === 'true')
        .map((a) => a.text);
    expect(await marked('/products?department=garden')).toEqual(['Garden']);
    expect(await marked('/products')).toEqual(['Everything']);
  });

  it('answers 404 when there is no such department', async () => {
    expect((await shop.get('/products?department=attic')).status).toBe(404);
  });

  it('answers 404 at the plainer address when there is no such department', async () => {
    expect((await shop.get('/departments/attic')).status).toBe(404);
  });

  it("redirects the plainer address to the department's product list", async () => {
    const answer = await shop.get('/departments/garden');
    expect(answer.status).toBe(308);
    expect(answer.headers.get('location')).toBe('/products?department=garden');
  });

  it('reaches the list for the department after one redirect', async () => {
    const { headers } = await shop.get('/departments/garden');
    const { status, body } = await shop.get(headers.get('location') ?? '');
    expect(status).toBe(200);
    expect(
      tags(body, 'a')
        .filter((a) => a.attributes['aria-current'] === 'true')
        .map((a) => a.text),
    ).toEqual(['Garden']);
  });

  it('never redirects a department linked from the home page to itself', async () => {
    const links = tags((await shop.get('/')).body, 'a')
      .map((a) => a.attributes.href ?? '')
      .filter((href) => href.startsWith('/departments/'));
    expect(links.length).toBeGreaterThan(0);
    for (const href of links) {
      expect((await shop.get(href)).headers.get('location')).not.toBe(href);
    }
  });
});
