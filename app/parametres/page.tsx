"use client";

import { useEffect, useState } from "react";

export default function ParametresPage() {
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const [formData, setFormData] = useState({
    company_name: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    logo_url: "",
    slogan: "",
  });

  const fetchSettings = async () => {
    const response = await fetch("/api/company-settings");
    const data = await response.json();

    if (data) {
      setFormData({
        company_name: data.company_name || "",
        address: data.address || "",
        phone: data.phone || "",
        email: data.email || "",
        website: data.website || "",
        logo_url: data.logo_url || "",
        slogan: data.slogan || "",
      });
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setIsReadOnly(user.role === "direction" || user.role === "client");
    }
    fetchSettings();
  }, []);

  const handleChange = (e: any) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogoUpload = async (e: any) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setMessage("");

    const uploadData = new FormData();
    uploadData.append("logo", file);

    const response = await fetch("/api/upload-logo", {
      method: "POST",
      body: uploadData,
    });

    const data = await response.json();

    if (data.logo_url) {
      setFormData({
        ...formData,
        logo_url: data.logo_url,
      });

      setMessage("Logo uploadé avec succès. N’oublie pas d’enregistrer les paramètres.");
    }

    setUploading(false);
  };

  const handleDownloadLogo = () => {
    if (!formData.logo_url) return;

    const link = document.createElement("a");
    link.href = formData.logo_url;
    link.download = "logo-entreprise";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (isReadOnly) {
      setMessage("Vous avez un accès lecture seule.");
      return;
    }

    await fetch("/api/company-settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: JSON.stringify(formData),
    });

    setMessage("Paramètres entreprise enregistrés avec succès.");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Paramètres entreprise
      </h1>

      <p className="text-gray-500 mb-8">
        Informations utilisées dans les rapports, PDF et documents officiels.
      </p>

      {message && (
        <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 font-bold">
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-8">
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-2xl shadow grid grid-cols-1 gap-4"
        >
          <input
            type="text"
            name="company_name"
            placeholder="Nom entreprise"
            value={formData.company_name}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <textarea
            name="address"
            placeholder="Adresse"
            value={formData.address}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="text"
            name="phone"
            placeholder="Téléphone"
            value={formData.phone}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="text"
            name="website"
            placeholder="Site web"
            value={formData.website}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <div className="border rounded-xl p-4">
            <p className="font-bold text-black mb-3">
              Logo entreprise
            </p>

            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="border p-3 rounded-xl text-black w-full"
            />

            {uploading && (
              <p className="text-blue-600 font-bold mt-3">
                Upload en cours...
              </p>
            )}

            <input
              type="text"
              name="logo_url"
              placeholder="URL du logo"
              value={formData.logo_url}
              onChange={handleChange}
              className="border p-3 rounded-xl text-black w-full mt-3"
            />
          </div>

          <textarea
            name="slogan"
            placeholder="Slogan"
            value={formData.slogan}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <button
            type="submit"
            disabled={isReadOnly}
            className="bg-yellow-500 text-black font-bold rounded-xl py-3"
          >
            {isReadOnly ? "Lecture seule" : "Enregistrer les paramètres"}
          </button>
        </form>

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-2xl font-bold text-black mb-5">
            Aperçu PDF entreprise
          </h2>

          <div className="border rounded-2xl p-6 bg-white">
            <div className="flex items-center gap-5 border-b pb-5 mb-5">
              {formData.logo_url ? (
                <img
                  src={formData.logo_url}
                  alt="Logo entreprise"
                  className="w-28 h-28 object-contain border rounded-xl"
                />
              ) : (
                <div className="w-28 h-28 bg-gray-200 rounded-xl flex items-center justify-center text-gray-500">
                  Logo
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-black">
                  {formData.company_name || "Nom entreprise"}
                </h3>

                <p className="text-gray-500 mt-1">
                  {formData.slogan || "Slogan entreprise"}
                </p>

                <p className="text-sm text-gray-600 mt-3">
                  {formData.address || "Adresse entreprise"}
                </p>

                <p className="text-sm text-gray-600">
                  {formData.phone || "Téléphone"} | {formData.email || "Email"}
                </p>

                <p className="text-sm text-gray-600">
                  {formData.website || "Site web"}
                </p>
              </div>
            </div>

            <h4 className="text-lg font-bold text-black mb-3">
              Exemple : Rapport de stock
            </h4>

            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-2">Référence</th>
                  <th>Produit</th>
                  <th>Stock</th>
                  <th>Emplacement</th>
                </tr>
              </thead>

              <tbody>
                <tr className="border-b">
                  <td className="py-2 font-bold">REF-001</td>
                  <td>Produit exemple</td>
                  <td>25</td>
                  <td>W/EM2S-A-A-R1-E2</td>
                </tr>
              </tbody>
            </table>

            <div className="border-t mt-6 pt-4 text-xs text-gray-500 flex justify-between">
              <span>Document généré par Triangle WMS Pro</span>
              <span>Signature / Validation</span>
            </div>
          </div>

          {formData.logo_url && (
            <button
              type="button"
              onClick={handleDownloadLogo}
              className="bg-black text-white font-bold rounded-xl px-5 py-3 mt-5"
            >
              Télécharger l’image du logo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
