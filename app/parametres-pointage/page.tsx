"use client";

import { useEffect, useState } from "react";
import { formatFCFA } from "../lib/format";

export default function ParametresPointagePage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [canSeeSalary, setCanSeeSalary] = useState(false);
  const [canManageGps, setCanManageGps] = useState(false);
  const [gpsTestMessage, setGpsTestMessage] = useState("");

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
    site_name: "",
    site_latitude: "",
    site_longitude: "",
    allowed_radius_meters: "100",
    allow_remote_attendance: false,
    kiosk_mode: true,
    employee_scanner_access: false,
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const fetchData = async () => {
    const groupsRes = await fetch(
      "/api/attendance/settings/schedule-groups",
      { headers: authHeaders() }
    );
    const groupsData = await groupsRes.json();
    setGroups(Array.isArray(groupsData) ? groupsData : []);

    const usersRes = await fetch("/api/users", {
      headers: authHeaders(),
    });
    const usersData = await usersRes.json();
    setUsers(Array.isArray(usersData) ? usersData : []);

    const gpsRes = await fetch("/api/attendance/settings/gps", {
      headers: authHeaders(),
    });
    const gpsData = await gpsRes.json().catch(() => ({}));
    setGpsForm({
      gps_required: gpsData.gps_required === true,
      site_name: gpsData.site_name || "",
      site_latitude:
        gpsData.site_latitude === null || gpsData.site_latitude === undefined
          ? ""
          : String(gpsData.site_latitude),
      site_longitude:
        gpsData.site_longitude === null || gpsData.site_longitude === undefined
          ? ""
          : String(gpsData.site_longitude),
      allowed_radius_meters: String(gpsData.allowed_radius_meters || 100),
      allow_remote_attendance: gpsData.allow_remote_attendance === true,
      kiosk_mode: gpsData.kiosk_mode !== false,
      employee_scanner_access: gpsData.employee_scanner_access === true,
    });
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCanSeeSalary(user.is_super_admin === true || user.role === "super_admin" || user.role === "direction");
      setCanManageGps(user.is_super_admin === true || user.role === "super_admin" || user.role === "admin");
    }
    fetchData();
  }, []);

  const handleGroupChange = (e: any) => {
    setGroupForm({
      ...groupForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleUserChange = (e: any) => {
    setUserForm({
      ...userForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleGpsChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setGpsForm({
      ...gpsForm,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const createGroup = async (e: any) => {
    e.preventDefault();

    await fetch("/api/attendance/settings/schedule-groups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(groupForm),
    });

    setMessage("Groupe horaire créé avec succès.");

    setGroupForm({
      name: "",
      start_time: "",
      end_time: "",
      break_start: "",
      break_end: "",
    });

    fetchData();
  };

  const saveGpsSettings = async (e: any) => {
    e.preventDefault();

    if (!canManageGps) {
      setMessage("Vous n’avez pas le droit de modifier les paramètres GPS.");
      return;
    }

    const response = await fetch("/api/attendance/settings/gps", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(gpsForm),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error || "Erreur sauvegarde sécurité GPS.");
      return;
    }

    setGpsForm({
      gps_required: data.gps_required === true,
      site_name: data.site_name || "",
      site_latitude:
        data.site_latitude === null || data.site_latitude === undefined
          ? ""
          : String(data.site_latitude),
      site_longitude:
        data.site_longitude === null || data.site_longitude === undefined
          ? ""
          : String(data.site_longitude),
      allowed_radius_meters: String(data.allowed_radius_meters || 100),
      allow_remote_attendance: data.allow_remote_attendance === true,
      kiosk_mode: data.kiosk_mode !== false,
      employee_scanner_access: data.employee_scanner_access === true,
    });
    setMessage("Paramètres GPS du pointage enregistrés.");
  };

  const testCurrentPosition = () => {
    setGpsTestMessage("");

    if (!navigator.geolocation) {
      setGpsTestMessage("GPS indisponible sur cet appareil.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setGpsTestMessage(
          `Position obtenue : ${latitude.toFixed(6)}, ${longitude.toFixed(6)} - précision ${Math.round(position.coords.accuracy)} m.`
        );
      },
      (error) => {
        setGpsTestMessage(
          error.code === 1
            ? "Autorisation GPS refusée."
            : "Impossible d’obtenir votre position."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const assignUserSettings = async (e: any) => {
    e.preventDefault();

    if (!userForm.user_id) {
      alert("Choisis un employé.");
      return;
    }

    await fetch(`/api/attendance/settings/users/${userForm.user_id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
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

  const selectedUser: any = users.find(
    (user: any) => String(user.id) === String(userForm.user_id)
  );

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Paramètres pointage
      </h1>

      <p className="text-gray-500 mb-8">
        Gestion des groupes horaires, pauses, salaires et affectation employés.
      </p>

      {message && (
        <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 font-bold">
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-8 mb-8">
        <form
          onSubmit={createGroup}
          className="bg-white rounded-2xl shadow p-6 grid grid-cols-1 gap-4"
        >
          <h2 className="text-2xl font-bold text-black mb-2">
            Créer un groupe horaire
          </h2>

          <input
            type="text"
            name="name"
            placeholder="Nom du groupe ex: Groupe A"
            value={groupForm.name}
            onChange={handleGroupChange}
            className="border p-3 rounded-xl text-black"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">Heure arrivée</label>
              <input
                type="time"
                name="start_time"
                value={groupForm.start_time}
                onChange={handleGroupChange}
                className="border p-3 rounded-xl text-black w-full"
                required
              />
            </div>

            <div>
              <label className="text-sm text-gray-500">Heure débauche</label>
              <input
                type="time"
                name="end_time"
                value={groupForm.end_time}
                onChange={handleGroupChange}
                className="border p-3 rounded-xl text-black w-full"
                required
              />
            </div>

            <div>
              <label className="text-sm text-gray-500">Début pause</label>
              <input
                type="time"
                name="break_start"
                value={groupForm.break_start}
                onChange={handleGroupChange}
                className="border p-3 rounded-xl text-black w-full"
              />
            </div>

            <div>
              <label className="text-sm text-gray-500">Fin pause</label>
              <input
                type="time"
                name="break_end"
                value={groupForm.break_end}
                onChange={handleGroupChange}
                className="border p-3 rounded-xl text-black w-full"
              />
            </div>
          </div>

          <button
            type="submit"
            className="bg-yellow-500 text-black font-bold rounded-xl py-3"
          >
            Créer groupe horaire
          </button>
        </form>

        <form
          onSubmit={assignUserSettings}
          className="bg-white rounded-2xl shadow p-6 grid grid-cols-1 gap-4"
        >
          <h2 className="text-2xl font-bold text-black mb-2">
            Affecter horaire{canSeeSalary ? " & salaire" : ""}
          </h2>

          <select
            name="user_id"
            value={userForm.user_id}
            onChange={handleUserChange}
            className="border p-3 rounded-xl text-black"
            required
          >
            <option value="">Choisir employé</option>

            {users.map((user: any) => (
              <option key={user.id} value={user.id}>
                {user.fullname} - {user.role}
              </option>
            ))}
          </select>

          {selectedUser && (
            <div className="bg-gray-100 rounded-xl p-4 text-sm text-gray-700">
              Employé sélectionné :{" "}
              <strong>{selectedUser.fullname}</strong>
            </div>
          )}

          <select
            name="schedule_group_id"
            value={userForm.schedule_group_id}
            onChange={handleUserChange}
            className="border p-3 rounded-xl text-black"
          >
            <option value="">Aucun groupe horaire</option>

            {groups.map((group: any) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.start_time} - {group.end_time})
              </option>
            ))}
          </select>

          {canSeeSalary && (
          <select
            name="salary_type"
            value={userForm.salary_type}
            onChange={handleUserChange}
            className="border p-3 rounded-xl text-black"
          >
            <option value="horaire">Salaire horaire</option>
            <option value="journalier">Salaire journalier</option>
            <option value="mensuel">Salaire mensuel</option>
          </select>
          )}

          {canSeeSalary ? (
          <>
          <input
            type="number"
            name="hourly_rate"
            placeholder="Taux horaire FCFA"
            value={userForm.hourly_rate}
            onChange={handleUserChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="number"
            name="daily_rate"
            placeholder="Salaire journalier FCFA"
            value={userForm.daily_rate}
            onChange={handleUserChange}
            className="border p-3 rounded-xl text-black"
          />
          </>
          ) : (
            <div className="bg-blue-100 text-blue-700 rounded-xl p-3 font-bold">
              Vous pouvez gérer les horaires, mais les salaires sont masqués.
            </div>
          )}

          <input
            type="number"
            name="monthly_salary"
            placeholder="Salaire mensuel FCFA"
            value={userForm.monthly_salary}
            onChange={handleUserChange}
            className="border p-3 rounded-xl text-black"
          />

          <button
            type="submit"
            className="bg-black text-white font-bold rounded-xl py-3"
          >
            Enregistrer paramètres employé
          </button>
        </form>
      </div>

      <form
        onSubmit={saveGpsSettings}
        className="bg-white rounded-2xl shadow p-6 mb-8 grid grid-cols-1 gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-black mb-2">
            Sécurité GPS du pointage
          </h2>
          <p className="text-gray-500">
            Définis la zone autorisée pour empêcher le pointage hors site.
          </p>
        </div>

        <label className="flex items-center gap-3 rounded-xl bg-gray-100 p-4 text-black font-bold">
          <input
            type="checkbox"
            name="gps_required"
            checked={gpsForm.gps_required}
            onChange={handleGpsChange}
            disabled={!canManageGps}
            className="h-5 w-5"
          />
          Activer GPS obligatoire
        </label>

        <div>
          <label className="text-sm text-gray-500">Nom du site</label>
          <input
            type="text"
            name="site_name"
            value={gpsForm.site_name}
            onChange={handleGpsChange}
            disabled={!canManageGps}
            placeholder="Ex: Entrepôt principal Bamako"
            className="border p-3 rounded-xl text-black w-full disabled:bg-gray-100"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-500">Latitude du site</label>
            <input
              type="number"
              step="any"
              name="site_latitude"
              value={gpsForm.site_latitude}
              onChange={handleGpsChange}
              disabled={!canManageGps}
              placeholder="Ex: 12.6392"
              className="border p-3 rounded-xl text-black w-full disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500">Longitude du site</label>
            <input
              type="number"
              step="any"
              name="site_longitude"
              value={gpsForm.site_longitude}
              onChange={handleGpsChange}
              disabled={!canManageGps}
              placeholder="Ex: -8.0029"
              className="border p-3 rounded-xl text-black w-full disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500">
              Rayon autorisé en mètres
            </label>
            <input
              type="number"
              min="1"
              name="allowed_radius_meters"
              value={gpsForm.allowed_radius_meters}
              onChange={handleGpsChange}
              disabled={!canManageGps}
              className="border p-3 rounded-xl text-black w-full disabled:bg-gray-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-center gap-3 rounded-xl bg-gray-100 p-4 text-black font-bold">
            <input
              type="checkbox"
              name="allow_remote_attendance"
              checked={gpsForm.allow_remote_attendance}
              onChange={handleGpsChange}
              disabled={!canManageGps}
              className="h-5 w-5"
            />
            Autoriser pointage hors zone
          </label>

          <label className="flex items-center gap-3 rounded-xl bg-gray-100 p-4 text-black font-bold">
            <input
              type="checkbox"
              name="kiosk_mode"
              checked={gpsForm.kiosk_mode}
              onChange={handleGpsChange}
              disabled={!canManageGps}
              className="h-5 w-5"
            />
            Mode kiosque tablette
          </label>

          <label className="flex items-center gap-3 rounded-xl bg-gray-100 p-4 text-black font-bold">
            <input
              type="checkbox"
              name="employee_scanner_access"
              checked={gpsForm.employee_scanner_access}
              onChange={handleGpsChange}
              disabled={!canManageGps}
              className="h-5 w-5"
            />
            Scanner accessible aux employés
          </label>
        </div>

        <div className="bg-blue-50 text-blue-800 rounded-xl p-4 font-bold">
          La localisation est utilisée uniquement pour vérifier le pointage professionnel.
        </div>

        {!canManageGps && (
          <div className="bg-blue-100 text-blue-700 rounded-xl p-3 font-bold">
            Seuls admin et super admin peuvent modifier la sécurité GPS.
          </div>
        )}

        {gpsTestMessage && (
          <div className="bg-yellow-100 text-yellow-900 rounded-xl p-3 font-bold">
            {gpsTestMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="submit"
            disabled={!canManageGps}
            className="bg-black text-white font-bold rounded-xl py-3 disabled:bg-gray-300 disabled:text-gray-500"
          >
            Enregistrer les paramètres GPS
          </button>

          <button
            type="button"
            onClick={testCurrentPosition}
            className="bg-yellow-500 text-black font-bold rounded-xl py-3"
          >
            Tester ma position actuelle
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold text-black mb-5">
          Groupes horaires existants
        </h2>

        {groups.length === 0 ? (
          <p className="text-gray-500">Aucun groupe horaire.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-3">Groupe</th>
                <th>Arrivée</th>
                <th>Pause</th>
                <th>Débauche</th>
                <th>Créé le</th>
              </tr>
            </thead>

            <tbody>
              {groups.map((group: any) => (
                <tr key={group.id} className="border-b">
                  <td className="py-4 font-bold">{group.name}</td>
                  <td>{group.start_time || "-"}</td>
                  <td>
                    {group.break_start && group.break_end
                      ? `${group.break_start} - ${group.break_end}`
                      : "Pas de pause"}
                  </td>
                  <td>{group.end_time || "-"}</td>
                  <td>
                    {group.created_at
                      ? new Date(group.created_at).toLocaleDateString("fr-FR")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow p-6 mt-8">
        <h2 className="text-2xl font-bold text-black mb-5">
          Employés & paramètres pointage
        </h2>

        {users.length === 0 ? (
          <p className="text-gray-500">Aucun utilisateur.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-3">Employé</th>
                <th>Rôle</th>
                <th>Groupe horaire</th>
                {canSeeSalary && <th>Type salaire</th>}
                {canSeeSalary && <th>Taux horaire</th>}
                {canSeeSalary && <th>Journalier</th>}
                {canSeeSalary && <th>Mensuel</th>}
              </tr>
            </thead>

            <tbody>
              {users.map((user: any) => {
                const group = groups.find(
                  (g: any) =>
                    String(g.id) === String(user.schedule_group_id)
                );

                return (
                  <tr key={user.id} className="border-b">
                    <td className="py-4 font-bold">{user.fullname}</td>
                    <td>{user.role}</td>
                    <td>{group ? group.name : "-"}</td>
                    {canSeeSalary && <td>{user.salary_type || "-"}</td>}
                    {canSeeSalary && <td>{formatFCFA(user.hourly_rate)}</td>}
                    {canSeeSalary && <td>{formatFCFA(user.daily_rate)}</td>}
                    {canSeeSalary && <td>{formatFCFA(user.monthly_salary)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
