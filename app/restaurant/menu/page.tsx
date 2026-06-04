import BusinessModulePage from "../../components/BusinessModulePage";
import { menuColumns, menuFields, restaurantNav } from "../../lib/businessConfigs";

export default function RestaurantMenuPage() {
  return (
    <BusinessModulePage
      title="Menu restaurant"
      description="Créer les plats visibles depuis les QR codes des tables."
      endpoint="/restaurant/menu-items"
      createTitle="Créer plat"
      fields={menuFields}
      columns={menuColumns}
      navLinks={restaurantNav}
    />
  );
}
