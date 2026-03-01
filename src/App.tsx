import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  BookOpen, 
  CreditCard, 
  Settings,
  Menu,
  X,
  GraduationCap
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Views
import Dashboard from './views/Dashboard';
import Students from './views/Students';
import Teachers from './views/Teachers';
import Attendance from './views/Attendance';
import Fees from './views/Fees';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function Sidebar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Students', path: '/students' },
    { icon: UserCheck, label: 'Teachers', path: '/teachers' },
    { icon: BookOpen, label: 'Attendance', path: '/attendance' },
    { icon: CreditCard, label: 'Fees', path: '/fees' },
  ];

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <motion.aside
        initial={false}
        animate={{ width: isOpen ? 260 : 0, opacity: isOpen ? 1 : 0 }}
        className={cn(
          "fixed left-0 top-0 h-screen bg-white border-r border-stone-200 z-40 overflow-hidden flex flex-col",
          !isOpen && "pointer-events-none"
        )}
      >
        <div className="p-6 flex items-center gap-3 border-bottom border-stone-100">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
            <GraduationCap size={24} />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg leading-tight">Nur Al-Ilm</h1>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Madrasah Management</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-emerald-50 text-emerald-700 font-medium" 
                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                )}
              >
                <item.icon size={20} className={cn(isActive ? "text-emerald-600" : "text-stone-400 group-hover:text-stone-600")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-stone-100">
          <button className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-stone-500 hover:bg-stone-50 transition-colors">
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </div>
      </motion.aside>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-stone-50">
        <Sidebar />
        <main className="flex-1 lg:ml-[260px] p-4 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/students" element={<Students />} />
              <Route path="/teachers" element={<Teachers />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/fees" element={<Fees />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}
