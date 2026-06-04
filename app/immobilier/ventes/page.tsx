import BusinessModulePage from "../../components/BusinessModulePage";
import { immobilierNav, propertySaleFields, saleColumns } from "../../lib/businessConfigs";

export default function ImmobilierVentesPage() {
  return (
    <BusinessModulePage
      title="Ventes immobilières"
      description="Vente comptant ou par tranches avec solde restant."
      endpoint="/immobilier/sales"
      createTitle="Créer vente"
      fields={propertySaleFields}
      columns={saleColumns}
      navLinks={immobilierNav}
    />
  );
}
