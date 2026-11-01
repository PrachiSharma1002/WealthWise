import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1>Welcome, {user?.name}! 👋</h1>
      <p>You are logged in as {user?.email}</p>
      <p>Your dashboard is coming soon.</p>
    </div>
  );
}