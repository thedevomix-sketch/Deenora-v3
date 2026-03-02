import express from 'express';
import { createServer as createViteServer } from 'vite';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Font loading
  let fontBuffer: Buffer | null = null;
  try {
    const fontUrl = 'https://github.com/google/fonts/raw/main/ofl/notosansbengali/NotoSansBengali-Regular.ttf';
    const response = await fetch(fontUrl);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      fontBuffer = Buffer.from(arrayBuffer);
      console.log('Bengali font loaded successfully');
    } else {
      console.warn('Failed to load Bengali font, falling back to standard fonts');
    }
  } catch (error) {
    console.error('Error loading font:', error);
  }

  // API Routes for PDF Generation
  app.post('/api/pdf/result', async (req, res) => {
    try {
      const { student, exam, marks, madrasah } = req.body;
      
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=result-${student.roll}.pdf`);
      
      doc.pipe(res);

      if (fontBuffer) {
        doc.font(fontBuffer);
      } else {
        doc.font('Helvetica');
      }

      // Header
      doc.fontSize(20).text(madrasah.name || 'Madrasah Name', { align: 'center' });
      doc.fontSize(12).text('Result Sheet', { align: 'center' });
      doc.moveDown();

      // Student Info
      doc.fontSize(10).text(`Name: ${student.student_name}`);
      doc.text(`Roll: ${student.roll}`);
      doc.text(`Class: ${student.classes?.class_name || ''}`);
      doc.text(`Exam: ${exam.exam_name}`);
      doc.moveDown();

      // Marks Table
      const tableTop = 200;
      const itemHeight = 20;
      
      doc.font('Helvetica-Bold').text('Subject', 50, tableTop);
      doc.text('Marks', 300, tableTop);
      doc.text('Grade', 400, tableTop);
      
      if (fontBuffer) doc.font(fontBuffer);
      else doc.font('Helvetica');

      let y = tableTop + 25;
      
      marks.forEach((mark: any) => {
        doc.text(mark.subject_name, 50, y);
        doc.text(mark.marks_obtained.toString(), 300, y);
        doc.text(calculateGrade(mark.marks_obtained), 400, y);
        y += itemHeight;
      });

      // Total
      const totalMarks = marks.reduce((sum: number, m: any) => sum + Number(m.marks_obtained), 0);
      doc.moveDown();
      doc.font('Helvetica-Bold').text(`Total Marks: ${totalMarks}`, 50, y + 20);

      doc.end();
    } catch (error) {
      console.error('PDF Generation Error:', error);
      res.status(500).send('Error generating PDF');
    }
  });

  app.post('/api/pdf/fee', async (req, res) => {
    try {
      const { student, fees, madrasah, totalPaid, totalDue } = req.body;
      
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=fees-${student.roll}.pdf`);
      
      doc.pipe(res);

      if (fontBuffer) {
        doc.font(fontBuffer);
      } else {
        doc.font('Helvetica');
      }

      // Header
      doc.fontSize(20).text(madrasah.name || 'Madrasah Name', { align: 'center' });
      doc.fontSize(12).text('Fee Collection Report', { align: 'center' });
      doc.moveDown();

      // Student Info
      doc.fontSize(10).text(`Name: ${student.student_name}`);
      doc.text(`Roll: ${student.roll}`);
      doc.text(`Class: ${student.classes?.class_name || ''}`);
      doc.moveDown();

      // Fees Table
      const tableTop = 200;
      const itemHeight = 20;
      
      doc.font('Helvetica-Bold').text('Month', 50, tableTop);
      doc.text('Amount Paid', 200, tableTop);
      doc.text('Due', 300, tableTop);
      doc.text('Status', 400, tableTop);
      
      if (fontBuffer) doc.font(fontBuffer);
      else doc.font('Helvetica');

      let y = tableTop + 25;
      
      fees.forEach((fee: any) => {
        doc.text(fee.month, 50, y);
        doc.text(fee.amount_paid.toString(), 200, y);
        doc.text(fee.amount_due.toString(), 300, y);
        doc.text(fee.status, 400, y);
        y += itemHeight;
      });

      // Summary
      doc.moveDown();
      doc.font('Helvetica-Bold');
      doc.text(`Total Paid: ${totalPaid}`, 50, y + 20);
      doc.text(`Total Due: ${totalDue}`, 200, y + 20);

      doc.end();
    } catch (error) {
      console.error('PDF Generation Error:', error);
      res.status(500).send('Error generating PDF');
    }
  });

  app.post('/api/pdf/class-fees', async (req, res) => {
    try {
      const { className, month, students, madrasah } = req.body;
      
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=class-fees-${className}-${month}.pdf`);
      
      doc.pipe(res);

      if (fontBuffer) {
        doc.font(fontBuffer);
      } else {
        doc.font('Helvetica');
      }

      // Header
      doc.fontSize(20).text(madrasah.name || 'Madrasah Name', { align: 'center' });
      doc.fontSize(12).text(`Class Fee Report - ${className}`, { align: 'center' });
      doc.fontSize(10).text(`Month: ${month}`, { align: 'center' });
      doc.moveDown();

      // Table Header
      const tableTop = 150;
      const itemHeight = 20;
      
      doc.font('Helvetica-Bold');
      doc.text('Roll', 50, tableTop);
      doc.text('Name', 100, tableTop);
      doc.text('Payable', 250, tableTop);
      doc.text('Paid', 320, tableTop);
      doc.text('Due', 390, tableTop);
      doc.text('Status', 460, tableTop);
      
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      if (fontBuffer) doc.font(fontBuffer);
      else doc.font('Helvetica');

      let y = tableTop + 25;
      
      students.forEach((student: any) => {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }

        doc.text(student.roll || '-', 50, y);
        doc.text(student.student_name, 100, y, { width: 140, ellipsis: true });
        doc.text(student.total_payable.toString(), 250, y);
        doc.text(student.total_paid.toString(), 320, y);
        doc.text(student.balance_due.toString(), 390, y);
        
        // Status color logic (simulated with text)
        let status = 'Unpaid';
        if (Number(student.balance_due) <= 0 && Number(student.total_payable) > 0) status = 'Paid';
        else if (Number(student.balance_due) > 0 && Number(student.total_paid) > 0) status = 'Partial';
        else if (Number(student.total_payable) === 0) status = 'No Fee';
        
        doc.text(status, 460, y);
        
        y += itemHeight;
      });

      // Summary
      doc.moveDown();
      doc.moveTo(50, y).lineTo(550, y).stroke();
      y += 10;
      
      const totalPayable = students.reduce((sum: number, s: any) => sum + Number(s.total_payable), 0);
      const totalPaid = students.reduce((sum: number, s: any) => sum + Number(s.total_paid), 0);
      const totalDue = students.reduce((sum: number, s: any) => sum + Number(s.balance_due), 0);

      doc.font('Helvetica-Bold');
      doc.text('Total:', 100, y);
      doc.text(totalPayable.toString(), 250, y);
      doc.text(totalPaid.toString(), 320, y);
      doc.text(totalDue.toString(), 390, y);
      doc.text(totalDue.toString(), 390, y);

      doc.end();
    } catch (error) {
      console.error('PDF Generation Error:', error);
      res.status(500).send('Error generating PDF');
    }
  });

  app.post('/api/pdf/class-result', async (req, res) => {
    try {
      const { exam, subjects, students, marksData, madrasah } = req.body;
      
      const doc = new PDFDocument({ size: 'A4', margin: 30, layout: 'landscape' });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=result-${exam.exam_name}.pdf`);
      
      doc.pipe(res);

      if (fontBuffer) {
        doc.font(fontBuffer);
      } else {
        doc.font('Helvetica');
      }

      // --- HEADER DESIGN ---
      // Background for header
      doc.rect(0, 0, 842, 100).fill('#1E3A8A');
      
      // Madrasah Name
      doc.fillColor('white');
      doc.fontSize(24).text(madrasah.name || 'Madrasah Name', 0, 30, { align: 'center' });
      
      // Exam Name & Date
      doc.fontSize(14).text(`${exam.exam_name} | ${new Date().toLocaleDateString()}`, 0, 65, { align: 'center' });
      
      // Reset color
      doc.fillColor('black');
      doc.moveDown(4);

      // --- TABLE CONFIGURATION ---
      const startX = 30;
      const startY = 130;
      let currentY = startY;
      const rowHeight = 30;
      
      // Dynamic Column Widths
      const rollWidth = 50;
      const nameWidth = 150;
      const totalWidth = 60;
      const gpaWidth = 50;
      const gradeWidth = 50;
      
      // Calculate remaining width for subjects
      const fixedWidth = rollWidth + nameWidth + totalWidth + gpaWidth + gradeWidth;
      const availableWidth = 842 - 60 - fixedWidth; // Page width - margins - fixed columns
      const subjectWidth = Math.max(60, availableWidth / subjects.length);
      
      // --- TABLE HEADER ---
      doc.font('Helvetica-Bold').fontSize(10);
      
      // Header Background
      doc.rect(startX, currentY, 842 - 60, rowHeight).fill('#E2E8F0').stroke();
      doc.fillColor('#1E293B');
      
      let currentX = startX;
      
      // Draw Header Columns
      const drawHeaderCell = (text: string, width: number, align: string = 'left') => {
        doc.text(text, currentX + 5, currentY + 10, { width: width - 10, align: align as any });
        currentX += width;
      };

      drawHeaderCell('Roll', rollWidth, 'center');
      drawHeaderCell('Name', nameWidth, 'left');
      
      subjects.forEach((sub: any) => {
        drawHeaderCell(sub.subject_name.substring(0, 10), subjectWidth, 'center');
      });
      
      drawHeaderCell('Total', totalWidth, 'center');
      drawHeaderCell('GPA', gpaWidth, 'center');
      drawHeaderCell('Grade', gradeWidth, 'center');
      
      currentY += rowHeight;
      
      // --- TABLE ROWS ---
      if (fontBuffer) doc.font(fontBuffer);
      else doc.font('Helvetica');
      doc.fontSize(10);
      
      students.forEach((student: any, index: number) => {
        // New Page Check
        if (currentY > 550) {
          doc.addPage({ layout: 'landscape', margin: 30 });
          currentY = 50;
          
          // Redraw Header on new page
          doc.font('Helvetica-Bold');
          doc.rect(startX, currentY, 842 - 60, rowHeight).fill('#E2E8F0').stroke();
          doc.fillColor('#1E293B');
          currentX = startX;
          
          drawHeaderCell('Roll', rollWidth, 'center');
          drawHeaderCell('Name', nameWidth, 'left');
          subjects.forEach((sub: any) => drawHeaderCell(sub.subject_name.substring(0, 10), subjectWidth, 'center'));
          drawHeaderCell('Total', totalWidth, 'center');
          drawHeaderCell('GPA', gpaWidth, 'center');
          drawHeaderCell('Grade', gradeWidth, 'center');
          
          currentY += rowHeight;
          
          // Reset font for body
          if (fontBuffer) doc.font(fontBuffer);
          else doc.font('Helvetica');
          doc.fontSize(10);
        }
        
        // Row Background (Zebra Striping)
        if (index % 2 === 0) {
          doc.rect(startX, currentY, 842 - 60, rowHeight).fill('#F8FAFC').stroke();
        } else {
          doc.rect(startX, currentY, 842 - 60, rowHeight).stroke();
        }
        doc.fillColor('#334155');
        
        currentX = startX;
        
        // Draw Cell Helper
        const drawCell = (text: string, width: number, align: string = 'left', color: string = '#334155') => {
          doc.fillColor(color).text(text, currentX + 5, currentY + 10, { width: width - 10, align: align as any, ellipsis: true });
          currentX += width;
        };

        // Roll
        drawCell(student.roll.toString(), rollWidth, 'center', '#2563EB'); // Blue color for roll
        
        // Name
        drawCell(student.student_name, nameWidth, 'left', '#1E293B');
        
        // Subject Marks
        let totalMarks = 0;
        let allPassed = true;
        
        subjects.forEach((sub: any) => {
          const mark = marksData[student.student_id]?.[sub.id] || 0;
          const numMark = parseFloat(mark);
          totalMarks += numMark;
          
          if (numMark < sub.pass_marks) allPassed = false;
          
          // Color code marks: Red if failed
          const markColor = numMark < sub.pass_marks ? '#EF4444' : '#334155';
          drawCell(numMark.toString(), subjectWidth, 'center', markColor);
        });
        
        // Total
        drawCell(totalMarks.toFixed(0), totalWidth, 'center', '#1E293B');
        
        // Calculate GPA/Grade
        const percentage = totalMarks / (subjects.reduce((sum: number, s: any) => sum + s.full_marks, 0) || 1) * 100;
        let gpa = '0.00';
        let grade = 'F';
        
        if (allPassed) {
             if (percentage >= 80) { gpa = '5.00'; grade = 'A+'; }
        else if (percentage >= 70) { gpa = '4.00'; grade = 'A'; }
        else if (percentage >= 60) { gpa = '3.50'; grade = 'A-'; }
        else if (percentage >= 50) { gpa = '3.00'; grade = 'B'; }
        else if (percentage >= 40) { gpa = '2.00'; grade = 'C'; }
        else if (percentage >= 33) { gpa = '1.00'; grade = 'D'; }
        }
        
        // Color code Grade
        const gradeColor = grade === 'F' ? '#EF4444' : '#10B981'; // Red for F, Green for pass
        
        drawCell(gpa, gpaWidth, 'center', gradeColor);
        drawCell(grade, gradeWidth, 'center', gradeColor);
        
        currentY += rowHeight;
      });

      // --- FOOTER / SUMMARY ---
      const totalStudents = students.length;
      const passedStudents = students.filter((s: any) => {
         let allPassed = true;
         subjects.forEach((sub: any) => {
             const mark = parseFloat(marksData[s.student_id]?.[sub.id] || '0');
             if (mark < sub.pass_marks) allPassed = false;
         });
         return allPassed;
      }).length;
      
      const failedStudents = totalStudents - passedStudents;
      const passRate = totalStudents > 0 ? ((passedStudents / totalStudents) * 100).toFixed(1) : '0';

      doc.moveDown(2);
      const summaryY = currentY + 20;
      
      // Summary Box
      if (summaryY < 500) { // Only draw if space permits
          doc.rect(startX, summaryY, 842 - 60, 60).fill('#F1F5F9');
          doc.fillColor('#1E293B');
          
          doc.font('Helvetica-Bold').fontSize(12);
          doc.text('Summary Report', startX + 20, summaryY + 20);
          
          doc.fontSize(10).font('Helvetica');
          doc.text(`Total Students: ${totalStudents}`, startX + 150, summaryY + 25);
          doc.text(`Passed: ${passedStudents}`, startX + 280, summaryY + 25);
          doc.fillColor('#EF4444').text(`Failed: ${failedStudents}`, startX + 380, summaryY + 25);
          doc.fillColor('#10B981').text(`Pass Rate: ${passRate}%`, startX + 480, summaryY + 25);
      }

      doc.end();
    } catch (error) {
      console.error('PDF Generation Error:', error);
      res.status(500).send('Error generating PDF');
    }
  });

  app.post('/api/pdf/final-result', async (req, res) => {
    try {
      const { title, className, subjects, students, madrasah } = req.body;
      
      const doc = new PDFDocument({ size: 'A4', margin: 30, layout: 'landscape' });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=final-result-${title}.pdf`);
      
      doc.pipe(res);

      if (fontBuffer) {
        doc.font(fontBuffer);
      } else {
        doc.font('Helvetica');
      }

      // --- HEADER DESIGN ---
      doc.rect(0, 0, 842, 100).fill('#1E3A8A');
      
      doc.fillColor('white');
      doc.fontSize(24).text(madrasah.name || 'Madrasah Name', 0, 30, { align: 'center' });
      
      doc.fontSize(14).text(`${title} | Class: ${className}`, 0, 65, { align: 'center' });
      
      doc.fillColor('black');
      doc.moveDown(4);

      // --- TABLE CONFIGURATION ---
      const startX = 30;
      const startY = 130;
      let currentY = startY;
      const rowHeight = 30;
      
      // Dynamic Column Widths
      const rankWidth = 40;
      const rollWidth = 50;
      const nameWidth = 150;
      const totalWidth = 60;
      const gpaWidth = 50;
      const gradeWidth = 50;
      
      const fixedWidth = rankWidth + rollWidth + nameWidth + totalWidth + gpaWidth + gradeWidth;
      const availableWidth = 842 - 60 - fixedWidth;
      const subjectWidth = Math.max(60, availableWidth / subjects.length);
      
      // --- TABLE HEADER ---
      doc.font('Helvetica-Bold').fontSize(10);
      
      doc.rect(startX, currentY, 842 - 60, rowHeight).fill('#E2E8F0').stroke();
      doc.fillColor('#1E293B');
      
      let currentX = startX;
      
      const drawHeaderCell = (text: string, width: number, align: string = 'left') => {
        doc.text(text, currentX + 5, currentY + 10, { width: width - 10, align: align as any });
        currentX += width;
      };

      drawHeaderCell('Rank', rankWidth, 'center');
      drawHeaderCell('Roll', rollWidth, 'center');
      drawHeaderCell('Name', nameWidth, 'left');
      
      subjects.forEach((sub: string) => {
        drawHeaderCell(sub.substring(0, 10), subjectWidth, 'center');
      });
      
      drawHeaderCell('Total', totalWidth, 'center');
      drawHeaderCell('GPA', gpaWidth, 'center');
      drawHeaderCell('Grade', gradeWidth, 'center');
      
      currentY += rowHeight;
      
      // --- TABLE ROWS ---
      if (fontBuffer) doc.font(fontBuffer);
      else doc.font('Helvetica');
      doc.fontSize(10);
      
      students.forEach((student: any, index: number) => {
        if (currentY > 550) {
          doc.addPage({ layout: 'landscape', margin: 30 });
          currentY = 50;
          
          doc.font('Helvetica-Bold');
          doc.rect(startX, currentY, 842 - 60, rowHeight).fill('#E2E8F0').stroke();
          doc.fillColor('#1E293B');
          currentX = startX;
          
          drawHeaderCell('Rank', rankWidth, 'center');
          drawHeaderCell('Roll', rollWidth, 'center');
          drawHeaderCell('Name', nameWidth, 'left');
          subjects.forEach((sub: string) => drawHeaderCell(sub.substring(0, 10), subjectWidth, 'center'));
          drawHeaderCell('Total', totalWidth, 'center');
          drawHeaderCell('GPA', gpaWidth, 'center');
          drawHeaderCell('Grade', gradeWidth, 'center');
          
          currentY += rowHeight;
          
          if (fontBuffer) doc.font(fontBuffer);
          else doc.font('Helvetica');
          doc.fontSize(10);
        }
        
        if (index % 2 === 0) {
          doc.rect(startX, currentY, 842 - 60, rowHeight).fill('#F8FAFC').stroke();
        } else {
          doc.rect(startX, currentY, 842 - 60, rowHeight).stroke();
        }
        doc.fillColor('#334155');
        
        currentX = startX;
        
        const drawCell = (text: string, width: number, align: string = 'left', color: string = '#334155') => {
          doc.fillColor(color).text(text, currentX + 5, currentY + 10, { width: width - 10, align: align as any, ellipsis: true });
          currentX += width;
        };

        drawCell(`#${student.rank}`, rankWidth, 'center', '#2563EB');
        drawCell(student.roll?.toString() || '-', rollWidth, 'center', '#2563EB');
        drawCell(student.student_name, nameWidth, 'left', '#1E293B');
        
        subjects.forEach((sub: string) => {
          const mark = student.marks[sub] || '-';
          drawCell(mark.toString(), subjectWidth, 'center', '#334155');
        });
        
        drawCell(student.total.toString(), totalWidth, 'center', '#1E293B');
        
        const gradeColor = student.grade === 'F' ? '#EF4444' : '#10B981';
        drawCell(student.gpa, gpaWidth, 'center', gradeColor);
        drawCell(student.grade, gradeWidth, 'center', gradeColor);
        
        currentY += rowHeight;
      });

      doc.end();
    } catch (error) {
      console.error('PDF Generation Error:', error);
      res.status(500).send('Error generating PDF');
    }
  });

  app.post('/api/pdf/admit-card', async (req, res) => {
    try {
      const { exam, students, madrasah, templateId = 'classic' } = req.body;
      const doc = new PDFDocument({ size: 'A4', margin: 30 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=admit-cards.pdf`);
      doc.pipe(res);

      if (fontBuffer) doc.font(fontBuffer);
      else doc.font('Helvetica');

      const drawClassicAdmitCard = (student: any, x: number, y: number, width: number, height: number) => {
          doc.rect(x, y, width, height).stroke();
          
          // Header
          doc.fontSize(16).text(madrasah.name || 'Madrasah Name', x, y + 20, { width, align: 'center' });
          doc.fontSize(12).text('Admit Card', x, y + 45, { width, align: 'center' });
          doc.fontSize(10).text(exam.exam_name, x, y + 60, { width, align: 'center' });
          
          // Photo Placeholder
          doc.rect(x + width - 100, y + 80, 80, 80).stroke();
          doc.fontSize(8).text('Photo', x + width - 100, y + 115, { width: 80, align: 'center' });

          // Details
          const startY = y + 90;
          const labelX = x + 30;
          const valueX = x + 100;
          
          doc.fontSize(10);
          doc.text('Name:', labelX, startY);
          doc.text(student.student_name, valueX, startY);
          
          doc.text('Class:', labelX, startY + 20);
          doc.text(student.classes?.class_name || '', valueX, startY + 20);
          
          doc.text('Roll:', labelX, startY + 40);
          doc.text(student.roll, valueX, startY + 40);
          
          doc.text('Exam Date:', labelX, startY + 60);
          doc.text(new Date(exam.exam_date).toLocaleDateString(), valueX, startY + 60);

          // Instructions
          doc.fontSize(8).text('Instructions: Bring this card to the exam hall. Do not carry mobile phones.', x + 30, y + height - 40, { width: width - 60, align: 'center' });
      };

      const drawModernAdmitCard = (student: any, x: number, y: number, width: number, height: number) => {
          // Header Background
          doc.rect(x, y, width, 70).fill('#1E3A8A');
          
          // Header Text
          doc.fillColor('white');
          doc.fontSize(16).text(madrasah.name || 'Madrasah Name', x, y + 20, { width, align: 'center' });
          doc.fontSize(10).text(`${exam.exam_name} | Admit Card`, x, y + 45, { width, align: 'center' });
          
          doc.fillColor('black');
          
          // Photo Placeholder (Circle)
          doc.save();
          doc.circle(x + width - 60, y + 110, 40).stroke();
          doc.fontSize(8).text('Photo', x + width - 80, y + 105, { width: 40, align: 'center' });
          doc.restore();

          // Details
          const startY = y + 90;
          const labelX = x + 30;
          const valueX = x + 120;
          
          doc.fontSize(12).font('Helvetica-Bold').text(student.student_name, labelX, startY);
          doc.fontSize(10).font(fontBuffer || 'Helvetica');
          
          doc.text(`Class: ${student.classes?.class_name || ''}`, labelX, startY + 20);
          doc.text(`Roll: ${student.roll}`, labelX, startY + 35);
          doc.text(`Date: ${new Date(exam.exam_date).toLocaleDateString()}`, labelX, startY + 50);

          // Footer Line
          doc.rect(x, y + height - 10, width, 10).fill('#1E3A8A');
      };

      const drawMinimalAdmitCard = (student: any, x: number, y: number, width: number, height: number) => {
          // No border, just text
          doc.fontSize(14).font('Helvetica-Bold').text(madrasah.name || 'Madrasah Name', x, y + 20, { width, align: 'center' });
          doc.fontSize(10).font(fontBuffer || 'Helvetica').text('Admit Card', x, y + 40, { width, align: 'center' });
          
          doc.moveTo(x + 50, y + 55).lineTo(x + width - 50, y + 55).stroke();

          const startY = y + 70;
          const col1X = x + 50;
          const col2X = x + width / 2 + 20;

          doc.fontSize(10);
          doc.text(`Name: ${student.student_name}`, col1X, startY);
          doc.text(`Class: ${student.classes?.class_name || ''}`, col1X, startY + 20);
          doc.text(`Roll: ${student.roll}`, col2X, startY);
          doc.text(`Exam: ${exam.exam_name}`, col2X, startY + 20);
          
          doc.rect(x + width - 80, y + 20, 60, 60).stroke(); // Photo
      };

      const cardHeight = 380;
      const cardWidth = 535;
      
      students.forEach((student: any, index: number) => {
          if (index % 2 === 0 && index !== 0) doc.addPage();
          
          const y = (index % 2) * (cardHeight + 20) + 30;
          
          if (templateId === 'modern') {
              drawModernAdmitCard(student, 30, y, cardWidth, cardHeight);
          } else if (templateId === 'minimal') {
              drawMinimalAdmitCard(student, 30, y, cardWidth, cardHeight);
          } else {
              drawClassicAdmitCard(student, 30, y, cardWidth, cardHeight);
          }
      });

      doc.end();
    } catch (e) {
      console.error(e);
      res.status(500).send('Error');
    }
  });

  app.post('/api/pdf/seat-plan', async (req, res) => {
    try {
      const { assignments, madrasah, templateId = 'list' } = req.body;
      const doc = new PDFDocument({ size: 'A4', margin: 30 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=seat-plan.pdf`);
      doc.pipe(res);

      if (fontBuffer) doc.font(fontBuffer);
      else doc.font('Helvetica');

      // Group by Room
      const rooms: any = {};
      assignments.forEach((a: any) => {
          if (!rooms[a.room_name]) rooms[a.room_name] = [];
          rooms[a.room_name].push(a);
      });

      Object.keys(rooms).forEach((roomName, index) => {
          if (index > 0) doc.addPage();
          
          doc.fontSize(24).text(madrasah.name || 'Madrasah Name', { align: 'center' });
          doc.fontSize(18).text(`Seat Plan - ${roomName}`, { align: 'center' });
          doc.moveDown();

          const roomAssignments = rooms[roomName];
          
          if (templateId === 'grid') {
              // Grid View
              const cols = 4;
              const boxWidth = 120;
              const boxHeight = 60;
              const startX = 40;
              let currentX = startX;
              let currentY = 150;
              
              roomAssignments.forEach((a: any, i: number) => {
                  if (i > 0 && i % cols === 0) {
                      currentX = startX;
                      currentY += boxHeight + 10;
                  }
                  
                  if (currentY > 750) {
                      doc.addPage();
                      currentY = 50;
                  }

                  doc.rect(currentX, currentY, boxWidth, boxHeight).stroke();
                  doc.fontSize(10).text(`Seat ${a.seat_number}`, currentX + 5, currentY + 5);
                  doc.fontSize(10).text(a.student_name, currentX + 5, currentY + 20, { width: boxWidth - 10, ellipsis: true });
                  doc.fontSize(8).text(`${a.class_name} (Roll: ${a.roll})`, currentX + 5, currentY + 40);
                  
                  currentX += boxWidth + 10;
              });

          } else {
              // List View (Default)
              const tableTop = 150;
              let y = tableTop;
              
              doc.fontSize(12).font('Helvetica-Bold');
              doc.text('Seat', 50, y);
              doc.text('Name', 120, y);
              doc.text('Class', 350, y);
              doc.text('Roll', 450, y);
              
              doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
              y += 25;
              
              if (fontBuffer) doc.font(fontBuffer);
              else doc.font('Helvetica');
              doc.fontSize(12);

              roomAssignments.forEach((a: any) => {
                  if (y > 750) {
                      doc.addPage();
                      y = 50;
                  }
                  
                  doc.text(a.seat_number.toString(), 50, y);
                  doc.text(a.student_name, 120, y, { width: 220, ellipsis: true });
                  doc.text(a.class_name, 350, y);
                  doc.text(a.roll.toString(), 450, y);
                  
                  y += 20;
              });
          }
      });

      doc.end();
    } catch (e) {
      console.error(e);
      res.status(500).send('Error');
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

function calculateGrade(marks: number): string {
  if (marks >= 80) return 'A+';
  if (marks >= 70) return 'A';
  if (marks >= 60) return 'A-';
  if (marks >= 50) return 'B';
  if (marks >= 40) return 'C';
  if (marks >= 33) return 'D';
  return 'F';
}

startServer();
