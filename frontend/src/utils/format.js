export const formatUZS = (amount) =>
  new Intl.NumberFormat('uz-UZ').format(Math.round(amount || 0)) + " so'm"

export const formatShort = (amount) => {
  if (amount == null) return "0"
  if (amount >= 1_000_000_000) return (amount / 1_000_000_000).toFixed(1) + " mlrd"
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(1) + " mln"
  if (amount >= 1_000) return (amount / 1_000).toFixed(0) + " ming"
  return String(amount)
}

export const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export const formatDateTime = (dateStr) => {
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const formatPhone = (phone) => {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 12) {
    return cleaned.replace(/(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})/, '+$1 $2 $3-$4-$5')
  }
  return phone
}

export const formatQuantity = (quantity, rollLength = 10) => {
  if (quantity === undefined || quantity === null) return '0 rl';
  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) return '0 rl';
  
  const wholeRolls = Math.floor(qty);
  const fractional = qty - wholeRolls;
  
  if (fractional < 0.001) {
    return `${wholeRolls} rl`;
  }
  
  const meters = Math.round(fractional * rollLength);
  if (meters === 0) {
    return `${wholeRolls} rl`;
  }
  if (wholeRolls === 0) {
    return `${meters} m`;
  }
  return `${wholeRolls} rl + ${meters} m`;
};
