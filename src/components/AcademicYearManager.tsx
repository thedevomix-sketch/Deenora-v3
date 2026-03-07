import React, { useState, useEffect } from 'react';
import { supabase } from 'lib/supabase';
import { Institution, Class, Exam, Student } from 'types';
import { Loader2, Calendar, ArrowRight, Save, AlertTriangle, CheckCircle2, X, ChevronRight, School } from 'lucide-react';

interface AcademicYearManagerProps {
  institution: Institution;
  onClose: () => void;
}

export const AcademicYearManager: React.FC<AcademicYearManagerProps> = ({ institution, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState<any>(null);
  const [step, setStep] = useState<'status' | 'config' | 'preview' | 'executing'>('status');
  
  // Config State
  const [newYearName, setNewYearName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [classes, setClasses] = useState<Class[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  
  // Map: classId -> { nextClassId, examId, passMark }
  const [promotionMap, setPromotionMap] = useState<Record<string, { nextClassId: string, examId: string, passMark: number }>>({});
  
  // Preview State
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [executingLog, setExecutingLog] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, [institution.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch current year
      const { data: year } = await supabase.from('academic_years')
        .select('*')
        .eq('institution_id', institution.id)
        .eq('status', 'active')
        .single();
      
      if (year) setCurrentYear(year);

      // Fetch classes
      const { data: cls } = await supabase.from('classes')
        .select('*')
        .eq('institution_id', institution.id)
        .order('sort_order', { ascending: true });
      
      if (cls) {
        setClasses(cls);
        // Auto-populate promotion map
        const map: any = {};
        cls.forEach((c, idx) => {
           const nextClass = cls[idx + 1];
           map[c.id] = {
             nextClassId: nextClass ? nextClass.id : 'graduated',
             examId: '',
             passMark: 33
           };
        });
        setPromotionMap(map);
      }

      // Fetch exams
      const { data: ex } = await supabase.from('exams')
        .select('*')
        .eq('institution_id', institution.id)
        .order('exam_date', { ascending: false });
      
      if (ex) setExams(ex);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreview = async () => {
    setLoading(true);
    try {
      const promotions: any[] = [];
      
      // Fetch all students
      const { data: students } = await supabase.from('students')
        .select('*')
        .eq('institution_id', institution.id);
        
      if (!students) return;

      // Fetch all marks for selected exams
      const selectedExamIds = Object.values(promotionMap).map(m => m.examId).filter(id => id);
      const { data: marks } = await supabase.from('exam_marks')
        .select('*')
        .in('exam_id', selectedExamIds);

      // Fetch exam subjects to calculate percentages
      const { data: subjects } = await supabase.from('exam_subjects')
        .select('*')
        .in('exam_id', selectedExamIds);

      // Process each class
      for (const cls of classes) {
        const config = promotionMap[cls.id];
        if (!config || !config.examId) continue;

        const classStudents = students.filter(s => s.class_id === cls.id);
        const examSubjects = subjects?.filter(s => s.exam_id === config.examId) || [];
        
        for (const student of classStudents) {
          // Calculate Result
          const studentMarks = marks?.filter(m => m.student_id === student.id && m.exam_id === config.examId) || [];
          
          let totalObtained = 0;
          let totalFull = 0;
          let failedSubjects = 0;

          examSubjects.forEach(sub => {
             const mark = studentMarks.find(m => m.subject_id === sub.id);
             const obtained = mark ? mark.marks_obtained : 0;
             totalObtained += obtained;
             totalFull += sub.full_marks;
             
             if (obtained < sub.pass_marks) failedSubjects++;
          });

          const percentage = totalFull > 0 ? (totalObtained / totalFull) * 100 : 0;
          const isPassed = failedSubjects === 0 && percentage >= config.passMark;

          promotions.push({
            student_id: student.id,
            student_name: student.student_name,
            roll: student.roll,
            current_class_id: cls.id,
            current_class_name: cls.class_name,
            next_class_id: isPassed ? config.nextClassId : cls.id, // Fail -> Retain
            next_class_name: isPassed ? (config.nextClassId === 'graduated' ? 'Graduated' : classes.find(c => c.id === config.nextClassId)?.class_name) : cls.class_name,
            result_status: isPassed ? 'promoted' : 'retained',
            percentage: percentage.toFixed(2),
            failed_subjects: failedSubjects
          });
        }
      }
      
      setPreviewData(promotions);
      setStep('preview');
    } catch (error) {
      console.error(error);
      alert('Error generating preview');
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePromotion = async () => {
    if (!confirm('Are you sure you want to promote these students? This action cannot be undone.')) return;
    
    setStep('executing');
    setExecutingLog(prev => [...prev, 'Starting promotion process...']);

    try {
      // Filter out graduated students from update list (or handle them separately)
      // For now, we only promote those who have a valid next_class_id (not 'graduated')
      // Actually, 'graduated' students should probably be moved to a 'Alumni' class or just kept in current class with status 'graduated'?
      // The RPC expects a UUID for next_class_id.
      // If 'graduated', we might need to handle it. 
      // For simplicity, let's assume 'graduated' means we don't update their class_id in this batch, OR we have an 'Alumni' class.
      // Let's filter out 'graduated' for the RPC update for now, or create a dummy class.
      // Better: The user should have created an 'Alumni' class if they want to move them there.
      // If nextClassId is 'graduated', we skip the update or set to null?
      // Let's skip 'graduated' for now to avoid UUID error.

      const validPromotions = previewData.filter(p => p.next_class_id !== 'graduated');

      const payload = validPromotions.map(p => ({
        student_id: p.student_id,
        next_class_id: p.next_class_id,
        current_class_name: p.current_class_name,
        next_class_name: p.next_class_name
      }));

      setExecutingLog(prev => [...prev, `Promoting ${payload.length} students...`]);

      const { error } = await supabase.rpc('promote_students', {
        p_institution_id: institution.id,
        p_new_year_name: newYearName,
        p_start_date: startDate,
        p_end_date: endDate,
        p_promotions: payload
      });

      if (error) throw error;

      setExecutingLog(prev => [...prev, 'Promotion completed successfully!']);
      setExecutingLog(prev => [...prev, 'New academic year created.']);
      setExecutingLog(prev => [...prev, 'Old academic year archived.']);
      
      setTimeout(() => {
        onClose();
        window.location.reload(); // Refresh to show changes
      }, 2000);

    } catch (error: any) {
      console.error(error);
      setExecutingLog(prev => [...prev, `Error: ${error.message}`]);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-black text-[#1E3A8A] font-noto">Academic Year Manager</h2>
            <p className="text-sm font-bold text-slate-400 mt-1">{institution.name}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm border border-slate-100">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {step === 'status' && (
            <div className="space-y-8">
              <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#2563EB] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#1E3A8A]">Current Academic Year</h3>
                    <p className="text-sm font-bold text-blue-500 mt-1">
                      {currentYear ? `${currentYear.year_name} (${currentYear.start_date} - ${currentYear.end_date})` : 'No Active Year'}
                    </p>
                  </div>
                </div>
                <div className="px-4 py-2 bg-emerald-100 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest">
                  Active
                </div>
              </div>

              <div className="bg-slate-50 p-8 rounded-[2.5rem] text-center space-y-4 border border-slate-100">
                <div className="w-16 h-16 bg-white text-[#2563EB] rounded-full flex items-center justify-center mx-auto shadow-bubble">
                  <ArrowRight size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-700">Ready to start a new year?</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Starting a new academic year will archive the current year and allow you to promote students to their next classes based on exam results.
                </p>
                <button onClick={() => setStep('config')} className="px-8 py-4 bg-[#2563EB] text-white font-black rounded-2xl shadow-premium hover:scale-105 transition-transform">
                  Start Promotion Wizard
                </button>
              </div>
            </div>
          )}

          {step === 'config' && (
            <div className="space-y-8">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">New Year Name</label>
                  <input type="text" className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-sm" placeholder="e.g. 2025" value={newYearName} onChange={e => setNewYearName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Start Date</label>
                  <input type="date" className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">End Date</label>
                  <input type="date" className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Promotion Rules</h3>
                
                {classes.map(cls => (
                  <div key={cls.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                    <div className="w-1/4">
                      <div className="flex items-center gap-2">
                        <School size={16} className="text-slate-400" />
                        <span className="font-black text-slate-700">{cls.class_name}</span>
                      </div>
                    </div>
                    
                    <ArrowRight size={16} className="text-slate-300" />
                    
                    <div className="w-1/4">
                      <select 
                        className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold outline-none"
                        value={promotionMap[cls.id]?.nextClassId || ''}
                        onChange={e => setPromotionMap({
                          ...promotionMap,
                          [cls.id]: { ...promotionMap[cls.id], nextClassId: e.target.value }
                        })}
                      >
                        <option value="graduated">Graduate (Leave)</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                      </select>
                    </div>

                    <div className="w-1/4">
                      <select 
                        className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold outline-none"
                        value={promotionMap[cls.id]?.examId || ''}
                        onChange={e => setPromotionMap({
                          ...promotionMap,
                          [cls.id]: { ...promotionMap[cls.id], examId: e.target.value }
                        })}
                      >
                        <option value="">Select Exam</option>
                        {exams.filter(e => e.class_id === cls.id).map(e => (
                          <option key={e.id} value={e.id}>{e.exam_name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="w-1/6">
                      <div className="relative">
                        <input 
                          type="number" 
                          className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold outline-none"
                          placeholder="Pass %"
                          value={promotionMap[cls.id]?.passMark || ''}
                          onChange={e => setPromotionMap({
                            ...promotionMap,
                            [cls.id]: { ...promotionMap[cls.id], passMark: parseFloat(e.target.value) }
                          })}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <button onClick={handleGeneratePreview} disabled={loading} className="px-8 py-4 bg-[#2563EB] text-white font-black rounded-2xl shadow-premium hover:scale-105 transition-transform flex items-center gap-2">
                  {loading ? <Loader2 className="animate-spin" /> : <>Generate Preview <ArrowRight size={20} /></>}
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-700 text-sm font-bold">
                <AlertTriangle size={20} />
                <p>Please review the promotion list carefully. This action is irreversible.</p>
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Student</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Current Class</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Result</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Action</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Next Class</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {previewData.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-4">
                          <div className="font-black text-slate-700 text-xs">{p.student_name}</div>
                          <div className="text-[10px] text-slate-400">Roll: {p.roll}</div>
                        </td>
                        <td className="p-4 text-xs font-bold text-slate-500">{p.current_class_name}</td>
                        <td className="p-4">
                          <div className={`text-xs font-black ${p.result_status === 'promoted' ? 'text-emerald-500' : 'text-red-500'}`}>
                            {p.percentage}% ({p.failed_subjects} failed)
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${p.result_status === 'promoted' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            {p.result_status}
                          </span>
                        </td>
                        <td className="p-4 text-xs font-bold text-[#1E3A8A]">{p.next_class_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between pt-4">
                <button onClick={() => setStep('config')} className="px-6 py-3 bg-slate-100 text-slate-500 font-black rounded-xl hover:bg-slate-200 transition-colors">
                  Back
                </button>
                <button onClick={handleExecutePromotion} className="px-8 py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-premium hover:scale-105 transition-transform flex items-center gap-2">
                  <CheckCircle2 size={20} /> Confirm & Promote
                </button>
              </div>
            </div>
          )}

          {step === 'executing' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-6">
              <Loader2 className="animate-spin text-[#2563EB]" size={48} />
              <h3 className="text-xl font-black text-slate-700">Processing Promotions...</h3>
              <div className="w-full max-w-md bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-xl h-48 overflow-y-auto">
                {executingLog.map((log, i) => (
                  <div key={i}>&gt; {log}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
