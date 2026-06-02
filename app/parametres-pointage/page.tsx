"use client";

import { useEffect, useMemo, useState } from "react";
import { formatFCFA } from "../lib/format";

const RADIUS_OPTIONS = [50, 100, 150, 200];

export default function ParametresPointagePage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [gpsTestMessage, setGpsTestMessage] = useState("");
  const [canSeeSalary, setCanSeeSalary] = useState(false);
  const [canManageGps, setCanManageGps] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);

  const [groupForm, setGroupForm] = useState({
    name: "",
    start_time: "",
    end_time: "",
    break_start: "",
    break_end: "",
  });

  const [userForm, setUserForm] = useState({
    user_id: "",
    schedule_group_id: "",
    salary_type: "horaire",
    hourly_rate: "",
    daily_rate: "",
    monthly_salary: "",
  });

  const [gpsForm, setGpsForm] = useState({
    gps_required: false,
    allow_remote_attendance: false,
    allow_out_of_zone_global: false,
    kiosk_mode: true,
    employee_scanner_access: false,
  });

  const [siteForm, setSiteForm] = useState({
    nom_du_site: "",
    latitude: "",
    longitude: "",
    rayon_autorise_metre: "100",
    actif: true,
  });

  const [assignmentForm, setAssignmentForm] = useState({
    user_id: "",
    site_ids: [] as string[],
    primary_attendance_site_id: "",
    employee_mobile: false,
    allow_out_of_zone: false,
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const jsonHeaders = () => ({
    "Content-Type": "application/json",
    ...authHeaders(),
  });

  const fetchData = async () => {
    const [groupsRes, usersRes, gpsRes, sitesRes] = await Promise.all([
      fetch("/api/attendance/settings/schedule-groups", { headers: authHeaders() }),
      fetch("/api/users", { headers: authHeaders() }),
      fetch("/api/attendance/settings/gps", { headers: authHeaders() }),
      fetch("/api/attendance-sites", { headers: authHeaders() }),
    ]);

    const groupsData = await groupsRes.json().catch(() => []);
    const usersData = await usersRes.json().catch(() => []);
    const gpsData = await gpsRes.json().catch(() => ({}));
    const sitesData = await sitesRes.json().catch(() => []);

    setGroups(Array.isArray(groupsData) ? groupsData : []);
    setUsers(Array.isArray(usersData) ? usersData : []);
    setSites(Array.isArray(sitesData) ? sitesData : []);
    setGpsForm({
      gps_required: gpsData.gps_required === true,
      allow_remote_attendance: gpsData.allow_remote_attendance === true,
      allow_out_of_zone_global: gpsData.allow_out_of_zone_global === true,
      kiosk_mode: gpsData.kiosk_mode !== false,
      employee_scanner_access: gpsData.employee_scanner_access === true,
    });
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      const role = String(user.role || "").toLowerCase();
      setCanSeeSalary(user.is_super_admin === true || role === "super_admin" || role === "direction");
      setCanManageGps(user.is_super_admin === true || role === "super_admin" || role === "admin" || role === "admin_entreprise");
    }
    fetchData();
  }, []);

  const selectedUser = users.find((user) => String(user.id) === String(userForm.user_id));
  const assignmentUser = users.find((user) => String(user.id) === String(assignmentForm.user_id));
  const selectedAssignmentSites = useMemo(
    () => new Set(assignmentForm.site_ids.map(String)),
    [assignmentForm.site_ids]
  );

  const createGroup = async (event: any) => {
    event.preventDefault();
    await fetch("/api/attendance/settings/schedule-groups", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(groupForm),
    });
    setMessage("Groupe horaire créé avec succès.");
    setGroupForm({ name: "", start_time: "", end_time: "", break_start: "", break_end: "" });
    fetchData();
  };

  const assignUserSettings = async (event: any) => {
    event.preventDefault();
    if (!userForm.user_id) return;

    await fetch(`/api/attendance/settings/users/${userForm.user_id}`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({
        schedule_group_id: userForm.schedule_group_id,
        salary_type: userForm.salary_type,
        hourly_rate: userForm.hourly_rate,
        daily_rate: userForm.daily_rate,
        monthly_salary: userForm.monthly_salary,
      }),
    });

    setMessage("Paramètres pointage de l’employé enregistrés.");
    setUserForm({
      user_id: "",
      schedule_group_id: "",
      salary_type: "horaire",
      hourly_rate: "",
      daily_rate: "",
      monthly_salary: "",
    });
    fetchData();
  };

  const saveGpsSettings = async (event: any) => {
    event.preventDefault();
    if (!canManageGps) {
      setMessage("Vous n’avez pas le droit de modifier les paramètres GPS.");
      return;
    }

    const response = await fetch("/api/attendance/settings/gps", {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify(gpsForm),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Paramètres généraux GPS enregistrés." : data.error || "Erreur sauvegarde GPS.");
    if (response.ok) fetchData();
  };

  const saveSite = async (event: any) => {
    event.preventDefault();
    if (!canManageGps) return;

    const url = editingSiteId ? `/api/attendance-sites/${editingSiteId}` : "/api/attendance-sites";
    const method = editingSiteId ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: jsonHeaders(),
      body: JSON.stringify(siteForm),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error || "Erreur sauvegarde site de pointage.");
      return;
    }

    setMessage(editingSiteId ? "Site de pointage modifié." : "Site de pointage ajouté.");
    setEditingSiteId(null);
    setSiteForm({ nom_du_site: "", latitude: "", longitude: "", rayon_autorise_metre: "100", actif: true });
    fetchData();
  };

  const editSite = (site: any) => {
    setEditingSiteId(site.id);
    setSiteForm({
      nom_du_site: site.nom_du_site || "",
      latitude: String(site.latitude || ""),
      longitude: String(site.longitude || ""),
      rayon_autorise_metre: String(site.rayon_autorise_metre || 100),
      actif: site.actif !== false,
    });
  };

  const disableSite = async (siteId: number) => {
    if (!confirm("Désactiver ce site de pointage ?")) return;
    const response = await fetch(`/api/attendance-sites/${siteId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Site désactivé." : data.error || "Erreur désactivation site.");
    fetchData();
  };

  const capturePositionForSite = () => {
    setGpsTestMessage("");
    if (!navigator.geolocation) {
      setGpsTestMessage("GPS indisponible sur cet appareil.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(7);
        const longitude = position.coords.longitude.toFixed(7);
        setSiteForm((current) => ({ ...current, latitude, longitude }));
        setGpsTestMessage(
          `Position récupérée : ${latitude}, ${longitude} - précision ${Math.round(position.coords.accuracy)} m.`
        );
      },
      (error) => {
        setGpsTestMessage(
          error.code === 1 ? "Autorisation GPS refusée." : "Impossible d’obtenir votre position."
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const testSiteDistance = (site: any) => {
    setGpsTestMessage("");
    if (!navigator.geolocation) {
      setGpsTestMessage("GPS indisponible sur cet appareil.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const toRad = (value: number) => (value * Math.PI) / 180;
        const earthRadiusMeters = 6371000;
        const dLat = toRad(Number(site.latitude) - position.coords.latitude);
        const dLon = toRad(Number(site.longitude) - position.coords.longitude);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(position.coords.latitude)) *
            Math.cos(toRad(Number(site.latitude))) *
            Math.sin(dLon / 2) ** 2;
        const distance = earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        setGpsTestMessage(
          `${site.nom_du_site} : distance ${Math.round(distance)} m / rayon ${site.rayon_autorise_metre} m.`
        );
      },
      () => setGpsTestMessage("Impossible d’obtenir votre position."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const loadEmployeeSites = async (userId: string) => {
    setAssignmentForm((current) => ({ ...current, user_id: userId, site_ids: [], primary_attendance_site_id: "" }));
    if (!userId) return;

    const response = await fetch(`/api/employees/${userId}/attendance-sites`, { headers: authHeaders() });
    const data = await response.json().catch(() => ({}));
    const assignedSites = Array.isArray(data.sites) ? data.sites : [];
    const employee = data.user || {};
    setAssignmentForm({
      user_id: userId,
      site_ids: assignedSites.map((site: any) => String(site.id)),
      primary_attendance_site_id: employee.primary_attendance_site_id ? String(employee.primary_attendance_site_id) : "",
      employee_mobile: employee.employee_mobile === true,
      allow_out_of_zone: employee.allow_out_of_zone === true,
    });
  };

  const toggleAssignmentSite = (siteId: number) => {
    const value = String(siteId);
    setAssignmentForm((current) => {
      const exists = current.site_ids.includes(value);
      const nextSites = exists
        ? current.site_ids.filter((id) => id !== value)
        : [...current.site_ids, value];
      return {
        ...current,
        site_ids: nextSites,
        primary_attendance_site_id:
          current.primary_attendance_site_id && nextSites.includes(current.primary_attendance_site_id)
            ? current.primary_attendance_site_id
            : nextSites[0] || "",
      };
    });
  };

  const saveEmployeeSites = async (event: any) => {
    event.preventDefault();
    if (!assignmentForm.user_id) return;

    const response = await fetch(`/api/employees/${assignmentForm.user_id}/attendance-sites`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify(assignmentForm),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Affectation sites employé enregistrée." : data.error || "Erreur affectation sites.");
    if (response.ok) {
      fetchData();
      loadEmployeeSites(assignmentForm.user_id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold md:text-4xl">Paramètres pointage</h1>
        <p className="text-gray-500">
          Horaires, sécurité GPS multi-sites et affectation des employés.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-green-100 p-4 font-bold text-green-700">
          {message}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <form onSubmit={createGroup} className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-bold">Créer un groupe horaire</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input name="name" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="Nom du groupe" className="rounded-xl border p-3" required />
            <input type="time" value={groupForm.start_time} onChange={(e) => setGroupForm({ ...groupForm, start_time: e.target.value })} className="rounded-xl border p-3" required />
            <input type="time" value={groupForm.end_time} onChange={(e) => setGroupForm({ ...groupForm, end_time: e.target.value })} className="rounded-xl border p-3" required />
            <input type="time" value={groupForm.break_start} onChange={(e) => setGroupForm({ ...groupForm, break_start: e.target.value })} className="rounded-xl border p-3" />
            <input type="time" value={groupForm.break_end} onChange={(e) => setGroupForm({ ...groupForm, break_end: e.target.value })} className="rounded-xl border p-3" />
          </div>
          <button className="mt-4 w-full rounded-xl bg-yellow-500 py-3 font-bold text-black">
            Créer groupe horaire
          </button>
        </form>

        <form onSubmit={assignUserSettings} className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-bold">Affecter horaire{canSeeSalary ? " & salaire" : ""}</h2>
          <div className="grid grid-cols-1 gap-4">
            <select value={userForm.user_id} onChange={(e) => setUserForm({ ...userForm, user_id: e.target.value })} className="rounded-xl border p-3" required>
              <option value="">Choisir employé</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.fullname} - {user.role}</option>
              ))}
            </select>
            {selectedUser && <div className="rounded-xl bg-gray-100 p-3 font-bold">Employé : {selectedUser.fullname}</div>}
            <select value={userForm.schedule_group_id} onChange={(e) => setUserForm({ ...userForm, schedule_group_id: e.target.value })} className="rounded-xl border p-3">
              <option value="">Aucun groupe horaire</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name} ({group.start_time} - {group.end_time})</option>
              ))}
            </select>
            {canSeeSalary ? (
              <>
                <select value={userForm.salary_type} onChange={(e) => setUserForm({ ...userForm, salary_type: e.target.value })} className="rounded-xl border p-3">
                  <option value="horaire">Salaire horaire</option>
                  <option value="journalier">Salaire journalier</option>
                  <option value="mensuel">Salaire mensuel</option>
                </select>
                <input type="number" value={userForm.hourly_rate} onChange={(e) => setUserForm({ ...userForm, hourly_rate: e.target.value })} placeholder="Taux horaire FCFA" className="rounded-xl border p-3" />
                <input type="number" value={userForm.daily_rate} onChange={(e) => setUserForm({ ...userForm, daily_rate: e.target.value })} placeholder="Salaire journalier FCFA" className="rounded-xl border p-3" />
                <input type="number" value={userForm.monthly_salary} onChange={(e) => setUserForm({ ...userForm, monthly_salary: e.target.value })} placeholder="Salaire mensuel FCFA" className="rounded-xl border p-3" />
              </>
            ) : (
              <div className="rounded-xl bg-blue-100 p-3 font-bold text-blue-700">
                Vous pouvez gérer les horaires, mais les salaires sont masqués.
              </div>
            )}
          </div>
          <button className="mt-4 w-full rounded-xl bg-black py-3 font-bold text-white">
            Enregistrer paramètres employé
          </button>
        </form>
      </div>

      <form onSubmit={saveGpsSettings} className="mb-8 rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-2 text-2xl font-bold">Section 1 : Paramètres généraux</h2>
        <p className="mb-4 text-gray-500">Le contrôle de distance est effectué côté backend.</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Toggle label="GPS obligatoire" checked={gpsForm.gps_required} disabled={!canManageGps} onChange={(checked) => setGpsForm({ ...gpsForm, gps_required: checked })} />
          <Toggle label="Autoriser pointage hors zone" checked={gpsForm.allow_out_of_zone_global || gpsForm.allow_remote_attendance} disabled={!canManageGps} onChange={(checked) => setGpsForm({ ...gpsForm, allow_remote_attendance: checked, allow_out_of_zone_global: checked })} />
          <Toggle label="Mode kiosque tablette" checked={gpsForm.kiosk_mode} disabled={!canManageGps} onChange={(checked) => setGpsForm({ ...gpsForm, kiosk_mode: checked })} />
          <Toggle label="Scanner accessible employés" checked={gpsForm.employee_scanner_access} disabled={!canManageGps} onChange={(checked) => setGpsForm({ ...gpsForm, employee_scanner_access: checked })} />
        </div>
        <button disabled={!canManageGps} className="mt-4 rounded-xl bg-black px-5 py-3 font-bold text-white disabled:bg-gray-300">
          Enregistrer paramètres généraux
        </button>
      </form>

      <section className="mb-8 rounded-2xl bg-white p-6 shadow">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Section 2 : Sites de pointage</h2>
          <p className="text-gray-500">Bureau, entrepôt, chantier, site client ou site mobile.</p>
        </div>

        <form onSubmit={saveSite} className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-6">
          <input value={siteForm.nom_du_site} onChange={(e) => setSiteForm({ ...siteForm, nom_du_site: e.target.value })} placeholder="Nom du site" className="rounded-xl border p-3 md:col-span-2" required />
          <input type="number" step="any" value={siteForm.latitude} onChange={(e) => setSiteForm({ ...siteForm, latitude: e.target.value })} placeholder="Latitude" className="rounded-xl border p-3" required />
          <input type="number" step="any" value={siteForm.longitude} onChange={(e) => setSiteForm({ ...siteForm, longitude: e.target.value })} placeholder="Longitude" className="rounded-xl border p-3" required />
          <select value={siteForm.rayon_autorise_metre} onChange={(e) => setSiteForm({ ...siteForm, rayon_autorise_metre: e.target.value })} className="rounded-xl border p-3">
            {RADIUS_OPTIONS.map((radius) => <option key={radius} value={radius}>{radius} m</option>)}
          </select>
          <button disabled={!canManageGps} className="rounded-xl bg-yellow-500 px-4 py-3 font-bold text-black disabled:bg-gray-300">
            {editingSiteId ? "Modifier" : "+ Ajouter"}
          </button>
        </form>

        <div className="mb-4 flex flex-wrap gap-3">
          <button type="button" onClick={capturePositionForSite} className="rounded-xl bg-black px-4 py-3 font-bold text-white">
            Récupérer automatiquement ma position
          </button>
          {editingSiteId && (
            <button type="button" onClick={() => { setEditingSiteId(null); setSiteForm({ nom_du_site: "", latitude: "", longitude: "", rayon_autorise_metre: "100", actif: true }); }} className="rounded-xl bg-gray-100 px-4 py-3 font-bold">
              Annuler modification
            </button>
          )}
        </div>

        {gpsTestMessage && <div className="mb-4 rounded-xl bg-yellow-100 p-3 font-bold text-yellow-900">{gpsTestMessage}</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="p-3">Nom du site</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Rayon</th>
                <th>Actif</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id} className="border-t">
                  <td className="p-3 font-bold">{site.nom_du_site}</td>
                  <td>{site.latitude}</td>
                  <td>{site.longitude}</td>
                  <td>{site.rayon_autorise_metre} m</td>
                  <td>{site.actif ? "Oui" : "Non"}</td>
                  <td className="space-x-2">
                    <button onClick={() => editSite(site)} className="rounded-xl bg-yellow-500 px-3 py-2 font-bold text-black">Modifier</button>
                    <button onClick={() => testSiteDistance(site)} className="rounded-xl bg-gray-100 px-3 py-2 font-bold">Tester</button>
                    <button onClick={() => disableSite(site.id)} className="rounded-xl bg-red-600 px-3 py-2 font-bold text-white">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sites.length === 0 && <p className="p-5 text-gray-500">Aucun site de pointage.</p>}
        </div>
      </section>

      <section className="mb-8 rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-2 text-2xl font-bold">Section 3 : Affectation employés</h2>
        <p className="mb-4 text-gray-500">Un employé ne peut pointer que sur les sites qui lui sont affectés.</p>

        <form onSubmit={saveEmployeeSites} className="grid grid-cols-1 gap-4">
          <select value={assignmentForm.user_id} onChange={(e) => loadEmployeeSites(e.target.value)} className="rounded-xl border p-3" required>
            <option value="">Choisir employé</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.fullname} - {user.role}</option>)}
          </select>
          {assignmentUser && <div className="rounded-xl bg-gray-100 p-3 font-bold">Employé sélectionné : {assignmentUser.fullname}</div>}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sites.filter((site) => site.actif !== false).map((site) => (
              <label key={site.id} className="flex items-center gap-3 rounded-xl bg-gray-100 p-4 font-bold">
                <input type="checkbox" checked={selectedAssignmentSites.has(String(site.id))} onChange={() => toggleAssignmentSite(site.id)} />
                {site.nom_du_site}
              </label>
            ))}
          </div>

          <select value={assignmentForm.primary_attendance_site_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, primary_attendance_site_id: e.target.value })} className="rounded-xl border p-3">
            <option value="">Site principal automatique</option>
            {sites.filter((site) => selectedAssignmentSites.has(String(site.id))).map((site) => (
              <option key={site.id} value={site.id}>{site.nom_du_site}</option>
            ))}
          </select>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Toggle label="Employé mobile" checked={assignmentForm.employee_mobile} onChange={(checked) => setAssignmentForm({ ...assignmentForm, employee_mobile: checked })} />
            <Toggle label="Autoriser hors zone pour cet employé" checked={assignmentForm.allow_out_of_zone} onChange={(checked) => setAssignmentForm({ ...assignmentForm, allow_out_of_zone: checked })} />
          </div>

          <button disabled={!canManageGps || !assignmentForm.user_id} className="rounded-xl bg-black px-5 py-3 font-bold text-white disabled:bg-gray-300">
            Enregistrer affectation sites
          </button>
        </form>
      </section>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-5 text-2xl font-bold">Groupes horaires existants</h2>
          {groups.length === 0 ? <p className="text-gray-500">Aucun groupe horaire.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-gray-500"><tr><th className="py-3">Groupe</th><th>Arrivée</th><th>Pause</th><th>Débauche</th></tr></thead>
                <tbody>{groups.map((group) => (
                  <tr key={group.id} className="border-t">
                    <td className="py-3 font-bold">{group.name}</td>
                    <td>{group.start_time || "-"}</td>
                    <td>{group.break_start && group.break_end ? `${group.break_start} - ${group.break_end}` : "-"}</td>
                    <td>{group.end_time || "-"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-5 text-2xl font-bold">Employés & paramètres pointage</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-gray-500">
                <tr><th className="py-3">Employé</th><th>Rôle</th><th>Groupe</th>{canSeeSalary && <th>Mensuel</th>}</tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const group = groups.find((item) => String(item.id) === String(user.schedule_group_id));
                  return (
                    <tr key={user.id} className="border-t">
                      <td className="py-3 font-bold">{user.fullname}</td>
                      <td>{user.role}</td>
                      <td>{group?.name || "-"}</td>
                      {canSeeSalary && <td>{formatFCFA(user.monthly_salary)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-xl bg-gray-100 p-4 font-bold">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5"
      />
      {label}
    </label>
  );
}
