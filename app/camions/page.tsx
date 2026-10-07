"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "../lib/api";
import { formatFCFA } from "../lib/format";
import ImportButton from "../components/ImportButton";

type Camion = { id:number; code:string; immatriculation:string|null; chauffeur:string|null; statut:string; notes?:string|null; total_recette:string; total_depense:string; operations:string; };
type EditForm = { code:string; immatriculation:string; chauffeur:string; statut:string; notes:string; };

export default function CamionsPage() {
  const [items,setItems]=useState<Camion[]>([]);
  const [form,setForm]=useState({code:"",immatriculation:"",chauffeur:""});
  const [editing,setEditing]=useState<Camion|null>(null);
  const [edit,setEdit]=useState<EditForm>({code:"",immatriculation:"",chauffeur:"",statut:"ACTIF",notes:""});
  const [msg,setMsg]=useState("");
  const [saving,setSaving]=useState(false);

  const load=useCallback(async()=>{ const res=await authFetch("/camions"); if(res.ok) setItems(await res.json()); },[]);
  useEffect(()=>{load();},[load]);

  const create=async()=>{ setMsg(""); if(!form.code.trim()) return setMsg("Code camion requis."); const res=await authFetch("/camions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}); const d=await res.json().catch(()=>({})); if(!res.ok) return setMsg(d?.error||"Erreur."); setForm({code:"",immatriculation:"",chauffeur:""}); setMsg("Camion enregistré."); await load(); };
  const beginEdit=(c:Camion)=>{ setEditing(c); setEdit({code:c.code||"",immatriculation:c.immatriculation||"",chauffeur:c.chauffeur||"",statut:(c.statut||"ACTIF").toUpperCase(),notes:c.notes||""}); setMsg(""); };
  const saveEdit=async()=>{ if(!editing) return; if(!edit.code.trim()) return setMsg("Code camion requis."); setSaving(true); setMsg(""); try { const res=await authFetch(`/camions/${editing.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(edit)}); const d=await res.json().catch(()=>({})); if(!res.ok) return setMsg(d?.error||"Erreur modification camion."); setEditing(null); setMsg("Camion modifié sans perte de son historique."); await load(); } finally { setSaving(false); } };
  const net=(c:Camion)=>Number(c.total_recette)-Number(c.total_depense);

  return <div className="min-h-screen bg-gray-100 p-4 md:p-8"><div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-black text-gray-900">Camions</h1><div className="flex gap-2"><ImportButton profile="auto" label="Importer un suivi (camions)" /><Link href="/dashboard" className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">← Tableau de bord</Link></div></div>
    {msg&&<div className="rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">{msg}</div>}
    <section className="rounded-2xl bg-white p-6 shadow"><h2 className="text-lg font-black text-gray-900">Ajouter un camion</h2><div className="mt-3 grid gap-3 sm:grid-cols-3">
      <input className="rounded-xl border p-3" placeholder="Code" value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/>
      <input className="rounded-xl border p-3" placeholder="Immatriculation" value={form.immatriculation} onChange={e=>setForm({...form,immatriculation:e.target.value})}/>
      <input className="rounded-xl border p-3" placeholder="Chauffeur" value={form.chauffeur} onChange={e=>setForm({...form,chauffeur:e.target.value})}/>
    </div><button onClick={create} className="mt-4 rounded-xl bg-yellow-500 px-6 py-3 font-black text-black">Ajouter</button></section>
    <section className="rounded-2xl bg-white p-4 shadow">{items.length===0?<p className="p-4 text-gray-600">Aucun camion.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="text-left text-gray-500"><th className="p-2">Code</th><th className="p-2">Immat.</th><th className="p-2">Chauffeur</th><th className="p-2">Opérations</th><th className="p-2">Recettes</th><th className="p-2">Dépenses</th><th className="p-2">Net</th><th className="p-2">Actions</th></tr></thead><tbody>
      {items.map(c=><tr key={c.id} className="border-t"><td className="p-2 font-bold text-blue-700"><Link href={`/camions/${c.id}`}>{c.code}</Link></td><td className="p-2">{c.immatriculation||"—"}</td><td className="p-2">{c.chauffeur||"—"}</td><td className="p-2">{c.operations}</td><td className="p-2 text-green-700">{formatFCFA(Number(c.total_recette))}</td><td className="p-2 text-red-600">{formatFCFA(Number(c.total_depense))}</td><td className="p-2 font-black">{formatFCFA(net(c))}</td><td className="p-2"><button onClick={()=>beginEdit(c)} className="rounded-lg bg-slate-900 px-3 py-2 font-bold text-white">Modifier</button></td></tr>)}
    </tbody></table></div>}</section>
    {editing&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-black">Modifier le camion</h2><p className="mb-4 text-sm text-gray-500">L'historique et les opérations restent attachés au même camion.</p><div className="grid gap-3">
      <input className="rounded-xl border p-3" placeholder="Code" value={edit.code} onChange={e=>setEdit({...edit,code:e.target.value})}/>
      <input className="rounded-xl border p-3" placeholder="Immatriculation" value={edit.immatriculation} onChange={e=>setEdit({...edit,immatriculation:e.target.value})}/>
      <input className="rounded-xl border p-3" placeholder="Chauffeur" value={edit.chauffeur} onChange={e=>setEdit({...edit,chauffeur:e.target.value})}/>
      <select className="rounded-xl border p-3" value={edit.statut} onChange={e=>setEdit({...edit,statut:e.target.value})}><option value="ACTIF">Actif</option><option value="INACTIF">Inactif</option></select>
      <textarea className="rounded-xl border p-3" placeholder="Notes" value={edit.notes} onChange={e=>setEdit({...edit,notes:e.target.value})}/>
    </div><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setEditing(null)} className="rounded-xl border px-4 py-2 font-bold">Annuler</button><button disabled={saving} onClick={saveEdit} className="rounded-xl bg-yellow-500 px-5 py-2 font-black disabled:opacity-50">{saving?"Enregistrement...":"Enregistrer"}</button></div></div></div>}
  </div></div>;
}
