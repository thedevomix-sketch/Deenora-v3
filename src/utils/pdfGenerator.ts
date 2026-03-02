import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Exam, Student, ExamSubject, Madrasah, SeatAssignment } from '../types';

// Helper: Load Image
const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
    });
};

// --- ADMIT CARD GENERATOR ---
export const generateAdmitCardPDF = async (
    exam: Exam,
    students: Student[],
    madrasah: { name: string; logo_url?: string },
    templateId: string = 'classic'
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Load Logo if available
    let logoData: string | null = null;
    if (madrasah.logo_url) {
        try {
            logoData = await loadImage(madrasah.logo_url);
        } catch (e) {
            console.warn('Failed to load logo', e);
        }
    }

    const cardWidth = 180;
    const cardHeight = 120;
    const marginX = (pageWidth - cardWidth) / 2;
    
    students.forEach((student, index) => {
        if (index > 0 && index % 2 === 0) doc.addPage();
        
        const y = (index % 2) * (cardHeight + 20) + 20;
        
        // Draw Card Border
        if (templateId === 'classic') {
            doc.setDrawColor(0);
            doc.rect(marginX, y, cardWidth, cardHeight);
        } else if (templateId === 'modern') {
            // Header Background
            doc.setFillColor(30, 58, 138); // Blue-900
            doc.rect(marginX, y, cardWidth, 30, 'F');
            // Footer Line
            doc.rect(marginX, y + cardHeight - 5, cardWidth, 5, 'F');
            // Border
            doc.setDrawColor(200);
            doc.rect(marginX, y, cardWidth, cardHeight);
        } else if (templateId === 'minimal') {
            // No border, just a line
            doc.setDrawColor(200);
            doc.line(marginX + 10, y + 25, marginX + cardWidth - 10, y + 25);
        }

        // Header Content
        if (templateId === 'modern') doc.setTextColor(255, 255, 255);
        else doc.setTextColor(0, 0, 0);

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(madrasah.name || 'Madrasah Name', marginX + cardWidth / 2, y + 12, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${exam.exam_name} | Admit Card`, marginX + cardWidth / 2, y + 20, { align: 'center' });

        // Reset Color
        doc.setTextColor(0, 0, 0);

        // Student Photo Placeholder
        const photoX = marginX + cardWidth - 40;
        const photoY = y + 35;
        doc.setDrawColor(150);
        doc.rect(photoX, photoY, 30, 35);
        doc.setFontSize(8);
        doc.text('Photo', photoX + 15, photoY + 17, { align: 'center' });

        // Student Details
        const labelX = marginX + 15;
        const valueX = marginX + 50;
        let currentY = y + 40;
        const lineHeight = 8;

        doc.setFontSize(11);
        
        const drawField = (label: string, value: string) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label, labelX, currentY);
            doc.setFont('helvetica', 'normal');
            doc.text(value, valueX, currentY);
            currentY += lineHeight;
        };

        drawField('Name:', student.student_name);
        drawField('Class:', student.classes?.class_name || '');
        drawField('Roll:', student.roll?.toString() || '-');
        drawField('Date:', new Date(exam.exam_date).toLocaleDateString());
        
        // Instructions
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('Instructions: Bring this card to the exam hall. Do not carry mobile phones.', marginX + cardWidth / 2, y + cardHeight - 15, { align: 'center' });
    });

    doc.save(`admit-cards-${exam.exam_name}.pdf`);
};

// --- SEAT PLAN GENERATOR ---
export const generateSeatPlanPDF = (
    assignments: SeatAssignment[],
    madrasah: { name: string },
    templateId: string = 'list'
) => {
    const doc = new jsPDF();
    
    // Group by Room
    const rooms: any = {};
    assignments.forEach((a) => {
        if (!rooms[a.room_name]) rooms[a.room_name] = [];
        rooms[a.room_name].push(a);
    });

    Object.keys(rooms).forEach((roomName, index) => {
        if (index > 0) doc.addPage();

        // Header
        doc.setFontSize(18);
        doc.text(madrasah.name || 'Madrasah Name', 105, 15, { align: 'center' });
        doc.setFontSize(14);
        doc.text(`Seat Plan - ${roomName}`, 105, 25, { align: 'center' });

        const roomAssignments = rooms[roomName];

        if (templateId === 'grid') {
            // Grid View
            const startX = 15;
            const startY = 40;
            const boxWidth = 40;
            const boxHeight = 25;
            const gap = 5;
            const cols = 4;

            let currentX = startX;
            let currentY = startY;

            roomAssignments.forEach((a: any, i: number) => {
                if (i > 0 && i % cols === 0) {
                    currentX = startX;
                    currentY += boxHeight + gap;
                }

                if (currentY > 270) {
                    doc.addPage();
                    currentY = 40;
                }

                doc.setDrawColor(0);
                doc.rect(currentX, currentY, boxWidth, boxHeight);
                
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(`Seat ${a.seat_number}`, currentX + 2, currentY + 5);
                
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(doc.splitTextToSize(a.student_name, boxWidth - 4), currentX + 2, currentY + 12);
                doc.text(`${a.class_name} (Roll: ${a.roll})`, currentX + 2, currentY + 22);

                currentX += boxWidth + gap;
            });

        } else {
            // List View (Table)
            autoTable(doc, {
                startY: 35,
                head: [['Seat', 'Name', 'Class', 'Roll']],
                body: roomAssignments.map((a: any) => [
                    a.seat_number,
                    a.student_name,
                    a.class_name,
                    a.roll
                ]),
                theme: 'grid',
                headStyles: { fillColor: [30, 58, 138] },
            });
        }
    });

    doc.save(`seat-plan-${templateId}.pdf`);
};

// --- RESULT GENERATOR ---
export const generateResultPDF = (
    student: any,
    exam: any,
    marks: any[],
    madrasah: { name: string }
) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(30, 58, 138);
    doc.text(madrasah.name || 'Madrasah Name', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Result Sheet', 105, 30, { align: 'center' });

    // Student Info Box
    doc.setDrawColor(200);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(15, 40, 180, 35, 3, 3, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Name: ${student.student_name}`, 20, 50);
    doc.text(`Roll: ${student.roll}`, 120, 50);
    doc.text(`Class: ${student.classes?.class_name || ''}`, 20, 60);
    doc.text(`Exam: ${exam.exam_name}`, 120, 60);

    // Marks Table
    const totalMarks = marks.reduce((sum, m) => sum + Number(m.marks_obtained), 0);
    
    // Calculate Grade Helper
    const getGrade = (m: number) => {
        if (m >= 80) return 'A+';
        if (m >= 70) return 'A';
        if (m >= 60) return 'A-';
        if (m >= 50) return 'B';
        if (m >= 40) return 'C';
        if (m >= 33) return 'D';
        return 'F';
    };

    autoTable(doc, {
        startY: 85,
        head: [['Subject', 'Marks', 'Grade']],
        body: [
            ...marks.map((m: any) => [
                m.subject_name,
                m.marks_obtained,
                getGrade(m.marks_obtained)
            ]),
            ['Total', totalMarks, '']
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 58, 138] },
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
    });

    doc.save(`result-${student.roll}.pdf`);
};

// --- CLASS RESULT GENERATOR ---
export const generateClassResultPDF = (
    exam: any,
    subjects: any[],
    students: any[],
    marksData: any,
    madrasah: { name: string }
) => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape

    doc.setFontSize(18);
    doc.text(madrasah.name || 'Madrasah Name', 148, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`${exam.exam_name} - Result Sheet`, 148, 22, { align: 'center' });

    const head = [
        'Roll', 
        'Name', 
        ...subjects.map((s: any) => s.subject_name.substring(0, 10)), 
        'Total', 
        'GPA', 
        'Grade'
    ];

    const body = students.map((std: any) => {
        let total = 0;
        const subjectMarks = subjects.map((sub: any) => {
            const m = parseFloat(marksData[std.id]?.[sub.id] || '0');
            total += m;
            return m;
        });

        // Simple GPA Calculation (Mock)
        const percentage = total / (subjects.reduce((sum: number, s: any) => sum + s.full_marks, 0) || 1) * 100;
        let grade = 'F';
        let gpa = '0.00';
        
        if (percentage >= 80) { gpa = '5.00'; grade = 'A+'; }
        else if (percentage >= 70) { gpa = '4.00'; grade = 'A'; }
        else if (percentage >= 60) { gpa = '3.50'; grade = 'A-'; }
        else if (percentage >= 50) { gpa = '3.00'; grade = 'B'; }
        else if (percentage >= 40) { gpa = '2.00'; grade = 'C'; }
        else if (percentage >= 33) { gpa = '1.00'; grade = 'D'; }

        return [
            std.roll,
            std.student_name,
            ...subjectMarks,
            total,
            gpa,
            grade
        ];
    });

    autoTable(doc, {
        startY: 30,
        head: [head],
        body: body,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 138] }
    });

    doc.save(`class-result-${exam.exam_name}.pdf`);
};

// --- CLASS FEE REPORT GENERATOR ---
export const generateClassFeeReportPDF = (
    className: string,
    month: string,
    students: any[],
    madrasah: { name: string }
) => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(madrasah.name || 'Madrasah Name', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Class Fee Report - ${className} (${month})`, 105, 25, { align: 'center' });

    const head = [['Roll', 'Name', 'Payable', 'Paid', 'Due', 'Status']];
    const body = students.map((std: any) => {
        let status = 'Unpaid';
        if (Number(std.balance_due) <= 0 && Number(std.total_payable) > 0) status = 'Paid';
        else if (Number(std.balance_due) > 0 && Number(std.total_paid) > 0) status = 'Partial';
        else if (Number(std.total_payable) === 0) status = 'No Fee';

        return [
            std.roll || '-',
            std.student_name,
            std.total_payable,
            std.total_paid,
            std.balance_due,
            status
        ];
    });

    autoTable(doc, {
        startY: 35,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138] },
        styles: { fontSize: 10 }
    });

    // Summary
    const totalPayable = students.reduce((sum, s) => sum + Number(s.total_payable), 0);
    const totalPaid = students.reduce((sum, s) => sum + Number(s.total_paid), 0);
    const totalDue = students.reduce((sum, s) => sum + Number(s.balance_due), 0);

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Payable: ${totalPayable}`, 15, finalY);
    doc.text(`Total Paid: ${totalPaid}`, 80, finalY);
    doc.text(`Total Due: ${totalDue}`, 150, finalY);

    doc.save(`class-fees-${className}-${month}.pdf`);
};

// --- FINAL RESULT GENERATOR ---
export const generateFinalResultPDF = (
    title: string,
    className: string,
    subjects: string[],
    students: any[],
    madrasah: { name: string }
) => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape

    // Header
    doc.setFillColor(30, 58, 138); // Blue-900
    doc.rect(0, 0, 297, 30, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text(madrasah.name || 'Madrasah Name', 148, 12, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(`${title} | Class: ${className}`, 148, 22, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);

    const head = [
        'Rank',
        'Roll',
        'Name',
        ...subjects.map(s => s.substring(0, 10)),
        'Total',
        'GPA',
        'Grade'
    ];

    const body = students.map((std: any) => [
        `#${std.rank}`,
        std.roll || '-',
        std.student_name,
        ...subjects.map(sub => std.marks[sub] || '-'),
        std.total,
        std.gpa,
        std.grade
    ]);

    autoTable(doc, {
        startY: 40,
        head: [head],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: [37, 99, 235] }, // Rank
            1: { fontStyle: 'bold', textColor: [37, 99, 235] }, // Roll
            2: { fontStyle: 'bold' } // Name
        },
        didParseCell: (data) => {
            // Color code grade
            if (data.section === 'body' && data.column.index === head.length - 1) {
                const grade = data.cell.raw;
                if (grade === 'F') {
                    data.cell.styles.textColor = [239, 68, 68]; // Red
                } else {
                    data.cell.styles.textColor = [16, 185, 129]; // Green
                }
            }
        }
    });

    doc.save(`final-result-${title}.pdf`);
};
