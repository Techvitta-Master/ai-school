/**
 * Legacy admin screen: class/section CRUD moved to the school role portal (/school).
 * Admin overview still lists schools; per-school structure is managed by school login.
 */
export default function ManageSections() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-slate-600 text-sm max-w-lg mx-auto">
      <p className="mb-2 font-medium text-slate-800">Classes are managed in the School portal</p>
      <p>
        Sign in as the school account to create classes, enroll students and teachers, assign teachers to
        classes by subject, and map students to teachers per subject. Sections have been removed — one cohort
        per class label (e.g. 6–10).
      </p>
    </div>
  );
}
