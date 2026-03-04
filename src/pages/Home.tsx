
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Clock, User as UserIcon, RefreshCw, PhoneCall, X, MessageCircle, Phone, AlertCircle, Trash2, AlertTriangle, Loader2, Users, BookOpen, GraduationCap, Wallet, TrendingUp, DollarSign, CheckCircle2, Banknote, ClipboardList, ChevronRight, Trophy, Zap } from 'lucide-react';
import { supabase, offlineApi } from 'supabase';
import { Student, Language, Institution } from 'types';
import { t } from 'translations';
import StudentRiskAnalysis from 'components/StudentRiskAnalysis';
import SmartFeeAnalytics from 'components/SmartFeeAnalytics';
import SmartResultAnalytics from 'components/SmartResultAnalytics';
import { isValidUUID } from 'utils/validation';

interface HomeProps {
  onStudentClick: (student: Student) => void;
  lang: Language;
  dataVersion: number;
  triggerRefresh: () => void;
  institutionId?: string;
  madrasah: Institution | null;
  onNavigateToWallet?: () => void;
  onNavigateToAccounting?: () => void;
  onNavigateToAttendance?: () => void;
  onNavigateToExams?: () => void;
  onNavigateToClasses?: () => void;
  onNavigateToTeachers?: () => void;
}

const Home: React.FC<HomeProps> = ({ onStudentClick, lang, dataVersion, triggerRefresh, institutionId, madrasah, onNavigateToWallet, onNavigateToAccounting, onNavigateToAttendance, onNavigateToExams, onNavigateToClasses, onNavigateToTeachers }) => {
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    totalTeachers: 0,
    smsBalance: 0,
    attendanceToday: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Dynamic module configuration
  const modules = madrasah?.config_json?.modules || {
    attendance: true,
    fees: true,
    results: true,
    admit_card: true,
    seat_plan: true,
    accounting: true
  };

  const fetchDashboardStats = async () => {
    if (!isValidUUID(institutionId)) return;
    setLoadingStats(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const promises: any[] = [
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId),
        supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId),
        supabase.from('institutions').select('sms_balance').eq('id', institutionId).maybeSingle()
      ];

      if (modules.attendance) {
        promises.push(supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId).eq('date', today).eq('status', 'present'));
      } else {
        promises.push(Promise.resolve({ count: 0 }));
      }

      const [stdRes, clsRes, teaRes, mRes, attRes] = await Promise.all(promises);

      setStats({
        totalStudents: stdRes.count || 0,
        totalClasses: clsRes.count || 0,
        totalTeachers: teaRes.count || 0,
        smsBalance: mRes.data?.sms_balance || 0,
        attendanceToday: attRes.count || 0
      });
    } catch (e) {
      console.error("Dashboard Stats Error:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => { 
    fetchDashboardStats();
  }, [dataVersion, institutionId, modules.attendance]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="grid grid-cols-2 gap-3 px-1">

        <button onClick={onNavigateToClasses} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 active:scale-95 transition-all">
           <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner"><Users size={20} /></div>
           <h4 className="text-xl font-black text-[#1E3A8A]">{loadingStats ? '...' : stats.totalStudents}</h4>
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('students', lang, madrasah?.institution_type)}</p>
        </button>
        <button onClick={onNavigateToClasses} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-75 active:scale-95 transition-all">
           <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner"><BookOpen size={20} /></div>
           <h4 className="text-xl font-black text-[#1E3A8A]">{loadingStats ? '...' : stats.totalClasses}</h4>
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('classes', lang, madrasah?.institution_type)}</p>
        </button>
        <button onClick={onNavigateToTeachers} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-100 active:scale-95 transition-all">
           <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner"><GraduationCap size={20} /></div>
           <h4 className="text-xl font-black text-[#1E3A8A]">{loadingStats ? '...' : stats.totalTeachers}</h4>
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('teachers', lang, madrasah?.institution_type)}</p>
        </button>
        <button onClick={onNavigateToWallet} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-150 active:scale-95 transition-all">
           <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner"><Zap size={20} /></div>
           <h4 className="text-xl font-black text-[#1E3A8A]">{loadingStats ? '...' : stats.smsBalance}</h4>
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('wallet', lang, madrasah?.institution_type)}</p>
        </button>
        {modules.attendance && (
          <button onClick={onNavigateToAttendance} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-200 active:scale-95 transition-all col-span-2">
             <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner"><CheckCircle2 size={20} /></div>
             <h4 className="text-xl font-black text-[#1E3A8A]">{loadingStats ? '...' : stats.attendanceToday}</h4>
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">আজকের হাজিরা</p>
          </button>
        )}
      </div>

      {institutionId && (
        <div className="space-y-6">
          <StudentRiskAnalysis 
            institutionId={institutionId} 
            lang={lang} 
            onStudentClick={onStudentClick} 
          />
          
          {modules.fees && (
            <div className="px-1 space-y-3">
               <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-3 opacity-80">
                 {t('smart_fee_mgmt', lang)}
               </h2>
               <SmartFeeAnalytics 
                 institutionId={institutionId} 
                 lang={lang} 
                 month={new Date().toISOString().slice(0, 7)} 
               />
            </div>
          )}

          {modules.results && (
            <div className="px-1 space-y-3">
               <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-3 opacity-80">
                 Result Insights
               </h2>
               <SmartResultAnalytics 
                 institutionId={institutionId} 
                 lang={lang} 
               />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
