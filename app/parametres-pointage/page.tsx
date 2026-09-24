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

  /* PAIE — les salariés de l'entreprise.
     La liste vient de /payroll/employees, bornée à l'entreprise de la session
     côté serveur : /users, lui, sert toutes les sociétés à un super admin et
     mêlerait les salariés Triangle et Fatemat dans le même tableau. */
  const [payroll, setPayroll] = useState<any[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<any>(null);
  const [removing, setRemoving] = useState(false);

  const emptyEmployee = {
    nom: "",
    prenom: "",
    fonction: "",
    salaire_mensuel: "",
    telephone: "",
    date_entree: "",
  };
  const [employeeForm, setEmployeeForm] = useState(emptyEmployee);

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
    const [groupsRes, usersRes, gpsRes, sitesRes, payrollRes, companyRes] = await Promise.all([
      fetch("/api/attendance/settings/schedule-groups", { headers: authHeaders() }),
      fetch("/api/users", { headers: authHeaders() }),
      fetch("/api/attendance/settings/gps", { headers: authHeaders() }),
      fetch("/api/attendance-sites", { headers: authHeaders() }),
      fetch("/api/payroll/employees", { headers: authHeaders() }),
      fetch("/api/company-settings/current", { headers: authHeaders() }),
    ]);

    const groupsData = await groupsRes.json().catch(() => []);
    const usersData = await usersRes.json().catch(() => []);
    const gpsData = await gpsRes.json().catch(() => ({}));
    const sitesData = await sitesRes.json().catch(() => []);
    const payrollData = await payrollRes.json().catch(() => ({}));
    const companyData = await companyRes.json().catch(() => ({}));

    setGroups(Array.isArray(groupsData) ? groupsData : []);
    setUsers(Array.isArray(usersData) ? usersData : []);
    setSites(Array.isArray(sitesData) ? sitesData : []);
    setPayroll(Array.isArray(payrollData?.employees) ? payrollData.employees : []);
    /* Le nom sert à nommer l'entreprise dans la confirmation de retrait :
       « Confirmer le retrait de X de Triangle ? ». */
    setCompanyName(
      companyData?.company_name ||
      companyData?.name ||
      (typeof window !== "undefined" ? localStorage.getItem("active_company_name") : "") ||
      "l’entreprise"
    );
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

  /* Un salarié retiré est désactivé, pas supprimé : il sort de la liste
     active, et on se contente d'en annoncer le nombre. */
  const actifs = useMemo(() => payroll.filter((e) => e.is_active !== false), [payroll]);
  const retires = useMemo(() => payroll.filter((e) => e.is_active === false), [payroll]);

  /* LES EMPLOYÉS PROPOSÉS DANS LES SÉLECTEURS.
     /users ne filtre pas par société pour un super admin : ouvert depuis
     Fatemat, il proposait les salariés Triangle dans la même liste déroulante,
     et l'on pouvait leur affecter un horaire ou un salaire depuis la mauvaise
     entreprise. On retient donc les seuls comptes que la paie — elle, bornée
     côté serveur — reconnaît comme actifs ici. */
  const employesDeLEntreprise = useMemo(() => {
    const actifsIds = new Set(actifs.map((e) => String(e.id)));
    return users.filter((user) => actifsIds.has(String(user.id)));
  }, [users, actifs]);

  const selectedUser = users.find((user) => String(user.id) === String(userForm.user_id));
  const assignmentUser = users.find((user) => String(user.id) === String(assignmentForm.user_id));
  const selectedAssignmentSites = useMemo(
    () => new Set(assignmentForm.site_ids.map(String)),
    [assignmentForm.site_ids]
  );

  /* Les refus du serveur ont un code : on en fait une phrase, jamais un
     message technique ni une trace. Le texte du serveur reste le repli, car
     c'est lui qui connaît le détail — par exemple le nom de la fiche déjà
     existante. */
  const messageDErreur = (data: any, statut: number) => {
    const connus: Record<string, string> = {
      EMPLOYEE_ALREADY_EXISTS: data?.error || "Ce salarié fait déjà partie de l’entreprise.",
      EMPLOYEE_NOT_FOUND: "Ce salarié est introuvable dans cette entreprise.",
      MISSING_NAME: "Le nom du salarié est obligatoire.",
      INVALID_SALARY: "Le salaire ne peut pas être négatif.",
      INVALID_DATE: "La date d’entrée est invalide.",
      EMAIL_ALREADY_USED: "Un compte porte déjà cette adresse e-mail.",
      CANNOT_REMOVE_SELF: "Vous ne pouvez pas vous retirer vous-même de la paie.",
      NO_ACTIVE_COMPANY: "Aucune entreprise active. Sélectionnez l’entreprise avant de gérer la paie.",
    };
    if (data?.code && connus[data.code]) return connus[data.code];
    if (statut === 403) return "Vous n’avez pas l’autorisation d’effectuer cette action.";
    if (statut === 404) return "Ce salarié est introuvable dans cette entreprise.";
    if (statut >= 500) return "Le serveur n’a pas pu traiter la demande. Réessayez dans un instant.";
    return typeof data?.error === "string" && data.error.length < 200
      ? data.error
      : "L’opération n’a pas pu être effectuée.";
  };

  /**
   * AJOUTER UN SALARIÉ.
   *
   * L'entreprise n'est pas envoyée : le serveur la déduit de la session. Un
   * `company_id` posté depuis le navigateur serait au mieux inutile, au pire
   * un moyen d'écrire dans l'autre société.
   */
  const ajouterSalarie = async (event: any) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");
    setSavingEmployee(true);

    const response = await fetch("/api/payroll/employees", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        nom: employeeForm.nom,
        prenom: employeeForm.prenom,
        fonction: employeeForm.fonction,
        salaire_mensuel: employeeForm.salaire_mensuel,
        telephone: employeeForm.telephone,
        date_entree: employeeForm.date_entree,
      }),
    }).catch(() => null);

    const data = await response?.json().catch(() => ({}));
    setSavingEmployee(false);

    if (!response || !response.ok) {
      setErrorMessage(messageDErreur(data, response?.status || 0));
      return;
    }

    setShowAddEmployee(false);
    setEmployeeForm(emptyEmployee);
    /* Le serveur dit lui-même si le salaire a pu être fixé : un compte sans ce
       droit crée le salarié mais pas sa rémunération, et l'écran doit le dire
       plutôt que d'afficher un montant vide sans explication. */
    setMessage(data?.message || "Salarié ajouté à la paie.");
    await fetchData();
  };

  /**
   * RETIRER UN SALARIÉ.
   *
   * Le serveur désactive le compte et conserve paies, avances et heures. On ne
   * parle donc jamais de suppression à l'écran : ce serait décrire autre chose
   * que ce qui se passe.
   */
  const retirerSalarie = async () => {
    if (!removeTarget) return;
    setMessage("");
    setErrorMessage("");
    setRemoving(true);

    const response = await fetch(`/api/payroll/employees/${removeTarget.id}`, {
      method: "DELETE",
      headers: jsonHeaders(),
    }).catch(() => null);

    const data = await response?.json().catch(() => ({}));
    setRemoving(false);

    if (!response || !response.ok) {
      setErrorMessage(messageDErreur(data, response?.status || 0));
      return;
    }

    setRemoveTarget(null);
    setMessage(data?.message || `${removeTarget.fullname} a été retiré de la paie.`);
    await fetchData();
  };

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

      {errorMessage && (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-xl bg-red-100 p-4 font-bold text-red-700">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage("")} className="shrink-0 text-red-500">✕</button>
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
              {employesDeLEntreprise.map((user) => (
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
            {/* Même raison : on n'affecte pas un site de pointage à un salarié
                d'une autre entreprise. */}
            {employesDeLEntreprise.map((user) => <option key={user.id} value={user.id}>{user.fullname} - {user.role}</option>)}
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

        {/* La liste de paie porte désormais une colonne d'action : dans une
            demi-largeur, « Retirer » se retrouvait hors du cadre. Elle prend
            donc toute la largeur de la grille. */}
        <section className="rounded-2xl bg-white p-6 shadow xl:col-span-2">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Salariés & paramètres pointage</h2>
              <p className="text-gray-500">
                {actifs.length} salarié(s) dans {companyName}
                {retires.length > 0 && ` · ${retires.length} retiré(s), non affiché(s)`}
              </p>
            </div>
            <button
              onClick={() => { setEmployeeForm(emptyEmployee); setErrorMessage(""); setShowAddEmployee(true); }}
              className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black"
            >
              + Ajouter un salarié
            </button>
          </div>
          {/* SUR TÉLÉPHONE, UNE CARTE PAR SALARIÉ.
              Le tableau, lui, défile horizontalement : l'action « Retirer »
              serait hors de l'écran à 375 px, donc hors de portée. Une carte
              met le nom, le salaire et l'action sous le pouce. */}
          <div className="grid gap-3 sm:hidden">
            {actifs.map((employe) => (
              <div key={employe.id} className="rounded-xl border border-gray-200 p-4">
                <p className="font-bold">{employe.fullname}</p>
                <p className="text-gray-500">{employe.job_title || employe.role || "-"}</p>
                {canSeeSalary && (
                  <p className="mt-1 font-bold">
                    {employe.monthly_salary === undefined ? "-" : formatFCFA(employe.monthly_salary)}
                  </p>
                )}
                <button
                  onClick={() => { setErrorMessage(""); setRemoveTarget(employe); }}
                  className="mt-3 w-full rounded-lg border border-red-200 py-2 font-bold text-red-700"
                >
                  Retirer
                </button>
              </div>
            ))}
            {actifs.length === 0 && (
              <p className="text-gray-500">
                Aucun salarié pour le moment. Utilisez « + Ajouter un salarié ».
              </p>
            )}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[640px] text-left">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-3">Salarié</th><th>Fonction</th><th>Groupe</th>
                  {canSeeSalary && <th>Mensuel</th>}<th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {actifs.map((employe) => {
                  /* Le groupe horaire vient de /users : la liste de paie ne le
                     porte pas, et il n'y avait pas lieu de la changer pour ça. */
                  const fiche = users.find((item) => String(item.id) === String(employe.id));
                  const group = groups.find((item) => String(item.id) === String(fiche?.schedule_group_id));
                  return (
                    <tr key={employe.id} className="border-t">
                      <td className="py-3 font-bold">{employe.fullname}</td>
                      <td>{employe.job_title || employe.role || "-"}</td>
                      <td>{group?.name || "-"}</td>
                      {canSeeSalary && (
                        <td>
                          {employe.monthly_salary === undefined
                            ? "-"
                            : formatFCFA(employe.monthly_salary)}
                        </td>
                      )}
                      <td className="text-right">
                        <button
                          onClick={() => { setErrorMessage(""); setRemoveTarget(employe); }}
                          className="rounded-lg border border-red-200 px-3 py-2 font-bold text-red-700"
                        >
                          Retirer
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {actifs.length === 0 && (
                  <tr><td colSpan={canSeeSalary ? 5 : 4} className="py-6 text-gray-500">
                    Aucun salarié pour le moment. Utilisez « + Ajouter un salarié ».
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ══════════════════════ AJOUTER UN SALARIÉ ══════════════════════ */}
      {showAddEmployee && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
             role="dialog" aria-modal="true" aria-label="Ajouter un salarié">
          <form onSubmit={ajouterSalarie}
                className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow sm:max-w-lg sm:rounded-2xl">
            <h2 className="text-2xl font-bold">Ajouter un salarié</h2>
            <p className="mt-1 text-gray-500">
              Le salarié sera rattaché à {companyName}. Il apparaîtra ensuite dans la paie,
              le pointage et les badges.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="font-bold">
                Nom <span className="text-red-600">*</span>
                <input value={employeeForm.nom} required
                       onChange={(e) => setEmployeeForm({ ...employeeForm, nom: e.target.value })}
                       placeholder="Traoré" className="mt-1 w-full rounded-xl border p-3 font-normal" />
              </label>
              <label className="font-bold">
                Prénom <span className="text-red-600">*</span>
                <input value={employeeForm.prenom} required
                       onChange={(e) => setEmployeeForm({ ...employeeForm, prenom: e.target.value })}
                       placeholder="Moussa" className="mt-1 w-full rounded-xl border p-3 font-normal" />
              </label>
              <label className="font-bold md:col-span-2">
                Fonction / Poste
                <input value={employeeForm.fonction}
                       onChange={(e) => setEmployeeForm({ ...employeeForm, fonction: e.target.value })}
                       placeholder="Magasinier livreur" className="mt-1 w-full rounded-xl border p-3 font-normal" />
              </label>
              {canSeeSalary ? (
                <label className="font-bold">
                  Salaire mensuel (FCFA)
                  <input type="number" min={0} inputMode="numeric" value={employeeForm.salaire_mensuel}
                         onChange={(e) => setEmployeeForm({ ...employeeForm, salaire_mensuel: e.target.value })}
                         placeholder="175000" className="mt-1 w-full rounded-xl border p-3 font-normal" />
                </label>
              ) : (
                <div className="rounded-xl bg-blue-100 p-3 font-bold text-blue-700 md:col-span-2">
                  Le salaire sera fixé par la direction : vous pouvez créer le salarié sans lui.
                </div>
              )}
              <label className="font-bold">
                Téléphone
                <input value={employeeForm.telephone} inputMode="tel"
                       onChange={(e) => setEmployeeForm({ ...employeeForm, telephone: e.target.value })}
                       placeholder="+223 70 00 00 00" className="mt-1 w-full rounded-xl border p-3 font-normal" />
              </label>
              <label className="font-bold md:col-span-2">
                Date d’entrée
                <input type="date" value={employeeForm.date_entree}
                       onChange={(e) => setEmployeeForm({ ...employeeForm, date_entree: e.target.value })}
                       className="mt-1 w-full rounded-xl border p-3 font-normal" />
              </label>
            </div>

            {errorMessage && (
              <p className="mt-4 rounded-xl bg-red-100 p-3 font-bold text-red-700">{errorMessage}</p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="submit" disabled={savingEmployee}
                      className="flex-1 rounded-xl bg-yellow-500 py-3 font-bold text-black disabled:opacity-40">
                {savingEmployee ? "Ajout en cours…" : "Ajouter le salarié"}
              </button>
              <button type="button" disabled={savingEmployee}
                      onClick={() => { setShowAddEmployee(false); setErrorMessage(""); }}
                      className="rounded-xl border border-gray-300 px-5 py-3 font-bold text-gray-700">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ════════════════════ CONFIRMER LE RETRAIT ═════════════════════ */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
             role="dialog" aria-modal="true" aria-label="Confirmer le retrait">
          <div className="w-full rounded-t-2xl bg-white p-6 shadow sm:max-w-md sm:rounded-2xl">
            <h2 className="text-2xl font-bold">
              Confirmer le retrait de {removeTarget.fullname} de {companyName} ?
            </h2>
            {/* Le compte est désactivé et l'historique conservé : on le dit,
                parce que « supprimer » décrirait autre chose que ce qui se passe. */}
            <p className="mt-2 text-gray-600">
              Il n’apparaîtra plus parmi les salariés actifs. Ses paies, avances et heures
              déjà enregistrées sont conservées.
            </p>

            {errorMessage && (
              <p className="mt-4 rounded-xl bg-red-100 p-3 font-bold text-red-700">{errorMessage}</p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={retirerSalarie} disabled={removing}
                      className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-40">
                {removing ? "Retrait en cours…" : "Confirmer le retrait"}
              </button>
              <button disabled={removing}
                      onClick={() => { setRemoveTarget(null); setErrorMessage(""); }}
                      className="rounded-xl border border-gray-300 px-5 py-3 font-bold text-gray-700">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
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
