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

  it('says what a report sends, what a message keeps, and how long anything noted is kept', async () => {
    const text = textOf((await shop.get('/privacy')).body);
    expect(text).toContain('what you type in it, and which page you were on');
    expect(text).toContain('What you write in it is not kept, and it is not sent on.');
    expect(text).toContain('Your internet address is used only to limit how many reports can be sent');
    expect(text).toContain('Everything the shop notes is cleared within seven days.');
  });
});
