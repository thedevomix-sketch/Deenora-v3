import React from 'react';
import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { Exam, Student } from '../types';

interface AdmitCardProps {
  exam: Exam;
  student: Student;
  madrasah: { name: string; logo_url?: string };
  templateId: string;
}

const AdmitCardTemplate: React.FC<AdmitCardProps> = ({ exam, student, madrasah, templateId }) => {
  const isBangla = /[অ-য়]/.test(exam.exam_name) || /[অ-য়]/.test(madrasah.name);
  const fontFamily = isBangla ? "'Noto Sans Bengali', sans-serif" : "sans-serif";

  if (templateId === 'modern') {
    return (
      <div className="w-[800px] h-[450px] border-2 rounded-2xl overflow-hidden flex flex-col relative font-sans" style={{ fontFamily, backgroundColor: '#ffffff', borderColor: '#1e3a8a' }}>
        {/* Header */}
        <div className="p-6 flex items-center justify-between" style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
          <div className="flex items-center gap-4">
            {madrasah.logo_url && (
              <img src={madrasah.logo_url} alt="Logo" className="w-16 h-16 rounded-full p-1 object-cover" style={{ backgroundColor: '#ffffff' }} crossOrigin="anonymous" />
            )}
            <div>
              <h1 className="text-3xl font-black tracking-tight">{madrasah.name}</h1>
              <p className="text-sm font-bold mt-1 uppercase tracking-widest" style={{ color: '#bfdbfe' }}>{exam.exam_name}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="px-4 py-2 rounded-xl backdrop-blur-sm border" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', borderColor: 'rgba(255, 255, 255, 0.3)' }}>
              <h2 className="text-xl font-black tracking-widest uppercase">Admit Card</h2>
              <p className="text-xs mt-1" style={{ color: '#dbeafe' }}>{isBangla ? 'প্রবেশপত্র' : 'Entry Pass'}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-8 flex gap-8">
          <div className="flex-1 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>{isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name'}</p>
                <p className="text-xl font-black border-b-2 pb-2" style={{ color: '#1e293b', borderColor: '#f1f5f9' }}>{student.student_name}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>{isBangla ? 'শ্রেণী' : 'Class'}</p>
                <p className="text-xl font-black border-b-2 pb-2" style={{ color: '#1e293b', borderColor: '#f1f5f9' }}>{student.classes?.class_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>{isBangla ? 'রোল নম্বর' : 'Roll Number'}</p>
                <p className="text-xl font-black border-b-2 pb-2" style={{ color: '#1e293b', borderColor: '#f1f5f9' }}>{student.roll || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>{isBangla ? 'পরীক্ষার তারিখ' : 'Exam Date'}</p>
                <p className="text-xl font-black border-b-2 pb-2" style={{ color: '#1e293b', borderColor: '#f1f5f9' }}>{new Date(exam.exam_date).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <div className="w-32 flex flex-col items-center gap-4">
            <div className="w-32 h-40 border-2 border-dashed rounded-xl flex items-center justify-center" style={{ borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }}>
              <span className="font-bold text-sm uppercase tracking-widest" style={{ color: '#94a3b8' }}>{isBangla ? 'ছবি' : 'Photo'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-between items-end px-8" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
          <div className="text-xs font-bold max-w-md" style={{ color: '#64748b' }}>
            <p className="mb-1" style={{ color: '#ef4444' }}>{isBangla ? 'নির্দেশনা:' : 'Instructions:'}</p>
            <p>{isBangla ? '১. পরীক্ষার হলে অবশ্যই প্রবেশপত্র সাথে আনতে হবে।' : '1. Must bring this admit card to the exam hall.'}</p>
            <p>{isBangla ? '২. মোবাইল ফোন বা কোনো ইলেকট্রনিক ডিভাইস আনা সম্পূর্ণ নিষেধ।' : '2. Mobile phones or electronic devices are strictly prohibited.'}</p>
          </div>
          <div className="text-center">
            <div className="w-32 border-b-2 mb-2" style={{ borderColor: '#1e293b' }}></div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>{isBangla ? 'কর্তৃপক্ষের স্বাক্ষর' : 'Authority Signature'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (templateId === 'minimal') {
    return (
      <div className="w-[800px] h-[450px] border p-8 flex flex-col relative font-sans" style={{ fontFamily, backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
        <div className="text-center mb-8">
          {madrasah.logo_url && (
            <img src={madrasah.logo_url} alt="Logo" className="w-12 h-12 mx-auto mb-3 object-cover grayscale" crossOrigin="anonymous" />
          )}
          <h1 className="text-2xl font-black tracking-widest uppercase" style={{ color: '#0f172a' }}>{madrasah.name}</h1>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="h-[1px] w-12" style={{ backgroundColor: '#cbd5e1' }}></div>
            <p className="text-sm font-bold uppercase tracking-[0.2em]" style={{ color: '#64748b' }}>{exam.exam_name}</p>
            <div className="h-[1px] w-12" style={{ backgroundColor: '#cbd5e1' }}></div>
          </div>
        </div>

        <div className="flex justify-between items-start mb-8">
          <div className="px-6 py-2" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
            <h2 className="text-lg font-black tracking-widest uppercase">Admit Card</h2>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>{isBangla ? 'তারিখ' : 'Date'}</p>
            <p className="text-sm font-black" style={{ color: '#1e293b' }}>{new Date(exam.exam_date).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="flex-1 flex gap-12">
          <div className="flex-1 space-y-4">
            <div className="flex border-b pb-2" style={{ borderColor: '#e2e8f0' }}>
              <span className="w-32 text-xs font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>{isBangla ? 'নাম' : 'Name'}</span>
              <span className="font-black" style={{ color: '#1e293b' }}>{student.student_name}</span>
            </div>
            <div className="flex border-b pb-2" style={{ borderColor: '#e2e8f0' }}>
              <span className="w-32 text-xs font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>{isBangla ? 'শ্রেণী' : 'Class'}</span>
              <span className="font-black" style={{ color: '#1e293b' }}>{student.classes?.class_name || '-'}</span>
            </div>
            <div className="flex border-b pb-2" style={{ borderColor: '#e2e8f0' }}>
              <span className="w-32 text-xs font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>{isBangla ? 'রোল' : 'Roll'}</span>
              <span className="font-black" style={{ color: '#1e293b' }}>{student.roll || '-'}</span>
            </div>
          </div>

          <div className="w-28 h-32 border flex items-center justify-center" style={{ borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }}>
            <span className="font-bold text-xs uppercase tracking-widest" style={{ color: '#cbd5e1' }}>{isBangla ? 'ছবি' : 'Photo'}</span>
          </div>
        </div>

        <div className="mt-auto flex justify-between items-end pt-8">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
            <p>• {isBangla ? 'প্রবেশপত্র ছাড়া পরীক্ষা দেওয়া নিষেধ।' : 'Entry without admit card is prohibited.'}</p>
            <p>• {isBangla ? 'পরীক্ষা শুরুর ১৫ মিনিট আগে উপস্থিত হতে হবে।' : 'Must be present 15 mins before exam.'}</p>
          </div>
          <div className="text-center">
            <div className="w-40 border-b mb-2" style={{ borderColor: '#94a3b8' }}></div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>{isBangla ? 'স্বাক্ষর' : 'Signature'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Classic Template
  return (
    <div className="w-[800px] h-[450px] border-4 border-double p-6 flex flex-col relative font-sans" style={{ fontFamily, backgroundColor: '#ffffff', borderColor: '#1e293b' }}>
      <div className="flex justify-between items-start border-b-2 pb-4 mb-6" style={{ borderColor: '#1e293b' }}>
        <div className="flex items-center gap-4">
          {madrasah.logo_url && (
            <img src={madrasah.logo_url} alt="Logo" className="w-16 h-16 object-cover" crossOrigin="anonymous" />
          )}
          <div>
            <h1 className="text-3xl font-black" style={{ color: '#0f172a' }}>{madrasah.name}</h1>
            <p className="font-bold mt-1 text-lg" style={{ color: '#475569' }}>{exam.exam_name}</p>
          </div>
        </div>
        <div className="text-center border-2 p-2" style={{ borderColor: '#1e293b' }}>
          <h2 className="text-xl font-black uppercase tracking-widest">Admit Card</h2>
          <p className="text-sm font-bold">{isBangla ? 'প্রবেশপত্র' : 'Entry Pass'}</p>
        </div>
      </div>

      <div className="flex-1 flex gap-8">
        <div className="flex-1 space-y-6">
          <div className="flex items-end gap-2">
            <span className="text-sm font-bold whitespace-nowrap">{isBangla ? 'শিক্ষার্থীর নাম :' : 'Student Name :'}</span>
            <span className="flex-1 border-b-2 border-dotted text-lg font-black px-2 pb-1" style={{ borderColor: '#94a3b8' }}>{student.student_name}</span>
          </div>
          <div className="flex gap-8">
            <div className="flex items-end gap-2 flex-1">
              <span className="text-sm font-bold whitespace-nowrap">{isBangla ? 'শ্রেণী :' : 'Class :'}</span>
              <span className="flex-1 border-b-2 border-dotted text-lg font-black px-2 pb-1" style={{ borderColor: '#94a3b8' }}>{student.classes?.class_name || '-'}</span>
            </div>
            <div className="flex items-end gap-2 flex-1">
              <span className="text-sm font-bold whitespace-nowrap">{isBangla ? 'রোল নম্বর :' : 'Roll No :'}</span>
              <span className="flex-1 border-b-2 border-dotted text-lg font-black px-2 pb-1" style={{ borderColor: '#94a3b8' }}>{student.roll || '-'}</span>
            </div>
          </div>
          <div className="flex gap-8">
            <div className="flex items-end gap-2 flex-1">
              <span className="text-sm font-bold whitespace-nowrap">{isBangla ? 'পরীক্ষার তারিখ :' : 'Exam Date :'}</span>
              <span className="flex-1 border-b-2 border-dotted text-lg font-black px-2 pb-1" style={{ borderColor: '#94a3b8' }}>{new Date(exam.exam_date).toLocaleDateString()}</span>
            </div>
            <div className="flex items-end gap-2 flex-1">
              <span className="text-sm font-bold whitespace-nowrap">{isBangla ? 'শাখা :' : 'Section :'}</span>
              <span className="flex-1 border-b-2 border-dotted text-lg font-black px-2 pb-1" style={{ borderColor: '#94a3b8' }}>-</span>
            </div>
          </div>
        </div>

        <div className="w-32 h-40 border-2 flex items-center justify-center" style={{ borderColor: '#1e293b' }}>
          <span className="font-bold text-sm" style={{ color: '#94a3b8' }}>{isBangla ? 'ছবি' : 'Photo'}</span>
        </div>
      </div>

      <div className="mt-auto flex justify-between items-end pt-4">
        <div className="text-xs font-bold max-w-sm" style={{ color: '#475569' }}>
          <p className="underline mb-1">{isBangla ? 'নিয়মাবলী:' : 'Rules:'}</p>
          <p>১. {isBangla ? 'পরীক্ষার হলে প্রবেশপত্র আনা বাধ্যতামূলক।' : 'Admit card is mandatory in the exam hall.'}</p>
          <p>২. {isBangla ? 'অসদুপায় অবলম্বন করলে পরীক্ষা বাতিল হবে।' : 'Adopting unfair means will cancel the exam.'}</p>
        </div>
        <div className="text-center">
          <div className="w-40 border-b-2 mb-2" style={{ borderColor: '#1e293b' }}></div>
          <p className="text-sm font-bold">{isBangla ? 'অধ্যক্ষের স্বাক্ষর' : 'Principal Signature'}</p>
        </div>
      </div>
    </div>
  );
};

export const generateAdmitCardPDF = async (
  exam: Exam,
  students: Student[],
  madrasah: { name: string; logo_url?: string },
  templateId: string = 'classic'
) => {
  // Create a hidden container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  const root = createRoot(container);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // A4 size in mm: 210 x 297
  // We want to fit 2 admit cards per page
  // The rendered div is 800x450 px.
  // We'll scale it down to fit half the page width/height.
  
  const cardWidthMm = 190; // Almost full width with 10mm margins
  const cardHeightMm = (450 / 800) * cardWidthMm; // Maintain aspect ratio
  
  const marginX = (pageWidth - cardWidthMm) / 2;
  const marginY = 15;
  const gapY = 15;

  await document.fonts.ready;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    
    // Render the component for this student
    await new Promise<void>((resolve) => {
      root.render(<AdmitCardTemplate exam={exam} student={student} madrasah={madrasah} templateId={templateId} />);
      // Wait a bit for images to load and DOM to update
      setTimeout(resolve, 300);
    });

    const imgData = await toPng(container.firstElementChild as HTMLElement, {
      pixelRatio: 2, // Higher quality
      backgroundColor: '#ffffff',
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left'
      }
    });

    // Calculate position
    const isSecondOnPage = i % 2 !== 0;
    
    if (i > 0 && !isSecondOnPage) {
      pdf.addPage();
    }

    const yPos = isSecondOnPage ? marginY + cardHeightMm + gapY : marginY;

    pdf.addImage(imgData, 'PNG', marginX, yPos, cardWidthMm, cardHeightMm);
  }

  root.unmount();
  document.body.removeChild(container);

  pdf.save(`Admit_Cards_${exam.exam_name}.pdf`);
};
