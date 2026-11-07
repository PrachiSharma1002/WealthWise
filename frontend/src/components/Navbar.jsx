import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <span className="navbar-brand">WealthWise</span>
        <NavLink to="/dashboard" className="navbar-link">
          Dashboard
        </NavLink>
        <NavLink to="/transactions" className="navbar-link">
          Transactions
        </NavLink>
        <NavLink to="/budgets" className="navbar-link">
          Budgets
        </NavLink>
        <NavLink to="/goals" className="navbar-link">
          Goals
        </NavLink>
        <NavLink to="/insights" className="navbar-link">
          Insights
        </NavLink>
        <NavLink to="/notifications" className="navbar-link">
          Notifications
        </NavLink>
        <NavLink to="/categories" className="navbar-link">
          Categories
        </NavLink>
      </div>
      <div className="navbar-right">
        <span className="navbar-user">{user?.name}</span>
                <NotificationBell />
        <button className="navbar-logout" onClick={logout}>
          Log out
        </button>
      </div>
    </nav>
  );
}