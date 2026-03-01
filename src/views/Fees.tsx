import { useEffect, useState } from 'react';
import { CreditCard, Filter, Download, CheckCircle2, Clock } from 'lucide-react';
import type { FeeRecord } from '../types';

export default function Fees() {
  const [fees, setFees] = useState<FeeRecord[]>([]);

  useEffect(() => {
    fetch('/api/fees').then(res => res.json()).then(setFees);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-stone-900">Fee Management</h1>
          <p className="text-stone-500">Track student payments and dues.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-white border border-stone-200 text-stone-600 px-4 py-2 rounded-xl hover:bg-stone-50 transition-colors">
            <Filter size={18} />
            <span>Filter</span>
          </button>
          <button className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100">
            <Download size={18} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 bg-emerald-600 text-white">
          <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Total Collected (Mar)</p>
          <p className="text-3xl font-bold mt-1">$12,450.00</p>
          <div className="mt-4 flex items-center gap-2 text-emerald-100 text-sm">
            <CheckCircle2 size={16} />
            <span>85% of target reached</span>
          </div>
        </div>
        <div className="glass-card p-6 bg-rose-500 text-white">
          <p className="text-rose-100 text-xs font-bold uppercase tracking-wider">Outstanding Dues</p>
          <p className="text-3xl font-bold mt-1">$2,100.00</p>
          <div className="mt-4 flex items-center gap-2 text-rose-100 text-sm">
            <Clock size={16} />
            <span>12 students pending</span>
          </div>
        </div>
        <div className="glass-card p-6 flex items-center justify-center border-dashed border-2 border-stone-200 bg-transparent shadow-none">
          <button className="text-stone-400 hover:text-stone-600 flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center">
              <Plus size={20} />
            </div>
            <span className="text-sm font-medium">Record New Payment</span>
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Month/Year</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {fees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-stone-400">No payment records found.</td>
                </tr>
              ) : fees.map((record) => (
                <tr key={record.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-stone-900">{record.student_name}</td>
                  <td className="px-6 py-4 text-stone-600">{record.month} {record.year}</td>
                  <td className="px-6 py-4 font-bold text-stone-900">${record.amount.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      record.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-stone-500 text-sm">{record.payment_date || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-emerald-600 hover:text-emerald-700 font-medium text-sm">Receipt</button>
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

function Plus({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  );
}
