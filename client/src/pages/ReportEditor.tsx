import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/useAuth';
import { useMonthYear } from '../contexts/MonthYearContext';
import { useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api, { isMaintenanceError } from '../libs/api';
import {
  Save,
  Send,
  Calendar as CalendarIcon,
  Info,
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
  CloudUpload,
  ClipboardCopy
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import DropdownCombobox from '../components/DropdownCombobox';
import TiptapEditor from '../components/TiptapEditor';
import WordUpload from '../components/WordUpload';
import DeadlineNotification from '../components/DeadlineNotification';

interface Section {
  id: number;
  section_key: string;
  display_name: string;
  section_type: 'records' | 'single_value' | 'rich_text' | 'nested' | 'fixed_table';
  display_order: number;
  columns: any[];
  fixed_rows?: string[];
  sub_sections: any[];
  accessible_by?: string[];
  config?: { labels?: Record<string, string>; [key: string]: any };
}

// MTP section that needs Word document upload (in addition to records table)
const MTP_SECTION = 20;

// Check if a section is the MTP section
const isMTPSection = (sectionOrder: number): boolean => {
  return sectionOrder === MTP_SECTION;
};

const ReportEditor: React.FC = () => {
  const { user } = useAuth();
  const { setMonth: setMonthCtx, setYear: setYearCtx } = useMonthYear();
  const location = useLocation();
  const navigate = useNavigate();
  const { sectionKey } = useParams<{ sectionKey: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [displayedSections, setDisplayedSections] = useState<Section[]>([]);
  const [reportData, setReportData] = useState<any>({});
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [reportDataLoading, setReportDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Admin: Department selection
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [selectedDepartmentName, setSelectedDepartmentName] = useState<string>('');

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

  // Read month/year from URL search params, falling back to defaults
  const defaultMonthYear = getDefaultMonthYear();
  const paramMonth = searchParams.get('month');
  const paramYear = searchParams.get('year');
  const [month, setMonthState] = useState(() => {
    const m = paramMonth ? parseInt(paramMonth) : defaultMonthYear.month;
    return m >= 1 && m <= 12 ? m : defaultMonthYear.month;
  });
  const [year, setYearState] = useState(() => {
    const y = paramYear ? parseInt(paramYear) : defaultMonthYear.year;
    return y >= 2025 ? y : defaultMonthYear.year;
  });

  // Sync initial month/year into context on mount so Sidebar has correct values immediately
  useEffect(() => {
    setMonthCtx(month);
    setYearCtx(year);
  }, [month, year]);

  // Sync month/year to URL search params and shared context
  const setMonth = (m: number) => {
    setMonthState(m);
    setMonthCtx(m);
    setSearchParams(prev => { prev.set('month', String(m)); prev.set('year', String(year)); return prev; }, { replace: true });
  };
  const setYear = (y: number) => {
    setYearState(y);
    setYearCtx(y);
    setSearchParams(prev => { prev.set('month', String(month)); prev.set('year', String(y)); return prev; }, { replace: true });
  };

  // Ensure URL always has month/year params (on initial load & sidebar navigation)
  useEffect(() => {
    if (!searchParams.get('month') || !searchParams.get('year')) {
      setSearchParams(prev => { prev.set('month', String(month)); prev.set('year', String(year)); return prev; }, { replace: true });
    }
  }, [sectionKey]);

  const initialScrollDone = useRef(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [success, setSuccess] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const lastSavedDataRef = useRef<any>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const reportDataRef = useRef<any>(reportData);
  reportDataRef.current = reportData;

  const currentDate = new Date();

  const currentSection = allSections.find(s => s.section_key === sectionKey);
  const isAdminOnlySection = currentSection?.accessible_by?.includes('dept:ADMIN') ?? false;

  useEffect(() => {
    // For non-admins, use their own department (only on user change)
    if (user?.role !== 'admin') {
      setSelectedDepartmentId(user?.department_id ?? null);
      setSelectedDepartmentName(user?.department_name ?? '');
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchSections(month, year);
  }, [user, month, year]);

  // For admin: fetch departments when section, month, or year changes
  useEffect(() => {
    if (user?.role === 'admin' && sectionKey && month && year) {
      fetchDepartments();
    }
  }, [user?.role, sectionKey, month, year]);

  // Ref to track if initial scroll has happened

  useEffect(() => {
    if (allSections.length > 0) {
      if (sectionKey) {
        const filtered = allSections.filter(s => s.section_key === sectionKey);

        // If section exists and user has access, show it
        if (filtered.length > 0) {
          setDisplayedSections(filtered);
        } else {
          // Section not found or not accessible - redirect to first accessible section
          navigate(`/section/${allSections[0].section_key}`, { replace: true });
        }
      } else if (allSections[0]) {
        // Redirect to the first section if none specified
        navigate(`/section/${allSections[0].section_key}`, { replace: true });
      }
    }
  }, [sectionKey, allSections, navigate]);

  useEffect(() => {
    if (allSections.length > 0 && selectedDepartmentId) {
      fetchReportData();
    }
  }, [allSections, month, year, selectedDepartmentId]);

  // Adjust month if it exceeds current month when viewing current year
  useEffect(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (year === currentYear && month > currentMonth) {
      setMonth(currentMonth);
    }
  }, [year]);

  useEffect(() => {
    if (!lastSavedDataRef.current) return;

    const current = JSON.stringify(reportData);
    const changed = current !== lastSavedDataRef.current;
    console.log('Change detection:', {
      changed,
      currentKeys: Object.keys(reportData),
      savedKeys: Object.keys(JSON.parse(lastSavedDataRef.current))
    });
    setHasChanges(changed);
  }, [reportData]);

  const fetchSections = async (m?: number, y?: number) => {
    try {
      setSectionsLoading(true);
      const params = m && y ? { month: m, year: y } : {};
      const response = await api.get('/sections', { params });
      if (response.data && Array.isArray(response.data.sections)) {
        setAllSections(response.data.sections);
      } else {
        setAllSections([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch sections:', error);
      setIsMaintenanceMode(isMaintenanceError(error));
      setFetchError(error.message || 'Failed to load sections');
    } finally {
      setSectionsLoading(false);
    }
  };

  const fetchDepartments = async () => {
    if (!sectionKey) {
      console.warn('No section key available yet');
      return;
    }

    try {
      setDepartmentsLoading(true);

      const response = await api.get('/reports/departments-with-data', {
        params: {
          section_key: sectionKey,
          month,
          year
        }
      });

      if (response.data && Array.isArray(response.data.departments)) {
        const depts = response.data.departments;
        console.log('Fetched departments with data for section', sectionKey, ':', depts);
        setDepartments(depts);

        // Auto-select first department if available
        if (depts.length > 0) {
          setSelectedDepartmentId(depts[0].id);
          setSelectedDepartmentName(depts[0].name);
          console.log('Auto-selected first dept:', depts[0]);
        } else {
          // For dept:ADMIN sections with no data yet, let the admin enter data directly
          const currentSection = allSections.find(s => s.section_key === sectionKey);
          const isAdminOnlySection = currentSection?.accessible_by?.includes('dept:ADMIN');
          if (isAdminOnlySection && user?.role === 'admin' && user?.department_id) {
            setSelectedDepartmentId(user.department_id);
            setSelectedDepartmentName(user.department_name ?? 'ADMIN');
          } else {
            setSelectedDepartmentId(null);
            setSelectedDepartmentName('');
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    } finally {
      setDepartmentsLoading(false);
    }
  };

  const fetchReportData = async () => {
    if (!selectedDepartmentId) return;

    try {
      setReportDataLoading(true);
      const response = await api.get(`/reports?month=${month}&year=${year}&department_id=${selectedDepartmentId}`);
      const data = response.data.report?.report_data || {};
      setReportData(data);
      lastSavedDataRef.current = JSON.stringify(data);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to fetch report data:', error);
    } finally {
      setReportDataLoading(false);
    }
  };

  const handleSave = useCallback(async () => {
    const currentReportData = reportDataRef.current;
    console.log('handleSave called, selectedDepartmentId:', selectedDepartmentId);
    if (!selectedDepartmentId) {
      console.warn('Cannot save: No department selected');
      return;
    }

    setSaving(true);
    try {
      await api.post('/reports/save', {
        department_id: selectedDepartmentId,
        month,
        year,
        report_data: currentReportData
      });
      console.log('Save successful'); // Debug log
      setSuccess(true);
      setIsEditing(false);
      lastSavedDataRef.current = JSON.stringify(currentReportData);
      setHasChanges(false);

      setTimeout(() => setSuccess(false), 1500);
    } catch (error) {
      console.error('Failed to save report:', error);
    } finally {
      setSaving(false);
    }
  }, [selectedDepartmentId, month, year]);

  const handleCancelEdit = () => {
    if (!lastSavedDataRef.current) return;

    const previousData = JSON.parse(lastSavedDataRef.current);

    setReportData(previousData); // revert changes
    setHasChanges(false); // no unsaved changes
    setIsEditing(false); // back to view mode
  };

  // Navigate to previous month
  const goToPreviousMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  // Navigate to next month
  const goToNextMonth = () => {
    // Don't allow going beyond current month
    const isCurrentMonth = month === currentDate.getMonth() + 1 && year === currentDate.getFullYear();
    if (isCurrentMonth) return;

    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  // Check if next month navigation should be disabled
  const isNextDisabled = month === currentDate.getMonth() + 1 && year === currentDate.getFullYear();

  const updateData = (sectionKey: string, value: any) => {
    console.log('updateData called:', { sectionKey, value });
    setReportData((prev: any) => {
      const updated = {
        ...prev,
        [sectionKey]: value
      };
      console.log('New reportData:', updated);
      return updated;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        const currentlyChanged = lastSavedDataRef.current !== null &&
          JSON.stringify(reportDataRef.current) !== lastSavedDataRef.current;
        console.log('Ctrl+S detected:', { isEditing, currentlyChanged, saving }); // Debug log
        if (isEditing && currentlyChanged && !saving) {
          console.log('Conditions met, calling handleSave'); // Debug log
          handleSave();
        } else {
          console.log('Conditions NOT met - isEditing:', isEditing, 'hasChanges:', currentlyChanged, 'saving:', saving); // Debug log
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isEditing, saving, handleSave]); // handleSave is stable now (no reportData dep)

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

    if (year === currentYear) {
      return months.filter(m => m.value <= currentMonth);
    }
    return months;
  };

  const MIN_YEAR = 2025;
  const MAX_YEAR = new Date().getFullYear();

  const years = Array.from(
    { length: MAX_YEAR - MIN_YEAR + 1 },
    (_, i) => {
      const year = MIN_YEAR + i;
      return { value: year, label: year.toString() };
    }
  );

  return (
    <div className="px-3 pb-2 max-w-7xl mx-auto space-y-4">
      <DeadlineNotification />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white px-6 py-3 rounded-xl shadow-sm border border-gray-200">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Monthly Report Editor
          </h1>
          {user?.role === 'admin' ? (
            <div className="flex items-center gap-3 mt-2">
              <p className="text-gray-500 font-medium">
                Editing Department:
              </p>
              <div className="w-64">

                {departmentsLoading ?
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="animate-spin h-4 w-4" /> Loading departments...
                  </div>
                  : departments.length > 0 ? (
                    <DropdownCombobox
                      options={departments.map(d => ({ value: d.id, label: d.name }))}
                      value={selectedDepartmentId ?? ''}
                      onChange={(value) => {
                        console.log('Department selected:', value); // Debug log
                        const deptId = Number(value);
                        setSelectedDepartmentId(deptId);
                        const dept = departments.find(d => d.id === deptId);
                        setSelectedDepartmentName(dept?.name ?? '');
                        setIsEditing(false); // Exit edit mode when switching departments
                        setHasChanges(false);
                      }}
                      placeholder="Select Department"
                      disableSearch={true}
                    />
                  ) : isAdminOnlySection ? (
                    <span className="text-sm font-medium text-gray-700">{selectedDepartmentName}</span>
                  ) : (
                    <div className="text-sm text-gray-400 italic">
                      No departments have data for this section
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 font-medium">
              Department: {user?.department_name} · {user?.role?.toUpperCase()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isEditing ? (
            <Button variant="outline" onClick={() => setIsEditing(true)} className="flex items-center cursor-pointer">
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleCancelEdit} className="flex items-center text-red-600 border-red-200 hover:bg-red-600 hover:text-white transition-colors cursor-pointer">
                Cancel
              </Button>
              <div className="relative">
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className={`relative shadow-md flex items-center min-w-25 justify-center transition-all overflow-hidden ${hasChanges ? "bg-indigo-600 hover:bg-indigo-700 cursor-pointer" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
                >
                  {saving && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                      <div className="loader"></div>
                    </div>
                  )}
                  {success ? (
                    <> <Check className="mr-2 h-4 w-4" /> Saved </>
                  ) : (
                    <> <CloudUpload className="mr-2 h-4 w-4" /> Save </>
                  )}
                </Button>
                <span className="absolute -bottom-4 right-0 text-[11px] text-gray-400 italic whitespace-nowrap leading-none">ctrl+s</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
            <button
              onClick={goToPreviousMonth}
              className="p-2 rounded-md hover:bg-white hover:shadow-sm text-gray-500 hover:text-gray-900 transition-all duration-200 cursor-pointer"
              title="Previous month"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-32">
                <DropdownCombobox
                  options={getAvailableMonths()}
                  value={month}
                  onChange={(value) => setMonth(Number(value))}
                  placeholder="Month"
                  disableSearch={true}
                />
              </div>
              <div className="w-24">
                <DropdownCombobox
                  options={years}
                  value={year}
                  onChange={(value) => setYear(Number(value))}
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
                : 'text-gray-500 hover:bg-white hover:shadow-sm hover:text-gray-900 cursor-pointer'
                }`}
              title={isNextDisabled ? "Current month" : "Next month"}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {sectionsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
          </div>
        ) : fetchError ? (
          isMaintenanceMode ? (
            <div className="flex flex-col items-center justify-center py-20 text-amber-600">
              <AlertCircle className="h-10 w-10 mb-2" />
              <p className="font-medium">Under Maintenance</p>
              <p className="text-sm opacity-80">{fetchError}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-red-600">
              <AlertCircle className="h-10 w-10 mb-2" />
              <p className="font-medium">Error loading editor</p>
              <p className="text-sm opacity-80">{fetchError}</p>
              <Button variant="outline" className="mt-4" onClick={() => fetchSections(month, year)}>Retry</Button>
            </div>
          )
        ) : displayedSections.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No sections available</h3>
            <p className="text-gray-500">Contact admin to assign report sections to your department.</p>
          </div>
        ) : user?.role === 'admin' && departmentsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200">
            <Loader2 className="animate-spin h-7 w-7 text-indigo-500 mb-3" />
            <p className="text-sm text-gray-500">Loading departments...</p>
          </div>
        ) : user?.role === 'admin' && !selectedDepartmentId ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <Info className="mx-auto h-12 w-12 text-indigo-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              {departments.length === 0 && !isAdminOnlySection ? 'No Data Available' : 'Select a Department'}
            </h3>
            <p className="text-gray-500">
              {departments.length === 0 && !isAdminOnlySection
                ? 'No departments have submitted data for this section in the selected month/year.'
                : 'Please select a department from the dropdown above to view and edit reports.'}
            </p>
          </div>
        ) : reportDataLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200">
            <Loader2 className="animate-spin h-7 w-7 text-indigo-500 mb-3" />
            <p className="text-sm text-gray-500">Loading report data...</p>
          </div>
        ) : (
          displayedSections.map((section) => (
            <Card key={section.id} id={section.section_key} className="overflow-hidden border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div
                className="px-4 pb-2 flex items-center justify-between border-b bg-gray-50/80"
              >
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-gray-800 tracking-tight">{section.display_name}</h3>
                </div>
              </div>

              <CardContent className="px-4">
                {renderSectionContent(
                  section,
                  reportData,
                  updateData,
                  isEditing,
                  month,
                  year,
                  selectedDepartmentId ?? undefined,
                  (newConfig) => {
                    setAllSections(prev =>
                      prev.map(s => s.section_key === section.section_key ? { ...s, config: newConfig } : s)
                    );
                  }
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

const autoResizeTextarea = (el: HTMLTextAreaElement) => {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

// Helper to render different section types
const renderSectionContent = (section: any, data: any, updateFn: any, isEditing: boolean, month?: number, year?: number, departmentId?: number, onConfigSaved?: (newConfig: any) => void) => {
  const sectionData = data[section.section_key];

  // Priority 1: Check if this is the MTP section (19) - show table + Word upload
  if (isMTPSection(section.display_order)) {
    return (
      <div className="space-y-6">
        {/* Config panel for sections with labels config */}
        {section.config?.labels && onConfigSaved && month && year && (
          <SectionConfigPanel
            sectionKey={section.section_key}
            config={section.config}
            month={month}
            year={year}
            onSaved={onConfigSaved}
          />
        )}
        {/* Table (either records or fixed_table) */}
        {section.section_type === 'fixed_table' ? (
          <FixedRowsTable
            columns={section.columns}
            fixedRows={section.fixed_rows || []}
            data={Array.isArray(sectionData) ? sectionData : []}
            onChange={(newRows) => updateFn(section.section_key, newRows)}
            isEditing={isEditing}
            showTotal={section.section_key === 'mtp_activities'}
            sectionKey={section.section_key}
            month={month}
            year={year}
            departmentId={departmentId}
          />
        ) : (
          <DynamicTable
            columns={section.columns}
            data={Array.isArray(sectionData) ? sectionData : []}
            onChange={(newRows) => updateFn(section.section_key, newRows)}
            isEditing={isEditing}
          />
        )}

        {/* Word Document Upload - Always enabled */}
        {month && year && (
          <WordUpload
            sectionKey={section.section_key}
            month={month}
            year={year}
            departmentId={departmentId}
            readOnly={false}
          />
        )}
      </div>
    );
  }

  // Priority 2: Use normal rendering based on section_type
  switch (section.section_type) {
    case 'single_value':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8 py-4">
          {section.columns.map((col: any) => (
            <div key={col.name} className="space-y-3">
              <Label className="text-gray-700 font-bold text-base tracking-tight">{col.display_name}</Label>
              <Input
                readOnly={!isEditing}
                disabled={!isEditing}
                type="text"
                inputMode={col.type === 'NUMBER' ? 'numeric' : undefined}
                pattern={col.type === 'NUMBER' ? '[0-9]*' : undefined}
                value={sectionData?.[col.name] || ''}
                onChange={(e) => {
                  const current = sectionData || {};
                  const value =
                    col.type === 'NUMBER'
                      ? e.target.value.replace(/\D/g, '')
                      : e.target.value;

                  updateFn(section.section_key, {
                    ...current,
                    [col.name]: value
                  });
                }}
                className={`h-12 text-lg font-medium focus:ring-2 focus:ring-indigo-500 border-gray-300 shadow-none rounded-md ${col.type === 'NUMBER' ? 'no-spinner' : ''
                  }`}

              />
            </div>
          ))}
        </div>
      );

    case "rich_text":
      return (
        <div className="space-y-2">
          <TiptapEditor
            value={sectionData || ''}
            onChange={(value) => updateFn(section.section_key, value)}
            placeholder={`Enter ${section.display_name} content...`}
            readOnly={!isEditing}
          />
          {!isEditing && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <Info size={16} className="text-gray-400" />
              <span>
                Editor is in read-only mode. Click "Edit" button to modify content.
              </span>
            </div>
          )}
        </div>
      );

    case "records":
      return (
        <DynamicTable
          columns={section.columns}
          data={Array.isArray(sectionData) ? sectionData : []}
          onChange={(newRows) => updateFn(section.section_key, newRows)}
          isEditing={isEditing}
        />
      );

    case "fixed_table":
      return (
        <div className="space-y-0">
          {section.config?.labels && onConfigSaved && month && year && (
            <SectionConfigPanel
              sectionKey={section.section_key}
              config={section.config}
              month={month}
              year={year}
              onSaved={onConfigSaved}
            />
          )}
          <FixedRowsTable
            columns={section.columns}
            fixedRows={section.fixed_rows || []}
            data={Array.isArray(sectionData) ? sectionData : []}
            onChange={(newRows) => updateFn(section.section_key, newRows)}
            isEditing={isEditing}
            showTotal={section.section_key === 'mtp_activities'}
            sectionKey={section.section_key}
            month={month}
            year={year}
            departmentId={departmentId}
          />
        </div>
      );

    case "nested":
      return (
        <div className="space-y-10">
          {section.sub_sections.map((sub: any) => (
            <div key={sub.section_key} className="border-l-4 border-indigo-400 pl-6 py-1 bg-white">
              <h4 className="font-bold text-indigo-900 mb-6 text-lg border-b pb-2">{sub.display_name}</h4>
              {renderSectionContent(sub, sectionData || {}, (subKey: string, val: any) => {
                const current = sectionData || {};
                updateFn(section.section_key, { ...current, [subKey]: val });
              },
                isEditing
              )}
            </div>
          ))}
        </div>
      );

    default:
      return <div className="text-gray-400 italic">Unsupported section type: {section.section_type}</div>;
  }
};

// Friendly display names for known config label keys
const CONFIG_LABEL_DISPLAY: Record<string, string> = {
  batch_label: 'Current Batch',
  target_year: 'Target Year',
};

// Which label keys each section uses — used to pre-populate empty configs
const SECTION_CONFIG_KEYS: Record<string, string[]> = {
  snapshot_placement: ['batch_label'],
  snapshot_research:  ['target_year'],
};

const SectionConfigPanel: React.FC<{
  sectionKey: string;
  config: { labels: Record<string, string>; [key: string]: any };
  month: number;
  year: number;
  onSaved: (newConfig: any) => void;
}> = ({ sectionKey, config, month, year, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const getInitialValues = () => {
    const saved = config.labels || {};
    if (Object.keys(saved).length > 0) return saved;
    // Seed with empty strings for known keys so fields always render
    return (SECTION_CONFIG_KEYS[sectionKey] || []).reduce(
      (acc, key) => ({ ...acc, [key]: '' }),
      {} as Record<string, string>
    );
  };
  const [values, setValues] = useState<Record<string, string>>(getInitialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const newConfig = { ...config, labels: values };
      await api.put(`/sections/${sectionKey}/config`, { config: newConfig, month, year });
      onSaved(newConfig);
      setEditing(false);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setValues(getInitialValues());
    setEditing(false);
    setError(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-4 pb-3 border-b border-gray-100 mb-3">
      {Object.entries(values).map(([key, val]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">
            {CONFIG_LABEL_DISPLAY[key] || key.replace(/_/g, ' ')}:
          </span>
          {editing ? (
            <input
              type="text"
              value={val}
              autoFocus
              onChange={(e) => setValues(prev => ({ ...prev, [key]: e.target.value }))}
              className="text-sm font-semibold text-gray-800 border-b border-gray-400 bg-transparent focus:outline-none focus:border-gray-700 min-w-40 pb-0.5"
            />
          ) : (
            <span className="text-sm font-semibold text-gray-700">
              {val || <span className="italic text-gray-400 font-normal">not set</span>}
            </span>
          )}
        </div>
      ))}

      {editing ? (
        <div className="flex items-center gap-2 ml-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-gray-800 text-white rounded-md hover:bg-gray-900 disabled:opacity-50 cursor-pointer transition-colors"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            Save
          </button>
          <button
            onClick={handleCancel}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 cursor-pointer transition-colors"
          >
            <X size={11} /> Cancel
          </button>
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-300 hover:border-gray-500 rounded-md px-2.5 py-1 cursor-pointer transition-colors ml-1"
        >
          <Pencil size={11} /> Edit
        </button>
      )}
    </div>
  );
};

const FixedRowsTable: React.FC<{
  columns: any[];
  fixedRows: string[];
  data: any[];
  onChange: (rows: any[]) => void;
  isEditing: boolean;
  showTotal?: boolean;
  sectionKey?: string;
  month?: number;
  year?: number;
  departmentId?: number;
}> = ({ columns, fixedRows, data, onChange, isEditing, showTotal = false, sectionKey, month, year, departmentId }) => {
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [highlightCopied, setHighlightCopied] = useState(false);

  const getPrevMonthYear = () => {
    if (!month || !year) return null;
    if (month === 1) return { month: 12, year: year - 1 };
    return { month: month - 1, year };
  };

  const prevMonthYear = getPrevMonthYear();

  const monthNames = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleCopyFromLastMonth = async () => {
    if (!prevMonthYear || !departmentId || !sectionKey) return;
    setCopying(true);
    setCopyError(null);
    try {
      const response = await api.get(`/reports?month=${prevMonthYear.month}&year=${prevMonthYear.year}&department_id=${departmentId}`);
      const lastMonthData = response.data.report?.report_data?.[sectionKey];
      if (!lastMonthData || !Array.isArray(lastMonthData) || lastMonthData.length === 0) {
        setCopyError(`No data found for ${monthNames[prevMonthYear.month]} ${prevMonthYear.year}.`);
        return;
      }
      onChange(lastMonthData);
      setCopyDialogOpen(false);
      setHighlightCopied(true);
      setTimeout(() => setHighlightCopied(false), 2500);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setCopyError(`No data found for ${monthNames[prevMonthYear.month]} ${prevMonthYear.year}.`);
      } else {
        setCopyError('Could not load data for that month.');
      }
    } finally {
      setCopying(false);
    }
  };

  // SINGLE_TEXTAREA columns are shown as a shared field below the table
  // TEXTAREA columns are shown per-row inside the table (like TEXT but as <textarea>)
  const tableColumns = columns.filter(col => col.type !== 'SINGLE_TEXTAREA');
  const textareaColumns = columns.filter(col => col.type === 'SINGLE_TEXTAREA');

  // For mtp_activities: inject a virtual calculated percentage column after 'offers'
  const MTP_CALC_COL = { name: '__calc_percentage', display_name: 'Percentage (%) (D/C)', type: 'CALCULATED' };
  const displayColumns = sectionKey === 'mtp_activities'
    ? [...tableColumns.slice(0, -1), MTP_CALC_COL, ...tableColumns.slice(-1)]
    : tableColumns;


  // Initialize data structure: ensure we have a row for each fixed row
  const getRowData = (rowName: string) => {
    return data.find((row) => row.dept === rowName) || { dept: rowName };
  };

  const handleCellChange = (rowName: string, colName: string, value: any) => {
    const newData = [...data];
    const existingIndex = newData.findIndex((row) => row.dept === rowName);

    // Preserve SINGLE_TEXTAREA values from first record (they live there, not per-row)
    const singleTextareaValues: Record<string, any> = {};
    columns.filter(col => col.type === 'SINGLE_TEXTAREA').forEach(col => {
      if (data.length > 0 && data[0][col.name] !== undefined) {
        singleTextareaValues[col.name] = data[0][col.name];
      }
    });

    if (existingIndex >= 0) {
      newData[existingIndex] = { ...newData[existingIndex], [colName]: value };
    } else {
      newData.push({ dept: rowName, [colName]: value });
    }

    // Re-apply SINGLE_TEXTAREA values into the first record
    if (Object.keys(singleTextareaValues).length > 0 && newData.length > 0) {
      newData[0] = { ...newData[0], ...singleTextareaValues };
    }

    onChange(newData);
  };

  // Handle textarea fields (stored in first record with dept field)
  const getTextareaValue = (fieldName: string) => {
    const firstRecord = data.find(row => row[fieldName] !== undefined);
    return firstRecord ? firstRecord[fieldName] || '' : '';
  };

  const handleTextareaChange = (fieldName: string, value: string) => {
    console.log('Textarea change:', { fieldName, value, dataLength: data.length });
    const newData = [...data];

    if (newData.length === 0) {
      // Create first record with the first fixed row's dept name
      const firstDept = fixedRows.length > 0 ? fixedRows[0] : '';
      newData.push({ dept: firstDept, [fieldName]: value });
    } else {
      // Store in the first record
      newData[0] = { ...newData[0], [fieldName]: value };
    }

    console.log('Calling onChange with:', newData);
    onChange(newData);
  };

  return (
    <>
      {/* Copy Confirmation Dialog — portal at document.body, outside table DOM entirely */}
      {createPortal(
        <div
          className={`fixed inset-0 bg-black/40 flex items-center justify-center z-50 transition-opacity duration-150 ${copyDialogOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={() => { if (!copying) { setCopyDialogOpen(false); setCopyError(null); } }}
        >
          <Card
            className="w-full max-w-md mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="pt-5 pb-5">
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                Copy data from {prevMonthYear ? `${monthNames[prevMonthYear.month]} ${prevMonthYear.year}` : ''}?
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                All values in <strong>Placement Activities</strong> for{' '}
                <strong>{month ? monthNames[month] : ''} {year}</strong> will be replaced with data from{' '}
                <strong>{prevMonthYear ? `${monthNames[prevMonthYear.month]} ${prevMonthYear.year}` : ''}</strong>.
                Any values you have already entered for {month ? monthNames[month] : ''} {year} will be overwritten.
              </p>
              <p className="text-xs text-gray-400 mb-4">
                You can still undo this by clicking Cancel without saving.
              </p>

              {copyError && (
                <p className="text-sm text-red-600 mb-4">{copyError}</p>
              )}

              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setCopyDialogOpen(false); setCopyError(null); }}
                  disabled={copying}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCopyFromLastMonth}
                  disabled={copying}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer flex items-center gap-2"
                >
                  {copying && <Loader2 size={14} className="animate-spin" />}
                  Copy & Replace
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}

    <div className="space-y-4">

      {/* Copy from Last Month button — only for mtp_activities in edit mode */}
      {isEditing && sectionKey === 'mtp_activities' && prevMonthYear && (
        <div className="flex justify-end">
          <button
            onClick={() => { setCopyDialogOpen(true); setCopyError(null); }}
            className="group flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700 transition-colors cursor-pointer"
          >
            <ClipboardCopy size={14} className="group-hover:scale-110 transition-transform" />
            <span className="underline underline-offset-2 decoration-dashed decoration-green-400 group-hover:decoration-green-600">
              copy from {monthNames[prevMonthYear.month]} {prevMonthYear.year}
            </span>
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-base text-left border-collapse">
          <thead className="text-xs text-gray-600 uppercase bg-transparent border-b">
            <tr>
              <th className="px-4 py-3 w-16 text-center font-bold">Sl.No</th>
              <th className="px-4 py-4 font-bold">Dept.</th>
              {displayColumns.map((col) => (
                <th key={col.name} className="px-4 py-4 font-bold min-w-45">
                  {col.display_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {fixedRows.map((rowName, rowIndex) => {
              const rowData = getRowData(rowName);
              return (
                <tr key={rowIndex} className="hover:bg-indigo-50/30 transition-colors">
                  <td className={`px-4 py-3 text-center font-bold text-gray-400 transition-colors duration-700 ${highlightCopied ? 'bg-yellow-50' : ''}`}>
                    {rowIndex + 1}
                  </td>
                  <td className={`px-4 py-3 font-semibold text-gray-700 transition-colors duration-700 ${highlightCopied ? 'bg-yellow-50' : ''}`}>{rowName}</td>
                  {displayColumns.map((col) => (
                    <td key={col.name} className={`px-2 py-3 transition-colors duration-700 ${highlightCopied ? 'bg-yellow-50' : ''}`}>
                      {col.type === 'CALCULATED' ? (
                        (() => {
                          const placed = Number(rowData['placed'] || 0);
                          const eligible = Number(rowData['eligible'] || 0);
                          const pct = eligible > 0 ? ((placed / eligible) * 100).toFixed(2) + '%' : '—';
                          return (
                            <Input
                              type="text"
                              value={pct}
                              disabled
                              readOnly
                              className="h-12 text-lg font-bold text-center text-indigo-700 bg-indigo-50 border-indigo-200 cursor-not-allowed no-spinner"
                            />
                          );
                        })()
                      ) : col.type === 'SELECT' ? (
                        <DropdownCombobox
                          disabled={!isEditing}
                          options={col.options || []}
                          value={rowData[col.name] || ''}
                          onChange={(val) => handleCellChange(rowName, col.name, val)}
                          placeholder="Select..."
                          disableSearch={true}
                        />
                      ) : col.type === 'TEXTAREA' ? (
                        <textarea
                          readOnly={!isEditing}
                          disabled={!isEditing}
                          className="w-full p-3 border border-gray-300 rounded-lg text-base min-h-16 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm disabled:bg-gray-50 resize-none overflow-hidden"
                          value={rowData[col.name] || ''}
                          onChange={(e) => {
                            handleCellChange(rowName, col.name, e.target.value);
                            autoResizeTextarea(e.target);
                          }}
                          onInput={(e) => autoResizeTextarea(e.currentTarget)}
                          placeholder="..."
                        />
                      ) : (
                        <Input
                          readOnly={!isEditing}
                          disabled={!isEditing}
                          type="text"
                          inputMode={col.type === 'NUMBER' ? 'numeric' : undefined}
                          pattern={col.type === 'NUMBER' ? '[0-9]*' : undefined}

                          className={`h-12 text-lg font-medium focus:ring-2 focus:ring-indigo-500 border-gray-300 shadow-none rounded-md ${col.type === 'NUMBER' ? 'no-spinner' : ''
                            }`}

                          value={rowData[col.name] || ''}
                          onChange={(e) =>
                            handleCellChange(
                              rowName,
                              col.name,
                              col.type === 'NUMBER'
                                ? e.target.value.replace(/\D/g, '')
                                : e.target.value
                            )
                          }
                          placeholder="..."
                        />
                      )}
                    </td>
                  ))}

                </tr>
              );
            })}

            {/* TOTAL ROW — only for MTP placement table */}
            {showTotal && <tr className="bg-gray-100 font-bold">
              <td className="px-4 py-3 text-center text-gray-600"></td>
              <td className="px-4 py-3 text-gray-800">TOTAL</td>

              {displayColumns.map((col) => {
                if (col.type === 'CALCULATED') {
                  const totalPlaced = fixedRows.reduce((sum, rowName) => {
                    const row = getRowData(rowName);
                    return sum + Number(row['placed'] || 0);
                  }, 0);
                  const totalEligible = fixedRows.reduce((sum, rowName) => {
                    const row = getRowData(rowName);
                    return sum + Number(row['eligible'] || 0);
                  }, 0);
                  const percentage = totalEligible > 0 ? ((totalPlaced / totalEligible) * 100).toFixed(2) + '%' : '—';
                  return (
                    <td key={col.name} className="px-2 py-3">
                      <input
                        type="text"
                        value={percentage}
                        disabled
                        className="w-full h-12 text-center font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md cursor-not-allowed"
                      />
                    </td>
                  );
                }

                if (col.type !== 'NUMBER') {
                  return (
                    <td key={col.name} className="px-2 py-3 text-center text-gray-400">
                      —
                    </td>
                  );
                }

                const total = fixedRows.reduce((sum, rowName) => {
                  const row = getRowData(rowName);
                  const value = Number(row[col.name] || 0);
                  return sum + value;
                }, 0);

                return (
                  <td key={col.name} className="px-2 py-3">
                    <input
                      type="text"
                      value={total}
                      disabled
                      className="w-full max-w-md h-12 text-center font-bold text-gray-900 bg-gray-100 border border-gray-300 rounded-md cursor-not-allowed focus:outline-none"
                    />
                  </td>
                );
              })}
            </tr>}
            {fixedRows.length === 0 && (
              <tr>
                <td
                  colSpan={displayColumns.length + 2}
                  className="px-6 py-12 text-center text-gray-400 italic text-lg"
                >
                  No fixed rows defined.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SINGLE_TEXTAREA fields shown below the table (shared for all rows) */}
      {textareaColumns.map((col) => (
        <div key={col.name} className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            {col.display_name}
          </label>
          <textarea
            readOnly={!isEditing}
            disabled={!isEditing}
            rows={5}
            className="
              w-full
              max-w-md
              p-3
              border border-gray-300
              rounded-lg
              text-base
              min-h-30
              resize-none
              overflow-hidden
              focus:ring-2 focus:ring-indigo-500
              focus:border-transparent
              outline-none
              transition-all
              shadow-sm
              disabled:bg-gray-50
            "
            value={getTextareaValue(col.name)}
            onChange={(e) => {
              handleTextareaChange(col.name, e.target.value);
              autoResizeTextarea(e.target);
            }}
            onInput={(e) => autoResizeTextarea(e.currentTarget)}
            placeholder={
              isEditing
                ? `Enter ${col.display_name}...`
                : `No ${col.display_name} provided`
            }
          />

        </div>
      ))}
    </div>
    </>
  );
};

const DynamicTable: React.FC<{ columns: any[]; data: any[]; onChange: (rows: any[]) => void; isEditing: boolean; }> = ({ columns, data, onChange, isEditing }) => {
  const [deleteRowIndex, setDeleteRowIndex] = useState<number | null>(null);

  const handleAddRow = () => {
    const newRow = columns.reduce((acc, col) => ({ ...acc, [col.name]: '' }), {});
    onChange([...data, newRow]);
  };

  const handleRemoveRow = (index: number) => {
    const newData = [...data];
    newData.splice(index, 1);
    onChange(newData);
    setDeleteRowIndex(null);
  };

  const handleCellChange = (index: number, colName: string, value: any) => {
    const newData = [...data];
    newData[index] = { ...newData[index], [colName]: value };
    onChange(newData);
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-base text-left border-collapse">
          <thead className="text-xs text-gray-600 uppercase bg-transparent border-b ">
            <tr>
              <th className="px-4 py-3 w-16 text-center font-bold">S.No</th>
              {columns.map(col => (
                <th
                  key={col.name}
                  className={`px-4 py-4 font-bold ${col.type === 'TEXTAREA' ? 'min-w-112.5' : 'min-w-45'}`}
                >
                  {col.display_name}
                </th>
              ))}
              <th className="px-1 py-2 w-16 text-center font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-indigo-50/30 transition-colors">
                <td className="px-4 py-3 text-center font-bold text-gray-400">{rowIndex + 1}</td>
                {columns.map(col => (
                  <td key={col.name} className="px-2 py-3">
                    {col.type === 'TEXTAREA' ? (
                      <textarea
                        readOnly={!isEditing}
                        disabled={!isEditing}
                        className="w-full p-3 border border-gray-300 rounded-lg text-base min-h-30 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm"
                        value={row[col.name] || ''}
                        onChange={(e) => handleCellChange(rowIndex, col.name, e.target.value)}
                        placeholder="..."
                      />
                    ) : col.type === 'SELECT' ? (
                      <DropdownCombobox
                        disabled={!isEditing}
                        options={col.options || []}
                        value={row[col.name] || ''}
                        onChange={(val) => handleCellChange(rowIndex, col.name, val)}
                        placeholder="Select..."
                        disableSearch={true}
                      />
                    ) : (
                      <Input
                        readOnly={!isEditing}
                        disabled={!isEditing}
                        type="text"
                        inputMode={col.type === 'NUMBER' ? 'numeric' : undefined}
                        pattern={col.type === 'NUMBER' ? '[0-9]*' : undefined}
                        className={`h-12 text-lg font-medium focus:ring-2 focus:ring-indigo-500 border-gray-300 shadow-none rounded-md ${col.type === 'NUMBER' ? 'no-spinner' : ''
                          }`}

                        value={row[col.name] || ''}
                        onChange={(e) =>
                          handleCellChange(
                            rowIndex,
                            col.name,
                            col.type === 'NUMBER'
                              ? e.target.value.replace(/\D/g, '')
                              : e.target.value
                          )
                        }
                        placeholder="..."
                      />
                    )}
                  </td>
                ))}
                <td className="px-1 py-2 text-center">
                  {isEditing && (
                    <button onClick={() => setDeleteRowIndex(rowIndex)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                      title="Delete row"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-6 py-12 text-center text-gray-400 italic text-lg">
                  No records added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isEditing && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleAddRow}
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold h-12 px-8 rounded-xl shadow-sm cursor-pointer"
        >
          <Plus size={20} className="mr-2" /> Add New Record
        </Button>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteRowIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-2">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Delete Record
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Are you sure you want to delete this record? This action cannot be undone after saving.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDeleteRowIndex(null)}
                      className="px-4"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleRemoveRow(deleteRowIndex)}
                      className="px-4 bg-red-600 hover:bg-red-700 text-white"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReportEditor;