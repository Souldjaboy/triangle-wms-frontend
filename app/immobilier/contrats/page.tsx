import BusinessModulePage from "../../components/BusinessModulePage";
import { immobilierNav } from "../../lib/businessConfigs";

export default function ImmobilierContratsPage() {
  return (
    <BusinessModulePage
      title="Contrats immobilier"
      description="Les contrats de location, vente et factures hôtel sont centralisés dans Documents."
      navLinks={immobilierNav}
    />
  );
}
