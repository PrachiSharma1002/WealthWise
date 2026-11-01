import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        <Outlet />
      </main>
    </>
  );
}