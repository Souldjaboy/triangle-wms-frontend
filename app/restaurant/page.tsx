import BusinessModulePage from "../components/BusinessModulePage";
import { restaurantNav } from "../lib/businessConfigs";

export default function RestaurantPage() {
  return (
    <BusinessModulePage
      title="Restauration / QR Table"
      description="Tables QR, menu, commandes, cuisine, appels serveur, paiements et tickets."
      dashboardEndpoint="/restaurant/dashboard"
      navLinks={restaurantNav}
    />
  );
}
