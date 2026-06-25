export function formatCurrency(value: number | null | undefined, _currency?: string | null) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}
