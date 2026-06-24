import React, { createContext, useContext, useState, ReactNode } from 'react';

const getDefault = () => {
  const now = new Date();
  const d = now.getDate(), m = now.getMonth() + 1, y = now.getFullYear();
  if (d <= 9) return { month: m === 1 ? 12 : m - 1, year: m === 1 ? y - 1 : y };
  return { month: m, year: y };
};

interface MonthYearContextType {
  month: number;
  year: number;
  setMonth: (m: number) => void;
  setYear: (y: number) => void;
}

const MonthYearContext = createContext<MonthYearContextType | undefined>(undefined);

export function MonthYearProvider({ children }: { children: ReactNode }) {
  const defaults = getDefault();
  const [month, setMonth] = useState(defaults.month);
  const [year, setYear] = useState(defaults.year);

  return (
    <MonthYearContext.Provider value={{ month, year, setMonth, setYear }}>
      {children}
    </MonthYearContext.Provider>
  );
}

export function useMonthYear() {
  const ctx = useContext(MonthYearContext);
  if (!ctx) throw new Error('useMonthYear must be used within MonthYearProvider');
  return ctx;
}
