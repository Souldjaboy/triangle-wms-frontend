const UNITS = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
];

function underHundred(n: number): string {
  n = Math.floor(n);

  if (n < 17) return UNITS[n];

  if (n < 20) {
    return "dix-" + UNITS[n - 10];
  }

  if (n < 70) {
    const tens = [
      "",
      "",
      "vingt",
      "trente",
      "quarante",
      "cinquante",
      "soixante",
    ];

    const t = Math.floor(n / 10);
    const u = n % 10;

    if (u === 0) return tens[t];
    if (u === 1) return tens[t] + " et un";

    return tens[t] + "-" + UNITS[u];
  }

  if (n < 80) {
    if (n === 71) return "soixante et onze";
    return "soixante-" + underHundred(n - 60);
  }

  if (n === 80) return "quatre-vingts";

  return "quatre-vingt-" + underHundred(n - 80);
}

function underThousand(n: number): string {
  n = Math.floor(n);

  if (n < 100) return underHundred(n);

  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  let result =
    hundreds === 1
      ? "cent"
      : underHundred(hundreds) + " cent";

  if (rest === 0 && hundreds > 1) {
    result += "s";
  }

  if (rest > 0) {
    result += " " + underHundred(rest);
  }

  return result;
}

export function numberToFrench(value: number): string {
  let n = Math.floor(Math.abs(Number(value || 0)));

  if (n === 0) return "zéro";

  const parts: string[] = [];

  const billions = Math.floor(n / 1_000_000_000);

  if (billions) {
    parts.push(
      billions === 1
        ? "un milliard"
        : numberToFrench(billions) + " milliards"
    );
    n %= 1_000_000_000;
  }

  const millions = Math.floor(n / 1_000_000);

  if (millions) {
    parts.push(
      millions === 1
        ? "un million"
        : numberToFrench(millions) + " millions"
    );
    n %= 1_000_000;
  }

  const thousands = Math.floor(n / 1000);

  if (thousands) {
    parts.push(
      thousands === 1
        ? "mille"
        : underThousand(thousands) + " mille"
    );
    n %= 1000;
  }

  if (n) {
    parts.push(underThousand(n));
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function amountInWordsFCFA(value: number): string {
  const amount = Math.round(Number(value || 0));
  const words = numberToFrench(amount);

  return (
    words.charAt(0).toUpperCase() +
    words.slice(1) +
    " francs CFA"
  );
}
