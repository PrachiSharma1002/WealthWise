import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: 32 }}>
      <h1>Welcome, {user?.name}! 👋</h1>
      <p>You are logged in as {user?.email}</p>
      <p>Your dashboard is coming soon.</p>
      <button
        onClick={logout}
        style={{
          padding: '10px 20px',
          background: '#dc2626',
          color: '#ffffff',
          border: 'none',
          borderRadius: 8,
          fontSize: 15,
          cursor: 'pointer',
        }}
      >
        Log out
      </button>
    </div>
  );
}