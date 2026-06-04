import BusinessModulePage from "../../components/BusinessModulePage";
import { automobileNav } from "../../lib/businessConfigs";

export default function AutomobileDocumentsPage() {
  return (
    <BusinessModulePage
      title="Documents automobile"
      description="Contrats, reçus, factures et fiches véhicules sont créés dans le module Documents."
      navLinks={automobileNav}
    />
  );
}
