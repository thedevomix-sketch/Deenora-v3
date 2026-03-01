import { useEffect, useState } from 'react';
import { UserCheck, Mail, Phone, Plus } from 'lucide-react';
import type { Teacher } from '../types';

export default function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  useEffect(() => {
    fetch('/api/teachers').then(res => res.json()).then(setTeachers);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-stone-900">Teachers</h1>
          <p className="text-stone-500">Manage faculty and staff records.</p>
        </div>
        <button className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100">
          <Plus size={20} />
          <span>Add Teacher</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teachers.map((teacher) => (
          <div key={teacher.id} className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400">
                <UserCheck size={32} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-stone-900">{teacher.name}</h3>
                <p className="text-emerald-600 text-sm font-medium">{teacher.subject}</p>
              </div>
            </div>
            
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-3 text-stone-500 text-sm">
                <Mail size={16} />
                <span>{teacher.email || 'No email provided'}</span>
              </div>
              <div className="flex items-center gap-3 text-stone-500 text-sm">
                <Phone size={16} />
                <span>{teacher.phone || 'No phone provided'}</span>
              </div>
            </div>

            <div className="pt-4 flex gap-2">
              <button className="flex-1 py-2 bg-stone-50 text-stone-600 rounded-lg text-sm font-medium hover:bg-stone-100 transition-colors">
                View Profile
              </button>
              <button className="px-3 py-2 bg-stone-50 text-stone-600 rounded-lg hover:bg-stone-100 transition-colors">
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
