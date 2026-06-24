import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, FileText, TrendingUp, Database, Building2, AlertTriangle, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Download, FileDown, X } from 'lucide-react';
import CountUp from 'react-countup';
import api, { API_BASE_URL, isMaintenanceError } from '../libs/api';
import { useAuth } from '../contexts/useAuth';
import DropdownCombobox from '../components/DropdownCombobox';

interface DepartmentStat {
  id: number;
  name: string;
  faculty_count: number;
  hod_count: number;
  total_entries: number;
  table_contributions: { [key: string]: number };
}

interface AdminStatsData {
  summary: {
    total_tables: number;
    total_departments: number;
    total_users: number;
    total_faculty: number;
    total_hods: number;
    total_entries: number;
  };
  department_stats: DepartmentStat[];
  inactive_departments: { id: number; name: string }[];
  table_stats: {
    table_name: string;
    display_name: string;
    total_entries: number;
    departments_contributed: number;
  }[];
}

const COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1', '#84CC16'];

export default function AdminStats() {
  const [stats, setStats] = useState<AdminStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [generatingSnapshot, setGeneratingSnapshot] = useState(false);
  const [snapshotProgress, setSnapshotProgress] = useState(0);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [downloadingMTP, setDownloadingMTP] = useState(false);
  const [mtpDocError, setMtpDocError] = useState<string | null>(null);
  const [mtpDepartmentId, setMtpDepartmentId] = useState<number | null>(null);
  const [mtpDocuments, setMtpDocuments] = useState<any[]>([]);
  const [loadingMtpDocs, setLoadingMtpDocs] = useState(false);
  const [showMtpDocuments, setShowMtpDocuments] = useState(false);
  const { user } = useAuth();

  // Calculate default month and year based on current date
  const getDefaultMonthYear = () => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // If we're on or before the 9th, default to previous month
    if (currentDay <= 9) {
      if (currentMonth === 1) {
        return { month: 12, year: currentYear - 1 };
      } else {
        return { month: currentMonth - 1, year: currentYear };
      }
    }
    return { month: currentMonth, year: currentYear };
  };

  const defaultMonthYear = getDefaultMonthYear();
  const currentDate = new Date();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedMonth, setSelectedMonthState] = useState(() => {
    const p = Number(searchParams.get('month'));
    return p >= 1 && p <= 12 ? p : defaultMonthYear.month;
  });
  const [selectedYear, setSelectedYearState] = useState(() => {
    const p = Number(searchParams.get('year'));
    return p >= 2000 && p <= 2100 ? p : defaultMonthYear.year;
  });

  const setSelectedMonth = (m: number) => {
    setSelectedMonthState(m);
    setSearchParams(prev => { prev.set('month', String(m)); prev.set('year', String(selectedYear)); return prev; }, { replace: true });
  };
  const setSelectedYear = (y: number) => {
    setSelectedYearState(y);
    setSearchParams(prev => { prev.set('month', String(selectedMonth)); prev.set('year', String(y)); return prev; }, { replace: true });
  };

  // Adjust month if it exceeds current month when viewing current year
  useEffect(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (selectedYear === currentYear && selectedMonth > currentMonth) {
      setSelectedMonth(currentMonth);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchStats();
    fetchMTPDocuments();
  }, [selectedMonth, selectedYear, mtpDepartmentId]);

  // Fetch MTP department ID on mount
  useEffect(() => {
    const fetchMTPDepartmentId = async () => {
      try {
        const response = await api.get('/auth/departments');
        const mtpDept = response.data.data.find((dept: any) => dept.name === 'MTP');
        if (mtpDept) {
          setMtpDepartmentId(mtpDept.id);
        }
      } catch (err) {
        console.error('Failed to fetch MTP department:', err);
      }
    };

    fetchMTPDepartmentId();
  }, []);

  // Close MTP documents dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMtpDocuments) {
        const target = event.target as HTMLElement;
        if (!target.closest('.mtp-dropdown-container')) {
          setShowMtpDocuments(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMtpDocuments]);

  // Navigate to previous month
  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  // Navigate to next month
  const goToNextMonth = () => {
    const isDefaultMonth = selectedMonth === defaultMonthYear.month && selectedYear === defaultMonthYear.year;
    if (isDefaultMonth) return;

    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Check if next month navigation should be disabled (can't go beyond default month)
  const isNextDisabled = selectedMonth === defaultMonthYear.month && selectedYear === defaultMonthYear.year;

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tables/admin/stats', {
        params: {
          month: selectedMonth,
          year: selectedYear
        }
      });
      setStats(response.data);
      setError(null);
      setIsMaintenance(false);
    } catch (err: any) {
      console.error('Failed to fetch admin stats:', err);
      setIsMaintenance(isMaintenanceError(err));
      setError(err.message || err.response?.data?.error || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchMTPDocuments = async () => {
    if (!mtpDepartmentId) {
      setMtpDocuments([]);
      return;
    }

    try {
      setLoadingMtpDocs(true);
      setMtpDocError(null);

      const params = new URLSearchParams({
        section_key: 'mtp_activities',
        month: String(selectedMonth),
        year: String(selectedYear),
        department_id: String(mtpDepartmentId)
      });

      const response = await api.get(`/documents?${params.toString()}`);

      // Set documents array (backend now returns { documents: [...] })
      setMtpDocuments(response.data.documents || []);
    } catch (err: any) {
      // 404 or error means no documents exist
      if (err.response?.status === 404) {
        setMtpDocuments([]);
      } else {
        console.error('Failed to fetch MTP documents:', err);
        setMtpDocuments([]);
      }
    } finally {
      setLoadingMtpDocs(false);
    }
  };

  const handleDownloadReport = () => {
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);

    const token = localStorage.getItem('token');
    const params = new URLSearchParams({
      month: String(selectedMonth),
      year: String(selectedYear)
      // No department_id - download all departments
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

          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const fileName = data.fileName || `VNR_Institute_Report_${monthNames[selectedMonth - 1]}_${selectedYear}.docx`;
          link.setAttribute('download', fileName);

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
        setDownloadError('Connection failed');
        setTimeout(() => {
          setDownloading(false);
          setDownloadProgress(0);
          setDownloadError(null);
        }, 3000);
      }
    };

    fetchSSE();
  };

  const handleGenerateSnapshot = () => {
    setGeneratingSnapshot(true);
    setSnapshotProgress(0);
    setSnapshotError(null);

    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ month: String(selectedMonth), year: String(selectedYear) });
    const url = `${API_BASE_URL}/reports/snapshot/generate?${params}`;

    (async () => {
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }
        });
        if (!response.ok) throw new Error('Failed to connect');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error('No response body');

        let buffer = '', eventType = '', eventData = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim();
            else if (line.startsWith('data:')) eventData = line.slice(5).trim();
            else if (line === '' && eventType && eventData) {
              try {
                const data = JSON.parse(eventData);
                if (eventType === 'progress') {
                  setSnapshotProgress(data.percentage);
                } else if (eventType === 'complete') {
                  const bytes = atob(data.data);
                  const arr = new Uint8Array(bytes.length);
                  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                  const blob = new Blob([arr], { type: data.contentType });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = data.fileName || `VNRVJIET_Snapshot_${selectedMonth}_${selectedYear}.docx`;
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  URL.revokeObjectURL(link.href);
                  setTimeout(() => { setGeneratingSnapshot(false); setSnapshotProgress(0); }, 1500);
                } else if (eventType === 'error') {
                  setSnapshotError(data.message || 'Generation failed');
                  setTimeout(() => { setGeneratingSnapshot(false); setSnapshotProgress(0); setSnapshotError(null); }, 3000);
                }
              } catch { /* ignore parse errors */ }
              eventType = ''; eventData = '';
            }
          }
        }
      } catch (err: any) {
        setSnapshotError('Connection failed');
        setTimeout(() => { setGeneratingSnapshot(false); setSnapshotProgress(0); setSnapshotError(null); }, 3000);
      }
    })();
  };

  const handleDownloadMTPDocument = async (documentId: number, fileName: string) => {
    setDownloadingMTP(true);
    setMtpDocError(null);

    try {
      const params = new URLSearchParams({
        document_id: String(documentId)
      });

      // Get signed download URL from backend
      const response = await api.get(`/documents/download-url?${params.toString()}`);
      const { downloadUrl } = response.data;

      // Download file directly from GCS
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', fileName);
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Close dropdown after successful download
      setShowMtpDocuments(false);

    } catch (error: any) {
      console.error('Failed to download MTP document:', error);
      const errorMsg = error.response?.status === 404
        ? 'Document not found'
        : 'Failed to download document';
      setMtpDocError(errorMsg);
      setTimeout(() => setMtpDocError(null), 5000);
    } finally {
      setDownloadingMTP(false);
    }
  };

  // Generate month options
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  // Filter months based on selected year - only show up to current month for current year
  const getAvailableMonths = () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (selectedYear === currentYear) {
      return months.filter(m => m.value <= currentMonth);
    }
    return months;
  };

  // Generate year options (current year and past 2 years)
  const MIN_YEAR = 2025;
  const MAX_YEAR = defaultMonthYear.year;

  const years = Array.from(
    { length: MAX_YEAR - MIN_YEAR + 1 },
    (_, i) => {
      const year = MIN_YEAR + i;
      return { value: year, label: year.toString() };
    }
  );

  // Prepare data for charts (only when stats is available)
  const departmentEntriesData = stats?.department_stats
    ?.filter(dept => dept.total_entries > 0)
    ?.map(dept => ({
      name: dept.name,
      entries: dept.total_entries,
      faculty: dept.faculty_count
    }))
    ?.sort((a, b) => b.entries - a.entries)
    ?.slice(0, 10) || [];

  const pieData = stats?.department_stats
    ?.filter(dept => dept.total_entries > 0)
    ?.map(dept => ({
      name: dept.name,
      value: dept.total_entries
    })) || [];

  const tableContributionData = stats?.table_stats?.map(table => ({
    name: table.display_name,
    entries: table.total_entries,
    departments: table.departments_contributed
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200">
        {/* Title row */}
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Institute Statistics</h1>
          <p className="text-gray-500 mt-1 text-sm">Download and generate institute reports by month</p>
        </div>

        {/* Controls row — month nav + all buttons */}
        <div className="flex flex-wrap gap-3 items-center pt-4 border-t border-gray-100">
          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousMonth}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition"
              title="Previous month"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-32">
                <DropdownCombobox
                  options={getAvailableMonths()}
                  value={selectedMonth}
                  onChange={(value) => setSelectedMonth(Number(value))}
                  placeholder="Month"
                  disableSearch={true}
                />
              </div>
              <div className="w-22">
                <DropdownCombobox
                  options={years}
                  value={selectedYear}
                  onChange={(value) => setSelectedYear(Number(value))}
                  placeholder="Year"
                  disableSearch={true}
                />
              </div>
            </div>

            <button
              onClick={goToNextMonth}
              disabled={isNextDisabled}
              className={`p-2 rounded-lg border transition ${isNextDisabled
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                : 'border-gray-300 hover:bg-gray-100'
                }`}
              title={isNextDisabled ? "Can't go beyond current month" : "Next month"}
            >
              <ChevronRight size={20} className={isNextDisabled ? 'text-gray-300' : 'text-gray-600'} />
            </button>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-gray-200" />

          {/* Institute Report Download */}
          <button
            onClick={handleDownloadReport}
            disabled={downloading}
            className={`w-48 relative overflow-hidden px-6 py-2.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-2 ${downloading
              ? 'bg-gray-200 text-gray-500'
              : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            title="Download institute-wide monthly report"
          >
            {downloading && (
              <div
                className="absolute inset-0 bg-blue-400 transition-all duration-300 ease-out"
                style={{ width: `${downloadProgress}%` }}
              />
            )}
            <Download size={18} className="relative z-10" />
            <span className="relative z-10 text-sm font-medium">
              {downloadError
                ? downloadError
                : downloading
                  ? `${downloadProgress}%`
                  : 'Download Report'}
            </span>
          </button>

          {/* Snapshot Report Generate */}
          <button
            onClick={handleGenerateSnapshot}
            disabled={generatingSnapshot}
            className={`w-48 relative overflow-hidden px-6 py-2.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-2 ${generatingSnapshot
              ? 'bg-gray-200 text-gray-500'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            title="Generate snapshot report"
          >
            {generatingSnapshot && (
              <div
                className="absolute inset-0 bg-indigo-400 transition-all duration-300 ease-out"
                style={{ width: `${snapshotProgress}%` }}
              />
            )}
            <FileDown size={18} className="relative z-10" />
            <span className="relative z-10 text-sm font-medium">
              {snapshotError
                ? snapshotError
                : generatingSnapshot
                  ? `${snapshotProgress}%`
                  : 'Snapshot Report'}
            </span>
          </button>

          {/* MTP Placement Documents Button */}
          <div className="relative mtp-dropdown-container">
            <button
              onClick={() => setShowMtpDocuments(!showMtpDocuments)}
              disabled={loadingMtpDocs || !mtpDepartmentId || mtpDocuments.length === 0}
              className={`w-45 px-6 py-2.5 rounded-lg transition flex items-center justify-center gap-2 ${loadingMtpDocs
                  ? 'bg-gray-200 text-gray-500 cursor-wait'
                  : !mtpDepartmentId || mtpDocuments.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm'
                }`}
              title={
                !mtpDepartmentId
                  ? 'Loading MTP department...'
                  : loadingMtpDocs
                    ? 'Loading documents...'
                    : mtpDocuments.length === 0
                      ? 'No MTP documents available for this period'
                      : `View ${mtpDocuments.length} MTP document${mtpDocuments.length > 1 ? 's' : ''}`
              }
            >
              {loadingMtpDocs ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
                  <span className="text-sm font-medium">Loading...</span>
                </>
              ) : mtpDocuments.length === 0 ? (
                <>
                  <FileDown size={18} />
                  <span className="text-sm font-medium">No Documents</span>
                </>
              ) : (
                <>
                  <FileDown size={18} />
                  <span className="text-sm font-medium">
                    MTP Docs ({mtpDocuments.length})
                  </span>
                </>
              )}
            </button>

            {/* MTP Documents Dropdown */}
            {showMtpDocuments && mtpDocuments.length > 0 && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">MTP Documents</h3>
                  <button
                    onClick={() => setShowMtpDocuments(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-2">
                  {mtpDocuments.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => handleDownloadMTPDocument(doc.id, doc.file_name)}
                      disabled={downloadingMTP}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition text-left"
                    >
                      <FileText className="text-blue-600 flex-shrink-0" size={20} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate text-sm">
                          {doc.file_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(doc.uploaded_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <Download className="text-gray-400 flex-shrink-0" size={16} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Messages */}
        {mtpDocError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertTriangle size={16} />
            <span className="text-sm">{mtpDocError}</span>
            <button onClick={() => setMtpDocError(null)} className="ml-auto text-red-500 hover:text-red-700 font-bold">&times;</button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-3 border-blue-100"></div>
            <div className="absolute top-0 left-0 h-10 w-10 animate-spin rounded-full border-3 border-transparent border-t-blue-600"></div>
          </div>
          <p className="mt-3 text-sm text-gray-500">Loading statistics...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {isMaintenance ? (
            <>
              <div className="bg-amber-50 p-3 rounded-full mb-3">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <p className="text-gray-900 font-medium mb-1">Under Maintenance</p>
              <p className="text-gray-500 text-sm mb-4">{error}</p>
            </>
          ) : (
            <>
              <p className="text-gray-900 font-medium mb-1">Something went wrong</p>
              <p className="text-gray-500 text-sm mb-4">{error}</p>
              <button
                onClick={fetchStats}
                className="text-sm text-blue-600 underline hover:no-underline"
              >
                Retry
              </button>
            </>
          )}
        </div>
      )}

      {/* Content - only show when not loading and no error */}
      {!loading && !error && stats && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Total Tables */}
            <div className="bg-linear-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-xs font-medium">Tables</p>
                  <h3 className="text-3xl font-bold mt-1">
                    <CountUp end={stats.summary.total_tables} duration={1.5} />
                  </h3>
                </div>
                <Database size={28} className="text-indigo-200" />
              </div>
            </div>

            {/* Total Departments */}
            <div className="bg-linear-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-cyan-100 text-xs font-medium">Departments</p>
                  <h3 className="text-3xl font-bold mt-1">
                    <CountUp end={stats.summary.total_departments} duration={1.5} />
                  </h3>
                </div>
                <Building2 size={28} className="text-cyan-200" />
              </div>
            </div>

            {/* Total Users */}
            <div className="bg-linear-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-xs font-medium">Total Users</p>
                  <h3 className="text-3xl font-bold mt-1">
                    <CountUp end={stats.summary.total_users} duration={1.5} />
                  </h3>
                </div>
                <Users size={28} className="text-emerald-200" />
              </div>
            </div>

            {/* Faculty Count */}
            <div className="bg-linear-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-xs font-medium">Faculty</p>
                  <h3 className="text-3xl font-bold mt-1">
                    <CountUp end={stats.summary.total_faculty} duration={1.5} />
                  </h3>
                </div>
                <Users size={28} className="text-amber-200" />
              </div>
            </div>

            {/* HODs Count */}
            <div className="bg-linear-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-xs font-medium">HODs</p>
                  <h3 className="text-3xl font-bold mt-1">
                    <CountUp end={stats.summary.total_hods} duration={1.5} />
                  </h3>
                </div>
                <Users size={28} className="text-purple-200" />
              </div>
            </div>
          </div>


          {/* Department Details Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Department Details</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Faculty
                    </th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      HODs
                    </th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Entries
                    </th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.department_stats.map((dept) => (
                    <tr key={dept.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">

                          <span className="text-sm font-medium text-gray-900">{dept.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                        {dept.faculty_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                        {dept.hod_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <span className={`font-semibold ${dept.total_entries > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                          {dept.total_entries}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        {dept.total_entries == 0 && dept.name != 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircle size={12} />
                            Inactive
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 size={12} />
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}