import { useState } from 'react';
import { FileDown, Loader2, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { API_BASE_URL } from '../libs/api';
import DropdownCombobox from '../components/DropdownCombobox';

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
  { value: 12, label: 'December' },
];

const getDefaultMonthYear = () => {
  const now = new Date();
  const day = now.getDate();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  if (day <= 9) {
    return m === 1 ? { month: 12, year: y - 1 } : { month: m - 1, year: y };
  }
  return { month: m, year: y };
};

export default function SnapshotGenerator() {
  const def = getDefaultMonthYear();
  const currentDate = new Date();
  const MIN_YEAR = 2025;
  const MAX_YEAR = currentDate.getFullYear();

  const [month, setMonth] = useState(def.month);
  const [year, setYear] = useState(def.year);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const years = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => ({
    value: MIN_YEAR + i,
    label: String(MIN_YEAR + i),
  }));

  const getAvailableMonths = () => {
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    return year === currentYear ? months.filter(m => m.value <= currentMonth) : months;
  };

  const isNextDisabled =
    month === currentDate.getMonth() + 1 && year === currentDate.getFullYear();

  const goToPreviousMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const goToNextMonth = () => {
    if (isNextDisabled) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const handleGenerate = () => {
    setGenerating(true);
    setProgress(0);
    setProgressMsg('Starting...');
    setError(null);
    setDone(false);

    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ month: String(month), year: String(year) });
    const url = `${API_BASE_URL}/reports/snapshot/generate?${params}`;

    const processEvent = (type: string, raw: string) => {
      try {
        const data = JSON.parse(raw);
        if (type === 'progress') {
          setProgress(data.percentage);
          setProgressMsg(data.message || '');
        } else if (type === 'complete') {
          const bytes = atob(data.data);
          const arr = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
          const blob = new Blob([arr], { type: data.contentType });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = data.fileName || `VNRVJIET_Snapshot_${month}_${year}.docx`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(link.href);
          setDone(true);
          setProgress(100);
          setProgressMsg('Done!');
          setTimeout(() => { setGenerating(false); setProgress(0); setDone(false); }, 2000);
        } else if (type === 'error') {
          setError(data.message || 'Generation failed');
          setGenerating(false);
        }
      } catch {
        // ignore parse errors
      }
    };

    (async () => {
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        });
        if (!response.ok) throw new Error('Failed to connect');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error('No response body');

        let buffer = '';
        let eventType = '';
        let eventData = '';

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
              processEvent(eventType, eventData);
              eventType = '';
              eventData = '';
            }
          }
        }
        if (eventType && eventData) processEvent(eventType, eventData);
      } catch (err: any) {
        setError(err.message || 'Connection failed');
        setGenerating(false);
      }
    })();
  };

  const monthLabel = months.find(m => m.value === month)?.label || '';

  return (
    <div className="px-3 pb-2 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white px-6 py-4 rounded-xl shadow-sm border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Snapshot Report</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Generate the institute-wide VNRVJIET Snapshot document.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white px-6 py-5 rounded-xl shadow-sm border border-gray-200 space-y-5">
        {/* Month / Year selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600 w-20">Period</span>
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
            <button
              onClick={goToPreviousMonth}
              className="p-2 rounded-md hover:bg-white hover:shadow-sm text-gray-500 hover:text-gray-900 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="w-32">
              <DropdownCombobox
                options={getAvailableMonths()}
                value={month}
                onChange={v => setMonth(Number(v))}
                placeholder="Month"
                disableSearch={true}
              />
            </div>
            <div className="w-24">
              <DropdownCombobox
                options={years}
                value={year}
                onChange={v => setYear(Number(v))}
                placeholder="Year"
                disableSearch={true}
              />
            </div>
            <button
              onClick={goToNextMonth}
              disabled={isNextDisabled}
              className={`p-2 rounded-md transition-all ${isNextDisabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-white hover:shadow-sm hover:text-gray-900'}`}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full h-12 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 cursor-pointer disabled:cursor-not-allowed"
        >
          {generating ? (
            <><Loader2 className="animate-spin mr-2 h-5 w-5" /> Generating...</>
          ) : done ? (
            <><CheckCircle2 className="mr-2 h-5 w-5" /> Downloaded!</>
          ) : (
            <><FileDown className="mr-2 h-5 w-5" /> Generate Snapshot — {monthLabel} {year}</>
          )}
        </Button>

        {/* Progress bar */}
        {generating && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{progressMsg}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 text-sm text-gray-500 space-y-1">
        <p className="font-medium text-gray-700">Snapshot includes:</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Important Points to be Reviewed</li>
          <li>Statutory Compliance (PAAC)</li>
          <li>Important Achievements (Dept, Faculty, Students)</li>
          <li>Placement Support</li>
          <li>Research Snapshot &amp; EC Report</li>
          <li>Project Proposals Submitted</li>
          <li>Patents Filed/Published/Granted</li>
          <li>Alumni</li>
          <li>Central Library Information</li>
          <li>Faculty Publications Summary</li>
        </ol>
      </div>
    </div>
  );
}
