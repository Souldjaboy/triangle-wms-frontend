import BusinessModulePage from "../../components/BusinessModulePage";
import { orderColumns, restaurantNav } from "../../lib/businessConfigs";

export default function RestaurantCommandesPage() {
  return (
    <BusinessModulePage
      title="Commandes restaurant"
      description="Commandes table, statut cuisine, paiement et service."
      endpoint="/restaurant/orders"
      columns={orderColumns}
      navLinks={restaurantNav}
    />
  );
}
