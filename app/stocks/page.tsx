"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { formatFCFA } from "../lib/format";
import ProductSearchSelect, { type ProductHit } from "../components/ProductSearchSelect";
import BinSelector, { useBinTree, type Bin } from "../components/BinSelector";
import { usePermissions } from "../lib/permissions";

export default function StocksPage() {
  const { can, canWrite, loading: permissionsLoading } = usePermissions();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductHit | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState("Entrée");
  const [userRole, setUserRole] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [urlPresetApplied, setUrlPresetApplied] = useState(false);
  const [highlightMovementId, setHighlightMovementId] = useState<number | null>(null);
  /* Emplacement exact de l'opération. Renseigné, il fait passer l'écriture par
     le moteur de stock par emplacement plutôt que par le mouvement global. */
  const { tree: binTree, reload: reloadBinTree } = useBinTree();
  const [binSource, setBinSource] = useState<Bin | null>(null);
  const [binDestination, setBinDestination] = useState<Bin | null>(null);
  const [binsProduit, setBinsProduit] = useState<any[]>([]);
  /* Nombre TOTAL de produits actifs de l'entreprise. `products` ne contient
     que la première page (50 au maximum) : l'afficher comme compteur donnait
     50 au lieu de 247. Le total vient du serveur et ne bouge ni avec la
     pagination, ni avec la recherche, ni avec le tri. */
  const [totalProduits, setTotalProduits] = useState<number | null>(null);
  /* Répartition du produit sélectionné, et localisation directe depuis cet
     écran quand il n'a encore aucun bac. */
  const [totauxProduit, setTotauxProduit] = useState<{stock:number;reparti:number;aLocaliser:number}|null>(null);
  const [localisation, setLocalisation] = useState<{key:number;bin:Bin|null;quantity:string}[]>([]);
  /* Répartition d'un mouvement entre plusieurs bacs. Distincte de
     `localisation`, qui déclare seulement où se trouve un stock existant. */
  const [repartitionMouvement, setRepartitionMouvement] =
    useState<{ key: number; bin: Bin | null; quantity: string }[]>([]);
  const [seqLoc, setSeqLoc] = useState(1);
  const [suggestion, setSuggestion] = useState<any>(null);
  /* Indicateurs de réception. La quantité en attente de rangement N'EST JAMAIS
     ajoutée au stock disponible : ce sont deux grandeurs distinctes. */
  const [receptionStats, setReceptionStats] = useState<{
    stock_available: string; receptions_pending: number; receptions_partial: number;
    quantity_pending: string; lines_to_review: number;
  } | null>(null);

  const [formData, setFormData] = useState({
    type: "Entrée",
    product_reference: "",
    product_name: "",
    location_code: "",
    current_stock: "",
    quantity: "",
    source_warehouse: "",
    destination_warehouse: "",
    reason: "",
    partner_id: "",
    partner_name: "",
    partner_type: "",
    apply_price: false,
    unit_price: "",
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    ...(localStorage.getItem("active_company_id")
      ? { "x-active-company-id": localStorage.getItem("active_company_id") || "" }
      : {}),
  });

  const fetchMovements = async () => {
    const response = await fetch("/api/stock-movements", {
      headers: authHeaders(),
    });

    const data = await response.json();
    setMovements(Array.isArray(data) ? data : []);
  };

  // Aperçu limité : le catalogue complet n'est plus chargé dans /stocks.
  // La sélection réelle passe par ProductSearchSelect -> /products/search.
  const fetchProducts = async () => {
    const response = await fetch("/api/products/search?q=&limit=50&offset=0", {
      headers: authHeaders(),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    setProducts(Array.isArray(data.items) ? data.items : []);
    if (typeof data.total_active === "number") setTotalProduits(data.total_active);
  };

  const fetchWarehouses = async () => {
    const response = await fetch("/api/warehouses", {
      headers: authHeaders(),
    });

    const data = await response.json();
    setWarehouses(Array.isArray(data) ? data : []);
  };

  const fetchPartners = async () => {
    const response = await fetch("/api/partners", {
      headers: authHeaders(),
    });

    const data = await response.json().catch(() => []);
    setPartners(Array.isArray(data) ? data : []);
  };

  const fetchReceptionStats = async () => {
    const response = await fetch("/api/stock/receptions/dashboard", {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (response.ok) setReceptionStats(await response.json().catch(() => null));
  };

  useEffect(() => {
    fetchMovements();
    fetchProducts();
    fetchWarehouses();
    fetchPartners();
    fetchReceptionStats();

    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setUserRole(user.role);
      // Le rôle ne décide plus du mode lecture seule : user_permissions fait foi.
      setIsReadOnly(false);

      if (
        user.role === "admin" ||
        user.role === "super_admin" ||
        user.role === "responsable_entrepot" ||
        user.role === "chef_entrepot" ||
        user.is_super_admin === true
      ) {
        setIsAdmin(true);
      }
    }
  }, []);

  useEffect(() => {
    if (urlPresetApplied || products.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    const productReference = params.get("product");
    const movementId = params.get("movement");
    const locationCode = params.get("location");

    if (movementId) {
      setHighlightMovementId(Number(movementId));
    }

    if (type && ["Entrée", "Sortie", "Transfert", "Inventaire"].includes(type)) {
      setSelectedType(type);
    }

    if (locationCode) {
      setFormData((current) => ({
        ...current,
        type: type || current.type,
        location_code: locationCode,
        reason: locationCode,
      }));
    }

    if (productReference) {
      const product = products.find(
        (item: any) => item.reference === productReference
      );

      if (product) {
        setFormData((current) => ({
          ...current,
          type: type || current.type,
          product_reference: product.reference,
          product_name: product.name,
          current_stock: String(product.stock || 0),
          source_warehouse: product.warehouse || "",
          location_code:
            product.location_code || product.emplacement_code || "",
        }));
      }
    }

    setUrlPresetApplied(true);
  }, [products, urlPresetApplied]);

  const selectMovementType = (type: string) => {
    setSelectedType(type);
    setBinSource(null);
    setBinDestination(null);

    setFormData({
      ...formData,
      type,
      destination_warehouse: "",
      reason: "",
      partner_id: "",
      partner_name: "",
      partner_type: "",
      apply_price: false,
      unit_price: "",
    });
  };

  const handleChange = (e: any) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    });
  };

  const expectedPartnerType =
    selectedType === "Entrée"
      ? "fournisseur"
      : selectedType === "Sortie"
        ? "client"
        : "";

  const filteredPartners = partners.filter((partner) => {
    if (!expectedPartnerType) return true;
    const type = String(partner.type || "").toLowerCase();
    return type.includes(expectedPartnerType) || type.includes("mixte");
  });

  const handlePartnerSelect = (partnerId: string) => {
    const partner = partners.find((item: any) => String(item.id) === partnerId);
    setFormData({
      ...formData,
      partner_id: partnerId,
      partner_name: partner?.name || "",
      partner_type: expectedPartnerType || partner?.type || "",
    });
  };

  const handleProductSelect = (reference: string) => {
    const product = products.find((p: any) => p.reference === reference);

    if (!product) return;

    setFormData({
      ...formData,
      product_reference: product.reference,
      product_name: product.name,
      current_stock: String(product.stock || 0),
      source_warehouse: product.warehouse || "",
      location_code:
        product.location_code ||
        product.emplacement_code ||
        "",
    });
  };

  /* Bacs où ce produit a RÉELLEMENT du stock : ce sont les seules sources
     possibles pour une sortie. */
  const chargerBinsProduit = async (productId: number | null) => {
    setLocalisation([]); setSuggestion(null);
    if (!productId) { setBinsProduit([]); setTotauxProduit(null); return; }
    const r = await fetch(`/api/stock/products/${productId}/balances`, {
      headers: authHeaders(), cache: "no-store",
    });
    if (!r.ok) { setBinsProduit([]); setTotauxProduit(null); return; }
    const d = await r.json();
    setBinsProduit((d.balances || []).filter((b: any) => Number(b.quantity) > 0));
    setTotauxProduit(d.totals || null);
    /* Rien de localisé mais du stock : on va chercher ce que l'historique
       suggère, sans jamais l'appliquer. */
    if (d.totals && d.totals.reparti === 0 && d.totals.stock > 0) {
      const sg = await fetch(`/api/stock/products/${productId}/legacy-location`, {
        headers: authHeaders(), cache: "no-store",
      });
      if (sg.ok) setSuggestion(await sg.json());
    }
  };

  /* Localiser un stock existant : on dit OÙ il est, on ne crée aucune unité.
     La somme doit être exactement égale au stock du produit. */
  const localiserStock = async () => {
    if (!selectedProduct || !totauxProduit) return;
    const r = await fetch(`/api/stock/products/${selectedProduct.id}/allocate`, {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        allocations: localisation
          .filter((l) => l.bin && Number(l.quantity) > 0)
          .map((l) => ({ locationId: l.bin!.id, quantity: Number(l.quantity) })),
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMessageType("error"); setMessage(d?.error || "Échec de la localisation."); return; }
    setMessageType("success");
    setMessage(`« ${selectedProduct.name} » localisé sur ${d.lignes.length} bac(s). Stock global inchangé.`);
    setLocalisation([]);
    await chargerBinsProduit(selectedProduct.id);
    reloadBinTree();
  };

  const handleProductSearchSelect = (product: ProductHit | null) => {
    setSelectedProduct(product);
    setFormData((current) => ({
      ...current,
      product_reference: product?.reference || "",
      product_name: product?.name || "",
      current_stock: String(product?.stock ?? ""),
      source_warehouse: product?.warehouse || current.source_warehouse || "",
      location_code: product?.location_code || "",
    }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setMessage("");

    const payload = {
      type: selectedType,
      product_reference: formData.product_reference,
      product_name: formData.product_name,
      quantity: Number(formData.quantity || 0),
      source_warehouse: formData.source_warehouse,
      destination_warehouse: formData.destination_warehouse || "",
      location_code: formData.location_code,
      partner_id: formData.partner_id || null,
      partner_name: formData.partner_name || "",
      partner_type: formData.partner_type || "",
      apply_price: formData.apply_price,
      unit_price: Number(formData.unit_price || 0),
      reason: formData.reason || formData.location_code || "",
      status: "En attente",
      user_name: currentUser?.fullname || "Utilisateur",
      user_role: currentUser?.role || userRole || "Non défini",
    };

    /* Un bac choisi = opération par emplacement. On passe alors par le moteur
       transactionnel dédié, qui met à jour la balance ET products.stock dans la
       même transaction. Sans bac, le comportement historique est conservé. */
    const parEmplacement =
      (selectedType === "Entrée"    && binDestination) ||
      (selectedType === "Sortie"    && binSource) ||
      (selectedType === "Transfert" && binSource && binDestination);

    let response: Response;
    if (parEmplacement && selectedProduct) {
      /* Entrée et Sortie sont PRÉPARÉES : le mouvement part « En attente » et
         n'applique rien. Une sortie réserve la quantité du bac sans la déduire.
         C'est le bouton Valider de la liste qui applique — ou Refuser qui
         libère. Le transfert, lui, reste immédiat et transactionnel. */
      /* Un produit vit rarement dans un seul bac : sortir trente unités d'un
         stock réparti sur trois rayons demande de dire dans lesquels puiser.
         Dès que plusieurs lignes sont renseignées, l'opération part sur la
         route répartie, qui les applique en une seule transaction. Une ligne
         unique continue d'emprunter le chemin habituel. */
      const repartition = repartitionMouvement
        .filter((l) => l.bin && Number(l.quantity) > 0)
        .map((l) => ({ locationId: l.bin!.id, quantity: Number(l.quantity) }));
      const multi = repartition.length > 1 && selectedType !== "Transfert";

      const routes: Record<string, string> = {
        "Entrée": multi ? "/api/stock/locations/entry-multi" : "/api/stock/locations/prepare-entry",
        "Sortie": multi ? "/api/stock/locations/exit-multi" : "/api/stock/locations/prepare-exit",
        "Transfert": "/api/stock/locations/transfer",
      };
      const corps: Record<string, unknown> = {
        productId: selectedProduct.id,
        quantity: Number(formData.quantity || 0),
        reason: formData.reason || `${selectedType} par emplacement`,
      };
      if (multi) {
        corps.allocations = repartition;
      } else {
        if (selectedType === "Entrée") corps.locationId = binDestination!.id;
        if (selectedType === "Sortie") corps.locationId = binSource!.id;
      }
      if (selectedType === "Transfert") {
        corps.sourceLocationId = binSource!.id;
        corps.destinationLocationId = binDestination!.id;
      }
      response = await fetch(routes[selectedType], {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(corps),
      });
    } else {
      response = await fetch("/api/stock-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
    }

    const data = await response.json();

    if (!response.ok) {
      setMessageType("error");
      setMessage(data.error || "Erreur création mouvement.");
      return;
    }

    setMessageType("success");
    setMessage(
      !parEmplacement
        ? `Demande ${selectedType} créée avec succès.`
        : selectedType === "Transfert"
          ? `Transfert appliqué : ${data.source?.full_code || "source"} → ${data.destination?.full_code || "destination"}. Stock global inchangé.`
          : selectedType === "Sortie"
            ? `Sortie préparée sur ce bac : ${formData.quantity} unité(s) réservées, ` +
              `stock inchangé. Validez la demande pour la déduire.`
            : `Entrée préparée sur ce bac : aucune unité ajoutée pour l'instant. ` +
              `Validez la demande pour l'appliquer.`
    );
    setSelectedProduct(null);
    setBinSource(null);
    setBinDestination(null);
    setBinsProduit([]);
    if (parEmplacement) { fetchMovements(); reloadBinTree(); }

    setFormData({
      type: selectedType,
      product_reference: "",
      product_name: "",
      location_code: "",
      current_stock: "",
      quantity: "",
      source_warehouse: "",
      destination_warehouse: "",
      reason: "",
      partner_id: "",
      partner_name: "",
      partner_type: "",
      apply_price: false,
      unit_price: "",
    });

    fetchMovements();
    fetchProducts();
  };

  const validateMovement = async (id: number) => {
    const movement = movements.find((item: any) => item.id === id);
    const correctedQuantity = prompt(
      "Quantité finale à valider",
      String(movement?.final_quantity || movement?.quantity || "")
    );

    if (correctedQuantity === null) return;

    const response = await fetch(`/api/stock-movements/${id}/validate`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        final_quantity: Number(correctedQuantity),
        correction_note:
          Number(correctedQuantity) !== Number(movement?.quantity || 0)
            ? "Quantité corrigée avant validation"
            : "",
      }),
    });

    const data = await response.json().catch(() => ({}));
    setMessageType(response.ok ? "success" : "error");
    setMessage(response.ok ? "Mouvement validé et stock mis à jour." : data.error || "Erreur validation.");

    await fetchMovements();
    await fetchProducts();
  };

  const rejectMovement = async (id: number) => {
    const rejectionReason = prompt("Motif du refus", "");

    if (rejectionReason === null) return;

    const response = await fetch(`/api/stock-movements/${id}/reject`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        rejection_reason: rejectionReason,
      }),
    });

    const data = await response.json().catch(() => ({}));
    setMessageType(response.ok ? "success" : "error");
    setMessage(response.ok ? "Mouvement refusé." : data.error || "Erreur refus.");

    await fetchMovements();
    await fetchProducts();
  };

  const publishStockProduct = async (product: any) => {
    const price = prompt(
      `Prix marketplace pour ${product.name}`,
      String(product.sale_price || product.price || "")
    );
    if (price === null) return;

    const quantity = prompt(
      "Quantité à publier",
      String(product.stock || "")
    );
    if (quantity === null) return;

    const category = prompt(
      "Catégorie marketplace",
      String(product.category || "")
    );
    if (category === null) return;

    const response = await fetch("/api/marketplace/vendor/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        product_id: product.id,
        title: product.name,
        description: product.description || "",
        category,
        price: Number(price || 0),
        public_price: Number(price || 0),
        published_quantity: Number(quantity || 0),
        image_url: product.image_url || "",
        status: "published",
      }),
    });
    const data = await response.json().catch(() => ({}));
    setMessageType(response.ok ? "success" : "error");
    setMessage(response.ok ? "Produit publié sur Marketplace." : data.error || "Erreur publication Marketplace.");
  };

  const getStatusColor = (status: string) => {
    if (status === "Validé") return "text-green-600";
    if (status === "Refusé") return "text-red-600";
    return "text-yellow-600";
  };

  const canViewStock = can("stock", "view");
  /* Le bandeau « Lecture seule » suit la capacité d'écrire, pas celle de
     créer : quelqu'un qui ne peut que transférer n'est pas un lecteur. */
  const canCreateStock = canWrite("stock");

  /* Dès qu'une ligne de répartition existe, elle engage : la validation reste
     fermée tant qu'une ligne est incomplète — quantité sans bac, ou bac sans
     quantité — ou que la somme ne tombe pas juste. Ignorer les lignes
     incomplètes afficherait une répartition qui ne partirait jamais. */
  const repartitionIncomplete = (() => {
    if (repartitionMouvement.length === 0) return false;
    const incomplete = repartitionMouvement.some(
      (l) => !l.bin || !(Number(l.quantity) > 0)
    );
    if (incomplete) return true;
    const somme = repartitionMouvement.reduce((t, l) => t + Number(l.quantity || 0), 0);
    return somme !== Number(formData.quantity || 0);
  })();
  const canValidateStock = can("stock", "validate");
  const canPublishMarketplace = can("marketplace", "create");

  if (permissionsLoading) {
    return <div className="min-h-screen bg-gray-100 p-8 text-black">Chargement des permissions...</div>;
  }

  if (!canViewStock) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 text-black">
        <div className="rounded-2xl bg-red-50 p-6 font-bold text-red-700">
          Accès refusé : permission Stock / Voir requise.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black">
        Stocks
      </h1>

      <p className="text-gray-500 mt-2 mb-2">
        Suivi des entrées, sorties, transferts et inventaires avec emplacements.
      </p>

      <p className="text-sm text-gray-500 mb-8">
        Rôle connecté : {userRole || "non connecté"}
      </p>

      {message && (
        <div className={`p-4 rounded-xl mb-6 font-bold ${
          messageType === "success"
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700"
        }`}>
          {message}
        </div>
      )}

      {/* Import d'inventaire : l'analyse ne modifie rien, seule la confirmation
          finale applique quoi que ce soit. */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/stocks/import"
          className="inline-block rounded-xl bg-slate-900 px-5 py-3 font-black text-white">
          Importer / Actualiser depuis Excel
        </Link>
        <Link href="/stocks/receptions"
          className="inline-block rounded-xl border border-gray-300 bg-white px-5 py-3 font-black text-gray-900">
          Réceptions conteneur
        </Link>
        <Link href="/stocks/entrepots"
          className="inline-block rounded-xl border border-gray-300 bg-white px-5 py-3 font-black text-gray-900">
          Entrepôts
        </Link>
        <Link href="/stocks/repartition"
          className="inline-block rounded-xl border border-gray-300 bg-white px-5 py-3 font-black text-gray-900">
          Répartition par emplacement
        </Link>
      </div>

      {/* Stock disponible et quantité en attente de rangement sont affichés
          séparément : une marchandise reçue mais non rangée n'est pas du stock
          disponible, et n'est jamais additionnée à celui-ci. */}
      {receptionStats && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-500">Stock disponible</p>
            <h2 className="text-3xl font-bold text-green-600">
              {Number(receptionStats.stock_available || 0).toLocaleString("fr-FR")}
            </h2>
            <p className="mt-1 text-xs text-gray-400">unités rangées et disponibles</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-500">Réceptions en attente</p>
            <h2 className="text-3xl font-bold text-yellow-600">
              {receptionStats.receptions_pending}
            </h2>
            <p className="mt-1 text-xs text-gray-400">
              dont {receptionStats.receptions_partial} partiellement rangée(s)
            </p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-500">En attente de rangement</p>
            <h2 className="text-3xl font-bold text-yellow-600">
              {Number(receptionStats.quantity_pending || 0).toLocaleString("fr-FR")}
            </h2>
            <p className="mt-1 text-xs text-gray-400">non comptées dans le stock disponible</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-500">Lignes à vérifier</p>
            <h2 className="text-3xl font-bold text-orange-600">
              {receptionStats.lines_to_review}
            </h2>
            <p className="mt-1 text-xs text-gray-400">produit à confirmer avant rangement</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-8">
        {["Entrée", "Sortie", "Transfert", "Inventaire"].map((type) => (
          <button
            key={type}
            onClick={() => selectMovementType(type)}
            className={`px-5 py-3 rounded-xl font-bold ${
              selectedType === type
                ? "bg-yellow-500 text-black"
                : "bg-white text-black"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {!canCreateStock && (
        <div className="bg-blue-100 text-blue-700 p-4 rounded-xl mb-6 font-bold">
          Vous avez un accès lecture seule.
        </div>
      )}

      {canCreateStock && (
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-2xl shadow mb-10 grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="md:col-span-3">
          <label className="mb-2 block text-sm font-bold text-gray-600">Rechercher un produit</label>
          <ProductSearchSelect
            value={selectedProduct}
            onSelect={(p) => {
              handleProductSearchSelect(p);
              setBinSource(null);
              setBinDestination(null);
              chargerBinsProduit(p?.id || null);
            }}
            placeholder="Nom, référence, SKU ou code-barres..."
          />
        </div>

        {/* ---------- EMPLACEMENT EXACT DE L'OPÉRATION ----------
            Renseigné, il fait passer l'écriture par le moteur de stock par
            emplacement : la balance du bac ET products.stock sont mis à jour
            dans la même transaction. Laissé vide, le comportement historique
            (mouvement global en attente de validation) est conservé. */}
        {selectedProduct && selectedType !== "Inventaire" && (
          <div className="md:col-span-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-black text-gray-900">Emplacement exact</p>

            {totauxProduit && (
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white p-2">
                  <p className="text-[11px] text-gray-500">Stock global</p>
                  <p className="font-black">{totauxProduit.stock.toLocaleString("fr-FR")}</p>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <p className="text-[11px] text-gray-500">Stock localisé</p>
                  <p className="font-black text-green-700">{totauxProduit.reparti.toLocaleString("fr-FR")}</p>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <p className="text-[11px] text-gray-500">À localiser</p>
                  <p className={`font-black ${totauxProduit.aLocaliser > 0 ? "text-amber-700" : ""}`}>
                    {totauxProduit.aLocaliser.toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>
            )}

            {/* ---------- LOCALISER UN STOCK EXISTANT ----------
                Un produit peut avoir du stock sans aucun bac connu. Plutôt que
                de renvoyer l'utilisateur sur un autre écran, on lui permet de
                le localiser ici. Dire OÙ est le stock ne crée aucune unité :
                products.stock reste identique. */}
            {selectedType === "Sortie" && totauxProduit
              && totauxProduit.reparti === 0 && totauxProduit.stock > 0 && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-black text-gray-900">Localiser le stock existant</p>
                <p className="mt-1 text-xs text-amber-900">
                  Le stock total existe ({totauxProduit.stock.toLocaleString("fr-FR")} unité(s)),
                  mais son emplacement physique n&apos;est pas encore enregistré.
                  <br />
                  Avant une sortie précise, indiquez dans quels bins le produit se trouve.
                  <br />
                  <b>Cette opération ne crée et ne supprime aucun stock.</b>
                </p>

                {suggestion?.suggestion && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2">
                    <p className="text-xs">
                      Ancien emplacement connu :{" "}
                      <b>{suggestion.suggestion.full_code || suggestion.suggestion.emplacement_code}</b>
                      <span className="text-gray-500"> — {suggestion.suggestion.preuves}</span>
                    </p>
                    <button type="button"
                            onClick={() => {
                              const sg = suggestion.suggestion;
                              setLocalisation([{ key: seqLoc, quantity: String(totauxProduit.stock),
                                bin: { id: sg.id, bin: sg.bin_code,
                                       code: sg.full_code || sg.emplacement_code,
                                       quantity: 0, reserved: 0, available: 0, status: "EMPTY" } }]);
                              setSeqLoc((x) => x + 1);
                            }}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white">
                      Utiliser cet emplacement comme suggestion
                    </button>
                  </div>
                )}
                {suggestion && !suggestion.suggestion && suggestion.pistes?.length > 0 && (
                  <p className="mt-2 rounded-lg bg-white p-2 text-xs text-gray-700">
                    Historique trouvé mais inexploitable tel quel :{" "}
                    {suggestion.pistes.map((p: any) => p.full_code || p.emplacement_code).join(", ")}
                    {suggestion.pistes[0]?.motif_fr ? ` — ${suggestion.pistes[0].motif_fr}.` : ""}{" "}
                    Saisissez le bac réel ci-dessous.
                  </p>
                )}

                <div className="mt-2 space-y-2">
                  {localisation.map((l, i) => (
                    <div key={l.key} className="rounded-lg bg-white p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase text-gray-500">Bac {i + 1}</span>
                        <button type="button" className="text-[11px] font-bold text-red-700"
                                onClick={() => setLocalisation((p) => p.filter((x) => x.key !== l.key))}>
                          Retirer
                        </button>
                      </div>
                      <BinSelector tree={binTree} value={l.bin} label="" compact
                        onSelect={(bin) => setLocalisation((p) => p.map((x) => x.key === l.key ? { ...x, bin } : x))} />
                      <input type="number" min={1} value={l.quantity} placeholder="Quantité"
                             onChange={(e) => setLocalisation((p) => p.map((x) => x.key === l.key ? { ...x, quantity: e.target.value } : x))}
                             className="mt-2 w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <button type="button"
                          onClick={() => { setLocalisation((p) => [...p, { key: seqLoc, bin: null, quantity: "" }]); setSeqLoc((x) => x + 1); }}
                          className="text-xs font-bold text-blue-700">+ Ajouter un bac</button>
                  {localisation.length > 0 && (() => {
                    const t = localisation.reduce((s, l) => s + Number(l.quantity || 0), 0);
                    const ecart = t - totauxProduit.stock;
                    const pret = ecart === 0 && localisation.every((l) => l.bin && Number(l.quantity) > 0);
                    return (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-black ${ecart === 0 ? "text-green-800" : "text-amber-900"}`}>
                          {t.toLocaleString("fr-FR")} / {totauxProduit.stock.toLocaleString("fr-FR")}
                          {ecart === 0 ? " — complet" : ecart > 0 ? ` — ${ecart} de trop` : ` — ${-ecart} manquante(s)`}
                        </span>
                        <button type="button" onClick={localiserStock} disabled={!pret}
                                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
                          Enregistrer la répartition du stock existant
                        </button>
                      </span>
                    );
                  })()}
                </div>
              </div>
            )}

            {selectedType === "Sortie" && (
              <>
                <p className="mt-1 text-xs text-blue-900">
                  Seuls les bacs contenant réellement ce produit peuvent servir de source.
                  La sortie sera <b>préparée</b> : la quantité est réservée sur le bac, mais
                  ni la balance ni le stock global ne baissent avant validation.
                </p>
                {binsProduit.length === 0 ? (
                  <p className="mt-2 rounded-lg bg-white p-2 text-sm text-amber-900">
                    Ce produit n&apos;a encore aucun stock localisé. Répartissez-le d&apos;abord depuis
                    l&apos;écran Répartition, ou laissez l&apos;emplacement vide pour un mouvement global.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {binsProduit.map((b: any) => {
                      const selectionne = binSource?.id === b.location_id;
                      return (
                        <div key={b.location_id}
                             className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm ${
                               selectionne ? "border-blue-500 bg-white" : "border-gray-200 bg-white"}`}>
                          <span className="flex items-center gap-2">
                            <span className="font-bold">{b.warehouse_code}</span>
                            <span className="text-gray-500">/ {b.row_code} / {b.loc_code} / {b.lvl_code} /</span>
                            <span className="font-bold">{b.bin_code}</span>
                          </span>
                          <span className="flex flex-wrap items-center gap-3 text-xs">
                            <span>
                              quantité <b>{Number(b.quantity).toLocaleString("fr-FR")}</b> ·
                              réservé {Number(b.reserved_quantity).toLocaleString("fr-FR")} ·
                              <b className="text-green-700"> disponible {Number(b.available).toLocaleString("fr-FR")}</b>
                            </span>
                            <button type="button"
                                    onClick={() => setBinSource({
                                      id: b.location_id, bin: b.bin_code,
                                      code: b.full_code || b.emplacement_code,
                                      quantity: Number(b.quantity), reserved: Number(b.reserved_quantity),
                                      available: Number(b.available), status: b.status,
                                    })}
                                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${
                                      selectionne ? "bg-blue-600 text-white" : "bg-slate-900 text-white hover:bg-slate-700"}`}>
                              {selectionne ? "✓ Sélectionné" : "Sélectionner ce bin"}
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {binSource && (() => {
                  const detail = binsProduit.find((b: any) => b.location_id === binSource.id);
                  if (!detail) return null;
                  return (
                    <div className="mt-2 rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm">
                      <p className="font-black text-blue-900">Source sélectionnée</p>
                      <p className="mt-1 text-xs leading-5 text-blue-900">
                        Entrepôt : <b>{detail.warehouse_code}</b><br />
                        Rayon : <b>{detail.row_code}</b><br />
                        Étagère : <b>{detail.loc_code}</b><br />
                        Niveau : <b>{detail.lvl_code}</b><br />
                        Bin : <b>{detail.bin_code}</b><br />
                        Quantité disponible : <b>{Number(detail.available).toLocaleString("fr-FR")}</b>
                      </p>
                    </div>
                  );
                })()}
                {binSource && Number(formData.quantity || 0) > binSource.available && (
                  <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-800">
                    {Number(formData.quantity).toLocaleString("fr-FR")} demandé(s) mais seulement{" "}
                    {binSource.available.toLocaleString("fr-FR")} disponible(s) dans ce bac.
                  </p>
                )}

                {/* Répartir la sortie sur plusieurs bacs. Un seul bac suffit
                    rarement : trente unités prises dans un stock de quatre-
                    vingts réparti sur trois rayons viennent de deux endroits,
                    et c'est au magasinier de dire lesquels. Les lignes partent
                    ensemble, en une seule transaction. */}
                {binsProduit.length > 1 && (
                  <div className="mt-3 rounded-xl border border-blue-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold">Répartir sur plusieurs bacs</p>
                      <button type="button"
                        onClick={() => setRepartitionMouvement((r) => [
                          ...r, { key: Date.now() + r.length, bin: null, quantity: "" },
                        ])}
                        className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                        + Ajouter un bac
                      </button>
                    </div>

                    {repartitionMouvement.length === 0 ? (
                      <p className="mt-2 text-xs text-gray-500">
                        Laissez vide pour prendre la totalité dans le bac sélectionné ci-dessus.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {repartitionMouvement.map((l, i) => (
                          <div key={l.key} className="flex flex-wrap items-end gap-2">
                            {/* Sur téléphone le sélecteur prend toute la
                                largeur : ligne, quantité et retrait
                                s'empilent au lieu de se serrer à 375 px. */}
                            <div className="min-w-[200px] flex-1 basis-full sm:basis-auto">
                              <BinSelector tree={binTree} value={l.bin} label="" compact
                                onSelect={(b) => setRepartitionMouvement((r) =>
                                  r.map((x, j) => (j === i ? { ...x, bin: b } : x)))} />
                            </div>
                            <input type="number" min="0" value={l.quantity} placeholder="quantité"
                              onChange={(e) => setRepartitionMouvement((r) =>
                                r.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                              className="w-28 flex-1 rounded-lg border-2 border-gray-200 p-2 text-sm sm:flex-none" />
                            <button type="button"
                              onClick={() => setRepartitionMouvement((r) => r.filter((_, j) => j !== i))}
                              className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-bold">Retirer</button>
                          </div>
                        ))}

                        {(() => {
                          const somme = repartitionMouvement
                            .reduce((t, l) => t + Number(l.quantity || 0), 0);
                          const demande = Number(formData.quantity || 0);
                          const reste = demande - somme;
                          const juste = reste === 0 && somme > 0;
                          return (
                            <div className={`rounded-lg p-3 text-sm ${
                              juste ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}>
                              <p>Quantité demandée : <b>{demande.toLocaleString("fr-FR")}</b></p>
                              <p>Quantité répartie : <b>{somme.toLocaleString("fr-FR")}</b></p>
                              <p>Reste à répartir : <b>{reste.toLocaleString("fr-FR")}</b></p>
                              {(() => {
                                const sansBac = repartitionMouvement.filter((l) => !l.bin).length;
                                const sansQte = repartitionMouvement.filter(
                                  (l) => l.bin && !(Number(l.quantity) > 0)
                                ).length;
                                return (
                                  <p className="mt-1 font-bold">
                                    {sansBac > 0
                                      ? `${sansBac} ligne(s) sans bac : choisissez l’emplacement.`
                                      : sansQte > 0
                                        ? `${sansQte} ligne(s) sans quantité.`
                                        : juste
                                          ? "La répartition est exacte."
                                          : "La validation reste bloquée tant que le reste n’est pas nul."}
                                  </p>
                                );
                              })()}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {selectedType === "Transfert" && (
              <div className="mt-2 space-y-3">
                <BinSelector tree={binTree} value={binSource} onSelect={setBinSource} label="SOURCE" />
                <BinSelector tree={binTree} value={binDestination} onSelect={setBinDestination} label="DESTINATION" />
                {binSource && binDestination && binSource.id === binDestination.id && (
                  <p className="rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-800">
                    Source et destination identiques.
                  </p>
                )}
                <p className="text-xs text-blue-900">
                  Le transfert fonctionne entre deux entrepôts comme à l&apos;intérieur d&apos;un seul —
                  rayon, location, level ou bac différents. Le stock global ne change jamais.
                </p>
              </div>
            )}

            {selectedType === "Entrée" && (
              <div className="mt-2">
                <BinSelector tree={binTree} value={binDestination} onSelect={setBinDestination}
                             label="Bac de destination" />
                <p className="mt-1 text-xs text-blue-900">
                  L&apos;entrée sera enregistrée <b>en attente</b> : aucune unité n&apos;est ajoutée
                  tant qu&apos;elle n&apos;est pas validée. À la validation, la balance de ce bac
                  et le stock global augmenteront d&apos;autant.
                </p>
              </div>
            )}
          </div>
        )}

        <input
          type="text"
          name="product_name"
          placeholder="Nom produit"
          value={formData.product_name}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          readOnly
        />

        <input
          type="text"
          name="location_code"
          placeholder="Emplacement exact"
          value={formData.location_code}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          readOnly
        />

        <input
          type="text"
          name="current_stock"
          placeholder="Stock actuel"
          value={formData.current_stock}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          readOnly
        />

        <input
          type="number"
          min="0"
          step="1"
          name="quantity"
          placeholder={
            selectedType === "Inventaire"
              ? "Stock réel compté"
              : "Quantité"
          }
          value={formData.quantity}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          required
        />

        <select
          name="partner_id"
          value={formData.partner_id}
          onChange={(e) => handlePartnerSelect(e.target.value)}
          className="border p-3 rounded-xl text-black"
        >
          <option value="">
            {expectedPartnerType
              ? `Choisir ${expectedPartnerType}`
              : "Partenaire optionnel"}
          </option>

          {filteredPartners.map((partner: any) => (
            <option key={partner.id} value={partner.id}>
              {partner.name} {partner.phone ? `- ${partner.phone}` : ""}
            </option>
          ))}
        </select>

        <select
          name="source_warehouse"
          value={formData.source_warehouse}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          required
        >
          <option value="">Choisir entrepôt source</option>

          {warehouses.map((warehouse: any) => (
            <option key={warehouse.id} value={warehouse.name}>
              {warehouse.code} - {warehouse.name}
            </option>
          ))}
        </select>

        {selectedType === "Transfert" && (
          <select
            name="destination_warehouse"
            value={formData.destination_warehouse}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
            required
          >
            <option value="">Choisir entrepôt destination</option>

            {warehouses.map((warehouse: any) => (
              <option key={warehouse.id} value={warehouse.name}>
                {warehouse.code} - {warehouse.name}
              </option>
            ))}
          </select>
        )}

        <input
          type="text"
          name="reason"
          placeholder="Motif / observation"
          value={formData.reason}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        />

        <label className="flex items-center gap-3 rounded-xl border p-3 text-black">
          <input
            type="checkbox"
            name="apply_price"
            checked={formData.apply_price}
            onChange={handleChange}
          />
          Appliquer un prix à ce mouvement
        </label>

        {formData.apply_price && (
          <>
            <input
              type="number"
              min="0"
              step="0.01"
              name="unit_price"
              placeholder="Prix unitaire"
              value={formData.unit_price}
              onChange={handleChange}
              className="border p-3 rounded-xl text-black"
              required
            />
            <div className="rounded-xl bg-gray-100 p-3 text-black">
              <p className="text-xs font-bold text-gray-500">Total mouvement</p>
              <p className="font-bold">
                {formatFCFA(
                  Number(formData.quantity || 0) *
                    Number(formData.unit_price || 0)
                )}
              </p>
            </div>
          </>
        )}

        {/* Tant que la répartition ne tombe pas juste, la validation reste
            fermée : mieux vaut un bouton inerte qu'un mouvement à moitié
            réparti que le serveur refusera de toute façon. */}
        <button
          type="submit"
          disabled={repartitionIncomplete}
          title={repartitionIncomplete
            ? "La somme répartie doit égaler la quantité demandée."
            : undefined}
          className="bg-yellow-500 text-black font-bold rounded-xl py-3
                     disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
        >
          Créer demande {selectedType}
        </button>
        <a
          href={`/demandes-stock?type=${encodeURIComponent(selectedType)}`}
          className="rounded-xl border border-yellow-500 p-3 text-center font-bold text-black"
        >
          + Opération multi-produits
        </a>
      </form>
      )}

      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Produits</p>
          <h2 className="text-3xl font-bold text-blue-500">
            {(totalProduits ?? products.length).toLocaleString("fr-FR")}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Entrepôts</p>
          <h2 className="text-3xl font-bold text-purple-500">
            {warehouses.length}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">En attente</p>
          <h2 className="text-3xl font-bold text-yellow-600">
            {movements.filter((m: any) => m.status === "En attente").length}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Validés</p>
          <h2 className="text-3xl font-bold text-green-600">
            {movements.filter((m: any) => m.status === "Validé").length}
          </h2>
        </div>
      </div>

      {canPublishMarketplace && (
        <div className="mb-8 rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-bold text-black">Publication Marketplace depuis le stock</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {products.slice(0, 12).map((product: any) => (
              <div key={product.id} className="rounded-xl border p-4">
                <p className="font-black text-black">{product.reference} - {product.name}</p>
                <p className="text-sm text-gray-500">Stock : {product.stock} | {product.category || "Sans catégorie"}</p>
                <button
                  onClick={() => publishStockProduct(product)}
                  className="mt-3 rounded-xl bg-yellow-500 px-4 py-2 font-bold text-black"
                >
                  Publier
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold text-black mb-5">
          Historique des mouvements
        </h2>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-3">Type</th>
              <th>Produit</th>
              <th>Quantité</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Partenaire</th>
              <th>Montant</th>
              <th>Observation / Emplacement</th>
              <th>Utilisateur</th>
              <th>Statut</th>
              {canValidateStock && <th>Validation</th>}
            </tr>
          </thead>

          <tbody>
            {movements.map((movement: any) => (
              <tr
                key={movement.id}
                className={`border-b ${
                  highlightMovementId === movement.id ? "bg-yellow-50" : ""
                }`}
              >
                <td className="py-4 font-bold">
                  {movement.type}
                </td>

                <td>
                  {movement.product_reference} - {movement.product_name}
                </td>

                <td>{movement.quantity}</td>
                <td>{movement.source_warehouse}</td>
                <td>{movement.destination_warehouse || "-"}</td>
                <td>
                  {movement.partner_name ? (
                    <>
                      {movement.partner_name}
                      <span className="block text-xs text-gray-400">
                        {movement.partner_type || "-"}
                      </span>
                    </>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  {movement.apply_price
                    ? formatFCFA(movement.total_amount)
                    : "-"}
                </td>
                <td>{movement.reason || "-"}</td>
                <td>
                  {movement.created_by_name || "Utilisateur"}{" "}
                  <span className="text-gray-400">
                    ({movement.created_by_role || "-"})
                  </span>
                </td>

                <td className={`font-bold ${getStatusColor(movement.status)}`}>
                  {movement.status}
                </td>

                {canValidateStock && (
                  <td className="space-x-2">
                    {movement.status === "En attente" ? (
                      <>
                        <button
                          onClick={() => validateMovement(movement.id)}
                          className="bg-green-500 text-white px-4 py-2 rounded-xl font-bold"
                        >
                          Valider
                        </button>

                        <button
                          onClick={() => rejectMovement(movement.id)}
                          className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold"
                        >
                          Refuser
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-400">Déjà traité</span>
                    )}
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
