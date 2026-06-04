import BusinessModulePage from "../../components/BusinessModulePage";
import { orderColumns, restaurantNav } from "../../lib/businessConfigs";

export default function RestaurantCuisinePage() {
  return (
    <BusinessModulePage
      title="Cuisine"
      description="Vue cuisine des commandes nouvelles, en préparation et prêtes."
      endpoint="/restaurant/orders"
      columns={orderColumns}
      navLinks={restaurantNav}
    />
  );
}
