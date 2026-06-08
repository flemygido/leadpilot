/** Format rupees into lakhs/crores for display (e.g. 18_000_000 → "₹1.8 Cr") */
export function formatPrice(rupees: number): string {
  if (rupees >= 10_000_000) {
    const c = rupees / 10_000_000;
    return `₹${c % 1 === 0 ? c.toFixed(0) : c.toFixed(1)} Cr`;
  }
  const l = rupees / 100_000;
  return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`;
}

/** Format a price range: "₹1.8 – 2.2 Cr" or "₹85 – 105L" */
export function formatPriceRange(min: number, max: number): string {
  if (max >= 10_000_000) {
    const lo = (min / 10_000_000).toFixed(1).replace(/\.0$/, '');
    const hi = (max / 10_000_000).toFixed(1).replace(/\.0$/, '');
    return `₹${lo} – ${hi} Cr`;
  }
  const lo = (min / 100_000).toFixed(0);
  const hi = (max / 100_000).toFixed(0);
  return `₹${lo} – ${hi}L`;
}

/** Display rupees as lakh number for form inputs (18_000_000 → "180") */
export function rupeesToLakhs(rupees: number): string {
  return (rupees / 100_000).toFixed(2).replace(/\.?0+$/, '');
}

/** Parse lakh string to rupees ("180" → 18_000_000) */
export function lakhsToRupees(lakhs: string): number {
  return parseFloat(lakhs || '0') * 100_000;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function dayName(n: number): string {
  return DAYS[n] ?? '';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
