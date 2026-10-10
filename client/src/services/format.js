// Helpers for showing money and dates.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 1500 -> ₹1,500   |   1500.5 -> ₹1,500.50
export function formatMoney(value) {
  const n = Math.abs(Number(value) || 0);
  const hasPaise = Math.round(n * 100) % 100 !== 0;
  return (
    '₹' +
    n.toLocaleString('en-IN', {
      minimumFractionDigits: hasPaise ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

// "2026-10-09" -> "09 Oct 2026"
export function formatDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '-';
  const [y, m, d] = iso.split('-');
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

// Today's date as YYYY-MM-DD in the user's local time
export function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Which colour class to use for a balance
// positive = customer owes money (red), zero = settled (green), negative = paid extra
export function balanceClass(balance) {
  if (balance > 0) return 'amount-due';
  if (balance < 0) return 'amount-excess';
  return 'amount-clear';
}

export function balanceLabel(balance) {
  if (balance > 0) return 'Due';
  if (balance < 0) return 'Advance';
  return 'Settled';
}