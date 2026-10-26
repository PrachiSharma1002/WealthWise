import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Still checking whether a saved token is valid, so wait
  if (loading) {
    return <p style={{ padding: 32 }}>Loading...</p>;
  }

  // Nobody is logged in, so send them to the login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in, so show the page
  return children;
}