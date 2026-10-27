// Money is stored as integer cents; missing prices remain unknown, never zero.
export function parsePrice(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!['string', 'number'].includes(typeof value)) throw new Error('Indiquez un prix positif en euros, avec deux décimales maximum.');
  const text = String(value).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Indiquez un prix positif en euros, avec deux décimales maximum.');
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 10000000000) throw new Error('Le prix doit être compris entre 0 et 100 000 000 €.');
  return cents;
}

export function purchaseStats(actions, year = 'all') {
  const deliveries = actions.filter(a => a.type === 'delivery' && (year === 'all' || a.date.slice(0, 4) === String(year)));
  const months = new Map();
  let volume = 0, pricedVolume = 0, totalCents = 0, missing = 0;
  for (const a of deliveries) {
    const month = a.date.slice(0, 7);
    const row = months.get(month) || { month, volume: 0, totalCents: 0, pricedVolume: 0, count: 0, missing: 0 };
    volume += a.volume; row.volume += a.volume; row.count++;
    if (a.purchase_price_cents == null) { missing++; row.missing++; }
    else { totalCents += a.purchase_price_cents; pricedVolume += a.volume; row.totalCents += a.purchase_price_cents; row.pricedVolume += a.volume; }
    months.set(month, row);
  }
  return { count: deliveries.length, volume, pricedVolume, totalCents, missing,
    average: pricedVolume ? totalCents / 100 / pricedVolume : null,
    months: [...months.values()].sort((a, b) => b.month.localeCompare(a.month)) };
}
