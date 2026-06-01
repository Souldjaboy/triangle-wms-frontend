export function formatFCFA(amount: any) {
  return `${Number(amount || 0).toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
  })} FCFA`;
}
