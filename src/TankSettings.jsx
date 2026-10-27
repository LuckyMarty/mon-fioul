import React, { useState } from 'react';
import { Plus, X, Fuel, LockKeyhole, Trash2, Check, ChevronLeft } from 'lucide-react';
import './tank-settings.css';
const litres = n => new Intl.NumberFormat('fr-FR', {maximumFractionDigits:1}).format(n);
const draftFor = tank => ({label:tank?.label || '',capacity:String(tank?.capacity ?? 1000),initialLevel:String(tank?.initial_level ?? 0)});

export default function TankSettings({ tanks, actions, request, onClose }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(draftFor());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tank = tanks.find(t => t.id === editing);
  const used = !!tank && actions.some(a => a.from_tank_id === tank.id || a.to_tank_id === tank.id);
  const isNew = editing === 'new';
  const canDelete = tank && !used && tanks.length > 1;
  function open(t) { setEditing(t?.id ?? 'new'); setDraft(draftFor(t)); setError(''); setNotice(''); setConfirmDelete(false); }
  function back() { setEditing(null); setError(''); setConfirmDelete(false); }
  async function save(e) {
    e.preventDefault(); setError('');
    const capacity = Number(draft.capacity), initialLevel = Number(draft.initialLevel);
    if (!draft.label.trim() || !Number.isFinite(capacity) || capacity <= 0) {setError('Indiquez un nom et une capacité supérieure à zéro.'); return;}
    if (!used && (!Number.isFinite(initialLevel) || initialLevel < 0 || initialLevel > capacity)) {setError('Le niveau de départ doit être compris entre 0 et la capacité.'); return;}
    if (used && capacity < tank.level) {setError(`La capacité doit contenir les ${litres(tank.level)} L actuellement enregistrés.`); return;}
    setBusy(true);
    try {
      await request(isNew ? '/api/tanks' : `/api/tanks/${tank.id}`, {method:isNew ? 'POST' : 'PATCH',body:JSON.stringify({label:draft.label.trim(),capacity,...(!used ? {initialLevel} : {})})});
      setNotice(isNew ? 'Cuve ajoutée à droite de votre installation.' : 'Modifications enregistrées.'); back();
    } catch(e) {setError(e.message);} finally {setBusy(false);}
  }
  async function remove() {
    setBusy(true); setError('');
    try {await request(`/api/tanks/${tank.id}`,{method:'DELETE'});setNotice('Cuve supprimée.');back();}
    catch(e){setError(e.message);} finally {setBusy(false);}
  }
  return <section className="tank-settings">
    <header className="settings-header"><div><p className="eyebrow">MON INSTALLATION</p><h2>{editing === null ? 'Mes cuves' : isNew ? 'Ajouter une cuve' : `Cuve ${tank?.label || ''}`}</h2></div><button className="icon-button" disabled={busy} onClick={onClose} aria-label="Fermer les réglages"><X size={20}/></button></header>
    {notice && <p className="settings-success" role="status"><Check size={17}/>{notice}</p>}
    {editing === null ? <>
      <div className="settings-overview"><Fuel size={22}/><div><strong>{tanks.length} cuve{tanks.length > 1 ? 's' : ''}</strong><span>{litres(tanks.reduce((sum,t)=>sum+t.capacity,0))} L de capacité totale</span></div></div>
      <p className="settings-description">Vos cuves sont présentées de gauche à droite. Sélectionnez une cuve pour modifier ses informations.</p>
      <div className="settings-tank-list">{tanks.map((t,i)=><button key={t.id} className="settings-tank" onClick={()=>open(t)}><span className="settings-position">{i+1}</span><span className="settings-tank-name"><strong>Cuve {t.label}</strong><small>{litres(t.level)} L sur {litres(t.capacity)} L</small><span className="settings-level"><i style={{width:`${Math.min(100,t.level/t.capacity*100)}%`}}/></span></span><span className="settings-edit">Modifier</span></button>)}</div>
      <button className="settings-add" onClick={()=>open(null)}><Plus size={20}/> Ajouter une cuve</button>
      <button className="settings-primary" onClick={onClose}>Terminé</button>
    </> : <>
      <button className="settings-back" disabled={busy} onClick={back}><ChevronLeft size={18}/> Retour aux cuves</button>
      <form className="settings-form" onSubmit={save}>
        <label>Nom de la cuve<input autoFocus required maxLength={24} value={draft.label} disabled={busy} placeholder="Ex. A, Garage, Réserve…" onChange={e=>setDraft({...draft,label:e.target.value})}/></label>
        <label>Capacité maximale<div className="settings-unit"><input required type="number" min="0.1" step="0.1" inputMode="decimal" value={draft.capacity} disabled={busy} onChange={e=>setDraft({...draft,capacity:e.target.value})}/><span>litres</span></div></label>
        {used ? <div className="settings-locked"><LockKeyhole size={18}/><div><strong>Niveau actuel : {litres(tank.level)} L</strong><p>Le niveau de départ ({litres(tank.initial_level)} L) est verrouillé, car cette cuve figure dans l’historique. Les mouvements font évoluer son niveau.</p></div></div> : <label>Niveau de départ<div className="settings-unit"><input required type="number" min="0" max={draft.capacity} step="0.1" inputMode="decimal" value={draft.initialLevel} disabled={busy} onChange={e=>setDraft({...draft,initialLevel:e.target.value})}/><span>litres</span></div><small>Quantité déjà présente avant les mouvements enregistrés.</small><div className="settings-presets"><button type="button" disabled={busy} onClick={()=>setDraft({...draft,initialLevel:'0'})}>Vide</button><button type="button" disabled={busy || !(Number(draft.capacity)>0)} onClick={()=>setDraft({...draft,initialLevel:String(Math.round(Number(draft.capacity)*5)/10)})}>À moitié</button><button type="button" disabled={busy || !(Number(draft.capacity)>0)} onClick={()=>setDraft({...draft,initialLevel:draft.capacity})}>Pleine</button></div></label>}
        {error && <p className="settings-error" role="alert">{error}</p>}
        <div className="settings-form-actions"><button type="button" disabled={busy} onClick={back}>Annuler</button><button type="submit" className="settings-primary" disabled={busy}>{busy ? 'Enregistrement…' : isNew ? 'Ajouter la cuve' : 'Enregistrer'}</button></div>
      </form>
      {!isNew && <div className="settings-danger">{canDelete ? confirmDelete ? <div role="alert"><strong>Supprimer la cuve {tank.label} ?</strong><p>Elle contient {litres(tank.level)} L enregistrés. Sa suppression retirera ce volume du stock affiché.</p><div><button disabled={busy} onClick={()=>setConfirmDelete(false)}>Conserver</button><button className="settings-delete" disabled={busy} onClick={remove}>{busy ? 'Suppression…' : 'Confirmer la suppression'}</button></div></div> : <button className="settings-delete" disabled={busy} onClick={()=>setConfirmDelete(true)}><Trash2 size={16}/> Supprimer cette cuve</button> : <p><LockKeyhole size={15}/>{used ? 'Cette cuve possède un historique et ne peut pas être supprimée.' : 'Conservez au moins une cuve dans votre installation.'}</p>}</div>}
    </>}
  </section>;
}
