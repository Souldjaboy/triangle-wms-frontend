import BusinessModulePage from "../../components/BusinessModulePage";
import { automobileNav, vehicleColumns, vehicleFields } from "../../lib/businessConfigs";

export default function AutomobileVehiculesPage() {
  return (
    <BusinessModulePage
      title="Véhicules"
      description="Créer et suivre voitures à vendre, à louer, en maintenance ou déjà vendues."
      endpoint="/automobile/vehicles"
      createTitle="Créer véhicule"
      fields={vehicleFields}
      columns={vehicleColumns}
      navLinks={automobileNav}
    />
  );
}
