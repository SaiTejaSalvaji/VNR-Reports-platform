import React, { useState, useEffect } from 'react';

const DeadlineNotification: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  const DEADLINE_DAY = 6;

  // Calculate the deadline message based on current date
  const getDeadlineMessage = () => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentYear = now.getFullYear();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    if (currentDay <= DEADLINE_DAY) {
      // Before deadline: deadline is for previous month's report
      const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const previousMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      return {
        reportMonth: monthNames[previousMonth],
        reportYear: previousMonthYear,
        deadlineMonth: monthNames[currentMonth],
        deadlineYear: currentYear,
        deadlineDay: DEADLINE_DAY
      };
    } else {
      // After 9th: deadline is for current month's report (due next month)
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;

      return {
        reportMonth: monthNames[currentMonth],
        reportYear: currentYear,
        deadlineMonth: monthNames[nextMonth],
        deadlineYear: nextMonthYear,
        deadlineDay: DEADLINE_DAY
      };
    }
  };

  const deadline = getDeadlineMessage();
  const dismissKey = `deadline-notification-dismissed-${deadline.reportMonth}-${deadline.reportYear}`;

  useEffect(() => {
    // Check if notification was dismissed for this month's report
    const wasDismissed = sessionStorage.getItem(dismissKey);
    setIsVisible(!wasDismissed);
  }, [dismissKey]);

  const handleDismiss = () => {
    sessionStorage.setItem(dismissKey, 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="sticky top-0 z-20 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="w-full px-4 py-2.5 flex items-center justify-center gap-2">
        <p className="text-sm text-gray-600">
          Deadline to submit reports of{' '}
          <span className="font-semibold">{deadline.reportMonth} {deadline.reportYear}</span>{' '}
          is{' '}
          <span className="font-semibold text-red-600">{deadline.deadlineDay}th {deadline.deadlineMonth} {deadline.deadlineYear}</span>
        </p>
        <button
          onClick={handleDismiss}
          className="text-sm text-gray-700 underline hover:text-gray-800 transition-colors duration-200 cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default DeadlineNotification;
