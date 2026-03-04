import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Class, Student, BefaqExam, BefaqSubject, Language, UserRole } from 'types';
import { GraduationCap, Plus, BookOpen, Trophy, Save, X, Loader2, ArrowLeft, Calendar, LayoutGrid, Download, CreditCard } from 'lucide-react';
import { t } from 'translations';
import { sortMadrasahClasses } from '../../../../pages/Classes';
import FinalResults from './FinalResults';

interface BefaqResultEngineProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
}

const BefaqResultEngine: React.FC<BefaqResultEngineProps> = ({ lang, madrasah, onBack, role }) => {
  const [activeTab, setActiveTab] = useState<'exams' | 'analytics' | 'final-results'>('exams');
  const [view, setView] = useState<'list' | 'subjects' | 'marks' | 'report'>('list');
  const [exams, setExams] = useState<BefaqExam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedExam, setSelectedExam] = useState<BefaqExam | null>(null);
  const [subjects, setSubjects] = useState<BefaqSubject[]>([]);
  const [marksData, setMarksData] = useState<any>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddExam, setShowAddExam] = useState(false);
  const [showAddSubject, setShowAddSubject] = useState(false);

  // Form states
  const [examName, setExamName] = useState('');
  const [examYear, setExamYear] = useState(new Date().getFullYear().toString());
  const [classId, setClassId] = useState('');
  const [subName, setSubName] = useState('');
  const [totalMarks, setTotalMarks] = useState('100');
  const [passingMarks, setPassingMarks] = useState('33');

  useEffect(() => {
    if (madrasah) {
      fetchExams();
      fetchClasses();
    }
  }, [madrasah?.id, view]);

  const fetchExams = async () => {
    const { data } = await supabase.from('befaq_exams').select('*, classes(class_name)').eq('institution_id', madrasah?.id).order('created_at', { ascending: false });
    if (data) setExams(data);
    setLoading(false);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('institution_id', madrasah?.id);
    if (data) setClasses(sortMadrasahClasses(data));
  };

  const fetchSubjects = async (examId: string) => {
    setLoading(true);
    const { data } = await supabase.from('befaq_subjects').select('*').eq('exam_id', examId);
    if (data) setSubjects(data);
    setLoading(false);
  };

  const fetchMarkEntryData = async (examId: string, classId: string) => {
    setLoading(true);
    const { data: stds } = await supabase.from('students').select('*').eq('class_id', classId).order('roll', { ascending: true });
    const { data: marks } = await supabase.from('befaq_results').select('*').eq('exam_id', examId);
    
    if (stds) setStudents(stds);
    if (marks) {
        const initialMarks: any = {};
        marks.forEach(m => {
            if (!initialMarks[m.student_id]) initialMarks[m.student_id] = {};
            initialMarks[m.student_id][m.subject_id] = m.marks_obtained;
        });
        setMarksData(initialMarks);
    }
    setLoading(false);
  };

  const handleAddExam = async () => {
    if (!madrasah || !examName || !classId) {
        alert('Please fill all fields');
        return;
    }
    setIsSaving(true);
    try {
        const selectedClass = classes.find(c => c.id === classId);
        const { error } = await supabase.from('befaq_exams').insert({
          institution_id: madrasah.id,
          marhala_id: classId,
          class_name: selectedClass?.class_name || 'Unknown',
          exam_name: examName,
          exam_year: examYear,
          is_active: true
        });
        
        if (error) {
            console.error('Error adding exam:', error);
            alert('Failed to add exam: ' + error.message);
        } else {
          setShowAddExam(false);
          setExamName('');
          fetchExams();
        }
    } catch (e) {
        console.error('Unexpected error:', e);
        alert('An unexpected error occurred');
    } finally {
        setIsSaving(false);
    }
  };

  const handleAddSubject = async () => {
    if (!selectedExam || !subName) return;
    setIsSaving(true);
    const { error } = await supabase.from('befaq_subjects').insert({
      exam_id: selectedExam.id,
      subject_name: subName,
      total_marks: parseInt(totalMarks),
      passing_marks: parseInt(passingMarks)
    });
    if (!error) {
      setShowAddSubject(false);
      setSubName('');
      fetchSubjects(selectedExam.id);
    }
    setIsSaving(false);
  };

  const handleSaveMarks = async () => {
    if (!selectedExam) return;
    setIsSaving(true);
    const payload: any[] = [];
    Object.entries(marksData).forEach(([studentId, subMarks]: any) => {
        Object.entries(subMarks).forEach(([subjectId, marks]) => {
            payload.push({
                exam_id: selectedExam.id,
                student_id: studentId,
                subject_id: subjectId,
                marks_obtained: parseFloat(marks as string)
            });
        });
    });

    // Upsert logic - simpler to delete and insert or use upsert if constraint exists
    // Assuming upsert works on (exam_id, student_id, subject_id)
    for (const row of payload) {
        // We need a unique constraint on befaq_results(exam_id, student_id, subject_id) for upsert to work perfectly
        // Or we check if exists. For now, let's try upsert.
        const { error } = await supabase.from('befaq_results').upsert(row, { onConflict: 'exam_id, student_id, subject_id' });
        if (error) console.error(error);
    }
    alert(t('success', lang));
    setIsSaving(false);
  };

  const getDivision = (totalMarks: number, totalPossible: number) => {
    if (totalPossible === 0) return 'N/A';
    const percentage = (totalMarks / totalPossible) * 100;
    
    if (percentage >= 80) return 'মুমতাজ';
    if (percentage >= 65) return 'জায়্যিদ জিদ্দান';
    if (percentage >= 50) return 'জায়্যিদ';
    if (percentage >= 40) return 'মকবুল';
    return 'রাসিব';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {activeTab !== 'final-results' && (
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={view === 'list' ? onBack : () => setView('list')} className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
            <ArrowLeft size={20}/>
          </button>
          <h1 className="text-xl font-black text-[#1E293B] font-noto">
            {view === 'list' ? 'বেফাক পরীক্ষা' : selectedExam?.exam_name}
          </h1>
        </div>
        {view === 'list' && role === 'madrasah_admin' && (
            <div className="flex gap-2">
                <button onClick={() => setActiveTab('final-results')} className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center border border-purple-100 shadow-sm active:scale-95 transition-all" title="চূড়ান্ত ফলাফল">
                  <Trophy size={20} />
                </button>
                <button onClick={() => setShowAddExam(true)} className="w-10 h-10 bg-emerald-600 text-white rounded-xl shadow-premium flex items-center justify-center active:scale-95 transition-all"><Plus size={20}/></button>
            </div>
        )}
      </div>
      )}

      {activeTab === 'final-results' && (
          <FinalResults lang={lang} madrasah={madrasah} role={role} onBack={() => setActiveTab('exams')} />
      )}

      {activeTab === 'exams' && view === 'list' && (
        <div className="space-y-4">
          {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-600" /></div> : exams.map(exam => (
            <div key={exam.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-bubble space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner"><GraduationCap size={24}/></div>
                        <div>
                            <h3 className="text-lg font-black text-[#1E3A8A] font-noto leading-tight">{exam.exam_name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{exam.classes?.class_name}</span>
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[8px] font-black uppercase">{exam.exam_year}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { setSelectedExam(exam); setView('subjects'); fetchSubjects(exam.id); }} className="py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 active:scale-95 transition-all">{t('subject', lang)}</button>
                    <button onClick={() => { setSelectedExam(exam); setView('marks'); fetchSubjects(exam.id); fetchMarkEntryData(exam.id, exam.marhala_id); }} className="py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-emerald-100 active:scale-95 transition-all">{t('enter_marks', lang)}</button>
                    <button className="py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-premium active:scale-95 transition-all">{t('rank', lang)}</button>
                </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'exams' && view === 'subjects' && (
        <div className="space-y-4">
           <button onClick={() => setShowAddSubject(true)} className="w-full py-5 bg-white rounded-[2.2rem] text-emerald-600 font-black flex items-center justify-center gap-3 shadow-bubble border border-slate-100 active:scale-95 transition-all">
              <Plus size={24} strokeWidth={3} /> কিতাব যোগ করুন
           </button>
           <div className="space-y-3">
              {subjects.map(s => (
                <div key={s.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><BookOpen size={20}/></div>
                      <h5 className="font-black text-[#1E3A8A] font-noto text-lg">{s.subject_name}</h5>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase">মোট নম্বর: {s.total_marks}</p>
                      <p className="text-[9px] font-black text-red-400 uppercase">পাস নম্বর: {s.passing_marks}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'exams' && view === 'marks' && (
        <div className="space-y-4">
            <div className="bg-white p-5 rounded-[2.5rem] shadow-bubble border border-slate-100 overflow-x-auto no-scrollbar">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-50">
                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase pr-4">Roll/Name</th>
                            {subjects.map(s => (
                                <th key={s.id} className="py-4 text-[10px] font-black text-slate-400 uppercase text-center min-w-[80px]">{s.subject_name}</th>
                            ))}
                            <th className="py-4 text-[10px] font-black text-emerald-400 uppercase text-center min-w-[60px]">মোট</th>
                            <th className="py-4 text-[10px] font-black text-purple-400 uppercase text-center min-w-[60px]">বিভাগ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(std => (
                            <tr key={std.id} className="border-b border-slate-50 last:border-0">
                                <td className="py-4 pr-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-emerald-600 leading-none mb-1">#{std.roll}</span>
                                        <span className="font-black text-[#1E3A8A] text-xs font-noto truncate max-w-[100px]">{std.student_name}</span>
                                    </div>
                                </td>
                                {subjects.map(sub => (
                                    <td key={sub.id} className="py-4 px-2">
                                        <input 
                                            type="number" 
                                            className="w-full h-10 bg-slate-50 border border-slate-100 rounded-lg text-center font-black text-xs outline-none focus:border-emerald-600 transition-all"
                                            value={marksData[std.id]?.[sub.id] || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setMarksData(prev => ({
                                                    ...prev,
                                                    [std.id]: {
                                                        ...prev[std.id],
                                                        [sub.id]: val
                                                    }
                                                }));
                                            }}
                                        />
                                    </td>
                                ))}
                                <td className="py-4 px-2 text-center font-black text-[#1E3A8A] text-xs">
                                    {(Object.values(marksData[std.id] || {}) as any[]).reduce((sum: number, m: any) => sum + (parseFloat(m) || 0), 0)}
                                </td>
                                <td className="py-4 px-2 text-center font-black text-emerald-500 text-xs">
                                    {(() => {
                                        const total = (Object.values(marksData[std.id] || {}) as any[]).reduce((sum: number, m: any) => sum + (parseFloat(m) || 0), 0);
                                        const totalPossible = subjects.reduce((sum, s) => sum + s.total_marks, 0);
                                        return getDivision(total, totalPossible);
                                    })()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button onClick={handleSaveMarks} disabled={isSaving} className="w-full h-16 bg-emerald-600 text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg active:scale-95 transition-all">
                {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={24}/> নম্বর সংরক্ষণ করুন</>}
            </button>
        </div>
      )}

      {/* Modals */}
      {showAddExam && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#1E3A8A]">নতুন পরীক্ষা (বেফাক)</h3>
               <button onClick={() => setShowAddExam(false)} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all" placeholder="পরীক্ষার নাম" value={examName} onChange={(e) => setExamName(e.target.value)} /><BookOpen className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all" placeholder="সাল (যেমন: ২০২৪)" value={examYear} onChange={(e) => setExamYear(e.target.value)} /><Calendar className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative">
                    <select className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 appearance-none transition-all" value={classId} onChange={(e) => setClassId(e.target.value)}>
                        <option value="">মারহালা (ক্লাস) বেছে নিন</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                    </select>
                    <LayoutGrid className="absolute left-4 top-4 text-slate-300" size={20}/>
                </div>
                <button onClick={handleAddExam} disabled={isSaving} className="w-full py-5 bg-emerald-600 text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={20}/> পরীক্ষা তৈরি করুন</>}
                </button>
             </div>
          </div>
        </div>
      )}

      {showAddSubject && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#1E3A8A]">কিতাব যোগ করুন</h3>
               <button onClick={() => setShowAddSubject(false)} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all" placeholder="কিতাবের নাম" value={subName} onChange={(e) => setSubName(e.target.value)} /><BookOpen size={20} className="absolute left-4 top-4 text-slate-300" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative"><input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all" placeholder="মোট নম্বর" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} /><CreditCard className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                    <div className="relative"><input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all" placeholder="পাস নম্বর" value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} /><CreditCard className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                </div>
                <button onClick={handleAddSubject} disabled={isSaving} className="w-full py-5 bg-emerald-600 text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : 'কিতাব সেভ করুন'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BefaqResultEngine;
