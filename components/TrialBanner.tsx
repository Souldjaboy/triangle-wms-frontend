"use client";

type Props = {
  user: any;
};

export default function TrialBanner({ user }: Props) {
  const status = String(user?.subscription_status || "").toLowerCase();
  const endDate = user?.subscription_expires_at || user?.trial_end_date || user?.subscription_end_date;

  if (!endDate || status !== "trial") return null;

  const daysLeft = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysLeft > 3 || daysLeft < 0) return null;

  return (
    <div className="mb-5 rounded-2xl border border-yellow-300 bg-yellow-50 p-4 font-bold text-black">
      Votre essai gratuit expire dans {daysLeft} jour{daysLeft > 1 ? "s" : ""}.
      <a href="/support" className="ml-2 text-blue-700 underline">
        Renouveler ou contacter le support
      </a>
    </div>
  );
}
