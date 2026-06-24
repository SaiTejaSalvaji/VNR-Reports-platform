// src/components/Sidebar.tsx

import React, { useEffect, useState } from "react";

import { Link, useLocation } from "react-router-dom";

import {
  Settings,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
  BarChart3,
  Table2,
  Users,
  Database,
  Download
} from "lucide-react";

import { useAuth } from "../contexts/useAuth";
import { useMonthYear } from "../contexts/MonthYearContext";

import { useSidebar } from "../contexts/SidebarContext";

import api, { API_BASE_URL } from "../libs/api";
import Dialog from './Dialog';


interface SectionMetadata {
  id: number;
  section_key: string;
  display_name: string;
  display_order: number;
  is_new?: boolean;
}

function SidebarNavItem({ item, isActive }: { item: { id: number; name: string; icon: React.ReactNode; path: string; isSnapshot: boolean; isNew: boolean }; isActive: boolean }) {
  const [tooltip, setTooltip] = useState<{ y: number } | null>(null);

  return (
    <div
      className="relative"
      onMouseEnter={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setTooltip({ y: rect.top + rect.height / 2 });
      }}
      onMouseLeave={() => setTooltip(null)}
    >
      <Link
        to={item.path}
        className={`flex items-center gap-3 p-3 rounded-lg hover:bg-white/20 transition mb-1 ${isActive ? "bg-white/30 font-semibold" : ""}`}
      >
        <span className="shrink-0 min-w-5 text-center">{item.icon}</span>
        <span className="text-sm truncate flex-1">{item.name}</span>
        {item.isSnapshot && (
          <span className="text-[9px] font-bold uppercase tracking-widest bg-amber-400/15 text-amber-300 border border-amber-400/30 rounded-full px-1.5 py-0.5 shrink-0 ml-1">
            Snapshot
          </span>
        )}
        {item.isNew && (
          <span className="text-[9px] font-bold uppercase tracking-widest bg-sky-400/15 text-sky-300 border border-sky-400/30 rounded-full px-1.5 py-0.5 shrink-0 ml-1">
            New
          </span>
        )}
      </Link>

      {tooltip && (
        <div
          className="fixed left-64 z-[9999] pointer-events-none ml-2 tooltip-slide-in"
          style={{ top: tooltip.y }}
        >
          <div className="bg-gray-900 border border-white/10 text-white text-xs font-medium rounded-lg px-3 py-1.5 whitespace-nowrap shadow-xl">
            {item.name}
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarNavItemMinimized({ item, isActive }: { item: { id: number; name: string; icon: React.ReactNode; path: string; isSnapshot: boolean; isNew: boolean }; isActive: boolean }) {
  const [tooltip, setTooltip] = useState<{ y: number } | null>(null);

  return (
    <div
      className="relative"
      onMouseEnter={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setTooltip({ y: rect.top + rect.height / 2 });
      }}
      onMouseLeave={() => setTooltip(null)}
    >
      <Link
        to={item.path}
        className={`flex items-center justify-center p-3 rounded-lg hover:bg-white/20 transition mb-1 ${isActive ? "bg-white/30 font-semibold" : ""}`}
      >
        <span className="shrink-0 min-w-5 text-center">{item.icon}</span>
      </Link>

      {tooltip && (
        <div
          className="fixed left-16 z-[9999] pointer-events-none ml-2 tooltip-slide-in"
          style={{ top: tooltip.y }}
        >
          <div className="bg-gray-900 border border-white/10 text-white text-xs font-medium rounded-lg px-3 py-1.5 whitespace-nowrap shadow-xl">
            {item.name}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const location = useLocation();

  const { logout, user } = useAuth();

  const { isMinimized, toggleSidebar } = useSidebar();

  const [sections, setSections] = React.useState<SectionMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isDevDb, setIsDevDb] = useState(false);

  // Download report state
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadTooltip, setDownloadTooltip] = useState<{ y: number } | null>(null);

  // Use shared context — always reflects whatever ReportEditor has selected
  const { month: dlMonth, year: dlYear } = useMonthYear();
  const checkDevDb = () => {
    api.get('/env').then(res => setIsDevDb(res.data.isDevDb)).catch(() => {});
  };

  useEffect(() => {
    fetchSections();
    checkDevDb();
  }, [user]);

  const fetchSections = async () => {
    try {
      setLoading(true);
      const response = await api.get("/sections/sidebar");

      setSections(response.data.sections || []);
    } catch (error) {
      console.error("Failed to fetch sections:", error);
    } finally {
      setLoading(false);
    }
  };

  // Download department report
  const handleDownloadReport = () => {
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);

    const token = localStorage.getItem('token');

    const params = new URLSearchParams({
      month: String(dlMonth),
      year: String(dlYear),
      department_id: String(user?.department_id)
    });

    const sseUrl = `${API_BASE_URL}/reports/generate?${params.toString()}`;

    const processEvent = (eventType: string, eventData: string) => {
      try {
        const data = JSON.parse(eventData);

        if (eventType === 'progress') {
          setDownloadProgress(data.percentage);
        } else if (eventType === 'complete') {
          const byteCharacters = atob(data.data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: data.contentType });

          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', data.fileName || `${user?.department_name}_Report.docx`);

          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);

          setTimeout(() => {
            setDownloading(false);
            setDownloadProgress(0);
          }, 500);
        } else if (eventType === 'error') {
          setDownloadError(data.message || 'Download failed');
          setTimeout(() => {
            setDownloading(false);
            setDownloadProgress(0);
            setDownloadError(null);
          }, 3000);
        }
      } catch (parseError) {
        console.error('Failed to parse SSE data:', parseError);
      }
    };

    const fetchSSE = async () => {
      try {
        const response = await fetch(sseUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to connect');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = '';
        let currentEventType = '';
        let currentEventData = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              currentEventData = line.slice(5).trim();
            } else if (line === '' && currentEventType && currentEventData) {
              processEvent(currentEventType, currentEventData);
              currentEventType = '';
              currentEventData = '';
            }
          }
        }

        if (currentEventType && currentEventData) {
          processEvent(currentEventType, currentEventData);
        }
      } catch (err: any) {
        console.error('SSE error:', err);
        setDownloadError('Failed');
        setTimeout(() => {
          setDownloading(false);
          setDownloadProgress(0);
          setDownloadError(null);
        }, 3000);
      }
    };

    fetchSSE();
  };

  const handleLogout = () => {
    logout();
  }; // Create menu items from sections

  const menuItems = sections.map((section) => ({
    id: section.display_order,
    name: section.display_name,
    icon: <FileText size={20} />,
    path: `/section/${section.section_key}`,
    isSnapshot: section.section_key.startsWith('snapshot'),
    isNew: section.is_new ?? false,
  }));

  return (
    <div
      className={`h-screen bg-linear-to-b from-gray-900 to-black text-white flex flex-col transition-all duration-300 relative ${isMinimized ? "w-16" : "w-64"
        }`}
    >
      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-5 bg-gray-900 hover:bg-gray-700 text-white rounded-full p-1 shadow-lg transition-all z-10 border border-gray-700"
        title={isMinimized ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isMinimized ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Header */}
      <div className="text-lg font-bold p-4 border-b border-white/20">
        {!isMinimized ? (
          <div className="flex items-center gap-2">
            <span className="cursor-pointer" onClick={checkDevDb}>
              {user?.role === 'admin' ? 'Admin Portal' : user?.department_name || 'Portal'}
            </span>
            {isDevDb && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-1.5 py-0.5 shrink-0">
                Dev DB
              </span>
            )}
          </div>
        ) : (
          <div className="text-center cursor-pointer" onClick={checkDevDb}>
            <User size={24} />
            {isDevDb && (
              <div className="w-2 h-2 rounded-full bg-amber-400 mx-auto mt-1" title="Dev DB" />
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto scrollbar-thin">
        {/* Download Report Button - Non-Admin Only */}
        {user?.role !== "admin" && (
          <>
          <div
            className="relative"
            onMouseEnter={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setDownloadTooltip({ y: rect.top + rect.height / 2 });
            }}
            onMouseLeave={() => setDownloadTooltip(null)}
          >
            <button
              onClick={handleDownloadReport}
              disabled={downloading}
              className={`w-full relative overflow-hidden mb-3 rounded-lg transition flex items-center ${
                isMinimized ? 'justify-center p-3' : 'gap-3 px-4 py-3'
              } ${
                downloading
                  ? 'bg-blue-600/30 text-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm cursor-pointer'
              }`}
            >
              {/* Progress bar */}
              {downloading && (
                <div
                  className="absolute inset-0 bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${downloadProgress}%` }}
                />
              )}
              <Download size={20} className="relative z-10 shrink-0" />
              {!isMinimized && (
                <div className="relative z-10 flex flex-col items-start flex-1 min-w-0">
                  <span className="text-sm font-medium leading-tight">
                    {downloadError
                      ? downloadError
                      : downloading
                        ? `${downloadProgress}%`
                        : 'Download Report'}
                  </span>
                  <span className="text-[10px] opacity-60 leading-tight mt-0.5">
                    {new Date(dlYear, dlMonth - 1).toLocaleString('default', { month: 'long' })} {dlYear}
                  </span>
                </div>
              )}
            </button>

            {downloadTooltip && (
              <div
                className={`fixed z-[9999] pointer-events-none ml-2 tooltip-slide-in ${isMinimized ? 'left-16' : 'left-64'}`}
                style={{ top: downloadTooltip.y }}
              >
                <div className="bg-gray-900 border border-white/10 text-white text-xs font-medium rounded-lg px-3 py-1.5 whitespace-nowrap shadow-xl -translate-y-1/2">
                  Change month in Report Editor
                </div>
              </div>
            )}
          </div>
          </>
        )}

        {/* Admin: Stats Page */}
        {user?.role === "admin" && (
          <Link
            to="/admin/stats"
            className={`flex items-center ${isMinimized ? "justify-center" : "gap-3"} p-3 rounded-lg hover:bg-white/20 transition mb-2 ${location.pathname === "/admin/stats"
              ? "bg-white/30 font-semibold"
              : ""
              }`}
            title="Statistics"
          >
            <BarChart3 size={20} />
            {!isMinimized && <span className="text-sm">Statistics</span>}
          </Link>
        )}

        {/* Sections Navigation */}
        {loading ? (
          // Skeleton Loader
          <div className="space-y-1 animate-pulse">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={`flex items-center ${isMinimized ? "justify-center" : "gap-3"} p-3 rounded-lg`}>
                <div className="shrink-0 min-w-5 flex justify-center">
                  <div className="w-5 h-5 bg-white/10 rounded"></div>
                </div>
                {!isMinimized && (
                  <div className="h-4 bg-white/10 rounded w-full max-w-35"></div>
                )}
              </div>
            ))}
          </div>
        ) : (
          menuItems.map((item) =>
            isMinimized ? (
              <SidebarNavItemMinimized key={item.id} item={item} isActive={location.pathname === item.path} />
            ) : (
              <SidebarNavItem key={item.id} item={item} isActive={location.pathname === item.path} />
            )
          )
        )}

        {/* Admin: Manage Tables */}
        {/* {user?.role === "admin" && (
          <Link
            to="/admin/manage-tables"
            className={`flex items-center ${isMinimized ? "justify-center" : "gap-3"} p-3 rounded-lg hover:bg-white/20 transition mt-4 ${
              location.pathname === "/admin/manage-tables"
                ? "bg-white/30 font-semibold"
                : ""
            }`}
            title="Manage Tables"
          >
            <Table2 size={20} />
            {!isMinimized && <span className="text-sm">Manage Tables</span>}
          </Link>
        )} */}
        {/* Admin: Create New Table Button */}
        {/* {user?.role === "admin" && (
          <Link
            to="/admin/table-builder"
            className={`flex items-center ${isMinimized ? "justify-center" : "gap-3"} p-3 rounded-lg hover:bg-green-600/30 bg-green-600/20 transition mt-2 ${
              location.pathname === "/admin/table-builder"
                ? "bg-white/30 font-semibold"
                : ""
            }`}
            title="Create New Table"
          >
            <Plus size={20} />
            {!isMinimized && <span className="text-sm">Create Table</span>}
          </Link>
        )} */}

      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-white/20 space-y-2">


        {/* HOD: Faculty Management
        {user?.role === 'hod' && (
          <Link
            to="/faculty-management"
            className={`flex items-center ${isMinimized ? 'justify-center' : 'gap-3'} p-3 rounded-lg hover:bg-white/20 transition w-full mb-2 ${location.pathname === '/faculty-management' ? 'bg-white/30 font-semibold' : ''}`}
            title="Faculty Management"
          >
            <Users size={20} />
            {!isMinimized && <span className="text-sm">Faculty Management</span>}
          </Link>
        )} */}

        {/* Settings */}
        <Link
          to="/settings"
          className={`flex items-center ${isMinimized ? "justify-center" : "gap-3"} p-3 rounded-lg hover:bg-white/20 transition w-full`}
          title="Settings"
        >
          <Settings size={20} />
          {!isMinimized && <span className="text-sm">Settings</span>}
        </Link>

        {/* User & Logout Section */}
        {user && (
          <div className={`px-2 py-1 rounded-xl flex items-center justify-between ${isMinimized ? 'justify-center' : 'gap-3'}`}>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-indigo-600/50 flex items-center justify-center text-xs font-bold shrink-0 border border-white/10">
                {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>

              {!isMinimized && (
                <div className="text-white leading-tight min-w-0">
                  <div className="font-semibold text-sm wrap-break-word">{user.name}</div>
                  <div className="text-gray-400 font-semibold uppercase tracking-wider text-[9px] mt-0.5 shrink-0">
                    {user.role}
                  </div>
                </div>
              )}
            </div>

            {!isMinimized && (
              <button
                onClick={() => setIsLogoutOpen(true)}
                className="p-2 rounded-full hover:bg-white/20 transition shrink-0 text-gray-400 hover:text-white"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        )}

        <Dialog
          isOpen={isLogoutOpen}
          onClose={() => setIsLogoutOpen(false)}
          maxWidth="sm"
        >
          <div className="space-y-6">
            <p className="text-lg font-medium text-gray-900 text-center pt-6">
              Are you sure you want to log out?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsLogoutOpen(false);
                  handleLogout();
                }}
                className="px-6 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-lg shadow-red-200 transition-all cursor-pointer"
              >
                Yes
              </button>
            </div>
          </div>
        </Dialog>


      </div>
    </div>
  );
}