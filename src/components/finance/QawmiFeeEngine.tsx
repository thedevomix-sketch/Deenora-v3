import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Class } from 'types';
import { Loader2, Plus, X, DollarSign, Tag, CheckCircle2, Download, ChevronDown, RefreshCw, AlertCircle, Info, Users, HandHeart } from 'lucide-react';
import { sortMadrasahClasses } from 'pages/Classes';
import { generateClassFeeReportPDF } from '../../utils/pdfGenerator';

interface QawmiFeeEngineProps {
  activeTab: 'fees' | 'structures';
  madrasah: Institution;
  lang: string;
}

export const QawmiFeeEngine: React.FC<QawmiFeeEngineProps> = ({ activeTab, madrasah, lang }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [feesReport, setFeesReport] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Fee Collection State
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [anyStudentsInMadrasah, setAnyStudentsInMadrasah] = useState<boolean | null>(null);
  
  // Collection Modal State
  const [showFeeCollection, setShowFeeCollection] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [donationType, setDonationType] = useState('Monthly Fee');
  const [isSaving, setIsSaving] = useState(false);

  // Structure State
  const [showAddStructure, setShowAddStructure] = useState(false);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    fetchClasses();
  }, [madrasah.id]);

  useEffect(() => {
    fetchData();
  }, [madrasah.id, activeTab, selectedMonth, selectedClass]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('institution_id', madrasah.id);
    if (data) setClasses(sortMadrasahClasses(data));
  };

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      if (activeTab === 'fees') {
        const classId = selectedClass === '' ? null : selectedClass;
        
        // For Qawmi, we might use a different report or the same one but interpret it differently
        // Using the same report for now as a base
        const { data, error } = await supabase.rpc('get_monthly_dues_report', {
          p_institution_id: madrasah.id,
          p_class_id: classId,
          p_month: selectedMonth
        });
        
        if (error) throw error;

        setFeesReport(data || []);

        if (!data || data.length === 0) {
          let checkQuery = supabase.from('students').select('id', { count: 'exact', head: true }).eq('institution_id', madrasah.id);
          if (classId) checkQuery = checkQuery.eq('class_id', classId);
          const { count } = await checkQuery;
          setAnyStudentsInMadrasah(count && count > 0 ? true : false);
        } else {
          setAnyStudentsInMadrasah(true);
        }
      }

      if (activeTab === 'structures') {
        const { data } = await supabase.from('fee_structures').select('*, classes(class_name)').eq('institution_id', madrasah.id);
        if (data) setStructures(data || []);
      }
    } catch (e: any) {
      console.error("Fetch Error:", e);
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCollectFee = async () => {
    if (!selectedStudent || !collectAmount) return;
    setIsSaving(true);
    try {
      const amt = parseFloat(collectAmount);
      
      const feeData = {
        institution_id: madrasah.id,
        student_id: selectedStudent.student_id,
        class_id: selectedStudent.class_id,
        amount_paid: amt,
        month: selectedMonth,
        status: 'paid' // Qawmi payments are often flexible, so any payment might be considered 'paid' or just recorded
      };

      const { error: feeErr } = await supabase.from('fees').insert(feeData);
      if (feeErr) throw feeErr;

      // Add to Ledger
      const className = classes.find(c => c.id === selectedStudent.class_id)?.class_name || '';
      const roll = selectedStudent.roll || '-';
      
      await supabase.from('ledger').insert({
        institution_id: madrasah.id,
        type: 'income',
        amount: amt,
        category: 'Student Fee', // Or 'Donation'
        description: `${donationType} - ${selectedStudent.student_name} (${className} | Roll: ${roll} | ${selectedMonth})`,
        transaction_date: new Date().toISOString().split('T')[0]
      });

      setShowFeeCollection(false);
      setCollectAmount('');
      setSelectedStudent(null);
      fetchData();
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setIsSaving(false); 
    }
  };

  if (activeTab === 'fees') {
    return (
      <div className="space-y-4 animate-in slide-in-from-bottom-5">
         <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-bubble space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
               {/* Class Selector */}
               <div className="relative flex-1 min-w-[140px]">
                  <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between group active:scale-[0.98] transition-all">
                     <span className="text-[11px] font-black text-[#1E3A8A] truncate">{classes.find(c => c.id === selectedClass)?.class_name || 'সব জামাত (Classes)'}</span>
                     <ChevronDown size={16} className="text-slate-400 group-hover:text-[#2563EB] transition-colors" />
                  </button>
                  {showClassDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-1 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                          <button onClick={() => { setSelectedClass(''); setShowClassDropdown(false); }} className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-black text-slate-600 hover:bg-slate-50 hover:text-[#2563EB] transition-colors">সব জামাত</button>
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
            </div>
         </div>

         <div className="space-y-2.5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p className="text-[10px] font-black uppercase tracking-widest">ডাটা লোড হচ্ছে...</p>
              </div>
            ) : feesReport.length > 0 ? (
                feesReport.filter((item: any) => {
                    // Qawmi logic might be different, but using standard for now
                    const isFullyPaid = Number(item.balance_due) <= 0 && Number(item.total_payable) > 0;
                    const isPartial = Number(item.balance_due) > 0 && Number(item.total_paid) > 0;
                    const isUnpaid = Number(item.total_paid) === 0 && Number(item.total_payable) > 0;

                    if (statusFilter === 'paid') return isFullyPaid;
                    if (statusFilter === 'partial') return isPartial;
                    if (statusFilter === 'unpaid') return isUnpaid;
                    return true;
                }).map((item: any) => {
                  const isFullyPaid = Number(item.balance_due) <= 0 && Number(item.total_payable) > 0;
                  
                  return (
                  <div key={item.student_id} className="bg-white p-4 rounded-[1.8rem] border border-slate-100 shadow-bubble flex items-center justify-between group active:scale-[0.98] transition-all">
                     <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-[1rem] bg-emerald-50 text-emerald-600 flex items-center justify-center font-black shrink-0">
                           {item.roll || '-'}
                        </div>
                        <div className="min-w-0">
                           <h5 className="font-black text-[#1E3A8A] font-noto truncate leading-tight mb-1">{item.student_name}</h5>
                           <div className="flex items-center gap-2">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Paid: ৳{item.total_paid}</p>
                           </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                       <button 
                          onClick={() => { setSelectedStudent(item); setCollectAmount(''); setShowFeeCollection(true); }} 
                          className="px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm bg-[#2563EB] text-white active:scale-95"
                       >
                          জমা নিন
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
                   {anyStudentsInMadrasah ? 'কোনো ডাটা পাওয়া যায়নি' : 'কোনো ছাত্র পাওয়া যায়নি'}
                 </h3>
              </div>
            )}
         </div>

         {/* COLLECT FEE MODAL */}
         {showFeeCollection && selectedStudent && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
                <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 overflow-y-auto max-h-[80vh] shadow-2xl">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-[#1E3A8A] font-noto">কওমি ফি / অনুদান</h3>
                        <button onClick={() => setShowFeeCollection(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">ছাত্রের নাম</p>
                        <h4 className="text-xl font-black text-[#1E3A8A] font-noto">{selectedStudent.student_name}</h4>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">বাবদ (Purpose)</label>
                            <div className="flex flex-wrap gap-2">
                                {['মাসিক খোরাকি', 'ভর্তি ফি', 'কিতাব ফি', 'অনুদান', 'অন্যান্য'].map(type => (
                                    <button 
                                        key={type} 
                                        onClick={() => setDonationType(type)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${donationType === type ? 'bg-blue-50 text-[#2563EB] border-[#2563EB]/20' : 'bg-white text-slate-400 border-slate-100'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">জমা টাকার পরিমাণ</label>
                            <div className="relative">
                              <input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="0.00" value={collectAmount} onChange={(e) => setCollectAmount(e.target.value)} />
                              <DollarSign className="absolute left-4 top-4 text-[#2563EB]" size={20}/>
                            </div>
                        </div>
                        <button onClick={handleCollectFee} disabled={isSaving || !collectAmount} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all text-base">
                            {isSaving ? <Loader2 className="animate-spin" /> : <><HandHeart size={20}/> জমা নিন</>}
                        </button>
                    </div>
                </div>
            </div>
         )}
      </div>
    );
  }

  if (activeTab === 'structures') {
    return (
      <div className="space-y-4 animate-in slide-in-from-bottom-5">
         <button onClick={() => setShowAddStructure(true)} className="w-full py-5 bg-white rounded-[2.2rem] text-[#2563EB] font-black flex items-center justify-center gap-3 shadow-bubble active:scale-95 transition-all border border-slate-100">
            <Plus size={24} strokeWidth={3} /> নতুন ফি/অনুদান খাত যোগ করুন
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
              <div className="text-center py-20 text-slate-400 uppercase text-xs font-black">কোনো ফি স্ট্রাকচার সেট করা নেই</div>
            )}
         </div>

         {/* ADD STRUCTURE MODAL */}
         {showAddStructure && (
           <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
              <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl relative">
                 <div className="flex items-center justify-between">
                   <h3 className="text-xl font-black text-[#1E3A8A]">ফি/অনুদান সেটআপ</h3>
                   <button onClick={() => setShowAddStructure(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
                 </div>
                 <div className="space-y-4">
                    <div className="relative">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">জামাত (Class)</label>
                       <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-14 px-6 rounded-2xl border-2 border-slate-100 bg-slate-50 flex items-center justify-between font-black text-[#1E3A8A]">
                          <span className="truncate">{classes.find(c => c.id === selectedClass)?.class_name || 'জামাত বেছে নিন'}</span>
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
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">খাতের নাম</label>
                       <input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="যেমন: খোরাকি" value={category} onChange={(e) => setCategory(e.target.value)} />
                       <Tag className="absolute left-4 top-[44px] text-slate-300" size={20}/>
                       <div className="flex flex-wrap gap-2 mt-2 px-1">
                          {['খোরাকি', 'ভর্তি ফি', 'কিতাব ফি'].map(suggestion => (
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
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">ধার্যকৃত টাকা (Optional)</label>
                       <input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                       <DollarSign className="absolute left-4 top-[44px] text-[#2563EB]" size={20}/>
                    </div>
                    
                    <button onClick={async () => {
                       if (!selectedClass || !category) return;
                       setIsSaving(true);
                       try {
                           const { error } = await supabase.from('fee_structures').insert({
                               institution_id: madrasah.id,
                               class_id: selectedClass,
                               fee_name: category,
                               amount: parseFloat(amount) || 0
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
  }

  return null;
};
