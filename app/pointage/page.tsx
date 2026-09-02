"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";

type Employee = { id:number; employee_id?:number; employee_number:number; full_name:string; user_id?:number|null; site_name:string; schedule_name:string; daily_rate?:number|null };
type Attendance = Employee & { attendance_id?:number|null; check_in?:string|null; break_out?:string|null; break_in?:string|null; check_out?:string|null; status:string; late_minutes:number };

const actions = [
  ["CHECK_IN","Pointer l’arrivée","bg-emerald-600 text-white"],
  ["BREAK_OUT","Départ en pause","bg-amber-400 text-black"],
  ["BREAK_IN","Retour de pause","bg-blue-600 text-white"],
  ["CHECK_OUT","Pointer la fin","bg-slate-900 text-white"],
] as const;
const statusLabel:Record<string,string> = { ABSENT:"Absent",PRESENT:"Présent",LATE:"En retard",ON_BREAK:"En pause",COMPLETED:"Terminé" };

export default function PointagePage() {
  const [employees,setEmployees]=useState<Employee[]>([]);
  const [records,setRecords]=useState<Attendance[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [permissions,setPermissions]=useState<any>({});
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    const [er,tr]=await Promise.all([
      authFetch("/attendance-v2/employees",{cache:"no-store"}),
      authFetch("/attendance-v2/today",{cache:"no-store"}),
    ]);
    const ed=await er.json().catch(()=>({})); const td=await tr.json().catch(()=>({}));
    if(!er.ok||!tr.ok){setError(ed.error||td.error||"Impossible de charger le pointage.");return;}
    const list=Array.isArray(ed.employees)?ed.employees:[];
    setEmployees(list); setRecords(Array.isArray(td.records)?td.records:[]); setPermissions(ed.permissions||{});
    setSelectedId(current=>current||(list[0]?.id?String(list[0].id):""));
  },[]);
  useEffect(()=>{load();},[load]);

  const selected=useMemo(()=>records.find(i=>String(i.employee_id||i.id)===selectedId)||employees.find(i=>String(i.id)===selectedId),[employees,records,selectedId]);
  const punch=async(actionType:string)=>{
    if(!selectedId||busy)return; setBusy(true);setMessage("");setError("");
    const response=await authFetch("/attendance-v2/check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({employee_id:Number(selectedId),action_type:actionType})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)setError(data.error||"Pointage refusé.");
    else{setMessage(`Pointage enregistré pour ${data.employee?.full_name||selected?.full_name}.`);await load();}
    setBusy(false);
  };
  const present=records.filter(i=>["PRESENT","LATE","ON_BREAK"].includes(i.status)).length;
  const late=records.filter(i=>i.late_minutes>0).length;

  return <main className="min-h-screen bg-slate-100 p-4 text-slate-950 md:p-8"><div className="mx-auto max-w-7xl">
    <h1 className="text-3xl font-black md:text-4xl">Pointage du personnel</h1>
    <p className="mt-2 text-slate-600">Horaires officiels, pauses et retards calculés à l’heure de Bamako.</p>
    {(message||error)&&<div className={`mt-5 rounded-xl p-4 font-bold ${error?"bg-red-100 text-red-800":"bg-emerald-100 text-emerald-800"}`}>{error||message}</div>}
    <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Effectif visible" value={records.length}/><Stat label="Présents" value={present}/><Stat label="Retards" value={late}/><Stat label="Terminés" value={records.filter(i=>i.status==="COMPLETED").length}/></section>
    <section className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
      <div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Enregistrer un pointage</h2>
        {employees.length>1&&<div className="mt-4"><label className="mb-2 block text-sm font-bold">Employé autorisé</label><select className="w-full rounded-xl border p-3" value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{employees.map(e=><option key={e.id} value={e.id}>{e.employee_number}. {e.full_name}</option>)}</select><p className="mt-2 text-xs text-slate-500">Seuls les employés de votre site autorisé apparaissent.</p></div>}
        {selected&&<div className="mt-4 rounded-xl bg-slate-100 p-4"><p className="font-black">{selected.full_name}</p><p className="text-sm text-slate-600">{selected.site_name}</p><p className="text-sm text-slate-600">{selected.schedule_name}</p></div>}
        <div className="mt-4 grid gap-3">{actions.map(([value,label,color])=><button key={value} disabled={!selectedId||busy} onClick={()=>punch(value)} className={`min-h-12 rounded-xl px-4 font-black disabled:cursor-not-allowed disabled:opacity-40 ${color}`}>{busy?"Enregistrement…":label}</button>)}</div>
        {permissions.can_view_all_salaries&&<p className="mt-4 text-xs text-slate-500">Les salaires apparaîtront après saisie des montants journaliers.</p>}
      </div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-black">Situation du jour</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="bg-slate-50 text-sm text-slate-600"><tr><th className="p-4">Employé</th><th className="p-4">Site</th><th className="p-4">Statut</th><th className="p-4">Arrivée</th><th className="p-4">Pause</th><th className="p-4">Fin</th><th className="p-4">Retard</th></tr></thead><tbody>{records.map(i=><tr key={i.employee_id} className="border-t"><td className="p-4 font-bold">{i.employee_number}. {i.full_name}</td><td className="p-4 text-sm">{i.site_name}</td><td className="p-4 font-bold">{statusLabel[i.status]||i.status}</td><td className="p-4">{time(i.check_in)}</td><td className="p-4">{time(i.break_out)} / {time(i.break_in)}</td><td className="p-4">{time(i.check_out)}</td><td className={`p-4 font-black ${i.late_minutes?"text-red-600":"text-slate-500"}`}>{i.late_minutes||0} min</td></tr>)}</tbody></table></div></div>
    </section>
  </div></main>;
}
function time(value?:string|null){return value?new Date(value).toLocaleTimeString("fr-FR",{timeZone:"Africa/Bamako",hour:"2-digit",minute:"2-digit"}):"—";}
function Stat({label,value}:{label:string;value:number}){return <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;}
