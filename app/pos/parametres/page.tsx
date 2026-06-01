"use client";

export default function PosParametresPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-black">
      <h1 className="text-4xl font-bold mb-2">Paramètres POS</h1>
      <p className="text-gray-500 mb-8">Configuration caisse, paiements manuels, TVA et pharmacie.</p>
      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Paiements</h2>
          <p className="text-gray-600">Espèces, carte, Orange Money, Moov Money, Wave, virement, paiement mixte et crédit client sont préparés en mode manuel.</p>
        </div>
        <div>
          <h2 className="text-2xl font-bold">Lots / pharmacie</h2>
          <p className="text-gray-600">La vente utilise FEFO sur les lots actifs avec date d’expiration la plus proche.</p>
        </div>
        <div>
          <h2 className="text-2xl font-bold">Paiement externe</h2>
          <p className="text-gray-600">Les API de paiement mobile pourront être branchées ici plus tard sans changer le flux POS.</p>
        </div>
      </div>
    </div>
  );
}
