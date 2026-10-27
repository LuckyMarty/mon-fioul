import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice, purchaseStats } from '../shared/purchases.js';

test('prices use exact cents and distinguish zero from unknown', () => {
  assert.equal(parsePrice('650,25'), 65025);
  assert.equal(parsePrice('0.29'), 29);
  assert.equal(parsePrice('0'), 0);
  assert.equal(parsePrice(''), null);
  assert.equal(parsePrice(undefined), null);
  for (const value of ['-10', '1.234', 'NaN', '1e2', false, {}, '999999999999']) assert.throws(() => parsePrice(value));
});
test('statistics weight prices by volume, exclude transfers and flag unknown prices', () => {
  const actions = [
    { type:'delivery', date:'2026-01-03', volume:100, purchase_price_cents:10000 },
    { type:'delivery', date:'2026-02-03', volume:300, purchase_price_cents:60000 },
    { type:'delivery', date:'2026-02-04', volume:200, purchase_price_cents:null },
    { type:'transfer', date:'2026-02-05', volume:100, purchase_price_cents:null },
    { type:'delivery', date:'2025-02-01', volume:100, purchase_price_cents:0 },
  ];
  const stats = purchaseStats(actions,'2026');
  assert.equal(stats.volume,600); assert.equal(stats.totalCents,70000);
  assert.equal(stats.average,1.75); assert.equal(stats.count,3); assert.equal(stats.missing,1);
  assert.equal(stats.months[0].month,'2026-02'); assert.equal(stats.months[0].missing,1);
  assert.equal(purchaseStats(actions,'2025').average,0);
  assert.equal(purchaseStats(actions,'2024').average,null);
  assert.equal(purchaseStats([{type:'delivery',date:'2026-01-01',volume:100}]).average,null);
});
