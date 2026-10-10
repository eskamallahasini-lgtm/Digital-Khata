// Shows a payment-behaviour tag. risk comes from the server: 'reliable' | 'sometimes' | 'late' | null
const MAP = {
  reliable: ['badge-green', 'Reliable'],
  sometimes: ['badge-amber', 'Sometimes late'],
  late: ['badge-red', 'Often late'],
};

export default function RiskBadge({ risk }) {
  if (!risk || !MAP[risk]) return null;
  const [cls, label] = MAP[risk];
  return <span className={`badge ${cls}`}>{label}</span>;
}
