import BusinessModulePage from "../../components/BusinessModulePage";
import { immobilierNav, moneyColumns, propertyRentalFields } from "../../lib/businessConfigs";

export default function ImmobilierLocationsPage() {
  return (
    <BusinessModulePage
      title="Locations immobilières"
      description="Contrats de location, cautions et paiements locatifs."
      endpoint="/immobilier/rentals"
      createTitle="Créer location"
      fields={propertyRentalFields}
      columns={moneyColumns}
      navLinks={immobilierNav}
    />
  );
}
