import BusinessModulePage from "../../components/BusinessModulePage";
import { orderColumns, restaurantNav } from "../../lib/businessConfigs";

export default function RestaurantServeursPage() {
  return (
    <BusinessModulePage
      title="Serveurs"
      description="Suivi des commandes à servir et appels clients."
      endpoint="/restaurant/orders"
      columns={orderColumns}
      navLinks={restaurantNav}
    />
  );
}
