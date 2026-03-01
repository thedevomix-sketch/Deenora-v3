export interface Student {
  id: number;
  name: string;
  guardian_name: string;
  phone: string;
  address: string;
  enrollment_date: string;
  class_id: number;
  class_name?: string;
  status: 'active' | 'inactive';
}

export interface Teacher {
  id: number;
  name: string;
  subject: string;
  phone: string;
  email: string;
  join_date: string;
}

export interface ClassRoom {
  id: number;
  name: string;
  teacher_id: number;
  room: string;
}

export interface AttendanceRecord {
  student_id: number;
  name: string;
  status: 'present' | 'absent' | 'late' | null;
}

export interface FeeRecord {
  id: number;
  student_id: number;
  student_name: string;
  amount: number;
  month: string;
  year: number;
  status: 'paid' | 'pending';
  payment_date: string;
}

export interface DashboardStats {
  students: number;
  teachers: number;
  classes: number;
  pendingFees: number;
}
