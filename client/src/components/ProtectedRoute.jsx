import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Only shows its children if the user is logged in; otherwise goes to /login
export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}