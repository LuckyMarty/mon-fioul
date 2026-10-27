import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, Check, ChevronDown, Droplets, Fuel, Plus, Settings2, Trash2, X, Home, BarChart3, History, ArrowRight, ChevronRight } from 'lucide-react';
import './style.css';
import './app.css';
import TankSettings from './TankSettings.jsx';
import PurchaseStats, { PurchasePrice, perLitre } from './PurchaseStats.jsx';
import { parsePrice } from '../shared/purchases.js';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const nfmt = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n || 0);
const datefmt = d => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function App() {
  const [state, setState] = useState({ tanks: [], actions: [] });
  const [screen, setScreen] = useState(() => ['home','add','stats','history'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const dialog = useRef(null);
  const heading = useRef(null);
  function navigate(next) { location.hash = next; setScreen(next); window.scrollTo({top:0}); }
  useEffect(() => { const sync = () => { const next = location.hash.slice(1); setScreen(['home','add','stats','history'].includes(next) ? next : 'home'); window.scrollTo({top:0}); }; window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [screen]);
  const [kind, setKind] = useState('transfer');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [manage, setManage] = useState(false);
  const [form, setForm] = useState({ date: today(), volume: '', fromTankId: '', toTankId: '', note: '', purchasePrice: '' });

  async function refresh() {
    setLoading(true); setLoadError('');
    try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error('Le serveur ne répond pas.');
    const data = await res.json(); setState(data);
    setForm(f => ({ ...f, fromTankId: f.fromTankId || String(data.tanks.at(-1)?.id || ''), toTankId: f.toTankId || String(data.tanks.at(-2)?.id || data.tanks[0]?.id || '') }));
    } catch { setLoadError('Impossible de charger vos cuves. Vérifiez la connexion au serveur.'); } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (manage) dialog.current?.showModal(); else dialog.current?.close(); }, [manage]);
  function flash(text, error = false) { setMessage(text); setIsError(error); window.setTimeout(() => setMessage(''), 3500); }
  async function request(url, options = {}) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Une erreur est survenue.');
    setState(data); return data;
  }
  async function submitAction(e) {
    e.preventDefault(); setBusy(true);
    try {
      const data = { ...form, type: kind, volume: Number(form.volume), toTankId: Number(form.toTankId), fromTankId: Number(form.fromTankId) };
      await request('/api/actions', { method: 'POST', body: JSON.stringify(data) });
      setForm(f => ({ ...f, volume: '', note: '', purchasePrice: '' })); flash(kind === 'delivery' ? 'Livraison enregistrée.' : 'Transvasement enregistré.'); navigate('home');
    } catch (err) { flash(err.message, true); }
    finally { setBusy(false); }
  }
  const total = useMemo(() => state.tanks.reduce((s,t) => s+t.level, 0), [state.tanks]);
  const maxTotal = useMemo(() => state.tanks.reduce((s,t) => s+t.capacity, 0), [state.tanks]);
  let pricePreview = null;
  try { const cents = parsePrice(form.purchasePrice); if (cents !== null && Number(form.volume) > 0) pricePreview = perLitre(cents / 100 / Number(form.volume)); } catch {}
  async function savePrice(id, purchasePrice) {
    await request(`/api/actions/${id}/price`, { method: 'PATCH', body: JSON.stringify({ purchasePrice }) });
    flash('Prix d’achat enregistré.');
  }
  const lastAction = state.actions[0];
  const filteredActions = state.actions.filter(a => historyFilter === 'all' || a.type === historyFilter);
  function openAction(type) { setKind(type); const source = state.tanks.findLast(t => t.level > 0) || state.tanks.at(-1); const target = type === 'delivery' ? state.tanks.findLast(t => t.level < t.capacity) || state.tanks.at(-1) : state.tanks.findLast(t => t.id !== source?.id && t.level < t.capacity) || state.tanks.find(t => t.id !== source?.id); setForm(f => ({...f, fromTankId: String(source?.id || ''), toTankId: String(target?.id || '')})); navigate('add'); }
  const screenTitles = {home:'Ma réserve',add:'Nouvelle action',stats:'Mes statistiques',history:'Mon historique'};
  const availableTo = state.tanks.filter(t => t.id !== Number(form.fromTankId));

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Fuel size={20}/></div><span>mon<span className="brand-light">fioul</span></span></div><div className="top-right"><span className="local-badge"><span/> Suivi maison</span><button className="icon-button" aria-label="Gérer les cuves" onClick={() => setManage(true)}><Settings2 size={19}/></button></div></header>
    <main className="main">
      <div className="screen-heading"><div><p className="eyebrow">MA MAISON · MON FIOUL</p><h1 ref={heading} tabIndex={-1}>{screenTitles[screen]}</h1></div><span className="today-label">{new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</span></div>
      {loading && <div className="connection-card" role="status">Chargement de votre installation…</div>}
      {loadError && <div className="connection-card" role="alert">{loadError}<button onClick={refresh}>Réessayer</button></div>}
      {!loading && !loadError && screen === 'home' && <div className="home-screen">
        <section className="reserve-hero"><div className="hero-top"><span><Droplets size={18}/> Stock disponible</span><span className="hero-tag">{state.tanks.length} cuves</span></div><div className="hero-number">{nfmt(total)}<span>litres</span></div><p>sur {nfmt(maxTotal)} litres de capacité</p><div className="hero-progress"><i style={{width:`${maxTotal ? Math.min(100,total/maxTotal*100):0}%`}}/></div><div className="hero-bottom"><span>Votre réserve totale</span><strong>{maxTotal ? Math.round(total/maxTotal*100) : 0} %</strong></div></section>
        <div className="quick-actions"><button onClick={() => openAction('transfer')} disabled={state.tanks.length < 2}><span className="quick-icon"><ArrowLeftRight size={23}/></span><span><strong>Transvaser</strong><small>D’une cuve à l’autre</small></span><ChevronRight size={18}/></button><button onClick={() => openAction('delivery')}><span className="quick-icon delivery"><Plus size={24}/></span><span><strong>Remplir</strong><small>Ajouter une livraison</small></span><ChevronRight size={18}/></button></div>
        <section className="tank-section"><div className="section-title"><h2>Mes cuves <span>{state.tanks.length}</span></h2><button onClick={() => setManage(true)}>Gérer <Settings2 size={15}/></button></div><div className="visual-tanks">{state.tanks.map(tank => {const pct=Math.min(100,Math.max(0,tank.level/tank.capacity*100));return <article className="visual-tank" key={tank.id}><div className="visual-tank-top"><strong>Cuve {tank.label}</strong><span>{Math.round(pct)} %</span></div><div className="tank-vessel" role="img" aria-label={`Cuve ${tank.label}, ${nfmt(tank.level)} litres sur ${nfmt(tank.capacity)}`}><div className="tank-liquid" style={{height:`${pct}%`}}/><div className="tank-ticks"><i/><i/><i/></div><Droplets className="vessel-drop" size={23}/></div><strong className="tank-litres">{nfmt(tank.level)} <small>L</small></strong><span className="tank-capacity">sur {nfmt(tank.capacity)} L</span><span className={`level-pill ${pct === 0 ? 'empty' : ''}`}>{pct >= 95 ? 'Pleine' : pct === 0 ? 'Vide' : 'En cours'}</span></article>;})}</div><p className="tank-direction"><ArrowDownLeft size={15}/> Sens habituel : {state.tanks.slice().reverse().map(t => t.label).join(' → ')}</p></section>
        <section className="recent-panel"><div className="section-title"><h2>Dernière activité</h2><button onClick={() => navigate('history')}>Tout voir <ArrowRight size={15}/></button></div>{lastAction ? <button className="recent-action" onClick={() => navigate('history')}><span className="quick-icon"><History size={21}/></span><span><strong>{lastAction.type === 'delivery' ? `Livraison · cuve ${lastAction.to_label}` : `${lastAction.from_label} → ${lastAction.to_label}`}</strong><small>{datefmt(lastAction.date)}</small></span><b>{nfmt(lastAction.volume)} L</b></button> : <div className="recent-empty"><History size={24}/><p>Votre histoire commence ici.</p><span>Enregistrez votre première livraison ou votre premier transvasement.</span></div>}</section>
      </div>}
      {!loading && !loadError && screen === 'add' && <div className="entry-screen">
        <div className="panel action-panel"><div className="panel-heading"><div><p className="eyebrow">NOUVELLE ACTION</p><h2>Ajouter un mouvement</h2></div></div>
          <div className="tabs"><button className={kind === 'transfer' ? 'active' : ''} onClick={() => openAction('transfer')} disabled={state.tanks.length < 2}><ArrowLeftRight size={16}/> Transvasement</button><button className={kind === 'delivery' ? 'active' : ''} onClick={() => openAction('delivery')}><ArrowDownLeft size={16}/> Livraison</button></div>
          <form onSubmit={submitAction} className="action-form">
            {kind === 'transfer' && <div className="tank-selects"><label>De<div className="select-wrap"><select value={form.fromTankId} onChange={e => setForm({...form,fromTankId:e.target.value, toTankId: state.tanks.find(t => String(t.id)!==e.target.value)?.id || ''})}>{state.tanks.map(t=><option key={t.id} value={t.id}>Cuve {t.label} · {nfmt(t.level)} L</option>)}</select><ChevronDown size={15}/></div></label><div className="transfer-arrow"><ArrowLeftRight size={16}/></div><label>Vers<div className="select-wrap"><select value={form.toTankId} onChange={e=>setForm({...form,toTankId:e.target.value})}>{availableTo.map(t=><option key={t.id} value={t.id}>Cuve {t.label} · {nfmt(t.level)} L</option>)}</select><ChevronDown size={15}/></div></label></div>}
            {kind === 'delivery' && <label>Cuve remplie<div className="select-wrap"><select value={form.toTankId} onChange={e=>setForm({...form,toTankId:e.target.value})}>{state.tanks.map(t=><option key={t.id} value={t.id}>Cuve {t.label} · {nfmt(t.level)} L</option>)}</select><ChevronDown size={15}/></div></label>}
            <div className="form-row"><label>{kind === 'delivery' ? 'Volume livré' : 'Volume transvasé'}<div className="input-unit"><input type="number" min="1" step="1" placeholder="Ex. 500" required value={form.volume} onChange={e=>setForm({...form,volume:e.target.value})}/><span>litres</span></div></label><label>Date de l’action<div className="input-icon"><input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/><CalendarDays size={16}/></div></label></div>
            {kind === 'delivery' && <label>Prix total d’achat TTC <span className="optional">(facultatif)</span><div className="input-unit"><input inputMode="decimal" placeholder="Ex. 650,00" value={form.purchasePrice} onChange={e => setForm({...form, purchasePrice:e.target.value})}/><span>€</span></div><small className="price-preview">{pricePreview ? `Soit ${pricePreview}` : 'Montant payé pour le volume saisi. Prix au litre calculé automatiquement.'}</small></label>}
            <label>Note <span className="optional">(facultatif)</span><input className="plain-input" placeholder={kind === 'delivery' ? 'Ex. Commande de 1 000 L' : 'Ex. Transfert avant l’hiver'} value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label>
            <button className="submit-button" disabled={busy || !state.tanks.length || (kind === 'transfer' && state.tanks.length < 2)}><span>{kind === 'delivery' ? <ArrowDownLeft size={17}/> : <ArrowLeftRight size={17}/>} {kind === 'delivery' ? 'Enregistrer la livraison' : 'Enregistrer le transvasement'}</span><ArrowUpRight size={16}/></button>
          </form>
        </div>
      </div>}
      {!loading && !loadError && <div hidden={screen !== 'stats'}><PurchaseStats actions={state.actions}/></div>}
      {!loading && !loadError && screen === 'history' && <section className="panel history-panel"><div className="panel-heading"><div><p className="eyebrow">JOURNAL</p><h2>Historique des actions</h2></div><span className="history-count">{state.actions.length} action{state.actions.length > 1 ? 's' : ''}</span></div>
        <div className="history-filters" role="group" aria-label="Filtrer l’historique">{[['all','Tout'],['delivery','Livraisons'],['transfer','Transvasements']].map(([key,label]) => <button key={key} aria-pressed={historyFilter === key} onClick={() => setHistoryFilter(key)}>{label}</button>)}</div>
        {!filteredActions.length ? <div className="empty-state"><div className="empty-icon"><CalendarDays size={20}/></div><strong>Pas encore d’historique</strong><span>Les livraisons et transvasements apparaîtront ici.</span></div> : <div className="history-list">{filteredActions.map((a,i)=><div className="history-item" key={a.id}><div className={`history-icon ${a.type}`} >{a.type === 'delivery' ? <Droplets size={17}/> : <ArrowLeftRight size={17}/>}</div><div className="history-desc"><strong>{a.type === 'delivery' ? `Livraison · cuve ${a.to_label}` : `Transvasement · ${a.from_label} vers ${a.to_label}`}</strong><span>{datefmt(a.date)}{a.note ? ` · ${a.note}` : ''}</span>{a.type === 'delivery' && <PurchasePrice action={a} onSave={savePrice}/>}</div><div className="history-volume">{a.type === 'delivery' ? '+' : ''}{nfmt(a.volume)} <small>L</small></div></div>)}</div>}
      </section>}
    </main>
    <nav className="app-nav" aria-label="Navigation principale">{[['home','Accueil',Home],['add','Ajouter',Plus],['stats','Statistiques',BarChart3],['history','Historique',History]].map(([key,label,Icon]) => <button key={key} className={screen === key ? 'selected' : ''} aria-current={screen === key ? 'page' : undefined} onClick={() => key === 'add' ? openAction(state.tanks.length < 2 ? 'delivery' : kind) : navigate(key)}><span><Icon size={22}/></span><small>{label}</small></button>)}</nav>
    {message && <div role="status" className={`toast ${isError ? 'error' : ''}`}><span>{isError ? <X size={16}/> : <Check size={16}/>}</span>{message}</div>}
    <dialog ref={dialog} className="manage-dialog" aria-label="Gérer les cuves" onCancel={() => setManage(false)} onClose={() => setManage(false)}>{manage && <TankSettings tanks={state.tanks} actions={state.actions} request={request} onClose={() => setManage(false)}/>}</dialog>
  </div>
}

createRoot(document.getElementById('root')).render(<App/>);
