
import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Madrasah, LedgerEntry, Fee, Language, UserRole, Class, Student } from 'types';
import { Calculator, Plus, ArrowUpCircle, ArrowDownCircle, Wallet, History, Users, Loader2, Save, X, Calendar, DollarSign, Tag, FileText, CheckCircle2, TrendingUp, AlertCircle, Send, Search, ChevronDown, BarChart3, Settings2, RefreshCw, Info, Download } from 'lucide-react';
import { t } from 'translations';
import { sortMadrasahClasses } from 'pages/Classes';
import SmartFeeAnalytics from 'components/SmartFeeAnalytics';
import { generateClassFeeReportPDF } from '../utils/pdfGenerator';

interface AccountingProps {
  lang: Language;
  madrasah: Madrasah | null;
  onBack: () => void;
  role: UserRole;
}

const Accounting: React.FC<AccountingProps> = ({ lang, madrasah, onBack, role }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'ledger' | 'fees' | 'structures'>('fees');
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [feesReport, setFeesReport] = useState<any[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddLedger, setShowAddLedger] = useState(false);
  const [showAddStructure, setShowAddStructure] = useState(false);
  const [showFeeCollection, setShowFeeCollection] = useState(false);
  
  const [anyStudentsInMadrasah, setAnyStudentsInMadrasah] = useState<boolean | null>(null);

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [desc, setDesc] = useState('');

  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  
  const [availableFeeItems, setAvailableFeeItems] = useState<any[]>([]);
  const [selectedFeeCategories, setSelectedFeeCategories] = useState<string[]>([]);
  const [paidFeeCategories, setPaidFeeCategories] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (madrasah) {
      fetchData();
      fetchClasses();
    }
  }, [madrasah?.id, activeTab, selectedMonth, selectedClass]);

  useEffect(() => {
    if (selectedStudent) {
      initializeFeeCollection(selectedStudent);
    }
  }, [selectedStudent]);

  const calculateTotal = (categories: string[], discountVal: string) => {
      const gross = availableFeeItems
          .filter(item => categories.includes(item.fee_name))
          .reduce((sum, item) => sum + item.amount, 0);
      
      const disc = parseFloat(discountVal) || 0;
      const net = Math.max(0, gross - disc);
      return net > 0 ? net.toString() : '';
  };

  const initializeFeeCollection = async (student: any) => {
      setDiscount('');
      
      // 1. Fetch structures
      const { data: structures } = await supabase.from('fee_structures').select('*').eq('class_id', student.class_id);
      if (!structures) {
          setAvailableFeeItems([]);
          return;
      }
      setAvailableFeeItems(structures);

      // 2. Fetch ledger entries for this student/month to see what's paid
      const { data: ledgerData } = await supabase.from('ledger')
        .select('description')
        .eq('madrasah_id', madrasah?.id)
        .eq('type', 'income')
        .eq('category', 'Student Fee')
        .ilike('description', `%${student.student_name} (${selectedMonth})%`);

      const paidItems: string[] = [];
      ledgerData?.forEach(l => {
          const desc = l.description.split(' - ')[0];
          if (desc) {
              desc.split(', ').forEach(item => paidItems.push(item));
          }
      });
      setPaidFeeCategories(paidItems);

      // 3. Select unpaid items
      const unpaid = structures.filter(s => !paidItems.includes(s.fee_name));
      const unpaidNames = unpaid.map(s => s.fee_name);
      setSelectedFeeCategories(unpaidNames);
      
      // 4. Set initial amount
      const total = unpaid.reduce((sum, s) => sum + s.amount, 0);
      setCollectAmount(total > 0 ? total.toString() : '');
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('madrasah_id', madrasah?.id);
    if (data) setClasses(sortMadrasahClasses(data));
  };

  const fetchData = async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    setFetchError(null);
    try {
      if (activeTab === 'summary' || activeTab === 'ledger') {
        const { data } = await supabase.from('ledger').select('*').eq('madrasah_id', madrasah.id).order('transaction_date', { ascending: false });
        if (data) setLedger(data);
      }
      
      if (activeTab === 'fees') {
        const classId = selectedClass === '' ? null : selectedClass;
        
        const { data, error } = await supabase.rpc('get_monthly_dues_report', {
          p_madrasah_id: madrasah.id,
          p_class_id: classId,
          p_month: selectedMonth
        });
        
        if (error) {
          console.error("RPC Error:", error);
          setFetchError(error.message);
          setFeesReport([]);
          return;
        }

        setFeesReport(data || []);

        if (!data || data.length === 0) {
          let checkQuery = supabase.from('students').select('id', { count: 'exact', head: true }).eq('madrasah_id', madrasah.id);
          if (classId) checkQuery = checkQuery.eq('class_id', classId);
          const { count } = await checkQuery;
          setAnyStudentsInMadrasah(count && count > 0 ? true : false);
        } else {
          setAnyStudentsInMadrasah(true);
        }
      }

      if (activeTab === 'structures') {
        const { data } = await supabase.from('fee_structures').select('*, classes(class_name)').eq('madrasah_id', madrasah.id);
        if (data) setStructures(data);
      }
      setRefreshKey(prev => prev + 1);
    } catch (e: any) { 
      console.error("Accounting Fetch Error:", e);
      setFetchError(e.message);
    } finally { setLoading(false); }
  };

  const handleCollectFee = async () => {
    if (!madrasah || !selectedStudent || !collectAmount) return;
    setIsSaving(true);
    try {
      const amt = parseFloat(collectAmount);
      const discountAmt = parseFloat(discount) || 0;
      
      const feeData = {
        madrasah_id: madrasah.id,
        student_id: selectedStudent.student_id,
        class_id: selectedStudent.class_id,
        amount_paid: amt,
        month: selectedMonth,
        status: (Number(selectedStudent.total_paid) + amt + discountAmt) >= Number(selectedStudent.total_payable) ? 'paid' : 'partial'
      };

      // Try inserting with discount first
      let { error: feeErr } = await supabase.from('fees').insert({
        ...feeData,
        discount: discountAmt
      });
      
      // If error is about missing column, retry without discount
      if (feeErr && (feeErr.message.includes('column') || feeErr.code === '42703')) {
          const { error: retryErr } = await supabase.from('fees').insert(feeData);
          feeErr = retryErr;
      }
      
      if (feeErr) {
        throw feeErr;
      }

      // লেনদেনের খেরাতে (Ledger) আয় যোগ করা
      const feeDescription = selectedFeeCategories.join(', ');
      const className = classes.find(c => c.id === selectedStudent.class_id)?.class_name || '';
      const roll = selectedStudent.roll || '-';
      
      await supabase.from('ledger').insert({
        madrasah_id: madrasah.id,
        type: 'income',
        amount: amt,
        category: 'Student Fee',
        description: `${feeDescription} - ${selectedStudent.student_name} (${className} | Roll: ${roll} | ${selectedMonth})${discountAmt > 0 ? ` (ছাড়: ৳${discountAmt})` : ''}`,
        transaction_date: new Date().toISOString().split('T')[0]
      });

      setShowFeeCollection(false);
      setCollectAmount('');
      setDiscount('');
      setSelectedStudent(null);
      fetchData();
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleAddLedger = async () => {
    if (!madrasah || !amount || !category) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('ledger').insert({
        madrasah_id: madrasah.id,
        type: type,
        amount: parseFloat(amount),
        category: category.trim(),
        description: desc.trim(),
        transaction_date: new Date().toISOString().split('T')[0]
      });
      if (error) throw error;
      setShowAddLedger(false);
      setAmount(''); setCategory(''); setDesc('');
      fetchData();
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  const totals = ledger.reduce((acc, curr) => {
    if (curr.type === 'income') acc.income += curr.amount;
    else acc.expense += curr.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const totalDues = feesReport.reduce((sum, item) => sum + Number(item.balance_due), 0);

  const handleDownloadClassReport = async () => {
    if (!madrasah || !selectedClass) {
      alert('Please select a class first');
      return;
    }

    if (feesReport.length === 0) {
      alert('No data to download');
      return;
    }

    const className = classes.find(c => c.id === selectedClass)?.class_name || 'All Classes';

    try {
      generateClassFeeReportPDF(
          className,
          selectedMonth,
          feesReport,
          { name: madrasah.name }
      );
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading PDF');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#2563EB] border border-blue-100">
            <Calculator size={20}/>
          </button>
          <h1 className="text-xl font-black text-[#1E293B] font-noto">ফি ও হিসাব</h1>
        </div>
        <div className="flex gap-2">
            <button onClick={() => fetchData()} className={`w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center active:scale-95 transition-all ${loading ? 'animate-spin' : ''}`}><RefreshCw size={18}/></button>
            <button onClick={() => setShowAddLedger(true)} className="w-10 h-10 bg-[#2563EB] text-white rounded-xl shadow-premium flex items-center justify-center active:scale-95 transition-all"><Plus size={20}/></button>
        </div>
      </div>

      <div className="flex p-1.5 bg-slate-50 rounded-[1.5rem] border border-slate-100 overflow-x-auto no-scrollbar">
        {(['fees', 'summary', 'ledger', 'structures'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === tab ? 'bg-[#2563EB] text-white shadow-premium' : 'text-slate-400'}`}>
            {tab === 'summary' ? 'ড্যাশবোর্ড' : tab === 'ledger' ? 'লেনদেন' : tab === 'fees' ? 'ছাত্র ফি' : 'ফি সেটিংস'}
          </button>
        ))}
      </div>

      {activeTab === 'fees' && (
        <div className="space-y-4 animate-in slide-in-from-bottom-5">
           <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-bubble space-y-4">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                 {/* Class Selector */}
                 <div className="relative flex-1 min-w-[140px]">
                    <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between group active:scale-[0.98] transition-all">
                       <span className="text-[11px] font-black text-[#1E3A8A] truncate">{classes.find(c => c.id === selectedClass)?.class_name || 'সব শ্রেণি'}</span>
                       <ChevronDown size={16} className="text-slate-400 group-hover:text-[#2563EB] transition-colors" />
                    </button>
                    {showClassDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-1 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                            <button onClick={() => { setSelectedClass(''); setShowClassDropdown(false); }} className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-black text-slate-600 hover:bg-slate-50 hover:text-[#2563EB] transition-colors">সব শ্রেণি</button>
                            {classes.map(c => (
                                <button key={c.id} onClick={() => { setSelectedClass(c.id); setShowClassDropdown(false); }} className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-black text-slate-600 hover:bg-slate-50 hover:text-[#2563EB] transition-colors">{c.class_name}</button>
                            ))}
                        </div>
                    )}
                 </div>

                 {/* Month Selector */}
                 <div className="relative flex-1 min-w-[140px]">
                    <input type="month" className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black text-[#1E3A8A] outline-none focus:border-[#2563EB]/30 transition-all" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
                 </div>

                 {/* Status Filter */}
                 <div className="relative flex-1 min-w-[140px]">
                     <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black text-[#1E3A8A] outline-none appearance-none focus:border-[#2563EB]/30 transition-all"
                    >
                        <option value="all">সব স্ট্যাটাস</option>
                        <option value="paid">পরিশোধিত (Paid)</option>
                        <option value="partial">আংশিক (Partial)</option>
                        <option value="unpaid">বকেয়া (Unpaid)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16}/>
                 </div>

                 {/* Download Button */}
                 <button onClick={handleDownloadClassReport} className="w-11 h-11 bg-white text-slate-400 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm hover:bg-blue-50 hover:text-[#2563EB] hover:border-blue-100 active:scale-95 transition-all" title="Download Report">
                     <Download size={20} />
                 </button>
              </div>
           </div>

           {fetchError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold shadow-sm">
                 <div className="bg-red-500 text-white p-2 rounded-xl">
                    <AlertCircle size={20} />
                 </div>
                 <div className="flex-1">
                    <p className="font-black">স্কিমা এরর!</p>
                    <p className="opacity-70">{fetchError}</p>
                    <p className="mt-1 font-normal opacity-60">সমাধান: SQL এডিটর থেকে নতুন প্রোভাইড করা কোডটি রান করুন।</p>
                 </div>
                 <button onClick={() => fetchData()} className="bg-white px-3 py-1.5 rounded-lg border border-red-200 text-red-600 active:scale-95"><RefreshCw size={14}/></button>
              </div>
           )}

           <div className="space-y-2.5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Loader2 className="animate-spin mb-4" size={32} />
                  <p className="text-[10px] font-black uppercase tracking-widest">ডাটা লোড হচ্ছে...</p>
                </div>
              ) : feesReport.length > 0 ? (
                  feesReport.filter((item: any) => {
                      const isFullyPaid = Number(item.balance_due) <= 0 && Number(item.total_payable) > 0;
                      const isPartial = Number(item.balance_due) > 0 && Number(item.total_paid) > 0;
                      const isUnpaid = Number(item.total_paid) === 0 && Number(item.total_payable) > 0;

                      if (statusFilter === 'paid') return isFullyPaid;
                      if (statusFilter === 'partial') return isPartial;
                      if (statusFilter === 'unpaid') return isUnpaid;
                      return true;
                  }).map((item: any) => {
                    const isFullyPaid = Number(item.balance_due) <= 0 && Number(item.total_payable) > 0;
                    const isPartial = Number(item.balance_due) > 0 && Number(item.total_paid) > 0;
                    const isNoFeeSet = Number(item.total_payable) === 0;

                    return (
                    <div key={item.student_id} className="bg-white p-4 rounded-[1.8rem] border border-slate-100 shadow-bubble flex items-center justify-between group active:scale-[0.98] transition-all">
                       <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-11 h-11 rounded-[1rem] flex items-center justify-center font-black shrink-0 ${isFullyPaid ? 'bg-emerald-50 text-emerald-500' : isPartial ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-[#2563EB]'}`}>
                             {item.roll || '-'}
                          </div>
                          <div className="min-w-0">
                             <h5 className="font-black text-[#1E3A8A] font-noto truncate leading-tight mb-1">{item.student_name}</h5>
                             <div className="flex items-center gap-2">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">বকেয়া: ৳{item.balance_due}</p>
                                {isNoFeeSet && <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-black uppercase">No Fee Set</span>}
                             </div>
                          </div>
                       </div>
                       <div className="flex items-center gap-2">
                         <button 
                            onClick={() => { setSelectedStudent(item); setCollectAmount(''); setShowFeeCollection(true); }} 
                            disabled={isFullyPaid || isNoFeeSet} 
                            className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm ${isFullyPaid ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : isNoFeeSet ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : isPartial ? 'bg-orange-500 text-white active:scale-95 shadow-orange-200' : 'bg-[#2563EB] text-white active:scale-95'}`}
                         >
                            {isFullyPaid ? 'PAID' : 'ফি জমা নিন'}
                         </button>
                       </div>
                    </div>
                  )})
              ) : !fetchError && (
                <div className="text-center py-16 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 mx-2 px-6 flex flex-col items-center">
                   <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-200 mb-5">
                      {anyStudentsInMadrasah ? <Info size={32} /> : <Users size={32} />}
                   </div>
                   <h3 className="text-[#1E293B] text-lg font-black font-noto leading-tight">
                     {anyStudentsInMadrasah ? 'রিপোর্ট পাওয়া যায়নি' : 'কোনো ছাত্র পাওয়া যায়নি'}
                   </h3>
                   <p className="text-slate-400 text-[10px] font-bold mt-2 uppercase tracking-wide leading-relaxed">
                     {anyStudentsInMadrasah 
                        ? 'আপনার ডাটাবেসে ছাত্র আছে, কিন্তু তারা সম্ভবত সঠিক শ্রেণিতে নিবন্ধিত নয় অথবা ডাটাবেস ফাংশনে সমস্যা হচ্ছে।'
                        : 'এই মাদরাসার অধীনে কোনো ছাত্র নিবন্ধিত নেই। অনুগ্রহ করে ছাত্র যোগ করুন।'}
                   </p>
                </div>
              )}
           </div>
        </div>
      )}
      
      {/* বাকি ট্যাবগুলো একই থাকবে */}
      {activeTab === 'summary' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-5">
          {madrasah && (
            <SmartFeeAnalytics 
              madrasahId={madrasah.id} 
              lang={lang} 
              month={selectedMonth} 
              refreshKey={refreshKey}
              classes={classes}
            />
          )}
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="space-y-3 animate-in slide-in-from-bottom-5">
          {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" /></div> : ledger.length > 0 ? (
            ledger.map(entry => {
              let displayName = entry.category;
              let details = '';
              let feeType = '';

              if (entry.category === 'Student Fee') {
                // Parse description: "FeeType - StudentName (Details)"
                const parts = entry.description.split(' - ');
                if (parts.length >= 2) {
                  feeType = parts[0];
                  const namePart = parts.slice(1).join(' - '); // Handle names with dashes if any
                  const nameMatch = namePart.match(/^(.*?)\s*\((.*?)\)/);
                  if (nameMatch) {
                    displayName = nameMatch[1];
                    details = nameMatch[2];
                  } else {
                    displayName = namePart;
                  }
                }
              }

              return (
              <div key={entry.id} className="bg-white p-4 rounded-[1.8rem] border border-slate-100 shadow-bubble flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${entry.type === 'income' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                    {entry.type === 'income' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                  </div>
                  <div>
                    <h5 className="font-black text-[#1E3A8A] font-noto leading-none mb-1">{displayName}</h5>
                    {entry.category === 'Student Fee' && (
                        <div className="flex flex-col gap-0.5">
                            <p className="text-[10px] text-slate-500 font-bold">{details}</p>
                            <p className="text-[9px] text-slate-400 font-bold">{feeType}</p>
                        </div>
                    )}
                    {entry.category !== 'Student Fee' && (
                        <p className="text-[10px] text-slate-400 font-bold">{new Date(entry.transaction_date).toLocaleDateString('bn-BD')}</p>
                    )}
                  </div>
                </div>
                <div className={`text-right ${entry.type === 'income' ? 'text-emerald-600' : 'text-red-600'} font-black`}>
                  {entry.type === 'income' ? '+' : '-'} ৳{entry.amount}
                </div>
              </div>
            )})
          ) : <div className="text-center py-20 text-slate-400 uppercase text-xs font-black">No transactions</div>}
        </div>
      )}

      {activeTab === 'structures' && (
        <div className="space-y-4 animate-in slide-in-from-bottom-5">
           <button onClick={() => setShowAddStructure(true)} className="w-full py-5 bg-white rounded-[2.2rem] text-[#2563EB] font-black flex items-center justify-center gap-3 shadow-bubble active:scale-95 transition-all border border-slate-100">
              <Plus size={24} strokeWidth={3} /> নতুন ফি আইটেম যোগ করুন
           </button>
           <div className="space-y-3">
              {structures.length > 0 ? structures.map(s => (
                <div key={s.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex items-center justify-between">
                   <div className="min-w-0">
                      <h5 className="font-black text-[#1E3A8A] font-noto text-[17px] truncate">{s.fee_name}</h5>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">{s.classes?.class_name}</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                       <div className="text-2xl font-black text-[#2563EB] shrink-0">৳{s.amount}</div>
                       <button onClick={async () => {
                           if(confirm('এটি ডিলিট করতে চান?')) {
                               await supabase.from('fee_structures').delete().eq('id', s.id);
                               fetchData();
                           }
                       }} className="p-2 text-red-300 hover:text-red-500"><X size={18}/></button>
                   </div>
                </div>
              )) : (
                <div className="text-center py-20 text-slate-400 uppercase text-xs font-black">No Fee Structures Set</div>
              )}
           </div>
        </div>
      )}

      {/* COLLECT FEE MODAL */}
      {showFeeCollection && selectedStudent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
              <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 overflow-y-auto max-h-[80vh] shadow-2xl">
                  <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-[#1E3A8A] font-noto">ফি সংগ্রহ করুন</h3>
                      <button onClick={() => setShowFeeCollection(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">ছাত্রের নাম</p>
                      <h4 className="text-xl font-black text-[#1E3A8A] font-noto">{selectedStudent.student_name}</h4>
                      <div className="grid grid-cols-3 gap-2 mt-4">
                          <div className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                            <p className="text-[7px] font-black text-slate-400 uppercase"> Payable </p>
                            <p className="font-black text-blue-600 text-sm">৳{selectedStudent.total_payable}</p>
                          </div>
                          <div className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                            <p className="text-[7px] font-black text-slate-400 uppercase"> Paid </p>
                            <p className="font-black text-green-600 text-sm">৳{selectedStudent.total_paid}</p>
                          </div>
                          <div className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                            <p className="text-[7px] font-black text-slate-400 uppercase"> Due </p>
                            <p className="font-black text-red-600 text-sm">৳{selectedStudent.balance_due}</p>
                          </div>
                      </div>
                  </div>
                  <div className="space-y-4">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ফি-র ধরণ (Fee Type)</label>
                          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 max-h-40 overflow-y-auto">
                              <div className="space-y-2">
                                  {availableFeeItems.length > 0 ? (
                                      availableFeeItems.map(item => {
                                          const isPaid = paidFeeCategories.includes(item.fee_name);
                                          const isSelected = selectedFeeCategories.includes(item.fee_name);
                                          
                                          return (
                                              <label key={item.id} className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${isPaid ? 'bg-emerald-50 cursor-default' : 'hover:bg-white cursor-pointer'}`}>
                                                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected || isPaid ? 'bg-[#2563EB] border-[#2563EB]' : 'border-slate-300'} ${isPaid ? 'opacity-50' : ''}`}>
                                                      {(isSelected || isPaid) && <CheckCircle2 size={14} className="text-white" />}
                                                  </div>
                                                  <input 
                                                      type="checkbox" 
                                                      className="hidden"
                                                      checked={isSelected || isPaid}
                                                      disabled={isPaid}
                                                      onChange={(e) => {
                                                          if (isPaid) return;
                                                          let newCategories = [];
                                                          if (e.target.checked) {
                                                              newCategories = [...selectedFeeCategories, item.fee_name];
                                                          } else {
                                                              newCategories = selectedFeeCategories.filter(c => c !== item.fee_name);
                                                          }
                                                          setSelectedFeeCategories(newCategories);
                                                          setCollectAmount(calculateTotal(newCategories, discount));
                                                      }}
                                                  />
                                                  <div className="flex-1 flex justify-between items-center">
                                                      <span className={`text-xs font-black ${isPaid ? 'text-emerald-600' : 'text-[#1E3A8A]'}`}>
                                                          {item.fee_name} {isPaid && '(পরিশোধিত)'}
                                                      </span>
                                                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">৳{item.amount}</span>
                                                  </div>
                                              </label>
                                          );
                                      })
                                  ) : (
                                      <div className="text-center py-4 text-slate-400 text-xs font-bold">কোনো ফি আইটেম পাওয়া যায়নি। দয়া করে ফি সেটিংস থেকে আইটেম যোগ করুন।</div>
                                  )}
                              </div>
                          </div>
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">জমা টাকার পরিমাণ</label>
                          <div className="relative">
                            <input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="0.00" value={collectAmount} onChange={(e) => setCollectAmount(e.target.value)} />
                            <DollarSign className="absolute left-4 top-4 text-[#2563EB]" size={20}/>
                          </div>
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ছাড় / ডিসকাউন্ট (যদি থাকে)</label>
                          <div className="relative">
                            <input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-orange-500/20" placeholder="0.00" value={discount} onChange={(e) => {
                                setDiscount(e.target.value);
                                setCollectAmount(calculateTotal(selectedFeeCategories, e.target.value));
                            }} />
                            <Tag className="absolute left-4 top-4 text-orange-500" size={20}/>
                          </div>
                      </div>
                      <button onClick={handleCollectFee} disabled={isSaving || !collectAmount} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all text-base">
                          {isSaving ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={20}/> পেমেন্ট নিশ্চিত করুন</>}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ADD LEDGER MODAL */}
      {showAddLedger && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#1E3A8A]">নতুন লেনদেন যোগ করুন</h3>
               <button onClick={() => setShowAddLedger(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
             </div>
             <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                <button onClick={() => setType('income')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${type === 'income' ? 'bg-white text-emerald-50 shadow-md text-emerald-500' : 'text-slate-400'}`}>আয় (Income)</button>
                <button onClick={() => setType('expense')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${type === 'expense' ? 'bg-white text-red-50 shadow-md text-red-500' : 'text-slate-400'}`}>ব্যয় (Expense)</button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="টাকার পরিমাণ" value={amount} onChange={(e) => setAmount(e.target.value)} /><DollarSign className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="ক্যাটাগরি (যেমন: বেতন, বিদ্যুৎ)" value={category} onChange={(e) => setCategory(e.target.value)} /><Tag className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative"><textarea className="w-full h-24 bg-slate-50 rounded-2xl px-12 py-4 font-bold text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 resize-none" placeholder="বিবরণ" value={desc} onChange={(e) => setDesc(e.target.value)} /><FileText className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <button onClick={handleAddLedger} disabled={isSaving} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20}/> সংরক্ষণ করুন</>}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* ADD STRUCTURE MODAL */}
      {showAddStructure && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl relative">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-[#1E3A8A]">ফি সেটআপ করুন</h3>
                <button onClick={() => setShowAddStructure(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                 <div className="relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">শ্রেণি নির্বাচন করুন</label>
                    <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-14 px-6 rounded-2xl border-2 border-slate-100 bg-slate-50 flex items-center justify-between font-black text-[#1E3A8A]">
                       <span className="truncate">{classes.find(c => c.id === selectedClass)?.class_name || 'শ্রেণি বেছে নিন'}</span>
                       <ChevronDown size={20} className="text-slate-300" />
                    </button>
                    {showClassDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[1001] p-2 max-h-48 overflow-y-auto">
                            {classes.map(c => (
                                <button key={c.id} onClick={() => { setSelectedClass(c.id); setShowClassDropdown(false); }} className="w-full text-left px-5 py-3 rounded-xl hover:bg-slate-50 font-black text-[#1E3A8A]">{c.class_name}</button>
                            ))}
                        </div>
                    )}
                 </div>
                 <div className="relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">ফি-র নাম</label>
                    <input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="যেমন: মাসিক বেতন" value={category} onChange={(e) => setCategory(e.target.value)} />
                    <Tag className="absolute left-4 top-[44px] text-slate-300" size={20}/>
                    <div className="flex flex-wrap gap-2 mt-2 px-1">
                       {['পরীক্ষার ফি', 'কোচিং ফি', 'অন্যান্য ফি'].map(suggestion => (
                          <button 
                             key={suggestion}
                             type="button"
                             onClick={() => setCategory(suggestion)}
                             className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${category === suggestion ? 'bg-blue-50 text-[#2563EB] border-[#2563EB]/20' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                          >
                             {suggestion}
                          </button>
                       ))}
                    </div>
                 </div>
                 <div className="relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">টাকার পরিমাণ</label>
                    <input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    <DollarSign className="absolute left-4 top-[44px] text-[#2563EB]" size={20}/>
                 </div>
                 
                 <button onClick={async () => {
                    if (!selectedClass || !category || !amount) return;
                    setIsSaving(true);
                    try {
                        const { error } = await supabase.from('fee_structures').insert({
                            madrasah_id: madrasah?.id,
                            class_id: selectedClass,
                            fee_name: category,
                            amount: parseFloat(amount)
                        });
                        if (error) throw error;
                        setShowAddStructure(false);
                        setCategory(''); setAmount(''); setSelectedClass('');
                        fetchData();
                    } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
                 }} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all text-base">
                    {isSaving ? <Loader2 className="animate-spin" /> : 'সেভ করুন'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Accounting;
