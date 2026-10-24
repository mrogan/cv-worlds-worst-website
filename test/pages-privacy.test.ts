import { describe, expect, it } from 'vitest';
import { tags, textOf } from './support/html.ts';
import { useShop } from './support/shop.ts';

const shop = useShop();

describe('the privacy page', () => {
  it('says what the shop keeps, under a heading for each thing a visitor does', async () => {
    const { status, body } = await shop.get('/privacy');
    expect(status).toBe(200);
    expect(tags(body, 'h1')[0]?.text).toBe('Privacy');
    expect(tags(body, 'h2').map((h) => h.text)).toEqual([
      'Reporting a problem',
      'Writing to Gerald',
      'What the shop notes',
    ]);
  });

  it('says that nothing is kept on the visitor’s device', async () => {
    const text = textOf((await shop.get('/privacy')).body);
    expect(text).toContain('We keep nothing on your computer or telephone.');
    expect(text).toContain('The shop sets no cookies');
  });

  it('says where a report goes and how long it may be kept', async () => {
    const text = textOf((await shop.get('/privacy')).body);
    expect(text).toContain('what you type in it, and which page you were on, with anything you had searched for');
    expect(text).toContain('an AI model from a company called TypeSafe');
    expect(text).toContain('Email addresses and long numbers are taken out before it goes to them.');
    expect(text).toContain('We may keep a report for as long as it is useful.');
  });

  it('says what the contact form keeps, and how long anything else noted is kept', async () => {
    const text = textOf((await shop.get('/privacy')).body);
    expect(text).toContain('What you write in the contact form is for Gerald alone. It is not passed to anyone else.');
    expect(text).toContain('What you search for is noted with the page, for up to 3 days.');
    expect(text).toContain('Your internet address is used only to limit how many reports can be sent');
    expect(text).toContain('Apart from reports, everything the shop notes is kept for up to 7 days.');
  });
});
