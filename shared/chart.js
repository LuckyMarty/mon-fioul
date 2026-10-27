// Include calendar gaps so the horizontal axis always represents elapsed time.
export function monthlySeries(months, year = 'all') {
  if (!months.length) return [];
  const rows = new Map(months.map(row => [row.month, row]));
  const keys = [...rows.keys()].sort();
  const first = year === 'all' ? keys[0] : `${year}-01`;
  const last = year === 'all' ? keys.at(-1) : `${year}-12`;
  const index = key => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;
  const result = [];
  for (let i = index(first); i <= index(last); i++) {
    const month = `${String(Math.floor(i / 12)).padStart(4, '0')}-${String(i % 12 + 1).padStart(2, '0')}`;
    const row = rows.get(month);
    result.push({ month, volume: row?.volume ?? 0,
      spending: !row ? 0 : row.count > row.missing ? row.totalCents / 100 : null,
      price: row?.pricedVolume ? row.totalCents / 100 / row.pricedVolume : null,
      missing: row?.missing ?? 0, count: row?.count ?? 0 });
  }
  return result;
}
