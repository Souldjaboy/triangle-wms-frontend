import BusinessModulePage from "../../components/BusinessModulePage";
import { automobileNav } from "../../lib/businessConfigs";

export default function AutomobileContratsPage() {
  return (
    <BusinessModulePage
      title="Contrats automobile"
      description="Les contrats et reçus générés depuis locations et ventes sont centralisés dans Documents."
      navLinks={automobileNav}
    />
  );
}
