import BusinessModulePage from "../../components/BusinessModulePage";
import { immobilierNav, moneyColumns, reservationFields } from "../../lib/businessConfigs";

export default function ImmobilierHotelPage() {
  return (
    <BusinessModulePage
      title="Hôtel"
      description="Chambres, réservations, check-in, check-out et factures hôtel."
      endpoint="/immobilier/hotel/reservations"
      createTitle="Créer réservation"
      fields={reservationFields}
      columns={moneyColumns}
      navLinks={immobilierNav}
    />
  );
}
