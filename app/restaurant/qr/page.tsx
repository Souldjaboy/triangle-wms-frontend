import BusinessModulePage from "../../components/BusinessModulePage";
import { restaurantNav, tableColumns } from "../../lib/businessConfigs";

export default function RestaurantQrPage() {
  return (
    <BusinessModulePage
      title="QR tables"
      description="Copier le lien QR de chaque table puis l'imprimer ou le transformer en QR code."
      endpoint="/restaurant/tables"
      columns={tableColumns}
      navLinks={restaurantNav}
    />
  );
}
