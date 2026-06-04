import BusinessModulePage from "../../components/BusinessModulePage";
import { immobilierNav, propertyColumns, propertyFields } from "../../lib/businessConfigs";

export default function ImmobilierBiensPage() {
  return (
    <BusinessModulePage
      title="Biens immobiliers"
      description="Créer maison, terrain, appartement, villa ou chambre d'hôtel."
      endpoint="/immobilier/properties"
      createTitle="Créer bien"
      fields={propertyFields}
      columns={propertyColumns}
      navLinks={immobilierNav}
    />
  );
}
