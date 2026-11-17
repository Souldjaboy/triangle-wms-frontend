"use client";
import { useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import { authFetch } from '../../lib/api';
type Access = {canView:boolean;canManage:boolean};
function useAccess() {
  const [access,setAccess]=useState<Access|null>(null);
  useEffect(()=>{
    const controller=new AbortController();let busy=false;
    async function check() {
      if(busy || controller.signal.aborted)return;busy=true;
      try {const r=await authFetch('/digital-twin/access',{cache:'no-store',signal:controller.signal});
        const j=r.ok?await r.json():null;
        if(!controller.signal.aborted)setAccess({canView:j?.canView===true,canManage:j?.canManage===true});
      }catch{if(!controller.signal.aborted)setAccess({canView:false,canManage:false});}finally{busy=false;}
    }
    void check();const refresh=()=>{if(!document.hidden)void check();};
    const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return ()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  return access;
}
export default function DigitalTwinEntry() {
  const access=useAccess();
  if(!access?.canView)return null;
  return <Link href="/stocks/digital-twin" style={{display:'inline-flex',margin:'12px 0',padding:'12px 18px',borderRadius:10,background:'#153752',color:'#ffd349',fontWeight:700,textDecoration:'none'}}>Entrepôts — Vue 3D / 2D</Link>;
}
export function AccessGate({children}:{children:ReactNode}) {
  const access=useAccess();const [manage,setManage]=useState(false);
  if(!access)return <main className="dt-access-message">Vérification de l’accès…</main>;
  if(!access.canView)return <main className="dt-access-message"><h1>Accès au module indisponible</h1><p>Ce module privé nécessite une autorisation du propriétaire et les droits de consultation du stock.</p><Link href="/stocks">Retour aux stocks</Link></main>;
  return <>
    {access.canManage && <div className="dt-access-owner"><span>Module privé · Tu gères les accès</span><button onClick={()=>setManage(!manage)}>{manage?'Fermer la gestion des accès':'Gérer les accès'}</button></div>}
    {access.canManage && manage && <AccessManager/>}
    {children}
  </>;
}
type Account={id:number;fullname:string;email:string;role:string;is_active:boolean;allowed:boolean;is_owner:boolean};
function AccessManager() {
  const [users,setUsers]=useState<Account[]>([]),[q,setQ]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState<number|null>(null),[loading,setLoading]=useState(true);
  useEffect(()=>{
    const c=new AbortController();setLoading(true);
    const timer=setTimeout(async()=>{try{
      const r=await authFetch('/digital-twin/access/users?q='+encodeURIComponent(q),{cache:'no-store',signal:c.signal});
      const j=await r.json();if(!r.ok)throw Error(j.error||'Lecture impossible');
      if(!c.signal.aborted){setUsers(j.users);setError('');}
    }catch(e){if(!c.signal.aborted){setUsers([]);setError(e instanceof Error?e.message:'Lecture impossible');}}finally{if(!c.signal.aborted)setLoading(false);}},200);
    return()=>{c.abort();clearTimeout(timer);};
  },[q]);
  async function toggle(u:Account) {
    setBusy(u.id);setError('');
    try{const r=await authFetch('/digital-twin/access/users/'+u.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({allowed:!u.allowed})});const j=await r.json();if(!r.ok)throw Error(j.error||'Modification impossible');setUsers(us=>us.map(v=>v.id===u.id?{...v,allowed:j.allowed===true}:v));}
    catch(e){setError(e instanceof Error?e.message:'Modification impossible');}finally{setBusy(null);}
  }
  return <section className="dt-access-panel" aria-label="Gestion des accès au Digital Twin"><h2>Qui peut voir le module 2D / 3D ?</h2>
    <p>Les autorisations concernent l’entreprise sélectionnée. Elles conservent les limites d’accès au stock et aux entrepôts. Toi seul gères les accès et les plans.</p>
    <label>Rechercher un compte<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nom ou adresse e-mail"/></label>
    {error&&<p role="alert">{error}</p>}{loading?<p>Chargement des comptes…</p>:<div className="dt-access-table"><table><thead><tr><th>Compte</th><th>Rôle</th><th>Accès au module</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><strong>{u.fullname}</strong><small>{u.email}</small>{!u.is_active&&<small>Compte désactivé</small>}</td><td>{u.role}</td><td><label><input type="checkbox" checked={u.is_owner||u.allowed} disabled={u.is_owner||busy!==null||(!u.is_active&&!u.allowed)} onChange={()=>void toggle(u)} aria-label={'Autoriser '+u.email}/>{u.is_owner?'Propriétaire':u.allowed?'Autorisé':'Non autorisé'}</label></td></tr>)}</tbody></table>{!users.length&&<p>Aucun compte trouvé.</p>}</div>}
    <p>100 comptes maximum par recherche. Tout changement est journalisé. Une révocation bloque les prochaines requêtes ; l’écran déjà ouvert se ferme lors de sa prochaine vérification (15 secondes ou retour sur l’onglet).</p>
  </section>;
}
