
import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Language, Class } from 'types';
import { t } from 'translations';
import { TrendingUp, DollarSign, BarChart3, AlertCircle, Send, Loader2, CheckCircle2, MessageSquare, Smartphone, PieChart, Users, Filter, Calendar, Wallet } from 'lucide-react';
import { isValidUUID } from 'utils/validation';

interface SmartFeeAnalyticsProps {
  institutionId: string;
  lang: Language;
  month: string;
  refreshKey?: number;
  classes?: Class[];
}

const SmartFeeAnalytics: React.FC<SmartFeeAnalyticsProps> = ({ institutionId, lang, month: initialMonth, refreshKey, classes = [] }) => {
  const [stats, setStats] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Filters
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  useEffect(() => {
    fetchAnalytics();
  }, [institutionId, selectedMonth, selectedYear, viewMode, selectedClassId, refreshKey]);

  const fetchAnalytics = async () => {
    if (!isValidUUID(institutionId)) return;
    setLoading(true);
    try {
      // Determine date filter for ledger
      const dateFilter = viewMode === 'monthly' ? selectedMonth : selectedYear;

      // 1. Fetch Fee Structures
      let structureQuery = supabase.from('fee_structures').select('*').eq('institution_id', institutionId);
      if (selectedClassId !== 'all') {
        structureQuery = structureQuery.eq('class_id', selectedClassId);
      }
      const { data: structures } = await structureQuery;
      if (!structures) return;

      // 2. Fetch Students for counts and class mapping
      let studentQuery = supabase.from('students').select('student_name, class_id').eq('institution_id', institutionId);
      if (selectedClassId !== 'all') {
        studentQuery = studentQuery.eq('class_id', selectedClassId);
      }
      const { data: students } = await studentQuery;
      
      const studentCounts: Record<string, number> = {};
      const studentClassMap: Record<string, string> = {};
      
      students?.forEach(s => {
        studentCounts[s.class_id] = (studentCounts[s.class_id] || 0) + 1;
        studentClassMap[s.student_name] = s.class_id;
      });

      // 3. Fetch Ledger for transaction counts (Income) AND Expenses
      const { data: ledger } = await supabase.from('ledger')
        .select('description, amount, type, category, transaction_date')
        .eq('institution_id', institutionId)
        .or(`transaction_date.ilike.${dateFilter}%,description.ilike.%${dateFilter}%`);

      // 4. Process Data
      const breakdownMap: Record<string, { expected: number, collected: number, students: number, transactions: number }> = {};
      let totalExpected = 0;
      let totalCollected = 0;
      let totalExpense = 0;

      // Calculate Expenses
      ledger?.forEach(l => {
        if (l.type === 'expense' && l.transaction_date.startsWith(dateFilter)) {
          totalExpense += l.amount;
        }
      });

      structures.forEach(s => {
        const count = studentCounts[s.class_id] || 0;
        // If yearly, multiply monthly fee by 12 (approximate)
        const multiplier = viewMode === 'yearly' ? 12 : 1;
        const total = count * s.amount * multiplier;
        
        if (!breakdownMap[s.fee_name]) {
          breakdownMap[s.fee_name] = { expected: 0, collected: 0, students: 0, transactions: 0 };
        }
        breakdownMap[s.fee_name].expected += total;
        breakdownMap[s.fee_name].students += count;
        totalExpected += total;
      });

      // Count transactions and calculate collected amount (Income)
      ledger?.forEach(l => {
        if (l.type !== 'income' || l.category !== 'Student Fee') return;

        // Ensure it's for the selected month/year
        if (!l.description.includes(dateFilter)) return;

        const parts = l.description.split(' - ');
        if (parts.length < 2) return;

        const feePart = parts[0];
        const studentInfo = parts.slice(1).join(' - ');
        const studentName = studentInfo.split(' (')[0];
        
        // Extract class name from description if possible
        const match = studentInfo.match(/\((.*?)\s*\|/);
        const className = match ? match[1].trim() : null;
        
        let classId = studentClassMap[studentName];
        if (!classId && className && classes.length > 0) {
            classId = classes.find(c => c.class_name === className)?.id;
        }

        // If filtering by class, ensure student belongs to selected class
        if (selectedClassId !== 'all' && classId !== selectedClassId) return;

        const fees = feePart.split(', ');
        let totalStructureAmount = 0;
        const matchedStructures: any[] = [];
        
        fees.forEach(f => {
            if (classId) {
               const structure = structures.find(s => s.fee_name === f && s.class_id === classId);
               if (structure) {
                   totalStructureAmount += structure.amount;
                   matchedStructures.push(structure);
               }
            }
        });
        
        if (matchedStructures.length > 0) {
            matchedStructures.forEach(structure => {
                if (breakdownMap[structure.fee_name]) {
                    breakdownMap[structure.fee_name].transactions += 1;
                    // Allocate actual collected amount proportionally
                    const ratio = totalStructureAmount > 0 ? (structure.amount / totalStructureAmount) : 0;
                    const allocatedAmount = l.amount * ratio;
                    breakdownMap[structure.fee_name].collected += allocatedAmount;
                }
            });
            totalCollected += l.amount;
        } else {
            // Fallback if no structures matched (e.g. fee structure was deleted)
            fees.forEach(f => {
                if (breakdownMap[f]) {
                    breakdownMap[f].transactions += 1;
                    breakdownMap[f].collected += l.amount / fees.length;
                }
            });
            totalCollected += l.amount;
        }
      });

      const breakdownList = Object.entries(breakdownMap).map(([name, data]) => ({ name, ...data }));
      setBreakdown(breakdownList);

      // Set Stats
      setStats({
        expected_income: totalExpected,
        prediction: totalCollected,
        total_expense: totalExpense,
        net_income: totalCollected - totalExpense,
        collection_rate: totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : 0
      });

      // Fetch reminders only for monthly view (current dues)
      if (viewMode === 'monthly') {
        const { data: remindersData } = await supabase.rpc('get_fee_reminder_list', { p_institution_id: institutionId, p_month: selectedMonth });
        if (remindersData) {
            // Filter reminders by class if selected
            const filteredReminders = selectedClassId !== 'all' 
                ? remindersData.filter((r: any) => r.class_name === classes.find(c => c.id === selectedClassId)?.class_name)
                : remindersData;
            setReminders(filteredReminders);
        }
      } else {
        setReminders([]);
      }

    } catch (err) {
      console.error('Smart Fee Analytics Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendBulkReminder = async (type: 'native' | 'system') => {
    if (reminders.length === 0) return;
    
    if (type === 'native') {
      const phones = reminders.map(r => r.guardian_phone).join(',');
      const body = `আস-সালামু আলাইকুম, আপনার সন্তানের ${selectedMonth} মাসের বকেয়া ফি ৳${reminders[0].balance_due} দ্রুত পরিশোধ করার জন্য অনুরোধ করা হলো।`;
      window.location.href = `sms:${phones}?body=${encodeURIComponent(body)}`;
    } else {
      // System SMS logic would go here
      alert('System SMS sending is not implemented in this demo, but the logic is ready.');
    }
  };

  if (loading) return (
    <div className="flex justify-center py-10">
      <Loader2 className="animate-spin text-[#2563EB]" size={32} />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                    onClick={() => setViewMode('monthly')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'monthly' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Monthly
                </button>
                <button 
                    onClick={() => setViewMode('yearly')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'yearly' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Yearly
                </button>
            </div>
            
            {viewMode === 'monthly' ? (
                <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
            ) : (
                <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            )}
        </div>

        <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select 
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[150px]"
            >
                <option value="all">All Classes</option>
                {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.class_name}</option>
                ))}
            </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-bubble">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
              <DollarSign size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('expected_income', lang)}</p>
          </div>
          <h3 className="text-2xl font-black text-[#1E3A8A]">৳ {stats?.expected_income?.toLocaleString('bn-BD')}</h3>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-bubble">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{viewMode === 'yearly' ? 'Total Collected' : t('predicted_total', lang)}</p>
          </div>
          <h3 className="text-2xl font-black text-[#1E3A8A]">৳ {stats?.prediction?.toLocaleString('bn-BD')}</h3>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-1000" 
              style={{ width: `${Math.min(100, (stats?.prediction / stats?.expected_income) * 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-bubble">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
              <BarChart3 size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('collection_rate_label', lang)}</p>
          </div>
          <h3 className="text-2xl font-black text-[#1E3A8A]">{stats?.collection_rate}%</h3>
          <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Based on current payments</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-bubble">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} className="rotate-180" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Expense</p>
          </div>
          <h3 className="text-2xl font-black text-red-500">৳ {stats?.total_expense?.toLocaleString('bn-BD')}</h3>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-bubble">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
              <Wallet size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Income</p>
          </div>
          <h3 className={`text-2xl font-black ${stats?.net_income >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            ৳ {stats?.net_income?.toLocaleString('bn-BD')}
          </h3>
        </div>
      </div>

      {/* Fee Breakdown Section */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-bubble space-y-4">
        <div className="flex items-center gap-3 mb-2">
           <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center">
              <PieChart size={20} />
           </div>
           <h3 className="text-lg font-black text-[#1E3A8A] font-noto">ফি ব্রেকডাউন ({viewMode === 'monthly' ? selectedMonth : selectedYear})</h3>
        </div>
        
        <div className="space-y-3">
           {breakdown.length > 0 ? breakdown.map((item, idx) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                 <div>
                    <h4 className="font-black text-[#1E3A8A] text-sm">{item.name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                       <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Users size={10}/> {item.students} Students</span>
                       <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10}/> {item.transactions} Paid</span>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Expected / Collected</p>
                    <p className="text-sm font-black text-[#1E3A8A]">৳{item.expected.toLocaleString()} / <span className="text-emerald-500">৳{item.collected.toLocaleString()}</span></p>
                    <p className="text-[10px] font-bold text-red-400 mt-1">Due: ৳{(item.expected - item.collected).toLocaleString()}</p>
                 </div>
              </div>
           )) : (
              <div className="text-center py-8 text-slate-400 text-xs font-bold">No fee structures found</div>
           )}
        </div>
      </div>

      {/* Reminders Section - Only show for Monthly View */}
      {viewMode === 'monthly' && (
        <div className="bg-white p-8 rounded-[2.5rem] text-[#1E293B] shadow-bubble border border-slate-100 space-y-6">
            <div className="flex items-center justify-between">
            <div>
                <h3 className="text-xl font-black font-noto">{t('reminders', lang)}</h3>
                <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">{reminders.length} Students Pending</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center border border-blue-100">
                <AlertCircle size={24} />
            </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
            <button 
                onClick={() => sendBulkReminder('system')}
                className="h-14 bg-[#2563EB] text-white rounded-2xl font-black text-[10px] uppercase shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
                <MessageSquare size={16} fill="currentColor" /> {t('system_sms', lang)}
            </button>
            <button 
                onClick={() => sendBulkReminder('native')}
                className="h-14 bg-slate-50 text-slate-600 rounded-2xl font-black text-[10px] uppercase border border-slate-200 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
                <Smartphone size={16} fill="currentColor" /> {t('native_sms', lang)}
            </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {reminders.map((r, idx) => (
                <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="min-w-0">
                    <h4 className="font-black text-[#1E3A8A] text-sm font-noto truncate">{r.student_name}</h4>
                    <p className="text-[9px] font-bold opacity-60 uppercase">{r.class_name} • Due: ৳{r.balance_due}</p>
                </div>
                <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${
                    r.reminder_type === 'final' ? 'bg-red-500 text-white' : r.reminder_type === 'strong' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                }`}>
                    {r.reminder_type === 'final' ? t('final_warning', lang) : r.reminder_type === 'strong' ? t('strong_reminder', lang) : t('soft_reminder', lang)}
                </span>
                </div>
            ))}
            {reminders.length === 0 && (
                <div className="text-center py-10 opacity-40">
                <CheckCircle2 size={32} className="mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">All fees collected!</p>
                </div>
            )}
            </div>
        </div>
      )}
    </div>
  );
};

export default SmartFeeAnalytics;
