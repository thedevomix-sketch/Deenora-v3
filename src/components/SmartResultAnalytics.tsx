
import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Language } from 'types';
import { t } from 'translations';
import { TrendingUp, TrendingDown, Award, AlertCircle, Loader2, User, ChevronRight, BarChart2, BookOpen, Users, ArrowUpRight, ArrowDownRight, Filter, Check, Search } from 'lucide-react';
import { isValidUUID } from 'utils/validation';

interface SmartResultAnalyticsProps {
  institutionId: string;
  lang: Language;
}

const SmartResultAnalytics: React.FC<SmartResultAnalyticsProps> = ({ institutionId, lang }) => {
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [analytics, setAnalytics] = useState<{
    classPerformance: any[];
    subjectWeakness: any[];
    improvementInsights: any[];
    overallAvg: number;
  }>({
    classPerformance: [],
    subjectWeakness: [],
    improvementInsights: [],
    overallAvg: 0
  });

  useEffect(() => {
    fetchClasses();
  }, [institutionId]);

  useEffect(() => {
    fetchAnalytics();
  }, [institutionId, selectedClassId]);

  const fetchClasses = async () => {
    if (!isValidUUID(institutionId)) return;
    const { data } = await supabase.from('classes').select('*').eq('institution_id', institutionId);
    if (data) setClasses(data);
  };

  const fetchAnalytics = async () => {
    if (!isValidUUID(institutionId)) return;
    setLoading(true);
    try {
        // Fetch Exams
        let examQuery = supabase.from('exams').select('*').eq('institution_id', institutionId).order('exam_date', { ascending: true });
        if (selectedClassId !== 'all') {
            examQuery = examQuery.eq('class_id', selectedClassId);
        }
        const { data: exams } = await examQuery;
        
        if (!exams || exams.length === 0) {
            setAnalytics({
                classPerformance: [],
                subjectWeakness: [],
                improvementInsights: [],
                overallAvg: 0
            });
            setLoading(false);
            return;
        }

        const examIds = exams.map(e => e.id);

        // Fetch Subjects
        const { data: subjects } = await supabase.from('exam_subjects').select('*').in('exam_id', examIds);
        
        // Fetch Marks
        const { data: marks } = await supabase.from('exam_marks').select('*').in('exam_id', examIds);

        // Fetch Students
        let studentQuery = supabase.from('students').select('id, student_name, roll, class_id').eq('institution_id', institutionId);
        if (selectedClassId !== 'all') {
            studentQuery = studentQuery.eq('class_id', selectedClassId);
        }
        const { data: students } = await studentQuery;

        if (!marks || !subjects || !students) {
             setLoading(false);
             return;
        }

        // --- Process Class Performance ---
        const classPerformance: any[] = [];
        let totalOverallPercentage = 0;
        let totalOverallCount = 0;

        const classesToProcess = selectedClassId === 'all' ? classes : classes.filter(c => c.id === selectedClassId);

        classesToProcess.forEach(cls => {
            const classExams = exams.filter(e => e.class_id === cls.id);
            const classExamIds = classExams.map(e => e.id);
            const classMarks = marks.filter(m => classExamIds.includes(m.exam_id));
            
            if (classMarks.length > 0) {
                let totalPercentage = 0;
                let count = 0;
                
                classMarks.forEach(m => {
                    const subject = subjects.find(s => s.id === m.subject_id);
                    if (subject) {
                        const pct = (m.marks_obtained / subject.full_marks) * 100;
                        totalPercentage += pct;
                        count++;
                        
                        totalOverallPercentage += pct;
                        totalOverallCount++;
                    }
                });
                
                const avg = count > 0 ? totalPercentage / count : 0;
                classPerformance.push({
                    class_name: cls.class_name,
                    average: avg.toFixed(1),
                    student_count: students.filter(s => s.class_id === cls.id).length
                });
            }
        });

        // --- Process Subject Weakness ---
        const subjectStats: Record<string, { total: number, count: number }> = {};
        marks.forEach(m => {
            const subject = subjects.find(s => s.id === m.subject_id);
            if (subject) {
                const name = subject.subject_name.trim();
                if (!subjectStats[name]) subjectStats[name] = { total: 0, count: 0 };
                
                subjectStats[name].total += (m.marks_obtained / subject.full_marks) * 100;
                subjectStats[name].count++;
            }
        });
        
        const subjectWeakness = Object.entries(subjectStats)
            .map(([name, stats]) => ({ name, average: stats.total / stats.count }))
            .sort((a, b) => a.average - b.average)
            .slice(0, 5);

        // --- Process Improvement ---
        const studentPerformance: Record<string, { exam_date: string, average: number }[]> = {};
        
        students.forEach(std => {
            const stdMarks = marks.filter(m => m.student_id === std.id);
            const stdExams = [...new Set(stdMarks.map(m => m.exam_id))];
            
            const examAvgs: { exam_date: string, average: number }[] = [];
            
            stdExams.forEach(eid => {
                const exam = exams.find(e => e.id === eid);
                const mks = stdMarks.filter(m => m.exam_id === eid);
                
                let total = 0;
                let count = 0;
                mks.forEach(m => {
                    const sub = subjects.find(s => s.id === m.subject_id);
                    if (sub) {
                        total += (m.marks_obtained / sub.full_marks) * 100;
                        count++;
                    }
                });
                
                if (exam && count > 0) {
                    examAvgs.push({
                        exam_date: exam.exam_date,
                        average: total / count
                    });
                }
            });
            
            examAvgs.sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());
            studentPerformance[std.id] = examAvgs;
        });

        const improvementInsights: any[] = [];
        students.forEach(std => {
            const perfs = studentPerformance[std.id];
            if (perfs && perfs.length >= 2) {
                const current = perfs[perfs.length - 1];
                const prev = perfs[perfs.length - 2];
                const change = current.average - prev.average;
                
                improvementInsights.push({
                    student_name: std.student_name,
                    class_name: classes.find(c => c.id === std.class_id)?.class_name,
                    roll: std.roll,
                    current_avg: current.average.toFixed(1),
                    change: parseFloat(change.toFixed(1)),
                    status: change >= 0 ? 'improving' : 'declining'
                });
            }
        });
        
        improvementInsights.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

        setAnalytics({
            classPerformance: classPerformance.sort((a, b) => parseFloat(b.average) - parseFloat(a.average)),
            subjectWeakness,
            improvementInsights: improvementInsights.slice(0, 5),
            overallAvg: totalOverallCount > 0 ? totalOverallPercentage / totalOverallCount : 0
        });

    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Filter */}
      <div className="flex justify-end relative z-30">
        <button 
            onClick={() => setShowFilter(!showFilter)}
            className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black text-slate-600 shadow-sm hover:border-[#2563EB] transition-all active:scale-95"
        >
            <Filter size={14} className="text-slate-400" />
            <span>{selectedClassId === 'all' ? 'All Classes' : classes.find(c => c.id === selectedClassId)?.class_name || 'Select Class'}</span>
            <ChevronRight size={14} className={`text-slate-400 transition-transform duration-300 ${showFilter ? 'rotate-90' : ''}`} />
        </button>

        {showFilter && (
            <>
                <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={() => setShowFilter(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-4 z-50 animate-in zoom-in-95 origin-top-right">
                    <div className="mb-3 px-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Filter by Class</h4>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search class..." 
                                className="w-full h-9 bg-slate-50 rounded-xl pl-9 pr-3 text-xs font-bold outline-none border border-transparent focus:border-blue-100 focus:bg-blue-50/50 transition-all"
                                value={filterSearch}
                                onChange={(e) => setFilterSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    
                    <div className="max-h-[280px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        <button 
                            onClick={() => { setSelectedClassId('all'); setShowFilter(false); }}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-between group ${selectedClassId === 'all' ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-200' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <span>All Classes</span>
                            {selectedClassId === 'all' && <Check size={14} className={selectedClassId === 'all' ? 'text-white' : 'text-slate-400'} />}
                        </button>
                        
                        {classes.filter(c => c.class_name.toLowerCase().includes(filterSearch.toLowerCase())).map(c => (
                            <button 
                                key={c.id}
                                onClick={() => { setSelectedClassId(c.id); setShowFilter(false); }}
                                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-between group ${selectedClassId === c.id ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-200' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <span>{c.class_name}</span>
                                {selectedClassId === c.id && <Check size={14} className={selectedClassId === c.id ? 'text-white' : 'text-slate-400'} />}
                            </button>
                        ))}
                        {classes.filter(c => c.class_name.toLowerCase().includes(filterSearch.toLowerCase())).length === 0 && (
                            <div className="text-center py-4 text-[10px] font-bold text-slate-400">No classes found</div>
                        )}
                    </div>
                </div>
            </>
        )}
      </div>

      {/* Overall Stats */}
      <div className="bg-[#1E3A8A] p-6 rounded-[2.5rem] text-white shadow-premium relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
         <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2 opacity-80">
               <Award size={20} />
               <span className="text-[10px] font-black uppercase tracking-widest">Overall Performance</span>
            </div>
            <h2 className="text-4xl font-black font-noto">{analytics.overallAvg.toFixed(1)}%</h2>
            <p className="text-xs font-bold opacity-60 mt-1">Average score across all classes</p>
         </div>
      </div>

      {/* Class Performance */}
      <div className="space-y-3">
         <div className="flex items-center gap-2 px-2">
            <BarChart2 size={16} className="text-slate-400" />
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class Performance</h3>
         </div>
         <div className="grid grid-cols-1 gap-3">
            {analytics.classPerformance.map((cls, idx) => (
               <div key={idx} className="bg-white p-4 rounded-[1.8rem] border border-slate-100 shadow-bubble flex items-center justify-between">
                  <div>
                     <h4 className="font-black text-[#1E3A8A] text-sm">{cls.class_name}</h4>
                     <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-0.5"><Users size={10}/> {cls.student_count} Students</p>
                  </div>
                  <div className="text-right">
                     <span className={`text-lg font-black ${parseFloat(cls.average) >= 80 ? 'text-emerald-500' : parseFloat(cls.average) >= 60 ? 'text-blue-500' : 'text-orange-500'}`}>
                        {cls.average}%
                     </span>
                  </div>
               </div>
            ))}
            {analytics.classPerformance.length === 0 && <div className="text-center py-6 text-slate-400 text-xs font-bold">No data available</div>}
         </div>
      </div>

      {/* Subject Weakness */}
      <div className="space-y-3">
         <div className="flex items-center gap-2 px-2">
            <AlertCircle size={16} className="text-red-400" />
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject Weakness Detection</h3>
         </div>
         <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble">
            <div className="space-y-4">
               {analytics.subjectWeakness.map((sub, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center font-black text-xs shrink-0">
                        {idx + 1}
                     </div>
                     <div className="flex-1">
                        <div className="flex justify-between mb-1">
                           <span className="text-xs font-black text-[#1E3A8A]">{sub.name}</span>
                           <span className="text-xs font-black text-red-500">{sub.average.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                           <div className="h-full bg-red-500 rounded-full" style={{ width: `${sub.average}%` }}></div>
                        </div>
                     </div>
                  </div>
               ))}
               {analytics.subjectWeakness.length === 0 && <div className="text-center py-4 text-slate-400 text-xs font-bold">No weakness detected</div>}
            </div>
         </div>
      </div>

      {/* Improvement Tracking */}
      <div className="space-y-3">
         <div className="flex items-center gap-2 px-2">
            <TrendingUp size={16} className="text-emerald-500" />
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Movers (Improvement/Decline)</h3>
         </div>
         <div className="space-y-3">
            {analytics.improvementInsights.map((item, idx) => (
               <div key={idx} className="bg-white p-4 rounded-[1.8rem] border border-slate-100 shadow-bubble flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.status === 'improving' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                        {item.status === 'improving' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                     </div>
                     <div>
                        <h4 className="font-black text-[#1E3A8A] text-sm font-noto">{item.student_name}</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">{item.class_name}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <span className={`text-sm font-black ${item.status === 'improving' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {item.change > 0 ? '+' : ''}{item.change}%
                     </span>
                     <p className="text-[9px] font-bold text-slate-300">Avg: {item.current_avg}%</p>
                  </div>
               </div>
            ))}
            {analytics.improvementInsights.length === 0 && <div className="text-center py-6 text-slate-400 text-xs font-bold">Not enough exam data for comparison</div>}
         </div>
      </div>

    </div>
  );
};

export default SmartResultAnalytics;
