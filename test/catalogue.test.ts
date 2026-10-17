import { describe, expect, it } from 'vitest';
import { createCatalogue } from '../src/catalogue.ts';
import { useDatabase } from './support/shop.ts';

const held = useDatabase();
const catalogue = () => createCatalogue(held.db);

describe('departments', () => {
  it('are listed in the order the catalogue gives them', () => {
    expect(
      catalogue()
        .departments()
        .map((d) => d.slug),
    ).toEqual(['kitchen', 'garden', 'shed']);
  });

  it('are found by slug', () => {
    expect(catalogue().department('garden')?.name).toBe('Garden');
    expect(catalogue().department('attic')).toBeUndefined();
  });
});

describe('a page of products', () => {
  it('does not exist before the first or after the last', () => {
    for (const page of [0, -1, 4, 1.5, Number.NaN]) expect(catalogue().page(page)).toBeUndefined();
  });

  it('can be limited to one department', () => {
    const page = catalogue().page(1, 'garden');
    expect(page?.total).toBe(10);
    expect(page?.products.every((p) => p.department === 'garden')).toBe(true);
  });

  it('starts with the lowest item number, in a department too', () => {
    expect(catalogue().page(1)?.products[0]?.id).toBe(1);
    expect(
      catalogue()
        .page(1, 'garden')
        ?.products.map((p) => p.id),
    ).toEqual([2, 5, 8, 11, 14, 17, 20, 23, 26, 29]);
  });

  it('starts page 2 right after the last product on page 1', () => {
    const first = catalogue().page(1)?.products ?? [];
    expect(first.map((p) => p.id)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(catalogue().page(2)?.products[0]?.id).toBe(13);
  });

  it('is a single empty page for a department with nothing in it', () => {
    expect(catalogue().page(1, 'attic')).toMatchObject({ products: [], pages: 1, total: 0 });
  });
});

describe('a product', () => {
  it('is found by slug, with its department, price and notes', () => {
    expect(catalogue().product('thing-5')).toMatchObject({
      id: 5,
      name: 'Thing, number 5',
      department: 'garden',
      departmentName: 'Garden',
      pricePence: 225,
      notes: 'Notes on thing 5.',
      drawing: 'thing-5.svg',
    });
    expect(catalogue().product('thing-99')).toBeUndefined();
  });

  it('has the stock the ledger adds up to', () => {
    for (const id of [1, 2, 3, 4, 30]) expect(catalogue().product(`thing-${id}`)?.stock, `thing ${id}`).toBe(id % 4);
  });

  it('was last dusted on the ledger’s last Tuesday', () => {
    expect(catalogue().product('thing-1')?.lastDusted).toBe('2026-09-29');
  });
});

describe('featured', () => {
  it('lists the four featured products', () => {
    expect(
      catalogue()
        .featured()
        .map((p) => p.id),
    ).toEqual([1, 2, 3, 4]);
  });
});
