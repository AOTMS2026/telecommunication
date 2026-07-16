import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../context/AuthContext';
import useTheme, { roleToTheme } from '../../hooks/useTheme';
import useBreakpoint from '../../hooks/useBreakpoint';
import { SidebarProvider } from '../../context/SidebarContext';

function LayoutInner() {
  const { user } = useAuth();
  useTheme(roleToTheme(user?.role));
  const bp = useBreakpoint();

  const topbarH = bp === 'mobile' ? 56 : 64;
  const marginLeft = bp === 'mobile' ? 0 : 48;

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif", background: 'var(--theme-surface-faint)', minHeight: '100vh', overflowX: 'hidden' }}>
      <Topbar />
      <Sidebar />
      <main
        style={{
          marginLeft,
          marginTop: topbarH,
          minHeight: `calc(100vh - ${topbarH}px)`,
          width: `calc(100% - ${marginLeft}px)`,
          maxWidth: `calc(100% - ${marginLeft}px)`,
          overflowY: 'auto',
          overflowX: 'hidden',
          boxSizing: 'border-box',
          transition: 'margin-left 0.22s ease, width 0.22s ease',
        }}
      >
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function Layout() {
  return (
    <SidebarProvider>
      <LayoutInner />
    </SidebarProvider>
  );
}