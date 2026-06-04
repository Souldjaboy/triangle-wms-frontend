import BusinessModulePage from "../../components/BusinessModulePage";
import { immobilierNav, saleColumns } from "../../lib/businessConfigs";

export default function ImmobilierPaiementsPage() {
  return (
    <BusinessModulePage
      title="Paiements immobilier"
      description="Paiements reçus, soldes restants et dettes clients immobilières."
      endpoint="/immobilier/sales"
      columns={saleColumns}
      navLinks={immobilierNav}
    />
  );
}
