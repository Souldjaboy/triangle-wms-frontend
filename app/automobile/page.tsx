import BusinessModulePage from "../components/BusinessModulePage";
import { automobileNav } from "../lib/businessConfigs";

export default function AutomobilePage() {
  return (
    <BusinessModulePage
      title="Automobile / Parking / Garage"
      description="Suivi des véhicules, locations, ventes, paiements partiels, contrats et documents."
      dashboardEndpoint="/automobile/dashboard"
      navLinks={automobileNav}
    />
  );
}
