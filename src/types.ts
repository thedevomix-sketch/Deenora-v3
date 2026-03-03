
/**
 * Global Type Definitions for Madrasah SaaS Management System
 */

export type Language = 'bn' | 'en';

export type UserRole = 'super_admin' | 'madrasah_admin' | 'teacher' | 'accountant';

export interface Institution {
  id: string;
  name: string;
  phone?: string;
  logo_url?: string;
  institution_type: 'madrasah' | 'school' | 'kindergarten' | 'nurani' | 'system';
  config_json: {
    modules: {
      attendance: boolean;
      fees: boolean;
      results: boolean;
      admit_card: boolean;
      seat_plan: boolean;
      accounting: boolean;
    };
    result_system: 'grading' | 'marks' | 'hifz';
    attendance_type: 'daily' | 'period';
    fee_structure: 'monthly' | 'session';
    ui_mode: 'madrasah' | 'school';
    template_set?: string;
  };
  theme: string;
  status: 'active' | 'suspended' | 'trial';
  is_active: boolean;
  is_super_admin: boolean;
  created_at: string;
  email?: string;
  login_code?: string;
  balance: number;
  sms_balance: number;
  reve_api_key?: string;
  reve_secret_key?: string;
  reve_caller_id?: string;
  reve_client_id?: string;
  subscription_end?: string;
}

export interface Profile {
  id: string;
  institution_id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Class {
  id: string;
  institution_id: string;
  class_name: string;
  sort_order?: number | null;
  created_at?: string;
}

export interface Student {
  id: string;
  institution_id: string;
  class_id: string;
  student_name: string;
  roll: number | null;
  guardian_name?: string;
  guardian_phone: string;
  guardian_phone_2?: string;
  photo_url?: string;
  created_at?: string;
  classes?: Class;
}

export interface Exam {
  id: string;
  institution_id: string;
  class_id: string;
  exam_name: string;
  exam_date: string;
  is_published: boolean;
  created_at: string;
  classes?: Class;
}

export interface ExamSubject {
  id: string;
  exam_id: string;
  subject_name: string;
  full_marks: number;
  pass_marks: number;
}

export interface ExamMark {
  id: string;
  exam_id: string;
  student_id: string;
  subject_id: string;
  marks_obtained: number;
}

export interface Teacher {
  id: string;
  institution_id: string;
  name: string;
  phone: string;
  login_code: string;
  is_active: boolean;
  permissions: {
    can_manage_students: boolean;
    can_manage_classes: boolean;
    can_send_sms: boolean;
    can_send_free_sms: boolean;
  };
  created_at: string;
}

export interface Attendance {
  id: string;
  institution_id: string;
  student_id: string;
  status: 'present' | 'absent' | 'late';
  date: string;
  recorded_by: string;
  students?: Student;
}

export interface LedgerEntry {
  id: string;
  institution_id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  transaction_date: string;
  created_at: string;
}

export interface FeeStructure {
  id: string;
  institution_id: string;
  class_id: string;
  fee_name: string;
  amount: number;
  created_at: string;
}

export interface Fee {
  id: string;
  institution_id: string;
  student_id: string;
  class_id: string;
  amount_paid: number;
  amount_due: number;
  discount?: number;
  month: string; // YYYY-MM
  status: 'paid' | 'unpaid' | 'partial';
  paid_at?: string;
  students?: Student;
}

export interface ExamRoom {
  id: string;
  room_name: string;
  capacity: number;
}

export interface SeatAssignment {
  student_id: string;
  student_name: string;
  class_name: string;
  roll: number;
  room_name: string;
  seat_number: number;
}

export interface FinalResult {
  id: string;
  institution_id: string;
  class_id: string;
  title: string;
  created_at: string;
  classes?: Class;
  exams?: FinalResultExam[];
}

export interface FinalResultExam {
  id: string;
  final_result_id: string;
  exam_id: string;
  weight: number;
  exam?: Exam;
}

export type View = 
  | 'home' 
  | 'classes' 
  | 'account' 
  | 'students' 
  | 'student-details' 
  | 'student-form' 
  | 'class-form' 
  | 'admin-panel' 
  | 'transactions' 
  | 'wallet-sms' 
  | 'admin-dashboard' 
  | 'admin-approvals' 
  | 'data-management' 
  | 'teachers' 
  | 'accounting' 
  | 'attendance'
  | 'exams'
  | 'final-results';

export interface AppState {
  currentView: View;
  selectedClassId?: string;
  selectedStudent?: Student;
  isEditing?: boolean;
}

export interface Transaction {
  id: string;
  institution_id: string;
  amount: number;
  transaction_id: string;
  sender_phone: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  sms_count?: number;
  institutions?: Institution;
}

export interface AdminSMSStock {
  id: string;
  remaining_sms: number;
  last_updated: string;
}

export interface SMSTemplate {
  id: string;
  institution_id: string;
  title: string;
  body: string;
  created_at: string;
}
