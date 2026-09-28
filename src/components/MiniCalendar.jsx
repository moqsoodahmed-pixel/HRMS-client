// Small popover date picker used by the Sales Leads / Business Development
// date filter. Extracted out of SalesLeads.jsx (where it used to be a
// private, unexported component) into its own file so both SalesLeads.jsx
// (management table view) and pages/BDWorkspace.jsx (individual-contributor
// workspace view) can import the exact same component without either file
// importing the other (that would create a circular import between the two
// page files). Behavior is byte-for-byte identical to the original.
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function MiniCalendar({ selectedDate, onSelectDate, onClose }) {
    const [viewDate, setViewDate] = useState(() => {
        if (selectedDate) {
            const parts = selectedDate.split('-');
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        }
        return new Date();
    });

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const prevMonth = (e) => {
        e.stopPropagation();
        setViewDate(new Date(year, month - 1, 1));
    };

    const nextMonth = (e) => {
        e.stopPropagation();
        setViewDate(new Date(year, month + 1, 1));
    };

    // Calendar math
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
        days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({ day: d, dateStr: dStr });
    }

    return (
        <div
            className="absolute top-full left-0 sm:right-0 sm:left-auto mt-2 z-50 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-xl ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <button
                    type="button"
                    onClick={prevMonth}
                    className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    title="Previous month"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold text-gray-800">
                    {monthNames[month]} {year}
                </span>
                <button
                    type="button"
                    onClick={nextMonth}
                    className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    title="Next month"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w) => (
                    <span key={w} className="text-[11px] font-medium text-gray-400">
                        {w}
                    </span>
                ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
                {days.map((item, idx) => {
                    if (!item) {
                        return <div key={`empty-${idx}`} className="h-7 w-7" />;
                    }
                    const isSelected = selectedDate === item.dateStr;
                    const isToday = todayStr === item.dateStr;

                    return (
                        <button
                            key={item.dateStr}
                            type="button"
                            onClick={() => {
                                onSelectDate(item.dateStr);
                                onClose();
                            }}
                            className={`h-7 w-7 rounded-full text-xs font-medium flex items-center justify-center transition-all ${isSelected
                                ? 'bg-primary-600 text-white font-semibold shadow-sm'
                                : isToday
                                    ? 'border border-primary-500 text-primary-600 hover:bg-primary-50'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            {item.day}
                        </button>
                    );
                })}
            </div>

            {/* Footer / Quick actions */}
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <button
                    type="button"
                    onClick={() => {
                        onSelectDate(todayStr);
                        onClose();
                    }}
                    className="text-primary-600 font-medium hover:underline"
                >
                    Today
                </button>
                {selectedDate && (
                    <button
                        type="button"
                        onClick={() => {
                            onSelectDate('');
                            onClose();
                        }}
                        className="text-gray-500 hover:text-red-600 hover:underline"
                    >
                        Clear Date
                    </button>
                )}
            </div>
        </div>
    );
}