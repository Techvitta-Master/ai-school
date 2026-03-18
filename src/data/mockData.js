import syllabusData from './data-ch.json';

const generateId = () => Math.random().toString(36).substr(2, 9);

const generateScores = (student, tests, count = 15) => {
  const selectedTests = tests.slice(0, count);
  return selectedTests.map(test => ({
    id: generateId(),
    testId: test.id,
    date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    score: Math.floor(Math.random() * 55) + 40,
    topicScores: test.topics.slice(0, 5).reduce((acc, topic) => {
      acc[topic] = Math.floor(Math.random() * 55) + 40;
      return acc;
    }, {})
  }));
};

const themes = syllabusData.themes;
const chapters = themes.flatMap(t => t.chapters);

const generateTest = (chapter, theme, index) => ({
  id: `test-${chapter.chapter_number}-${index}-${generateId()}`,
  title: `${chapter.title} - ${theme.domain.split(' ')[0]}`,
  chapter: chapter.chapter_number,
  theme: theme.theme,
  domain: theme.domain,
  topics: chapter.topics,
  duration: 30 + Math.floor(Math.random() * 45),
  totalMarks: 100,
  type: index === 0 ? 'Chapter Test' : 'Weekly Test',
  createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString()
});

const tests = chapters.flatMap(chapter => {
  const theme = themes.find(t => t.chapters.some(c => c.chapter_number === chapter.chapter_number));
  return [
    generateTest(chapter, theme, 0),
    generateTest(chapter, theme, 1)
  ];
});

const teachers = [
  { id: 't1', name: 'Priya Sharma', email: 'priya@school.com', password: 'teacher123', phone: '9876543210', subject: 'Social Science', experience: 8, education: 'M.A. History', joinDate: '2016-07-15' },
  { id: 't2', name: 'Rajesh Kumar', email: 'rajesh@school.com', password: 'teacher123', phone: '9876543211', subject: 'Mathematics', experience: 12, education: 'M.Sc. Mathematics', joinDate: '2012-06-01' },
  { id: 't3', name: 'Anita Desai', email: 'anita@school.com', password: 'teacher123', phone: '9876543212', subject: 'English', experience: 6, education: 'M.A. English', joinDate: '2018-08-20' },
  { id: 't4', name: 'Vikram Singh', email: 'vikram@school.com', password: 'teacher123', phone: '9876543213', subject: 'Science', experience: 10, education: 'M.Sc. Physics', joinDate: '2014-05-10' },
  { id: 't5', name: 'Meera Gupta', email: 'meera@school.com', password: 'teacher123', phone: '9876543214', subject: 'Hindi', experience: 5, education: 'M.A. Hindi', joinDate: '2019-07-01' },
  { id: 't6', name: 'Sanjay Verma', email: 'sanjay@school.com', password: 'teacher123', phone: '9876543215', subject: 'Sanskrit', experience: 15, education: 'M.A. Sanskrit', joinDate: '2009-04-15' },
  { id: 't7', name: 'Kavita Nair', email: 'kavita@school.com', password: 'teacher123', phone: '9876543216', subject: 'Computer Science', experience: 4, education: 'M.Tech Computer Science', joinDate: '2020-06-01' },
  { id: 't8', name: 'Arun Patel', email: 'arun@school.com', password: 'teacher123', phone: '9876543217', subject: 'Mathematics', experience: 7, education: 'M.Sc. Mathematics', joinDate: '2017-07-12' },
  { id: 't9', name: 'Sunita Rao', email: 'sunita@school.com', password: 'teacher123', phone: '9876543218', subject: 'Science', experience: 9, education: 'M.Sc. Chemistry', joinDate: '2015-08-25' },
  { id: 't10', name: 'Deepak Joshi', email: 'deepak@school.com', password: 'teacher123', phone: '9876543219', subject: 'Physical Education', experience: 11, education: 'M.P.Ed.', joinDate: '2013-04-01' },
  { id: 't11', name: 'Neha Kapoor', email: 'neha@school.com', password: 'teacher123', phone: '9876543220', subject: 'Art & Craft', experience: 6, education: 'M.F.A.', joinDate: '2018-07-10' },
  { id: 't12', name: 'Rahul Mishra', email: 'rahul@school.com', password: 'teacher123', phone: '9876543221', subject: 'Music', experience: 8, education: 'M.A. Music', joinDate: '2016-06-15' },
  { id: 't13', name: 'Pooja Bansal', email: 'pooja@school.com', password: 'teacher123', phone: '9876543222', subject: 'Mathematics', experience: 4, education: 'M.Sc. Mathematics', joinDate: '2020-08-01' },
  { id: 't14', name: 'Amit Tiwari', email: 'amit@school.com', password: 'teacher123', phone: '9876543223', subject: 'Social Science', experience: 7, education: 'M.A. Geography', joinDate: '2017-05-20' },
  { id: 't15', name: 'Swati Yadav', email: 'swati@school.com', password: 'teacher123', phone: '9876543224', subject: 'English', experience: 5, education: 'M.A. English Literature', joinDate: '2019-07-15' },
  { id: 't16', name: 'Vijay Singh', email: 'vijay@school.com', password: 'teacher123', phone: '9876543225', subject: 'Science', experience: 12, education: 'M.Sc. Biology', joinDate: '2012-06-10' },
  { id: 't17', name: 'Anjali Verma', email: 'anjali@school.com', password: 'teacher123', phone: '9876543226', subject: 'Hindi', experience: 3, education: 'M.A. Hindi', joinDate: '2021-07-01' },
  { id: 't18', name: 'Krishna Rao', email: 'krishna@school.com', password: 'teacher123', phone: '9876543227', subject: 'Computer Science', experience: 6, education: 'MCA', joinDate: '2018-06-20' },
  { id: 't19', name: 'Ritu Agarwal', email: 'ritu@school.com', password: 'teacher123', phone: '9876543228', subject: 'Sanskrit', experience: 9, education: 'M.A. Sanskrit', joinDate: '2015-05-15' },
  { id: 't20', name: 'Suresh Patel', email: 'suresh@school.com', password: 'teacher123', phone: '9876543229', subject: 'Physical Education', experience: 14, education: 'M.P.Ed., Ph.D.', joinDate: '2010-04-01' },
  { id: 't21', name: 'Manish Gupta', email: 'manish@school.com', password: 'teacher123', phone: '9876543230', subject: 'Mathematics', experience: 6, education: 'M.Sc. Mathematics', joinDate: '2018-07-01' },
  { id: 't22', name: 'Kavita Singh', email: 'kavita.singh@school.com', password: 'teacher123', phone: '9876543231', subject: 'Science', experience: 8, education: 'M.Sc. Physics', joinDate: '2016-08-15' },
  { id: 't23', name: 'Pradeep Kumar', email: 'pradeep@school.com', password: 'teacher123', phone: '9876543232', subject: 'English', experience: 5, education: 'M.A. English', joinDate: '2019-06-01' },
  { id: 't24', name: 'Sneha Agarwal', email: 'sneha@school.com', password: 'teacher123', phone: '9876543233', subject: 'Social Science', experience: 4, education: 'M.A. History', joinDate: '2020-07-10' },
  { id: 't25', name: 'Ankit Sharma', email: 'ankit@school.com', password: 'teacher123', phone: '9876543234', subject: 'Computer Science', experience: 5, education: 'MCA', joinDate: '2019-05-20' },
  { id: 't26', name: 'Vandana Reddy', email: 'vandana@school.com', password: 'teacher123', phone: '9876543235', subject: 'Mathematics', experience: 10, education: 'M.Sc. Mathematics', joinDate: '2014-05-15' },
  { id: 't27', name: 'Rakesh Malhotra', email: 'rakesh@school.com', password: 'teacher123', phone: '9876543236', subject: 'Science', experience: 7, education: 'M.Sc. Chemistry', joinDate: '2017-07-01' },
  { id: 't28', name: 'Preeti Iyer', email: 'preeti@school.com', password: 'teacher123', phone: '9876543237', subject: 'English', experience: 6, education: 'M.A. English', joinDate: '2018-08-20' },
  { id: 't29', name: 'Gaurav Dixit', email: 'gaurav@school.com', password: 'teacher123', phone: '9876543238', subject: 'Physical Education', experience: 8, education: 'M.P.Ed.', joinDate: '2016-04-01' },
  { id: 't30', name: 'Nidhi Shah', email: 'nidhi@school.com', password: 'teacher123', phone: '9876543239', subject: 'Art & Craft', experience: 5, education: 'M.F.A.', joinDate: '2019-06-15' }
];

const studentNames = [
  'Aarav Patel', 'Diya Singh', 'Arjun Nair', 'Saanvi Gupta', 'Rohan Iyer', 'Ishita Reddy', 'Kabir Malhotra', 'Nia Chatterjee', 'Shaurya Rao', 'Tiya Sharma',
  'Riya Desai', 'Vivaan Shah', 'Karan Mehta', 'Ananya Pillai', 'Myra Joshi', 'Manav Shah', 'Aadhya Iyer', 'Hridaan Mishra', 'Prisha Bose', 'Vihaan Patel',
  'Aditya Verma', 'Sia Kapoor', 'Reyansh Das', 'Navya Gupta', 'Kavya Krishnan', 'Dev Sharma', 'Ayaan Khan', 'Sneha Reddy', 'Ritvik Singh', 'Ishika Verma',
  'Parth Iyer', 'Anvi Patel', 'Lakshay Joshi', 'Myra Agarwal', 'Harsh Pandey', 'Tanisha Gupta', 'Advait Sharma', 'Keya Das', 'Rian Mehta', 'Aisha Patel',
  'Vedant Gupta', 'Myra Singh', 'Aarav Shah', 'Saanvi Joshi', 'Rudra Nair', 'Ira Pillai', 'Atharva Iyer', 'Anika Sharma', 'Vihaan Reddy', 'Shanaya Kapila',
  'Kabir Singh', 'Anvi Shah', 'Dhruv Mehta', 'Prisha Joshi', 'Arnav Patel', 'Myra Das', 'Shiven Nair', 'Sneha Gupta', 'Ritvik Sharma', 'Ishika Patel',
  'Ritika Singh', 'Aditya Raj', 'Mannat Kaur', 'Kartik Verma', 'Ishani Gupta', 'Ayan Ali', 'Aadhira Khan', 'Vivaan Reddy', 'Myra Shah', 'Kabir Iyer',
  'Anaya Nair', 'Rian Sharma', 'Aarohi Joshi', 'Vihaan Kapoor', 'Sia Malhotra', 'Arnav Das', 'Myra Rao', 'Aarav Gupta', 'Diya Patel', 'Arjun Mehta',
  'Saanvi Verma', 'Rohan Shah', 'Ishita Nair', 'Kabir Patel', 'Ananya Gupta', 'Vivaan Iyer', 'Tiya Sharma', 'Shaurya Malhotra', 'Riya Nair', 'Karan Reddy',
  'Prisha Kapoor', 'Arjun Das', 'Myra Joshi', 'Vihaan Mehta', 'Aadhya Shah', 'Sneha Iyer', 'Ritvik Patel', 'Ishika Gupta', 'Anvi Sharma', 'Lakshay Singh',
  'Aarav Kumar', 'Diya Patel', 'Arjun Verma', 'Saanvi Iyer', 'Rohan Sharma', 'Ishita Shah', 'Kabir Mehta', 'Nia Gupta', 'Shaurya Patel', 'Tiya Iyer',
  'Riya Malhotra', 'Vivaan Singh', 'Karan Nair', 'Ananya Das', 'Myra Patel', 'Manav Sharma', 'Aadhya Iyer', 'Hridaan Shah', 'Prisha Mehta', 'Vihaan Gupta',
  'Aditya Patel', 'Sia Kapoor', 'Reyansh Iyer', 'Navya Sharma', 'Kavya Shah', 'Dev Patel', 'Ayaan Gupta', 'Sneha Malhotra', 'Ritvik Reddy', 'Ishika Singh',
  'Parth Nair', 'Anvi Das', 'Lakshay Patel', 'Myra Shah', 'Harsh Gupta', 'Tanisha Iyer', 'Advait Mehta', 'Keya Patel', 'Rian Sharma', 'Aisha Kumar',
  'Vedant Singh', 'Myra Patel', 'Aarav Das', 'Saanvi Gupta', 'Rudra Shah', 'Ira Patel', 'Atharva Sharma', 'Anika Iyer', 'Vihaan Patel', 'Shanaya Gupta',
  'Kabir Das', 'Anvi Patel', 'Dhruv Sharma', 'Prisha Iyer', 'Arnav Shah', 'Myra Patel', 'Shiven Mehta', 'Sneha Patel', 'Ritvik Gupta', 'Ishika Sharma',
  'Ritika Patel', 'Aditya Shah', 'Mannat Patel', 'Kartik Sharma', 'Ishani Patel', 'Ayan Mehta', 'Aadhira Patel', 'Vivaan Sharma', 'Myra Patel', 'Kabir Das',
  'Anaya Sharma', 'Rian Patel', 'Aarohi Sharma', 'Vihaan Patel', 'Sia Sharma', 'Arnav Patel', 'Myra Sharma', 'Aarav Patel', 'Diya Sharma', 'Arjun Patel'
];

const parentNames = [
  'Rajesh Patel', 'Priya Singh', 'Vikram Nair', 'Anita Gupta', 'Sanjay Iyer', 'Meera Reddy', 'Rahul Malhotra', 'Sunita Chatterjee', 'Amit Rao', 'Neha Sharma',
  'Deepak Desai', 'Kavita Shah', 'Arun Mehta', 'Pooja Pillai', 'Vijay Joshi', 'Swati Verma', 'Krishna Iyer', 'Suresh Patel', 'Anjali Gupta', 'Ritu Khan',
  'Manish Sharma', 'Kavita Singh', 'Pradeep Kumar', 'Sneha Agarwal', 'Ankit Sharma', 'Vandana Reddy', 'Rakesh Malhotra', 'Preeti Iyer', 'Gaurav Dixit', 'Nidhi Shah'
];

const cities = ['New Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Ahmedabad'];
const localities = ['MG Road', 'Civil Lines', 'Model Town', 'Rajendra Nagar', 'Connaught Place', 'Jubilee Hills', 'Bandra West', 'Salt Lake'];

const students = [];

for (let i = 0; i < 200; i++) {
  const classNum = 6 + Math.floor(i / 60);
  const sections = ['A', 'B', 'C', 'D'];
  const section = sections[i % 4];
  const teacherAssignment = teachers[i % teachers.length].id;
  const city = cities[i % cities.length];
  const locality = localities[i % localities.length];
  
  students.push({
    id: `s${i + 1}`,
    name: studentNames[i] || `Student ${i + 1}`,
    email: `${studentNames[i]?.toLowerCase().replace(/ /g, '.') || `student${i + 1}`}@student.com`,
    password: 'student123',
    class: classNum,
    section: section,
    rollNo: (i % 60) + 1,
    assignedTeacher: teacherAssignment,
    parentName: parentNames[i % parentNames.length],
    parentPhone: `98765${43000 + i}`,
    address: `${i + 1}, ${locality}, ${city}`,
    scores: [],
    attendance: Math.floor(Math.random() * 15) + 85
  });
}

const classTests = {
  6: tests.filter(t => t.domain === 'Geography' || t.domain === 'History'),
  7: tests.filter(t => t.domain === 'History and Culture' || t.domain === 'Economics'),
  8: tests.filter(t => t.domain === 'Civics / Political Science' || t.domain === 'Economics')
};

students.forEach((s) => {
  const testSet = classTests[s.class] || tests;
  const scoreCount = 12 + Math.floor(Math.random() * 8);
  s.scores = generateScores(s, testSet, scoreCount);
});

const sections = [
  { class: 6, section: 'A', strength: 50, classTeacher: 't1', teachers: [{ teacherId: 't1', subject: 'Social Science' }, { teacherId: 't2', subject: 'Mathematics' }, { teacherId: 't3', subject: 'English' }, { teacherId: 't5', subject: 'Hindi' }, { teacherId: 't6', subject: 'Sanskrit' }, { teacherId: 't7', subject: 'Computer Science' }, { teacherId: 't10', subject: 'PE' }, { teacherId: 't11', subject: 'Art' }] },
  { class: 6, section: 'B', strength: 50, classTeacher: 't4', teachers: [{ teacherId: 't1', subject: 'Social Science' }, { teacherId: 't3', subject: 'English' }, { teacherId: 't4', subject: 'Science' }, { teacherId: 't5', subject: 'Hindi' }, { teacherId: 't7', subject: 'Computer Science' }, { teacherId: 't10', subject: 'PE' }, { teacherId: 't11', subject: 'Art' }] },
  { class: 6, section: 'C', strength: 50, classTeacher: 't2', teachers: [{ teacherId: 't2', subject: 'Mathematics' }, { teacherId: 't3', subject: 'English' }, { teacherId: 't4', subject: 'Science' }, { teacherId: 't17', subject: 'Hindi' }, { teacherId: 't6', subject: 'Sanskrit' }, { teacherId: 't7', subject: 'Computer Science' }, { teacherId: 't10', subject: 'PE' }] },
  { class: 6, section: 'D', strength: 50, classTeacher: 't14', teachers: [{ teacherId: 't14', subject: 'Social Science' }, { teacherId: 't4', subject: 'Science' }, { teacherId: 't5', subject: 'Hindi' }, { teacherId: 't3', subject: 'English' }, { teacherId: 't2', subject: 'Mathematics' }, { teacherId: 't10', subject: 'PE' }, { teacherId: 't11', subject: 'Art' }] },
  { class: 7, section: 'A', strength: 50, classTeacher: 't1', teachers: [{ teacherId: 't1', subject: 'Social Science' }, { teacherId: 't8', subject: 'Mathematics' }, { teacherId: 't3', subject: 'English' }, { teacherId: 't4', subject: 'Science' }, { teacherId: 't5', subject: 'Hindi' }, { teacherId: 't6', subject: 'Sanskrit' }, { teacherId: 't10', subject: 'PE' }, { teacherId: 't11', subject: 'Art' }] },
  { class: 7, section: 'B', strength: 50, classTeacher: 't9', teachers: [{ teacherId: 't14', subject: 'Social Science' }, { teacherId: 't2', subject: 'Mathematics' }, { teacherId: 't15', subject: 'English' }, { teacherId: 't9', subject: 'Science' }, { teacherId: 't5', subject: 'Hindi' }, { teacherId: 't19', subject: 'Sanskrit' }, { teacherId: 't10', subject: 'PE' }, { teacherId: 't12', subject: 'Music' }] },
  { class: 7, section: 'C', strength: 50, classTeacher: 't8', teachers: [{ teacherId: 't1', subject: 'Social Science' }, { teacherId: 't13', subject: 'Mathematics' }, { teacherId: 't3', subject: 'English' }, { teacherId: 't16', subject: 'Science' }, { teacherId: 't17', subject: 'Hindi' }, { teacherId: 't6', subject: 'Sanskrit' }, { teacherId: 't7', subject: 'Computer Science' }, { teacherId: 't10', subject: 'PE' }] },
  { class: 7, section: 'D', strength: 50, classTeacher: 't15', teachers: [{ teacherId: 't14', subject: 'Social Science' }, { teacherId: 't8', subject: 'Mathematics' }, { teacherId: 't15', subject: 'English' }, { teacherId: 't9', subject: 'Science' }, { teacherId: 't5', subject: 'Hindi' }, { teacherId: 't19', subject: 'Sanskrit' }, { teacherId: 't10', subject: 'PE' }, { teacherId: 't12', subject: 'Music' }] },
  { class: 8, section: 'A', strength: 50, classTeacher: 't1', teachers: [{ teacherId: 't1', subject: 'Social Science' }, { teacherId: 't8', subject: 'Mathematics' }, { teacherId: 't15', subject: 'English' }, { teacherId: 't16', subject: 'Science' }, { teacherId: 't5', subject: 'Hindi' }, { teacherId: 't6', subject: 'Sanskrit' }, { teacherId: 't18', subject: 'Computer Science' }, { teacherId: 't10', subject: 'PE' }, { teacherId: 't11', subject: 'Art' }] },
  { class: 8, section: 'B', strength: 50, classTeacher: 't16', teachers: [{ teacherId: 't14', subject: 'Social Science' }, { teacherId: 't13', subject: 'Mathematics' }, { teacherId: 't3', subject: 'English' }, { teacherId: 't16', subject: 'Science' }, { teacherId: 't17', subject: 'Hindi' }, { teacherId: 't19', subject: 'Sanskrit' }, { teacherId: 't18', subject: 'Computer Science' }, { teacherId: 't10', subject: 'PE' }, { teacherId: 't12', subject: 'Music' }] },
  { class: 8, section: 'C', strength: 50, classTeacher: 't4', teachers: [{ teacherId: 't1', subject: 'Social Science' }, { teacherId: 't2', subject: 'Mathematics' }, { teacherId: 't15', subject: 'English' }, { teacherId: 't4', subject: 'Science' }, { teacherId: 't5', subject: 'Hindi' }, { teacherId: 't6', subject: 'Sanskrit' }, { teacherId: 't18', subject: 'Computer Science' }, { teacherId: 't20', subject: 'PE' }] },
  { class: 8, section: 'D', strength: 50, classTeacher: 't8', teachers: [{ teacherId: 't14', subject: 'Social Science' }, { teacherId: 't8', subject: 'Mathematics' }, { teacherId: 't3', subject: 'English' }, { teacherId: 't9', subject: 'Science' }, { teacherId: 't5', subject: 'Hindi' }, { teacherId: 't19', subject: 'Sanskrit' }, { teacherId: 't18', subject: 'Computer Science' }, { teacherId: 't10', subject: 'PE' }, { teacherId: 't11', subject: 'Art' }] }
];

export const initialData = {
  syllabus: syllabusData,
  teachers,
  students,
  tests,
  sections,
  classes: [6, 7, 8],
  subjects: ['Social Science', 'Mathematics', 'English', 'Science', 'Hindi', 'Sanskrit', 'Computer Science', 'Physical Education', 'Art & Craft', 'Music']
};
