export default function Spinner({ text = 'Loading...' }) {
  return (
    <div className="spinner-wrap" role="status">
      <div className="spinner"></div>
      <span>{text}</span>
    </div>
  );
}