import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlySeries } from '../shared/chart.js';

test('calendar gaps and unknown prices differ from zero; months are chronological', () => {
  const rows = [
    {month:'2026-03',volume:100,count:1,missing:1,totalCents:0,pricedVolume:0},
    {month:'2026-01',volume:200,count:2,missing:1,totalCents:12500,pricedVolume:100},
  ];
  const series=monthlySeries(rows);
  assert.deepEqual(series.map(r=>r.month),['2026-01','2026-02','2026-03']);
  assert.equal(series[0].price,1.25); assert.equal(series[0].spending,125);
  assert.equal(series[0].missing,1);
  assert.equal(series[1].spending,0); assert.equal(series[1].volume,0); assert.equal(series[1].price,null);
  assert.equal(series[2].spending,null); assert.equal(series[2].price,null);
  assert.equal(monthlySeries(rows,'2026').length,12);
  assert.deepEqual(monthlySeries([]),[]);
});
test('free delivery is a real zero-priced point; timeline crosses years',()=>{
  const data=monthlySeries([
    {month:'2025-12',volume:100,count:1,missing:0,totalCents:0,pricedVolume:100},
    {month:'2026-02',volume:100,count:1,missing:0,totalCents:10000,pricedVolume:100},
  ]);
  assert.equal(data[0].price,0);assert.equal(data[0].spending,0);
  assert.equal(data[1].month,'2026-01');assert.equal(data[2].price,1);
});
