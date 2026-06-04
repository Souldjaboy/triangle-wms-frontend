import BusinessModulePage from "../../components/BusinessModulePage";
import { immobilierNav, moneyColumns, reservationFields } from "../../lib/businessConfigs";

export default function ImmobilierReservationsPage() {
  return (
    <BusinessModulePage
      title="Réservations"
      description="Suivi des réservations hôtelières et nuitées."
      endpoint="/immobilier/hotel/reservations"
      createTitle="Créer réservation"
      fields={reservationFields}
      columns={moneyColumns}
      navLinks={immobilierNav}
    />
  );
}
