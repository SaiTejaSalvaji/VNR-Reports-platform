import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';

export default function Layout() {
  const { isMinimized } = useSidebar();

  return (
    <div className="flex min-h-screen">
      {/* This container makes the sidebar fixed and full height */}
      <div className="fixed top-0 left-0 h-full z-30">
        <Sidebar />
      </div>

      {/* This main content area has a left margin that responds to sidebar state */}
      <main
        className={`flex-1 p-4 lg:p-8 w-full transition-all duration-300 ${
          isMinimized ? 'ml-16' : 'ml-64'
        }`}
      >
        <div className="max-w-6xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}