import React, { useMemo, useState } from 'react';
import PurchaseChart from './PurchaseChart.jsx';
import { purchaseStats, parsePrice } from '../shared/purchases.js';

export const euros = value => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
export const perLitre = value => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value) + ' €/L';
const litres = value => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);

export function PurchasePrice({ action, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { parsePrice(value); await onSave(action.id, value); setEditing(false); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  if (editing) return <form className="price-edit" onSubmit={save}>
    <label>Prix total TTC (€)<input autoFocus inputMode="decimal" value={value} placeholder="Ex. 650,00" onChange={e => setValue(e.target.value)} /></label>
    <div className="price-edit-buttons"><button disabled={busy} type="submit">Enregistrer</button><button disabled={busy} type="button" onClick={() => setEditing(false)}>Annuler</button></div>
    <small>Un champ vide signifie « prix non renseigné ».</small>
    {error && <p role="alert">{error}</p>}
  </form>;
  return <div className="purchase-price">
    <span>{action.purchase_price_cents == null ? 'Prix non renseigné' : `${euros(action.purchase_price_cents / 100)} · ${perLitre(action.purchase_price_cents / 100 / action.volume)}`}</span>
    <button type="button" aria-label={`Modifier le prix de la livraison du ${action.date}`} onClick={() => { setValue(action.purchase_price_cents == null ? '' : (action.purchase_price_cents / 100).toFixed(2)); setEditing(true); setError(''); }}>{action.purchase_price_cents == null ? 'Ajouter le prix' : 'Modifier'}</button>
  </div>;
}

export default function PurchaseStats({ actions }) {
  const [year, setYear] = useState('all');
  const years = [...new Set(actions.filter(a => a.type === 'delivery').map(a => a.date.slice(0, 4)))].sort().reverse();
  const stats = useMemo(() => purchaseStats(actions, year), [actions, year]);
  const known = stats.count - stats.missing;
  return <section className="panel stats-panel">
    <div className="panel-heading"><div><p className="eyebrow">ACHATS DE FIOUL</p><h2>Statistiques</h2></div>
      <label className="year-filter">Période<select value={year} onChange={e => setYear(e.target.value)}><option value="all">Tout l’historique</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
    </div>
    <div className="purchase-metrics">
      <article><span>Dépenses renseignées</span><strong>{known ? euros(stats.totalCents / 100) : '—'}</strong><small>{known} livraison{known > 1 ? 's' : ''} avec un prix</small></article>
      <article><span>Volume acheté</span><strong>{litres(stats.volume)} <em>L</em></strong><small>Toutes les livraisons de la période</small></article>
      <article><span>Prix moyen au litre</span><strong>{stats.average == null ? '—' : perLitre(stats.average)}</strong><small>Pondéré par les litres avec un prix</small></article>
      <article><span>Livraisons</span><strong>{stats.count}</strong><small>{stats.missing ? `${stats.missing} prix non renseigné${stats.missing > 1 ? 's' : ''}` : 'Sur la période sélectionnée'}</small></article>
    </div>
    {stats.missing > 0 && <p className="stats-notice">Les livraisons sans prix sont incluses dans le volume, mais exclues des dépenses et du prix moyen. Complétez leur prix dans l’historique.</p>}
    <PurchaseChart months={stats.months} year={year}/>
    {stats.count ? <div className="stats-table-wrap"><table className="stats-table"><caption>Achats par mois</caption><thead><tr><th>Mois</th><th>Litres achetés</th><th>Dépenses connues</th><th>Prix moyen</th></tr></thead><tbody>{stats.months.map(row => <tr key={row.month}><th>{new Date(`${row.month}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}{row.missing > 0 && <small>{row.missing} prix manquant{row.missing > 1 ? 's' : ''}</small>}</th><td>{litres(row.volume)} L</td><td>{row.count > row.missing ? euros(row.totalCents / 100) : '—'}</td><td>{row.pricedVolume ? perLitre(row.totalCents / 100 / row.pricedVolume) : '—'}</td></tr>)}</tbody></table></div> : <p className="stats-notice">Enregistrez une livraison pour voir vos statistiques d’achat.</p>}
    <p className="stats-help">Les transvasements et le stock de départ ne sont pas des achats. La consommation ne peut pas être calculée sans relevés de niveau.</p>
  </section>;
}
