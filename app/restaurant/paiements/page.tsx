import BusinessModulePage from "../../components/BusinessModulePage";
import { orderColumns, restaurantNav } from "../../lib/businessConfigs";

export default function RestaurantPaiementsPage() {
  return (
    <BusinessModulePage
      title="Paiements restaurant"
      description="Commandes payées, en attente et tickets restaurant."
      endpoint="/restaurant/orders"
      columns={orderColumns}
      navLinks={restaurantNav}
    />
  );
}
