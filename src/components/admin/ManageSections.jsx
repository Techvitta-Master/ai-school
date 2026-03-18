import { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { BookOpen, Plus, ArrowRightLeft, Users } from 'lucide-react';

export default function ManageSections() {
  const { data, addSection, assignTeacherToSection } = useSchool();
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSection, setNewSection] = useState({ class: '6', section: 'A' });
  const [showAssign, setShowAssign] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [assignData, setAssignData] = useState({ teacherId: '', subject: 'Social Science' });

  const handleAddSection = (e) => {
    e.preventDefault();
    addSection(newSection.class, newSection.section);
    setShowAddSection(false);
  };

  const handleAssign = () => {
    if (selectedSection && assignData.teacherId) {
      assignTeacherToSection(assignData.teacherId, selectedSection.class, selectedSection.section, assignData.subject);
      setShowAssign(false);
      setSelectedSection(null);
    }
  };

  const getSectionTeachers = (section) => {
    return section.teachers.map(t => {
      const teacher = data.teachers.find(tea => tea.id === t.teacherId);
      return { ...t, name: teacher?.name || 'Unknown' };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Classes & Sections</h2>
          <p className="text-sm text-gray-500">Manage class sections and teacher assignments</p>
        </div>
        <button
          onClick={() => setShowAddSection(!showAddSection)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Section
        </button>
      </div>

      {showAddSection && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Section</h3>
          <form onSubmit={handleAddSection} className="flex items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <select
                value={newSection.class}
                onChange={(e) => setNewSection({ ...newSection, class: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
              >
                {data.classes.map(c => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <select
                value={newSection.section}
                onChange={(e) => setNewSection({ ...newSection, section: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
              >
                {['A', 'B', 'C', 'D'].map(s => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="px-6 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700">
              Add Section
            </button>
            <button type="button" onClick={() => setShowAddSection(false)} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300">
              Cancel
            </button>
          </form>
        </div>
      )}

      {showAssign && selectedSection && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Assign Teacher to Class {selectedSection.class}-{selectedSection.section}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
              <select
                value={assignData.teacherId}
                onChange={(e) => setAssignData({ ...assignData, teacherId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select Teacher</option>
                {data.teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.subject})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <select
                value={assignData.subject}
                onChange={(e) => setAssignData({ ...assignData, subject: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
              >
                {data.subjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={handleAssign} className="px-6 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700">
              Assign Teacher
            </button>
            <button onClick={() => { setShowAssign(false); setSelectedSection(null); }} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.sections.map(section => {
          const sectionTeachers = getSectionTeachers(section);
          const studentsInSection = data.students.filter(s => s.class === section.class && s.section === section.section);
          
          return (
            <div key={`${section.class}-${section.section}`} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Class {section.class}-{section.section}</h3>
                    <p className="text-sm text-gray-500">{studentsInSection.length} Students</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Teachers</h4>
                {sectionTeachers.length > 0 ? (
                  sectionTeachers.map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-500">{t.subject}</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedSection(section);
                          setAssignData({ ...assignData, teacherId: t.teacherId, subject: t.subject });
                          setShowAssign(true);
                        }}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                        title="Change Teacher"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400 italic">No teachers assigned</p>
                )}
              </div>

              <button
                onClick={() => {
                  setSelectedSection(section);
                  setShowAssign(true);
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors"
              >
                <Users className="w-4 h-4" />
                Assign Teacher
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
