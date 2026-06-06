export const automobileNav = [
  { href: "/automobile/vehicules", label: "Véhicules" },
  { href: "/automobile/locations", label: "Locations" },
  { href: "/automobile/ventes", label: "Ventes" },
  { href: "/automobile/contrats", label: "Contrats" },
  { href: "/automobile/paiements", label: "Paiements" },
  { href: "/automobile/documents", label: "Documents" },
];

export const immobilierNav = [
  { href: "/immobilier/biens", label: "Biens" },
  { href: "/immobilier/locations", label: "Locations" },
  { href: "/immobilier/ventes", label: "Ventes" },
  { href: "/immobilier/hotel", label: "Hôtel" },
  { href: "/immobilier/reservations", label: "Réservations" },
  { href: "/immobilier/contrats", label: "Contrats" },
  { href: "/immobilier/paiements", label: "Paiements" },
];

export const restaurantNav = [
  { href: "/restaurant/menu", label: "Menu" },
  { href: "/restaurant/tables", label: "Tables QR" },
  { href: "/restaurant/commandes", label: "Commandes" },
  { href: "/restaurant/cuisine", label: "Cuisine" },
  { href: "/restaurant/serveurs", label: "Serveurs" },
  { href: "/restaurant/paiements", label: "Paiements" },
  { href: "/restaurant/qr", label: "QR tables" },
];

export const vehicleFields = [
  { name: "marque", label: "Marque" },
  { name: "modele", label: "Modèle" },
  { name: "immatriculation", label: "Immatriculation" },
  { name: "numero_chassis", label: "Numéro châssis" },
  { name: "annee", label: "Année", type: "number" as const },
  { name: "couleur", label: "Couleur" },
  { name: "kilometrage", label: "Kilométrage", type: "number" as const },
  { name: "carburant", label: "Carburant" },
  { name: "boite_vitesse", label: "Boîte de vitesse", type: "select" as const, options: ["Manuelle", "Automatique"] },
  { name: "nombre_places", label: "Nombre de places", type: "number" as const },
  { name: "etat_vehicule", label: "État du véhicule", type: "select" as const, options: ["Neuf", "Très bon", "Bon", "À réparer"] },
  { name: "prix_vente", label: "Prix vente", type: "number" as const },
  { name: "prix_location_jour", label: "Prix location jour", type: "number" as const },
  { name: "prix_location_semaine", label: "Prix location semaine", type: "number" as const },
  { name: "prix_location_mois", label: "Prix location mois", type: "number" as const },
  { name: "disponibilite", label: "Disponibilité", type: "select" as const, options: ["disponible", "vendu", "loué", "maintenance"] },
  { name: "is_sellable", label: "Vendable", type: "select" as const, options: ["oui", "non"] },
  { name: "is_rentable", label: "Louable", type: "select" as const, options: ["oui", "non"] },
  { name: "publish_on_marketplace", label: "Publier sur marketplace", type: "select" as const, options: ["oui", "non"] },
];

export const vehicleColumns = [
  { key: "id", label: "ID" },
  { key: "marque", label: "Marque" },
  { key: "modele", label: "Modèle" },
  { key: "immatriculation", label: "Immatriculation" },
  { key: "statut", label: "Statut" },
  { key: "disponibilite", label: "Disponibilité" },
  { key: "prix_vente", label: "Prix vente", money: true },
  { key: "prix_location_jour", label: "Location/jour", money: true },
  { key: "is_sellable", label: "Vendable" },
  { key: "is_rentable", label: "Louable" },
  { key: "publish_on_marketplace", label: "Marketplace" },
];

export const vehicleRentalFields = [
  { name: "vehicle_id", label: "ID véhicule", type: "number" as const },
  { name: "client_name", label: "Client" },
  { name: "client_phone", label: "Téléphone" },
  { name: "start_date", label: "Début", type: "date" as const },
  { name: "end_date", label: "Fin", type: "date" as const },
  { name: "price_per_day", label: "Prix/jour", type: "number" as const },
  { name: "total_amount", label: "Total", type: "number" as const },
  { name: "deposit_amount", label: "Caution", type: "number" as const },
  { name: "paid_amount", label: "Payé", type: "number" as const },
];

export const vehicleSaleFields = [
  { name: "vehicle_id", label: "ID véhicule", type: "number" as const },
  { name: "client_name", label: "Client" },
  { name: "client_phone", label: "Téléphone" },
  { name: "sale_price", label: "Prix vente", type: "number" as const },
  { name: "amount_paid", label: "Montant payé", type: "number" as const },
  { name: "payment_plan", label: "Plan paiement", type: "select" as const, options: ["comptant", "tranche", "mensuel"] },
];

export const moneyColumns = [
  { key: "id", label: "ID" },
  { key: "client_name", label: "Client" },
  { key: "status", label: "Statut" },
  { key: "total_amount", label: "Total", money: true },
  { key: "paid_amount", label: "Payé", money: true },
  { key: "created_at", label: "Date" },
];

export const saleColumns = [
  { key: "id", label: "ID" },
  { key: "client_name", label: "Client" },
  { key: "status", label: "Statut" },
  { key: "sale_price", label: "Prix", money: true },
  { key: "amount_paid", label: "Payé", money: true },
  { key: "remaining_amount", label: "Reste", money: true },
];

export const propertyFields = [
  { name: "type", label: "Type", type: "select" as const, options: ["maison à vendre", "maison à louer", "appartement", "terrain", "chambre d’hôtel", "suite", "salle", "bien professionnel"] },
  { name: "title", label: "Titre" },
  { name: "description", label: "Description" },
  { name: "address", label: "Adresse" },
  { name: "city", label: "Ville" },
  { name: "neighborhood", label: "Quartier" },
  { name: "surface", label: "Surface", type: "number" as const },
  { name: "rooms_count", label: "Nombre de chambres", type: "number" as const },
  { name: "beds_count", label: "Nombre de lits", type: "number" as const },
  { name: "guests_count", label: "Nombre de personnes", type: "number" as const },
  { name: "price_sale", label: "Prix vente", type: "number" as const },
  { name: "price_rent_day", label: "Prix jour", type: "number" as const },
  { name: "price_rent_month", label: "Prix mois", type: "number" as const },
  { name: "price_night", label: "Prix nuit hôtel", type: "number" as const },
  { name: "is_sellable", label: "Vendable", type: "select" as const, options: ["oui", "non"] },
  { name: "is_rentable", label: "Louable", type: "select" as const, options: ["oui", "non"] },
  { name: "is_bookable", label: "Réservable", type: "select" as const, options: ["oui", "non"] },
  { name: "publish_on_marketplace", label: "Publier sur marketplace", type: "select" as const, options: ["oui", "non"] },
];

export const propertyColumns = [
  { key: "id", label: "ID" },
  { key: "type", label: "Type" },
  { key: "title", label: "Titre" },
  { key: "city", label: "Ville" },
  { key: "status", label: "Statut" },
  { key: "price_sale", label: "Prix vente", money: true },
  { key: "price_rent_month", label: "Loyer mois", money: true },
  { key: "is_sellable", label: "Vendable" },
  { key: "is_rentable", label: "Louable" },
  { key: "is_bookable", label: "Réservable" },
  { key: "publish_on_marketplace", label: "Marketplace" },
];

export const propertyRentalFields = [
  { name: "property_id", label: "ID bien", type: "number" as const },
  { name: "client_name", label: "Client" },
  { name: "client_phone", label: "Téléphone" },
  { name: "start_date", label: "Début", type: "date" as const },
  { name: "end_date", label: "Fin", type: "date" as const },
  { name: "total_amount", label: "Total", type: "number" as const },
  { name: "deposit_amount", label: "Caution", type: "number" as const },
  { name: "paid_amount", label: "Payé", type: "number" as const },
];

export const propertySaleFields = [
  { name: "property_id", label: "ID bien", type: "number" as const },
  { name: "client_name", label: "Client" },
  { name: "client_phone", label: "Téléphone" },
  { name: "sale_price", label: "Prix vente", type: "number" as const },
  { name: "amount_paid", label: "Montant payé", type: "number" as const },
  { name: "payment_plan", label: "Plan paiement", type: "select" as const, options: ["comptant", "tranche", "mensuel"] },
];

export const reservationFields = [
  { name: "property_id", label: "ID chambre/bien", type: "number" as const },
  { name: "room_number", label: "Numéro chambre" },
  { name: "client_name", label: "Client" },
  { name: "client_phone", label: "Téléphone" },
  { name: "checkin_date", label: "Check-in", type: "date" as const },
  { name: "checkout_date", label: "Check-out", type: "date" as const },
  { name: "nights", label: "Nuitées", type: "number" as const },
  { name: "price_per_night", label: "Prix nuit", type: "number" as const },
  { name: "total_amount", label: "Total", type: "number" as const },
  { name: "paid_amount", label: "Payé", type: "number" as const },
];

export const tableFields = [
  { name: "table_number", label: "Numéro table" },
];

export const tableColumns = [
  { key: "id", label: "ID" },
  { key: "table_number", label: "Table" },
  { key: "qr_code", label: "Lien QR" },
  { key: "status", label: "Statut" },
];

export const menuFields = [
  { name: "name", label: "Plat" },
  { name: "description", label: "Description" },
  { name: "category", label: "Catégorie" },
  { name: "price", label: "Prix", type: "number" as const },
  { name: "image", label: "Image URL" },
  { name: "is_available", label: "Disponible", type: "select" as const, options: ["oui", "non"] },
  { name: "publish_on_marketplace", label: "Publier sur marketplace", type: "select" as const, options: ["oui", "non"] },
  { name: "preparation_time", label: "Préparation min", type: "number" as const },
];

export const menuColumns = [
  { key: "id", label: "ID" },
  { key: "name", label: "Plat" },
  { key: "category", label: "Catégorie" },
  { key: "price", label: "Prix", money: true },
  { key: "is_available", label: "Disponible" },
  { key: "publish_on_marketplace", label: "Marketplace" },
];

export const orderColumns = [
  { key: "id", label: "ID" },
  { key: "table_number", label: "Table" },
  { key: "customer_name", label: "Client" },
  { key: "order_status", label: "Statut commande" },
  { key: "payment_status", label: "Paiement" },
  { key: "total_amount", label: "Total", money: true },
];
