import BusinessModulePage from "../../components/BusinessModulePage";
import { restaurantNav, tableColumns, tableFields } from "../../lib/businessConfigs";

export default function RestaurantTablesPage() {
  return (
    <BusinessModulePage
      title="Tables QR"
      description="Créer les tables et générer un lien QR public par table."
      endpoint="/restaurant/tables"
      createTitle="Créer table"
      fields={tableFields}
      columns={tableColumns}
      navLinks={restaurantNav}
    />
  );
}
