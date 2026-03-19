export function formatCurrency(amount: number, locale = 'ar-SA'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string, locale = 'ar-SA'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('966') && cleaned.length === 12) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }
  return phone;
}
