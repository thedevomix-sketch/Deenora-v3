
import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, LedgerEntry, Language, UserRole, Class } from 'types';
import { Calculator, Plus, ArrowUpCircle, ArrowDownCircle, Loader2, Save, X, DollarSign, Tag, FileText, RefreshCw } from 'lucide-react';
import SmartFeeAnalytics from 'components/SmartFeeAnalytics';
import { SchoolFeeEngine } from 'components/finance/SchoolFeeEngine';
import { QawmiFeeEngine } from 'components/finance/QawmiFeeEngine';
import { sortMadrasahClasses } from 'pages/Classes';

interface AccountingProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
}

const Accounting: React.FC<AccountingProps> = ({ lang, madrasah, onBack, role }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'ledger' | 'fees' | 'structures'>('fees');
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddLedger, setShowAddLedger] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Ledger State
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [desc, setDesc] = useState('');

  const feeEngine = madrasah?.config_json?.fee_engine || 'school';

  useEffect(() => {
    if (madrasah) {
      fetchData();
      fetchClasses();
    }
  }, [madrasah?.id, activeTab]);

  const fetchClasses = async () => {
    if (!madrasah?.id) return;
    const { data } = await supabase.from('classes').select('*').eq('institution_id', madrasah.id);
    if (data) setClasses(sortMadrasahClasses(data));
  };

  const fetchData = async () => {
    if (!madrasah?.id) return;
    
    if (activeTab === 'summary' || activeTab === 'ledger') {
      setLoading(true);
      try {
        const { data } = await supabase.from('ledger').select('*').eq('institution_id', madrasah.id).order('transaction_date', { ascending: false });
        if (data) setLedger(data);
        setRefreshKey(prev => prev + 1);
      } catch (e: any) { 
        console.error("Accounting Fetch Error:", e);
      } finally { setLoading(false); }
    }
  };

  const handleAddLedger = async () => {
    if (!madrasah || !amount || !category) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('ledger').insert({
        institution_id: madrasah.id,
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

      {(activeTab === 'fees' || activeTab === 'structures') && madrasah && (
        <>
          {feeEngine === 'school' && (
            <SchoolFeeEngine activeTab={activeTab} madrasah={madrasah} lang={lang} />
          )}
          {feeEngine === 'qawmi' && (
            <QawmiFeeEngine activeTab={activeTab} madrasah={madrasah} lang={lang} />
          )}
          {/* Default to School Engine for others for now */}
          {feeEngine !== 'school' && feeEngine !== 'qawmi' && (
             <SchoolFeeEngine activeTab={activeTab} madrasah={madrasah} lang={lang} />
          )}
        </>
      )}
      
      {activeTab === 'summary' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-5">
          {madrasah && (
            <SmartFeeAnalytics 
              institutionId={madrasah.id} 
              lang={lang} 
              month={new Date().toISOString().slice(0, 7)} 
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
    </div>
  );
};

export default Accounting;
