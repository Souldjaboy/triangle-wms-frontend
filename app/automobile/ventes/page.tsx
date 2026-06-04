import BusinessModulePage from "../../components/BusinessModulePage";
import { automobileNav, saleColumns, vehicleSaleFields } from "../../lib/businessConfigs";

export default function AutomobileVentesPage() {
  return (
    <BusinessModulePage
      title="Ventes véhicules"
      description="Vente comptant ou par tranches avec dette client et reçu."
      endpoint="/automobile/sales"
      createTitle="Créer vente"
      fields={vehicleSaleFields}
      columns={saleColumns}
      navLinks={automobileNav}
    />
  );
}
