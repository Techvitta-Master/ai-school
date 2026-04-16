import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSchool } from '../../context/SchoolContext';
import {
  Users, BookOpen, UserPlus, ArrowRightLeft, Trash2,
  GraduationCap, LayoutDashboard, Plus, CheckCircle,
  Hash, ChevronRight,
} from 'lucide-react';

const CLASSES = [6, 7, 8, 9, 10];
const SECTIONS_LIST = ['A', 'B', 'C', 'D'];

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const teacherSchema = z.object({
  name:    z.string().min(2, 'Name must be at least 2 characters').max(60, 'Name must be under 60 characters'),
  email:   z.string().email('Enter a valid email address'),
  subject: z.string().min(1, 'Please select a subject'),
});

const studentSchema = z.object({
  name:    z.string().min(2, 'Name must be at least 2 characters').max(60, 'Name must be under 60 characters'),
  email:   z.string().email('Enter a valid email address'),
  rollNo:  z.coerce.number({ invalid_type_error: 'Enter a number' }).int().min(1, 'Min roll number is 1').max(9999, 'Max roll number is 9999'),
  class:   z.coerce.number().int().min(6).max(10),
  section: z.enum(['A', 'B', 'C', 'D'], { errorMap: () => ({ message: 'Select A–D' }) }),
});

const sectionSchema = z.object({
  class:   z.coerce.number().int().min(6).max(10),
  section: z.enum(['A', 'B', 'C', 'D'], { errorMap: () => ({ message: 'Select A–D' }) }),
});

const EMPTY_ASSIGN = { teacherId: '', class: '6', section: 'A', subject: '' };

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function FormInput({ label, required, ...props }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        {...props}
        required={required}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
      />
    </div>
  );
}

function FormSelect({ label, required, children, ...props }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <select
        {...props}
        required={required}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white transition-shadow"
      >
        {children}
      </select>
    </div>
  );
}

export default function SchoolDashboard() {
  const { data, addTeacher, removeTeacher, addStudent, removeStudent, addSection, assignTeacherToSection } = useSchool();

  const [activeTab, setActiveTab] = useState('overview');
  const [showTeacherForm, setShowTeacherForm] = useState(false);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [assignForm, setAssignForm]   = useState(EMPTY_ASSIGN);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // ── react-hook-form instances ────────────────────────────────────────────────
  const {
    register: regT, handleSubmit: hsT, reset: resetT,
    formState: { errors: errT, isSubmitting: savingT },
  } = useForm({ resolver: zodResolver(teacherSchema) });

  const {
    register: regS, handleSubmit: hsS, reset: resetS,
    formState: { errors: errS, isSubmitting: savingS },
  } = useForm({
    resolver: zodResolver(studentSchema),
    defaultValues: { class: 6, section: 'A' },
  });

  const {
    register: regSec, handleSubmit: hsSec, reset: resetSec,
    formState: { errors: errSec },
  } = useForm({
    resolver: zodResolver(sectionSchema),
    defaultValues: { class: 6, section: 'A' },
  });

  const handleAddTeacher = async (values) => {
    await addTeacher(values);
    resetT();
    setShowTeacherForm(false);
  };

  const handleAddStudent = async (values) => {
    await addStudent({ ...values, rollNo: String(values.rollNo), class: String(values.class) });
    resetS();
    setShowStudentForm(false);
  };

  const handleAddSection = async (values) => {
    await addSection(String(values.class), values.section);
    resetSec();
    setShowSectionForm(false);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setAssignSaving(true);
    await assignTeacherToSection(assignForm.teacherId, assignForm.class, assignForm.section, assignForm.subject);
    setAssignSuccess(true);
    setAssignSaving(false);
    setTimeout(() => setAssignSuccess(false), 3000);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'classes', label: 'Classes', icon: BookOpen },
    { id: 'teachers', label: 'Teachers', icon: Users },
    { id: 'students', label: 'Students', icon: GraduationCap },
    { id: 'assign', label: 'Assign Teacher', icon: ArrowRightLeft },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">School Admin</h1>
        <p className="text-slate-500 text-sm mt-1">Manage classes, teachers, and students</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Classes" value={CLASSES.length} color="bg-indigo-100 text-indigo-600" icon={BookOpen} />
            <StatCard label="Sections" value={data.sections.length} color="bg-purple-100 text-purple-600" icon={BookOpen} />
            <StatCard label="Teachers" value={data.teachers.length} color="bg-emerald-100 text-emerald-600" icon={Users} />
            <StatCard label="Students" value={data.students.length} color="bg-amber-100 text-amber-600" icon={GraduationCap} />
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-slate-800 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Manage Classes', tab: 'classes', color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
                { label: 'Add Teacher', tab: 'teachers', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                { label: 'Add Student', tab: 'students', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
                { label: 'Assign Teacher', tab: 'assign', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
              ].map(({ label, tab, color }) => (
                <button
                  key={label}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors ${color}`}
                >
                  {label}
                  <ChevronRight className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Class summary table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-slate-800">Class Summary</h2>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sections</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Students</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Teachers Assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {CLASSES.map(cls => {
                  const classSecs = data.sections.filter(s => s.class === cls);
                  const classStudents = data.students.filter(s => s.class === cls);
                  const assignedTeacherIds = new Set(
                    classSecs.flatMap(s => s.teachers.map(t => t.teacherId))
                  );
                  return (
                    <tr key={cls} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-800">Class {cls}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {classSecs.length > 0
                          ? classSecs.map(s => s.section).join(', ')
                          : <span className="text-slate-300 italic text-sm">None</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{classStudents.length}</td>
                      <td className="px-6 py-4 text-slate-600">{assignedTeacherIds.size}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CLASSES ──────────────────────────────────────────────── */}
      {activeTab === 'classes' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Classes &amp; Sections</h2>
              <p className="text-sm text-slate-500">Classes 6 through 10</p>
            </div>
            <button
              onClick={() => setShowSectionForm(!showSectionForm)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Section
            </button>
          </div>

          {showSectionForm && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-slate-800 mb-4">Add New Section</h3>
              <form onSubmit={hsSec(handleAddSection)} className="flex flex-wrap items-start gap-4">
                <div>
                  <FormSelect label="Class" {...regSec('class')}>
                    {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
                  </FormSelect>
                  {errSec.class && <p className="mt-1 text-xs text-red-500">{errSec.class.message}</p>}
                </div>
                <div>
                  <FormSelect label="Section" {...regSec('section')}>
                    {SECTIONS_LIST.map(s => <option key={s} value={s}>Section {s}</option>)}
                  </FormSelect>
                  {errSec.section && <p className="mt-1 text-xs text-red-500">{errSec.section.message}</p>}
                </div>
                <div className="flex gap-3 pt-5">
                  <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
                    Add Section
                  </button>
                  <button type="button" onClick={() => { setShowSectionForm(false); resetSec(); }} className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm hover:bg-slate-200">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {CLASSES.map(cls => {
              const classSections = data.sections.filter(s => s.class === cls);
              const classStudents = data.students.filter(s => s.class === cls);
              return (
                <div key={cls} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center">
                      <span className="text-lg font-bold text-white">{cls}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Class {cls}</p>
                      <p className="text-xs text-slate-400">{classStudents.length} students</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Sections</p>
                    {classSections.length > 0 ? (
                      classSections.map(sec => {
                        const sectionStudents = data.students.filter(s => s.class === cls && s.section === sec.section);
                        return (
                          <div key={sec.section} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                            <span className="text-sm font-medium text-slate-700">Section {sec.section}</span>
                            <span className="text-xs text-slate-400">{sectionStudents.length} students</span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-300 italic text-center py-3">No sections yet</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TEACHERS ─────────────────────────────────────────────── */}
      {activeTab === 'teachers' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Teachers</h2>
              <p className="text-sm text-slate-500">{data.teachers.length} registered</p>
            </div>
            <button
              onClick={() => setShowTeacherForm(!showTeacherForm)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium"
            >
              <UserPlus className="w-4 h-4" />
              Add Teacher
            </button>
          </div>

          {showTeacherForm && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-slate-800 mb-5">Add New Teacher</h3>
              <form onSubmit={hsT(handleAddTeacher)} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <FormInput label="Full Name" required type="text" placeholder="e.g. Priya Sharma" {...regT('name')} />
                  {errT.name && <p className="mt-1 text-xs text-red-500">{errT.name.message}</p>}
                </div>
                <div>
                  <FormInput label="Email Address" required type="email" placeholder="teacher@school.com" {...regT('email')} />
                  {errT.email && <p className="mt-1 text-xs text-red-500">{errT.email.message}</p>}
                </div>
                <div>
                  <FormSelect label="Subject" required {...regT('subject')}>
                    <option value="">Select Subject</option>
                    {data.subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </FormSelect>
                  {errT.subject && <p className="mt-1 text-xs text-red-500">{errT.subject.message}</p>}
                </div>
                <div className="md:col-span-3 flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={savingT}
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                  >
                    {savingT ? 'Saving…' : 'Add Teacher'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowTeacherForm(false); resetT(); }}
                    className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {data.teachers.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No teachers added yet.</p>
                <button
                  onClick={() => setShowTeacherForm(true)}
                  className="mt-3 text-sm text-indigo-600 hover:underline font-medium"
                >
                  Add the first teacher
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.teachers.map(teacher => (
                  <div key={teacher.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="font-bold text-emerald-700 text-sm">{teacher.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{teacher.name}</p>
                        <p className="text-xs text-slate-400">{teacher.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                        {teacher.subject || 'No subject'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {teacher.classes?.length || 0} {teacher.classes?.length === 1 ? 'class' : 'classes'}
                      </span>
                      <button
                        onClick={() => removeTeacher(teacher.id)}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors ml-2"
                        title="Remove teacher"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STUDENTS ─────────────────────────────────────────────── */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Students</h2>
              <p className="text-sm text-slate-500">{data.students.length} enrolled</p>
            </div>
            <button
              onClick={() => setShowStudentForm(!showStudentForm)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors text-sm font-medium"
            >
              <UserPlus className="w-4 h-4" />
              Add Student
            </button>
          </div>

          {showStudentForm && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-slate-800 mb-5">Add New Student</h3>
              <form onSubmit={hsS(handleAddStudent)} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <FormInput label="Full Name" required type="text" placeholder="e.g. Aarav Patel" {...regS('name')} />
                  {errS.name && <p className="mt-1 text-xs text-red-500">{errS.name.message}</p>}
                </div>
                <div>
                  <FormInput label="Email Address" required type="email" placeholder="student@school.com" {...regS('email')} />
                  {errS.email && <p className="mt-1 text-xs text-red-500">{errS.email.message}</p>}
                </div>
                <div>
                  <FormInput label="Roll Number" required type="number" placeholder="e.g. 101" min="1" max="9999" {...regS('rollNo')} />
                  {errS.rollNo && <p className="mt-1 text-xs text-red-500">{errS.rollNo.message}</p>}
                </div>
                <div>
                  <FormSelect label="Class" {...regS('class')}>
                    {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
                  </FormSelect>
                  {errS.class && <p className="mt-1 text-xs text-red-500">{errS.class.message}</p>}
                </div>
                <div>
                  <FormSelect label="Section" {...regS('section')}>
                    {SECTIONS_LIST.map(s => <option key={s} value={s}>Section {s}</option>)}
                  </FormSelect>
                  {errS.section && <p className="mt-1 text-xs text-red-500">{errS.section.message}</p>}
                </div>
                <div className="md:col-span-3 flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={savingS}
                    className="px-6 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-60 transition-colors"
                  >
                    {savingS ? 'Saving…' : 'Add Student'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowStudentForm(false); resetS(); }}
                    className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {data.students.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No students enrolled yet.</p>
                <button
                  onClick={() => setShowStudentForm(true)}
                  className="mt-3 text-sm text-amber-600 hover:underline font-medium"
                >
                  Enroll the first student
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Roll No.</th>
                      <th className="px-6 py-3.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Class</th>
                      <th className="px-6 py-3.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Teacher</th>
                      <th className="px-6 py-3.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.students.map(student => {
                      const teacher = data.teachers.find(t => t.id === student.assignedTeacher);
                      return (
                        <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="font-bold text-amber-700 text-xs">{student.name.charAt(0).toUpperCase()}</span>
                              </div>
                              <div>
                                <p className="font-medium text-slate-800 text-sm">{student.name}</p>
                                <p className="text-xs text-slate-400">{student.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-mono font-semibold">
                              <Hash className="w-3 h-3" />
                              {student.rollNo || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                              Class {student.class}-{student.section}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {teacher?.name || <span className="italic text-slate-300">Not assigned</span>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => removeStudent(student.id)}
                              className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove student"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ASSIGN TEACHER ───────────────────────────────────────── */}
      {activeTab === 'assign' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Assign Teacher to Class</h2>
            <p className="text-sm text-slate-500">Link a teacher to a class section for a specific subject</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-slate-700 mb-5">New Assignment</h3>
              <form onSubmit={handleAssign} className="space-y-4">
                <FormSelect
                  label="Teacher"
                  required
                  value={assignForm.teacherId}
                  onChange={e => setAssignForm({ ...assignForm, teacherId: e.target.value })}
                >
                  <option value="">Select Teacher</option>
                  {data.teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} — {t.subject}</option>
                  ))}
                </FormSelect>

                <div className="grid grid-cols-2 gap-4">
                  <FormSelect
                    label="Class"
                    value={assignForm.class}
                    onChange={e => setAssignForm({ ...assignForm, class: e.target.value })}
                  >
                    {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
                  </FormSelect>
                  <FormSelect
                    label="Section"
                    value={assignForm.section}
                    onChange={e => setAssignForm({ ...assignForm, section: e.target.value })}
                  >
                    {SECTIONS_LIST.map(s => <option key={s} value={s}>Section {s}</option>)}
                  </FormSelect>
                </div>

                <FormSelect
                  label="Subject"
                  required
                  value={assignForm.subject}
                  onChange={e => setAssignForm({ ...assignForm, subject: e.target.value })}
                >
                  <option value="">Select Subject</option>
                  {data.subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </FormSelect>

                <button
                  type="submit"
                  disabled={assignSaving}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors mt-2"
                >
                  {assignSaving ? 'Assigning…' : 'Assign Teacher'}
                </button>

                {assignSuccess && (
                  <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl text-sm">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    Teacher assigned successfully!
                  </div>
                )}
              </form>
            </div>

            {/* Current Assignments */}
            <div>
              <h3 className="font-semibold text-slate-700 mb-4">Current Assignments</h3>
              {data.sections.filter(s => s.teachers.length > 0).length === 0 ? (
                <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 text-sm">
                  No assignments yet. Use the form to assign a teacher.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.sections
                    .filter(sec => sec.teachers.length > 0)
                    .map(sec => (
                      <div key={`${sec.class}-${sec.section}`} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-purple-600" />
                          </div>
                          <span className="font-semibold text-slate-800 text-sm">Class {sec.class}-{sec.section}</span>
                        </div>
                        <div className="space-y-2">
                          {sec.teachers.map((t, i) => {
                            const teacher = data.teachers.find(tea => tea.id === t.teacherId);
                            return (
                              <div key={i} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-emerald-200 rounded-full flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-emerald-700">
                                      {(teacher?.name || 'U').charAt(0)}
                                    </span>
                                  </div>
                                  <span className="text-slate-700 font-medium">{teacher?.name || 'Unknown'}</span>
                                </div>
                                <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                  {t.subject}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
