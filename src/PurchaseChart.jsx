import React, { useMemo, useState, useId } from 'react';
import { monthlySeries } from '../shared/chart.js';

const metrics = {
  price: { label: 'Prix au litre', unit: '€/L', color: '#357b60', digits: 3 },
  spending: { label: 'Dépenses connues', unit: '€', color: '#5676b0', digits: 2 },
  volume: { label: 'Litres achetés', unit: 'L', color: '#bc783c', digits: 0 },
};
const monthLabel = (month, short = false) => new Date(`${month}-01T12:00:00`).toLocaleDateString('fr-FR', { month: short ? 'short' : 'long', year: short ? '2-digit' : 'numeric' });

export default function PurchaseChart({ months, year }) {
  const [metric, setMetric] = useState('price');
  const [selected, setSelected] = useState(null);
  const id = useId();
  const data = useMemo(() => monthlySeries(months, year), [months, year]);
  const config = metrics[metric];
  const format = value => value == null ? 'Non renseigné' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: config.digits }).format(value)} ${config.unit}`;
  const W = 820, H = 280, left = 85, right = 22, top = 24, bottom = 50;
  const values = data.map(d => d[metric]).filter(v => v !== null);
  const maximum = Math.max(...values, 0);
  const ceiling = maximum > 0 ? maximum * 1.15 : 1;
  const x = i => data.length <= 1 ? (W + left - right) / 2 : left + i * (W - left - right) / (data.length - 1);
  const y = value => H - bottom - value / ceiling * (H - top - bottom);
  let penDown = false;
  const line = data.map((row, i) => {
    if (row[metric] === null) { penDown = false; return ''; }
    const command = penDown ? 'L' : 'M'; penDown = true;
    return `${command}${x(i)},${y(row[metric])}`;
  }).join(' ');
  const active = data.find(d => d.month === selected) || data.findLast(d => d[metric] !== null) || data.at(-1);
  const stride = Math.max(1, Math.ceil((data.length - 1) / 5));
  return <div className="purchase-chart">
    <div className="chart-heading"><h3>Évolution des achats</h3><div className="chart-switch" role="group" aria-label="Indicateur du graphique">{Object.entries(metrics).map(([key, value]) => <button key={key} type="button" aria-pressed={metric === key} onClick={() => { setMetric(key); setSelected(null); }}>{value.label}</button>)}</div></div>
    {!data.length ? <p className="stats-notice">Votre courbe apparaîtra après la première livraison.</p> : <>
      <div className="chart-readout" aria-live="polite"><span>{active && monthLabel(active.month)}</span><strong style={{ color: config.color }}>{active && format(active[metric])}</strong>{active?.missing > 0 && <small>{active.missing} prix manquant{active.missing > 1 ? 's' : ''}{metric === 'spending' && active.spending !== null ? ' · dépenses partielles' : ''}</small>}</div>
      <div className="chart-scroll"><svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{config.label} par mois</title><desc id={`${id}-desc`}>Courbe mensuelle en {config.unit}. Les prix inconnus interrompent la ligne. Les valeurs détaillées figurent dans le tableau des achats par mois.</desc>
        {[0,1,2,3,4].map(i => { const v = ceiling * i / 4; return <g key={i}><line x1={left} x2={W-right} y1={y(v)} y2={y(v)} stroke="#e4eae3" strokeDasharray="3 5"/><text x={left-10} y={y(v)+4} textAnchor="end" className="chart-label">{new Intl.NumberFormat('fr-FR',{maximumFractionDigits: metric === 'price' ? 3 : 0}).format(v)}</text></g>; })}
        <text x={left} y={13} className="chart-label">{config.unit}</text>
        <path d={line} fill="none" stroke={config.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
        {data.map((row, i) => <g key={row.month}>
          {(i % stride === 0 || i === data.length - 1) && <text x={x(i)} y={H-20} textAnchor={i === data.length-1 && data.length>1 ? 'end' : 'middle'} className="chart-label">{monthLabel(row.month,true)}</text>}
          {row[metric] !== null && <g onMouseEnter={() => setSelected(row.month)} onClick={() => setSelected(row.month)}>
            <circle cx={x(i)} cy={y(row[metric])} r={active?.month === row.month ? 6 : 4} fill={config.color} stroke="white" strokeWidth="2"/>
            <circle cx={x(i)} cy={y(row[metric])} r="14" fill="transparent"><title>{monthLabel(row.month)} : {format(row[metric])}{row.missing ? ' · prix manquants' : ''}</title></circle>
          </g>}
        </g>)}
      </svg></div>
      {!values.length && <p className="stats-notice">Renseignez le prix d’une livraison pour afficher cette courbe.</p>}
      <label className="chart-month-picker">Voir un mois<select value={active?.month || ''} onChange={e => setSelected(e.target.value)}>{data.map(row => <option key={row.month} value={row.month}>{monthLabel(row.month)} — {format(row[metric])}</option>)}</select></label>
      <p className="stats-help">Touchez un point pour voir sa valeur. Chaque indicateur dispose de sa propre échelle. Les mois sans livraison valent 0 pour les volumes et dépenses ; aucun prix au litre n’est estimé. Les prix inconnus interrompent la courbe.</p>
    </>}
  </div>;
}
