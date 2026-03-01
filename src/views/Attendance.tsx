import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Calendar as CalendarIcon, Check, X, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { AttendanceRecord } from '../types';

export default function Attendance() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/attendance/${date}`)
      .then(res => res.json())
      .then(data => {
        setRecords(data);
        setLoading(false);
      });
  }, [date]);

  const updateAttendance = async (studentId: number, status: string) => {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, date, status })
    });
    if (res.ok) {
      setRecords(records.map(r => r.student_id === studentId ? { ...r, status: status as any } : r));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-stone-900">Attendance</h1>
          <p className="text-stone-500">Track daily student presence.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-stone-200 shadow-sm">
          <CalendarIcon size={18} className="text-stone-400 ml-2" />
          <input 
            type="date" 
            value={date}
            onChange={e => setDate(e.target.value)}
            className="outline-none bg-transparent text-stone-700 font-medium pr-2"
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">Student Name</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-stone-400">Loading records...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-stone-400">No students found.</td>
                </tr>
              ) : records.map((record) => (
                <tr key={record.student_id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-medium text-stone-900">{record.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      {record.status ? (
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          record.status === 'present' ? "bg-emerald-100 text-emerald-700" :
                          record.status === 'absent' ? "bg-rose-100 text-rose-700" :
                          "bg-amber-100 text-amber-700"
                        )}>
                          {record.status}
                        </span>
                      ) : (
                        <span className="text-stone-300 text-[10px] uppercase font-bold tracking-wider italic">Not Marked</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => updateAttendance(record.student_id, 'present')}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          record.status === 'present' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-stone-100 text-stone-400 hover:bg-emerald-50 hover:text-emerald-600"
                        )}
                      >
                        <Check size={18} />
                      </button>
                      <button 
                        onClick={() => updateAttendance(record.student_id, 'late')}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          record.status === 'late' ? "bg-amber-500 text-white shadow-lg shadow-amber-100" : "bg-stone-100 text-stone-400 hover:bg-amber-50 hover:text-amber-600"
                        )}
                      >
                        <Clock size={18} />
                      </button>
                      <button 
                        onClick={() => updateAttendance(record.student_id, 'absent')}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          record.status === 'absent' ? "bg-rose-500 text-white shadow-lg shadow-rose-100" : "bg-stone-100 text-stone-400 hover:bg-rose-50 hover:text-rose-600"
                        )}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
