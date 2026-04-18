import { useState, useEffect, useMemo, createElement } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSchool } from '../../context/SchoolContext';
import {
  Users, BookOpen, UserPlus, ArrowRightLeft, Trash2,
  GraduationCap, LayoutDashboard, Plus, CheckCircle,
  Hash, Pencil,
} from 'lucide-react';

/** Suggested grades for "Add class" / student enroll dropdowns (does not create UI cards by itself). */
const CLASS_GRADE_OPTIONS = [6, 7, 8, 9, 10];

const EMPTY_SCHOOL_CLASSES = [];

function sortSchoolClasses(list) {
  return [...(list || [])].sort((a, b) => Number(a.class) - Number(b.class));
}

const teacherSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  subjectId: z.string().min(1),
});

const studentSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  rollNo: z.coerce.number().int().min(1).max(9999),
  class: z.coerce.number().int().min(6).max(10),
});

const classSchema = z.object({
  class: z.coerce.number().int().min(1).max(12),
});

const subjectSchema = z.object({
  name: z.string().min(2).max(60),
});

const EMPTY_ASSIGN = { teacherId: '', class: '', subject: '' };

function StatCard({ label, value, color, icon }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
        {createElement(icon, { className: 'w-6 h-6' })}
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

function SchoolOverview() {
  const { data } = useSchool();
  const schoolClasses = data.schoolClasses ?? EMPTY_SCHOOL_CLASSES;
  const classesWithTeacher = schoolClasses.filter((c) => (c.teachers?.length ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Overview of your school</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Classes" value={schoolClasses.length} color="bg-indigo-100 text-indigo-600" icon={BookOpen} />
        <StatCard label="Teachers" value={data.teachers.length} color="bg-emerald-100 text-emerald-600" icon={Users} />
        <StatCard label="Students" value={data.students.length} color="bg-amber-100 text-amber-600" icon={GraduationCap} />
        <StatCard
          label="Classes with teachers"
          value={classesWithTeacher}
          color="bg-purple-100 text-purple-600"
          icon={Users}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-slate-800">Class summary</h2>
          <p className="text-xs text-slate-500 mt-1">One cohort per class (no sections)</p>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Class</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Students</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Teacher slots (subjects)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortSchoolClasses(schoolClasses).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-slate-500 text-sm">
                  No classes yet. Add classes under <span className="font-medium text-slate-700">Classes</span> in the sidebar.
                </td>
              </tr>
            ) : (
              sortSchoolClasses(schoolClasses).map((row) => {
                const count = data.students.filter((s) => s.class === row.class).length;
                const slots = row?.teachers?.length ?? 0;
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">Class {row.class}</td>
                    <td className="px-6 py-4 text-slate-600">{count}</td>
                    <td className="px-6 py-4 text-slate-600">{slots}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SchoolClassesPage() {
  const { data, addClass } = useSchool();
  const schoolClasses = data.schoolClasses ?? EMPTY_SCHOOL_CLASSES;
  const [showForm, setShowForm] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(classSchema), defaultValues: { class: 6 } });

  const onSubmit = async (values) => {
    const r = await addClass(String(values.class));
    if (!r?.error) {
      reset();
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Classes</h1>
          <p className="text-slate-500 text-sm mt-1">Only classes you add here exist in the database. Enrolling a student can also create a class row.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add class
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-slate-800 mb-4">Add class</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-4">
            <div>
              <FormSelect label="Class" {...register('class')}>
                {CLASS_GRADE_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </FormSelect>
              {errors.class && <p className="mt-1 text-xs text-red-500">{errors.class.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium">
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); reset(); }} className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm">
              Cancel
            </button>
          </form>
        </div>
      )}

      {sortSchoolClasses(schoolClasses).length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-500 text-sm">
          <p className="font-medium text-slate-700 mb-1">No classes yet</p>
          <p>Use <span className="text-indigo-600">Add class</span> above, or enroll a student (a class row is created automatically).</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortSchoolClasses(schoolClasses).map((row) => {
            const n = data.students.filter((s) => s.class === row.class).length;
            const linkedRows = (row.teachers || []).map((t) => {
              const teacher = data.teachers.find((x) => x.id === t.teacherId);
              return {
                subject: t.subject || teacher?.subject || 'General',
                teacherName: teacher?.name || 'Unassigned',
              };
            });
            return (
              <div key={row.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{row.class}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Class {row.class}</p>
                    <p className="text-xs text-slate-400">{n} students</p>
                  </div>
                </div>
                {linkedRows.length === 0 ? (
                  <p className="text-xs text-slate-500">No subject-teacher links yet.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Linked subjects and teachers:</p>
                    {linkedRows.map((link, idx) => (
                      <div
                        key={`${row.id}-${idx}-${link.subject}`}
                        className="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5"
                      >
                        <span className="font-medium text-slate-700">{link.subject}</span>
                        <span className="text-slate-500">{link.teacherName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SchoolTeachersPage() {
  const { data, addTeacher, removeTeacher } = useSchool();
  const [showForm, setShowForm] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting: savingT },
  } = useForm({ resolver: zodResolver(teacherSchema) });

  const onSubmit = async (values) => {
    const r = await addTeacher(values);
    if (!r?.error) {
      reset();
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Teachers</h1>
          <p className="text-sm text-slate-500">{data.teachers.length} registered</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium"
        >
          <UserPlus className="w-4 h-4" />
          Add teacher
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-slate-800 mb-5">New teacher</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <FormInput label="Full name" required type="text" {...register('name')} />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div>
              <FormInput label="Email" required type="email" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div>
              <FormSelect label="Primary subject" required {...register('subjectId')}>
                <option value="">Select subject</option>
                {(data.subjectRows || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </FormSelect>
              {errors.subjectId && <p className="mt-1 text-xs text-red-500">{errors.subjectId.message}</p>}
            </div>
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" disabled={savingT} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-60">
                {savingT ? 'Saving…' : 'Add teacher'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); reset(); }} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-slate-100">
        {data.teachers.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">No teachers yet.</div>
        ) : (
          data.teachers.map((teacher) => (
            <div key={teacher.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-sm font-bold text-emerald-700">
                  {teacher.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-slate-800">{teacher.name}</p>
                  <p className="text-xs text-slate-400">{teacher.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">{teacher.subject || '—'}</span>
                <span className="text-xs text-slate-400">{teacher.classes?.length ?? 0} class links</span>
                <button type="button" onClick={() => removeTeacher(teacher.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg" title="Remove">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SchoolSubjectsPage() {
  const { data, addSubject } = useSchool();
  const [showForm, setShowForm] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(subjectSchema) });

  const onSubmit = async (values) => {
    const r = await addSubject(values.name);
    if (!r?.error) {
      reset();
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Subjects</h1>
          <p className="text-sm text-slate-500">{data.subjects.length} subjects</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add subject
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-slate-800 mb-4">New subject</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-4">
            <div className="min-w-[240px]">
              <FormInput label="Subject name" required type="text" {...register('name')} />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium">
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); reset(); }} className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm">
              Cancel
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {data.subjects.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">No subjects yet.</div>
        ) : (
          <div className="p-5 flex flex-wrap gap-2">
            {data.subjects.map((subject) => (
              <span key={subject} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                {subject}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SchoolStudentsPage() {
  const { data, addStudent, updateStudent, removeStudent } = useSchool();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);

  const addForm = useForm({ resolver: zodResolver(studentSchema), defaultValues: { class: 10 } });
  const editForm = useForm({ resolver: zodResolver(studentSchema) });

  useEffect(() => {
    if (!editId) return;
    const s = data.students.find((x) => x.id === editId);
    if (!s) return;
    editForm.reset({
      name: s.name,
      email: s.email,
      rollNo: s.rollNo || 1,
      class: s.class,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when row/list changes; editForm identity is unstable
  }, [editId, data.students, editForm.reset]);

  const onAddSubmit = async (values) => {
    const r = await addStudent({ ...values, rollNo: String(values.rollNo), class: String(values.class) });
    if (!r?.error) {
      addForm.reset({ class: 10 });
      setShowForm(false);
    }
  };

  const onEditSubmit = async (values) => {
    if (!editId) return;
    const r = await updateStudent(editId, { ...values, rollNo: String(values.rollNo), class: String(values.class) });
    if (!r?.error) {
      setEditId(null);
      editForm.reset();
    }
  };

  const {
    formState: { errors: addErrors, isSubmitting: savingAdd },
  } = addForm;
  const {
    formState: { errors: editErrors, isSubmitting: savingEdit },
  } = editForm;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Students</h1>
          <p className="text-sm text-slate-500">{data.students.length} enrolled</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm(!showForm);
            setEditId(null);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 text-sm font-medium"
        >
          <UserPlus className="w-4 h-4" />
          Add student
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-slate-800 mb-5">New student</h3>
          <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <FormInput label="Full name" required type="text" {...addForm.register('name')} />
              {addErrors.name && <p className="mt-1 text-xs text-red-500">{addErrors.name.message}</p>}
            </div>
            <div>
              <FormInput label="Email" required type="email" {...addForm.register('email')} />
              {addErrors.email && <p className="mt-1 text-xs text-red-500">{addErrors.email.message}</p>}
            </div>
            <div>
              <FormInput label="Roll number" required type="number" min={1} {...addForm.register('rollNo')} />
              {addErrors.rollNo && <p className="mt-1 text-xs text-red-500">{addErrors.rollNo.message}</p>}
            </div>
            <div>
              <FormSelect label="Class" {...addForm.register('class')}>
                {CLASS_GRADE_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </FormSelect>
              {addErrors.class && <p className="mt-1 text-xs text-red-500">{addErrors.class.message}</p>}
            </div>
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" disabled={savingAdd} className="px-6 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium disabled:opacity-60">
                {savingAdd ? 'Saving…' : 'Add student'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); addForm.reset({ class: 10 }); }} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {editId && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-indigo-100 ring-1 ring-indigo-100">
          <h3 className="font-semibold text-slate-800 mb-5">Edit student</h3>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <FormInput label="Full name" required type="text" {...editForm.register('name')} />
              {editErrors.name && <p className="mt-1 text-xs text-red-500">{editErrors.name.message}</p>}
            </div>
            <div>
              <FormInput label="Email" required type="email" {...editForm.register('email')} />
              {editErrors.email && <p className="mt-1 text-xs text-red-500">{editErrors.email.message}</p>}
            </div>
            <div>
              <FormInput label="Roll number" required type="number" min={1} {...editForm.register('rollNo')} />
              {editErrors.rollNo && <p className="mt-1 text-xs text-red-500">{editErrors.rollNo.message}</p>}
            </div>
            <div>
              <FormSelect label="Class" {...editForm.register('class')}>
                {CLASS_GRADE_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </FormSelect>
              {editErrors.class && <p className="mt-1 text-xs text-red-500">{editErrors.class.message}</p>}
            </div>
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" disabled={savingEdit} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-60">
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  editForm.reset();
                }}
                className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {data.students.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">No students yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-slate-500 uppercase">Student</th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-slate-500 uppercase">Roll</th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-slate-500 uppercase">Class</th>
                  <th className="px-6 py-3.5 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-800 text-sm">{student.name}</p>
                      <p className="text-xs text-slate-400">{student.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-mono font-semibold">
                        <Hash className="w-3 h-3" />
                        {student.rollNo || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">Class {student.class}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => {
                            setEditId(student.id);
                            setShowForm(false);
                          }}
                          className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Remove"
                          onClick={() => removeStudent(student.id)}
                          className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SchoolAssignTeachersPage() {
  const { data, assignTeacherToClass } = useSchool();
  const schoolClasses = data.schoolClasses ?? EMPTY_SCHOOL_CLASSES;
  const sortedClasses = useMemo(() => sortSchoolClasses(schoolClasses), [schoolClasses]);
  const [assignForm, setAssignForm] = useState(EMPTY_ASSIGN);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);

  const firstClass = sortedClasses.length ? String(sortedClasses[0].class) : '';
  const resolvedClass = useMemo(() => {
    const valid = sortedClasses.some((c) => String(c.class) === assignForm.class);
    if (valid && assignForm.class) return assignForm.class;
    return firstClass;
  }, [sortedClasses, assignForm.class, firstClass]);

  const handleAssign = async (e) => {
    e.preventDefault();
    setAssignSaving(true);
    const r = await assignTeacherToClass(assignForm.teacherId, resolvedClass, assignForm.subject);
    setAssignSuccess(!r?.error);
    setAssignSaving(false);
    if (!r?.error) {
      setTimeout(() => setAssignSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Assign teachers to classes</h1>
        <p className="text-sm text-slate-500">Each class can have different teachers per subject.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-slate-700 mb-5">New assignment</h3>
          <form onSubmit={handleAssign} className="space-y-4">
            <FormSelect
              label="Teacher"
              required
              value={assignForm.teacherId}
              onChange={(e) => setAssignForm({ ...assignForm, teacherId: e.target.value })}
            >
              <option value="">Select teacher</option>
              {data.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.subject}
                </option>
              ))}
            </FormSelect>
            <FormSelect
              label="Class"
              required
              value={resolvedClass}
              onChange={(e) => setAssignForm({ ...assignForm, class: e.target.value })}
              disabled={schoolClasses.length === 0}
            >
              {schoolClasses.length === 0 ? (
                <option value="">Add a class first (Classes page)</option>
              ) : (
                sortedClasses.map((c) => (
                  <option key={c.id} value={String(c.class)}>
                    Class {c.class}
                  </option>
                ))
              )}
            </FormSelect>
            <FormSelect label="Subject" required value={assignForm.subject} onChange={(e) => setAssignForm({ ...assignForm, subject: e.target.value })}>
              <option value="">Select subject</option>
              {data.subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </FormSelect>
            <button
              type="submit"
              disabled={assignSaving || schoolClasses.length === 0 || !resolvedClass}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-60"
            >
              {assignSaving ? 'Saving…' : 'Assign teacher'}
            </button>
            {assignSuccess && (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                Saved.
              </div>
            )}
          </form>
        </div>

        <div>
          <h3 className="font-semibold text-slate-700 mb-4">Current assignments</h3>
          {schoolClasses.filter((c) => c.teachers?.length).length === 0 ? (
            <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 text-sm">No assignments yet.</div>
          ) : (
            <div className="space-y-3">
              {schoolClasses
                .filter((c) => c.teachers?.length)
                .map((c) => (
                  <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-4 h-4 text-purple-600" />
                      <span className="font-semibold text-slate-800 text-sm">Class {c.class}</span>
                    </div>
                    <div className="space-y-2">
                      {c.teachers.map((t, i) => {
                        const teacher = data.teachers.find((x) => x.id === t.teacherId);
                        return (
                          <div key={i} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                            <span className="text-slate-700 font-medium">{teacher?.name ?? 'Unknown'}</span>
                            <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">{t.subject}</span>
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
  );
}

function SchoolStudentSubjectsPage() {
  const { data, assignStudentToTeacherBySubject } = useSchool();
  const [studentMapForm, setStudentMapForm] = useState({ studentId: '', teacherId: '', subject: '' });
  const [studentMapSaving, setStudentMapSaving] = useState(false);
  const [studentMapSuccess, setStudentMapSuccess] = useState(false);

  const handleSubjectMapAssign = async (e) => {
    e.preventDefault();
    if (!studentMapForm.studentId || !studentMapForm.teacherId || !studentMapForm.subject) return;
    setStudentMapSaving(true);
    const result = await assignStudentToTeacherBySubject(studentMapForm.studentId, studentMapForm.teacherId, studentMapForm.subject);
    setStudentMapSaving(false);
    if (!result?.error) {
      setStudentMapSuccess(true);
      setTimeout(() => setStudentMapSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Student ↔ teacher (by subject)</h1>
        <p className="text-sm text-slate-500">Map each student to a teacher for a given subject.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-slate-700 mb-5">New mapping</h3>
          <form onSubmit={handleSubjectMapAssign} className="space-y-4">
            <FormSelect
              label="Student"
              required
              value={studentMapForm.studentId}
              onChange={(e) => setStudentMapForm({ ...studentMapForm, studentId: e.target.value })}
            >
              <option value="">Select student</option>
              {data.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — Class {s.class} (roll {s.rollNo ?? '—'})
                </option>
              ))}
            </FormSelect>
            <FormSelect
              label="Subject"
              required
              value={studentMapForm.subject}
              onChange={(e) => setStudentMapForm({ ...studentMapForm, subject: e.target.value })}
            >
              <option value="">Select subject</option>
              {data.subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </FormSelect>
            <FormSelect
              label="Teacher"
              required
              value={studentMapForm.teacherId}
              onChange={(e) => setStudentMapForm({ ...studentMapForm, teacherId: e.target.value })}
            >
              <option value="">Select teacher</option>
              {data.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.subject || 'General'}
                </option>
              ))}
            </FormSelect>
            <button type="submit" disabled={studentMapSaving} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-60">
              {studentMapSaving ? 'Saving…' : 'Save mapping'}
            </button>
            {studentMapSuccess && (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                Saved.
              </div>
            )}
          </form>
        </div>

        <div>
          <h3 className="font-semibold text-slate-700 mb-4">Existing mappings</h3>
          {!data.studentSubjectAssignments?.length ? (
            <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 text-sm">No mappings yet.</div>
          ) : (
            <div className="space-y-3">
              {data.studentSubjectAssignments.map((m) => {
                const st = data.students.find((s) => s.id === m.student_id);
                const tc = data.teachers.find((t) => t.id === m.teacher_id);
                return (
                  <div key={m.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-sm">
                    <div className="font-semibold text-slate-800">{st?.name ?? 'Student'}</div>
                    <div className="text-slate-500 mt-1">
                      Subject: <span className="font-medium text-slate-700">{m.subject}</span>
                    </div>
                    <div className="text-slate-500">
                      Teacher: <span className="font-medium text-slate-700">{tc?.name ?? '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SchoolDashboard() {
  return (
    <Routes>
      <Route index element={<SchoolOverview />} />
      <Route path="classes" element={<SchoolClassesPage />} />
      <Route path="subjects" element={<SchoolSubjectsPage />} />
      <Route path="teachers" element={<SchoolTeachersPage />} />
      <Route path="students" element={<SchoolStudentsPage />} />
      <Route path="assign-teachers" element={<SchoolAssignTeachersPage />} />
      <Route path="student-subjects" element={<SchoolStudentSubjectsPage />} />
      <Route path="*" element={<Navigate to="/school" replace />} />
    </Routes>
  );
}
