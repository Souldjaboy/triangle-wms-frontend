import BusinessModulePage from "../components/BusinessModulePage";
import { immobilierNav } from "../lib/businessConfigs";

export default function ImmobilierPage() {
  return (
    <BusinessModulePage
      title="Immobilier / Hôtellerie"
      description="Maisons, terrains, appartements, chambres d'hôtel, réservations, ventes et locations."
      dashboardEndpoint="/immobilier/dashboard"
      navLinks={immobilierNav}
    />
  );
}
