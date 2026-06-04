import BusinessModulePage from "../../components/BusinessModulePage";
import { automobileNav, moneyColumns, vehicleRentalFields } from "../../lib/businessConfigs";

export default function AutomobileLocationsPage() {
  return (
    <BusinessModulePage
      title="Locations véhicules"
      description="Créer une location, suivre les cautions, paiements et retours."
      endpoint="/automobile/rentals"
      createTitle="Créer location"
      fields={vehicleRentalFields}
      columns={moneyColumns}
      navLinks={automobileNav}
    />
  );
}
