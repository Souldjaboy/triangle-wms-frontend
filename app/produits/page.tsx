"use client";

import { useEffect, useState } from "react";

const marketplaceCategories = [
  "Alimentation",
  "Boissons",
  "Pharmacie",
  "Santé / Laboratoire",
  "Téléphones",
  "Informatique",
  "Électronique",
  "Vêtements",
  "Chaussures",
  "Beauté / Cosmétique",
  "Pièces auto",
  "Automobiles",
  "Immobilier",
  "Hôtels",
  "Restaurants",
  "Agriculture",
  "Matériaux construction",
  "Fournitures bureau",
  "Maison / meubles",
  "Services",
];

export default function ProduitsPage() {
  const [produits, setProduits] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const isReadOnly = userRole === "direction" || userRole === "client";
  const isAdmin = userRole === "admin" || userRole === "super_admin" || isSuperAdmin;
  const canAddProduct = !isReadOnly && (isAdmin || userRole === "magasinier");
  const authHeaders = (extra: Record<string, string> = {}) => ({
    ...extra,
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    ...(localStorage.getItem("active_company_id")
      ? { "x-active-company-id": localStorage.getItem("active_company_id") || "" }
      : {}),
  });

  const [formData, setFormData] = useState({
    reference: "",
    name: "",
    category: "",
    stock: "",
    warehouse: "",
    status: "Disponible",
    unit: "pièce",
    weight: "",
    dimensions: "",
    barcode: "",
    description: "",
    minimum_stock: "5",
    purchase_price: "",
    sale_price: "",
    rental_price: "",
    daily_price: "",
    monthly_price: "",
    product_type: "general_product",
    is_sellable: true,
    is_rentable: false,
    image_url: "",
    is_active: true,
    location_id: "",
    location_code: "",
    publish_on_marketplace: false,
    marketplace_category: "",
    marketplace_price: "",
    marketplace_quantity: "",
    company_id: "",
    is_durable: false,
  });

const fetchProduits = async () => {
  const response = await fetch(
    "/api/products",
    {
      headers: authHeaders(),
    }
  );

  const data = await response.json();

  setProduits(Array.isArray(data) ? data : []);
};

const fetchLocations = async () => {
  const response = await fetch(
    "/api/locations",
    {
      headers: authHeaders(),
    }
  );

  const data = await response.json();

  setLocations(Array.isArray(data) ? data : []);
};

const fetchCompanies = async () => {
  const response = await fetch("/api/super-admin/companies", {
    headers: authHeaders(),
  });
  const data = await response.json().catch(() => []);
  setCompanies(Array.isArray(data) ? data : []);
};

useEffect(() => {
  const savedUser = localStorage.getItem("user");

  if (savedUser) {
    const user = JSON.parse(savedUser);
    setUserRole(user.role);
    const superAdmin =
      user.is_super_admin === true ||
        user.is_super_admin === "true" ||
        user.is_super_admin === 1 ||
        String(user.role || "").toLowerCase() === "super_admin";
    setIsSuperAdmin(superAdmin);
    if (!superAdmin && user.company_id) {
      setFormData((current) => ({
        ...current,
        company_id: String(user.company_id),
      }));
    }
    if (superAdmin) {
      fetchCompanies();
    }
  }
  fetchProduits();
  fetchLocations();
}, []);

  const handleChange = (e: any) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;

    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const uploadProductImage = async (file: File | null) => {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Format image non autorisé. Utilisez jpg, png ou webp.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image trop lourde. Taille maximum : 5 Mo.");
      return;
    }

    setImagePreview(URL.createObjectURL(file));
    setUploadingImage(true);

    const body = new FormData();
    body.append("image", file);

    const response = await fetch("/api/upload-product-image", {
      method: "POST",
      headers: authHeaders(),
      body,
    });

    const data = await response.json().catch(() => ({}));
    setUploadingImage(false);

    if (!response.ok) {
      alert(data.error || "Erreur upload image produit.");
      return;
    }

    setFormData((current) => ({
      ...current,
      image_url: data.image_url || "",
    }));
    setImagePreview(data.image_url || "");
  };

  const clearProductImage = () => {
    setImagePreview("");
    setFormData({
      ...formData,
      image_url: "",
    });
  };

  const handleLocationSelect = (locationId: string) => {
    const selectedLocation: any = locations.find(
      (location: any) => String(location.id) === String(locationId)
    );

    setFormData({
      ...formData,
      location_id: locationId,
      location_code: selectedLocation ? selectedLocation.emplacement_code : "",
      warehouse: selectedLocation ? selectedLocation.warehouse_code : "",
    });
  };

  const resetForm = () => {
    setEditingId(null);

    setFormData({
      reference: "",
      name: "",
      category: "",
      stock: "",
      warehouse: "",
      status: "Disponible",
      unit: "pièce",
      weight: "",
      dimensions: "",
      barcode: "",
      description: "",
      minimum_stock: "5",
      purchase_price: "",
      sale_price: "",
      rental_price: "",
      daily_price: "",
      monthly_price: "",
      product_type: "general_product",
      is_sellable: true,
      is_rentable: false,
      image_url: "",
      is_active: true,
      location_id: "",
      location_code: "",
      publish_on_marketplace: false,
      marketplace_category: "",
      marketplace_price: "",
      marketplace_quantity: "",
      company_id: formData.company_id,
      is_durable: false,
    });
    setImagePreview("");
  };

const handleSubmit = async (e: any) => {
  e.preventDefault();

  if (!canAddProduct) {
    alert("Vous n'avez pas l'autorisation.");
    return;
  }

  const savedUser = localStorage.getItem("user");
  const user = savedUser ? JSON.parse(savedUser) : null;

  const payload = {
    ...formData,
    active_company_id: formData.company_id || undefined,
    user_name: user?.fullname || "Utilisateur",
    user_role: user?.role || userRole,
  };

  if (isSuperAdmin && !formData.company_id) {
    alert("Sélectionnez une entreprise avant de créer ou modifier un produit.");
    return;
  }

  const headers = authHeaders({ "Content-Type": "application/json" });

  let response;

  if (editingId) {
    if (!isAdmin) {
      alert("Seul l'administrateur peut modifier.");
      return;
    }

    response = await fetch(`/api/products/${editingId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
  } else {
    response = await fetch("/api/products", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  }

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || "Erreur enregistrement produit.");
    return;
  }

  if (formData.publish_on_marketplace) {
    await publishToMarketplace(data, {
      category: formData.marketplace_category || formData.category,
      price: formData.marketplace_price || formData.sale_price,
      quantity: formData.marketplace_quantity || formData.stock,
    });
  }

  resetForm();
  await fetchProduits();
};

  const handleEdit = (produit: any) => {
    if (!isAdmin) {
      alert("Seul l'administrateur peut modifier.");
      return;
    }

    setEditingId(produit.id);

    setFormData({
      reference: produit.reference || "",
      name: produit.name || "",
      category: produit.category || "",
      stock: String(produit.stock || ""),
      warehouse: produit.warehouse || "",
      status: produit.status || "Disponible",
      unit: produit.unit || "pièce",
      weight: String(produit.weight || ""),
      dimensions: produit.dimensions || "",
      barcode: produit.barcode || "",
      description: produit.description || "",
      minimum_stock: String(produit.minimum_stock || "5"),
      purchase_price: String(produit.purchase_price || ""),
      sale_price: String(produit.sale_price || ""),
      rental_price: String(produit.rental_price || ""),
      daily_price: String(produit.daily_price || ""),
      monthly_price: String(produit.monthly_price || ""),
      product_type: produit.product_type || "general_product",
      is_sellable: produit.is_sellable !== false,
      is_rentable: produit.is_rentable === true,
      is_durable: produit.is_durable === true,
      image_url: produit.image_url || "",
      is_active: produit.is_active !== false,
      location_id: produit.location_id ? String(produit.location_id) : "",
      location_code: produit.location_code || produit.emplacement_code || "",
      publish_on_marketplace: false,
      marketplace_category: produit.category || "",
      marketplace_price: String(produit.sale_price || produit.price || ""),
      marketplace_quantity: String(produit.stock || ""),
      company_id: produit.company_id ? String(produit.company_id) : formData.company_id,
    });
    setImagePreview(produit.image_url || "");
  };

  const publishToMarketplace = async (
    produit: any,
    options: { category?: string; price?: string; quantity?: string } = {}
  ) => {
    if (!produit?.id) return;
    if (produit.is_sellable === false) {
      alert("Ce produit n’est pas vendable. Activez d’abord l’option Produit vendable.");
      return;
    }

    const price = Number(options.price || produit.sale_price || produit.price || 0);
    const quantity = Number(options.quantity || produit.stock || 0);

    if (price <= 0) {
      alert("Prix marketplace obligatoire avant publication.");
      return;
    }

    if (quantity <= 0) {
      alert("Quantité marketplace obligatoire avant publication.");
      return;
    }

    const response = await fetch("/api/marketplace/vendor/products", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        product_id: produit.id,
        title: produit.name,
        description: produit.description || "",
        category: options.category || produit.category || "",
        price,
        public_price: price,
        published_quantity: quantity,
        image_url: produit.image_url || "",
        status: "published",
      }),
    });

    const data = await response.json().catch(() => ({}));
    alert(response.ok ? "Produit publié sur Marketplace." : data.error || "Erreur publication Marketplace.");
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) {
      alert("Seul l'administrateur peut supprimer.");
      return;
    }

    await fetch(`/api/products/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    fetchProduits();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Produits
      </h1>

      <p className="text-gray-500 mb-2">
        Gestion des références produits, images et emplacements.
      </p>

      <p className="text-sm text-gray-500 mb-8">
        Rôle connecté : {userRole || "non connecté"}
      </p>

      {canAddProduct && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-2xl shadow mb-10 grid grid-cols-3 gap-4"
        >
          <select
            name="company_id"
            value={formData.company_id}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
            required
            disabled={!isSuperAdmin}
          >
            <option value="">
              {isSuperAdmin ? "Choisir l’entreprise" : "Entreprise automatique"}
            </option>
            {isSuperAdmin
              ? companies.map((company: any) => (
                  <option key={company.id} value={company.id}>
                    {company.name || company.company_name || `Entreprise ${company.id}`}
                  </option>
                ))
              : formData.company_id && (
                  <option value={formData.company_id}>Mon entreprise</option>
                )}
          </select>

          <input
            type="text"
            name="reference"
            placeholder="Référence produit"
            value={formData.reference}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
            required
          />

          <input
            type="text"
            name="name"
            placeholder="Nom produit"
            value={formData.name}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
            required
          />

          <input
            type="text"
            name="category"
            placeholder="Catégorie"
            value={formData.category}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <select
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          >
            <option value="pièce">Pièce</option>
            <option value="carton">Carton</option>
            <option value="kg">Kg</option>
            <option value="litre">Litre</option>
            <option value="palette">Palette</option>
          </select>

          <input
            type="number"
            name="weight"
            placeholder="Poids"
            value={formData.weight}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="text"
            name="dimensions"
            placeholder="Dimensions"
            value={formData.dimensions}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="text"
            name="barcode"
            placeholder="Code-barres"
            value={formData.barcode}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="number"
            name="stock"
            placeholder="Stock initial"
            value={formData.stock}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="number"
            name="minimum_stock"
            placeholder="Stock minimum"
            value={formData.minimum_stock}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <select
            name="product_type"
            value={formData.product_type}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          >
            <option value="stock_vehicle">Stock véhicules</option>
            <option value="stock_property">Stock biens immobiliers</option>
            <option value="stock_room">Stock chambres / hôtel</option>
            <option value="restaurant_item">Plats restaurant</option>
            <option value="service">Services</option>
            <option value="general_product">Produits généraux</option>
          </select>

          <input
            type="number"
            name="purchase_price"
            placeholder="Prix achat optionnel"
            value={formData.purchase_price}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="number"
            name="sale_price"
            placeholder="Prix vente optionnel"
            value={formData.sale_price}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="number"
            name="rental_price"
            placeholder="Prix location optionnel"
            value={formData.rental_price}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="number"
            name="daily_price"
            placeholder="Prix journalier optionnel"
            value={formData.daily_price}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="number"
            name="monthly_price"
            placeholder="Prix mensuel optionnel"
            value={formData.monthly_price}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <label className="flex items-center gap-3 text-black">
            <input
              type="checkbox"
              name="is_sellable"
              checked={formData.is_sellable}
              onChange={handleChange}
            />
            Produit vendable
          </label>

          <label className="flex items-center gap-3 text-black">
            <input
              type="checkbox"
              name="is_durable"
              checked={formData.is_durable}
              onChange={handleChange}
            />
            Produit durable
          </label>

          <label className="flex items-center gap-3 text-black">
            <input
              type="checkbox"
              name="is_rentable"
              checked={formData.is_rentable}
              onChange={handleChange}
            />
            Produit louable
          </label>

          <label className="flex items-center gap-3 text-black">
            <input
              type="checkbox"
              name="publish_on_marketplace"
              checked={formData.publish_on_marketplace}
              onChange={handleChange}
            />
            Publier sur Marketplace
          </label>

          <select
            name="marketplace_category"
            value={formData.marketplace_category}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          >
            <option value="">Catégorie marketplace</option>
            {marketplaceCategories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <input
            type="number"
            name="marketplace_price"
            placeholder="Prix marketplace"
            value={formData.marketplace_price}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="number"
            name="marketplace_quantity"
            placeholder="Quantité à publier"
            value={formData.marketplace_quantity}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              uploadProductImage(event.dataTransfer.files?.[0] || null);
            }}
            className={`col-span-3 rounded-xl border-2 border-dashed p-4 text-black ${
              dragActive ? "border-yellow-500 bg-yellow-50" : "border-gray-300 bg-gray-50"
            }`}
          >
            <div className="flex flex-col md:flex-row gap-4 md:items-center">
              <div className="h-28 w-28 rounded-xl border bg-white overflow-hidden flex items-center justify-center text-xs text-gray-500">
                {imagePreview || formData.image_url ? (
                  <img
                    src={imagePreview || formData.image_url}
                    alt="Aperçu produit"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  "Aperçu"
                )}
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer rounded-xl bg-black px-5 py-3 font-bold text-white">
                    Choisir une image
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => uploadProductImage(event.target.files?.[0] || null)}
                    />
                  </label>

                  {(imagePreview || formData.image_url) && (
                    <button
                      type="button"
                      onClick={clearProductImage}
                      className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white"
                    >
                      Supprimer image
                    </button>
                  )}
                </div>

                <p className="text-sm text-gray-500">
                  Glissez-déposez une image ici ou choisissez depuis l’ordinateur. JPG, PNG, WEBP, maximum 5 Mo.
                </p>

                {uploadingImage && <p className="font-bold text-yellow-700">Upload image en cours...</p>}

                <input
                  type="text"
                  name="image_url"
                  placeholder="URL image produit optionnelle"
                  value={formData.image_url}
                  onChange={(event) => {
                    handleChange(event);
                    setImagePreview(event.target.value);
                  }}
                  className="w-full border p-3 rounded-xl text-black"
                />
              </div>
            </div>
          </div>

          <select
            name="location_id"
            value={formData.location_id}
            onChange={(e) => handleLocationSelect(e.target.value)}
            className="border p-3 rounded-xl text-black"
          >
            <option value="">Choisir emplacement</option>

            {locations.map((location: any) => (
              <option key={location.id} value={location.id}>
                {location.emplacement_code}
              </option>
            ))}
          </select>

          <input
            type="text"
            name="warehouse"
            placeholder="Entrepôt automatique"
            value={formData.warehouse}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
            readOnly
          />

          <input
            type="text"
            name="location_code"
            placeholder="Code emplacement automatique"
            value={formData.location_code}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
            readOnly
          />

          <textarea
            name="description"
            placeholder="Description produit"
            value={formData.description}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          >
            <option value="Disponible">Disponible</option>
            <option value="Faible">Faible</option>
            <option value="Rupture">Rupture</option>
          </select>

          <label className="flex items-center gap-3 text-black">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
            />
            Produit actif
          </label>

          <button
            type="submit"
            className={`font-bold rounded-xl py-3 ${
              editingId
                ? "bg-blue-500 text-white"
                : "bg-yellow-500 text-black"
            }`}
          >
            {editingId ? "Enregistrer modification" : "Ajouter produit"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="bg-gray-500 text-white font-bold rounded-xl py-3"
            >
              Annuler
            </button>
          )}
        </form>
      )}

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold text-black mb-5">
          Liste des produits
        </h2>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-3">Image</th>
              <th>Référence</th>
              <th>Produit</th>
              {isSuperAdmin && <th>Entreprise</th>}
              <th>Catégorie</th>
              <th>Stock</th>
              <th>Min</th>
              <th>Entrepôt</th>
              <th>Emplacement</th>
              <th>Statut</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {produits.map((produit: any) => (
              <tr key={produit.id} className="border-b">
                <td className="py-4">
                  {produit.image_url ? (
                    <img
                      src={produit.image_url}
                      alt={produit.name}
                      className="w-16 h-16 object-cover rounded-xl border"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-500">
                      Aucune
                    </div>
                  )}
                </td>

                <td className="font-bold">{produit.reference}</td>
                <td>{produit.name}</td>
                {isSuperAdmin && <td>{produit.company_name || produit.company_id || "-"}</td>}
                <td>{produit.category}</td>
                <td>{produit.stock}</td>
                <td>{produit.minimum_stock}</td>
                <td>{produit.warehouse}</td>

                <td className="font-bold text-blue-600">
                  {produit.location_code || produit.emplacement_code || "-"}
                </td>

                <td className="font-bold">{produit.status}</td>

                {isAdmin && (
                  <td className="space-x-2">
                    <button
                      onClick={() => handleEdit(produit)}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg"
                    >
                      Modifier
                    </button>

                    <button
                      onClick={() => handleDelete(produit.id)}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg"
                    >
                      Supprimer
                    </button>
                    <button
                      onClick={() => publishToMarketplace(produit)}
                      className="bg-yellow-500 text-black px-4 py-2 rounded-lg font-bold"
                    >
                      Publier
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
