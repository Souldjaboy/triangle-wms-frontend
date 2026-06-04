import BusinessModulePage from "../../components/BusinessModulePage";
import { automobileNav, saleColumns } from "../../lib/businessConfigs";

export default function AutomobilePaiementsPage() {
  return (
    <BusinessModulePage
      title="Paiements automobile"
      description="Suivi des montants payés et restants sur les ventes véhicules."
      endpoint="/automobile/sales"
      columns={saleColumns}
      navLinks={automobileNav}
    />
  );
}
