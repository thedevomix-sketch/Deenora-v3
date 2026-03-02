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

      doc.end();
    } catch (error) {
      console.error('PDF Generation Error:', error);
      res.status(500).send('Error generating PDF');
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
