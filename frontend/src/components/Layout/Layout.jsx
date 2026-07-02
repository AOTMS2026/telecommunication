import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../context/AuthContext';
import useTheme, { roleToTheme } from '../../hooks/useTheme';

export default function Layout() {
  const { user } = useAuth();
  useTheme(roleToTheme(user?.role));

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif", background: 'var(--theme-surface-faint)', minHeight: '100vh' }}>
      <Topbar />
      <Sidebar />
      <main style={{ marginLeft: 48, marginTop: 64, minHeight: 'calc(100vh - 64px)', overflowY: 'auto' }}>
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}