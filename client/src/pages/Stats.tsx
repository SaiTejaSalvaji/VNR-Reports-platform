import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, UserX, AlertTriangle } from 'lucide-react';
import api, { isMaintenanceError } from '../libs/api';
import { useAuth } from '../contexts/useAuth';
import DropdownCombobox from '../components/DropdownCombobox';

interface StatsSummary {
  faculty_count: number;
}

interface InactiveFaculty {
  id: string;
  name: string;
}

interface StatsData {
  summary: StatsSummary;
  inactive_faculty: InactiveFaculty[];
}

export default function Stats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [totalFacultyCount, setTotalFacultyCount] = useState<number>(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect admin users to admin stats page
  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin/stats', { replace: true });
    }
  }, [user, navigate]);

  // Allow both hod and reports-incharge to access this page
  const canAccessStats = user?.role === 'hod' || user?.role === 'reports-incharge';

  // Month filter state - default to current month
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  useEffect(() => {
    // Only fetch if user has access (hod or reports-incharge)
    if (!canAccessStats) return;
    fetchStats();
  }, [selectedMonth, selectedYear, canAccessStats]);

  // Fetch total faculty count once (independent of month/year)
  useEffect(() => {
    // Only fetch if user has access (hod or reports-incharge)
    if (!canAccessStats) return;
    fetchTotalFacultyCount();
  }, [canAccessStats]);

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
    // Don't allow going beyond current month
    const isCurrentMonth = selectedMonth === currentDate.getMonth() + 1 && selectedYear === currentDate.getFullYear();
    if (isCurrentMonth) return;

    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Check if next month navigation should be disabled
  const isNextDisabled = selectedMonth === currentDate.getMonth() + 1 && selectedYear === currentDate.getFullYear();

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tables/hod/stats', {
        params: {
          month: selectedMonth,
          year: selectedYear
        }
      });
      setStats(response.data);
      setError(null);
      setIsMaintenance(false);
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
      setIsMaintenance(isMaintenanceError(err));
      setError(err.message || err.response?.data?.error || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchTotalFacultyCount = async () => {
    try {
      const response = await api.get('/tables/hod/stats', {
        params: {
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear()
        }
      });
      setTotalFacultyCount(response.data.summary?.faculty_count || 0);
    } catch (err: any) {
      console.error('Failed to fetch total faculty count:', err);
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

  // Generate year options (current year and past 2 years)
  const years = Array.from({ length: 3 }, (_, i) => ({
    value: currentDate.getFullYear() - i,
    label: String(currentDate.getFullYear() - i)
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with Month Filter */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Department Overview</h1>
              <p className="text-gray-500 mt-1">
                {user?.department_name}
              </p>
            </div>
            {/* Total Faculty Count - Fixed */}
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-b-blue-100-200">
              <div className="flex flex-col">
                <span className="text-sm font-bold">
                  Total Faculty: {totalFacultyCount}
                </span>
              </div>
            </div>
          </div>

          {/* Month Navigation */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
              <button
                onClick={goToPreviousMonth}
                className="p-2 rounded-md hover:bg-white hover:shadow-sm text-gray-500 hover:text-gray-900 transition-all duration-200"
                title="Previous month"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex items-center gap-2">
                <div className="w-32">
                  <DropdownCombobox
                    options={months}
                    value={selectedMonth}
                    onChange={(value) => setSelectedMonth(Number(value))}
                    placeholder="Month"
                    disableSearch={true}
                  />
                </div>
                <div className="w-24">
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
                className={`p-2 rounded-md transition-all duration-200 ${isNextDisabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-500 hover:bg-white hover:shadow-sm hover:text-gray-900'
                  }`}
                title={isNextDisabled ? "Current month" : "Next month"}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-sm text-gray-500 font-medium">Loading data...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
          {isMaintenance ? (
            <>
              <div className="bg-amber-50 p-3 rounded-full mb-3">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="text-gray-900 font-medium">Under Maintenance</h3>
              <p className="text-gray-500 text-sm mt-1 mb-4">{error}</p>
            </>
          ) : (
            <>
              <div className="bg-red-50 p-3 rounded-full mb-3">
                <UserX className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-gray-900 font-medium">Unable to load statistics</h3>
              <p className="text-gray-500 text-sm mt-1 mb-4">{error}</p>
              <button
                onClick={fetchStats}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      )}

      {!loading && !error && stats && (
        <div className="grid grid-cols-1 gap-6">
          {/* Stats content removed - page now shows only header */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-12 text-center">
              <h2 className="text-lg font-medium text-gray-500">Department Statistics</h2>
              <p className="text-sm text-gray-400 mt-2">
                Overview for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
