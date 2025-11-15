import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// HealthCoach Component
const HealthCoach = ({ patientId }) => {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!patientId) return;
    axios.get(`http://localhost:3001/predict-adherence/${patientId}`)
      .then(res => {
        setPrediction(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('HealthCoach error:', err);
        setLoading(false);
        setPrediction({ risk: 0.5, tip: 'Start tracking more reminders for better insights!' });
      });
  }, [patientId]);
  if (loading) return <div className="loading">Analyzing your habits...</div>;
  return (
    <div className="futuristic-card tip-animation">
      <h2>🩺 Your Health Coach</h2>
      <p><strong>Adherence Risk:</strong> {prediction.risk * 100}%</p>
      <p>{prediction.tip}</p>
    </div>
  );
};

// ReminderPopup Component
const ReminderPopup = ({ reminder, onClose, onMarkDone }) => (
  <div className="popup-overlay">
    <div className="popup">
      <h2>Medication Reminder</h2>
      <p>Time to take: {reminder.DrugName} - {reminder.Dosage}</p>
      <button onClick={onMarkDone}>Mark as Done</button>
      <button onClick={onClose}>Dismiss</button>
    </div>
  </div>
);

// Login Component (Updated with 'family')
const Login = () => {
  const [selectedRole, setSelectedRole] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3001/login', {
        username,
        password,
        role: selectedRole
      });
      const { role, id } = response.data;
      localStorage.setItem('auth', JSON.stringify({ role, id }));
      if (role === 'patient') {
        navigate(`/patient/${id}`);
      } else if (role === 'caregiver') {
        navigate('/caregiver');
      } else if (role === 'family') {
        navigate('/family');
      } else if (role === 'admin') {
        navigate('/admin');
      }
      alert('Login successful!');
    } catch (error) {
      alert('Invalid credentials. Check username/password/role.');
      console.error(error);
    }
  };
  return (
    <div className="login-container">
      <h1>ElderCare Login</h1>
      {!selectedRole ? (
        <div>
          <h2>Select Your Role</h2>
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="role-select">
            <option value="">Choose a role...</option>
            <option value="patient">Patient</option>
            <option value="caregiver">Caregiver</option>
            <option value="family">Family Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="login-form">
          <label>
            Username: <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <br />
          <label>
            Password: <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <br />
          <button type="submit">Login as {selectedRole}</button>
          <button type="button" onClick={() => setSelectedRole('')}>Change Role</button>
        </form>
      )}
      <p>Demo credentials (password: pass for all):<br/>
        Patients: john123 (John), alice789 (Alice), bob456 (Bob)<br/>
        Caregiver: jane456 (Jane)<br/>
        Family: family123 (Mary - John's family)<br/>
        Admin: admin123</p>
    </div>
  );
};

// PatientDashboard Component
const PatientDashboard = () => {
  const { patientId } = useParams();
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReminder, setShowReminder] = useState(false);
  const [pendingReminder, setPendingReminder] = useState(null);
  const navigate = useNavigate();
  const stored = JSON.parse(localStorage.getItem('auth'));
  const { role, id: userId } = stored || {};
  useEffect(() => {
    if (role !== 'patient' || parseInt(patientId) !== userId) {
      navigate('/login');
      return;
    }
    fetchSchedule();
    const interval = setInterval(fetchSchedule, 60000);
    return () => clearInterval(interval);
  }, [patientId, role, userId, navigate]);
  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:3001/schedule/${patientId}`);
      setSchedule(response.data);
      const pending = response.data.find(item => item.Status === 'PENDING' && item.ReminderID);
      if (pending) {
        setPendingReminder(pending);
        setShowReminder(true);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error.message);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  };
  const markDone = async (reminderId) => {
    try {
      await axios.post(`http://localhost:3001/reminder/${reminderId}/done`);
      fetchSchedule();
      setShowReminder(false);
    } catch (error) {
      console.error('Error marking done:', error);
    }
  };
  const handleLogout = () => {
    localStorage.removeItem('auth');
    navigate('/login');
  };
  if (loading) return <div className="loading">Loading...</div>;
  return (
    <div className="dashboard">
      <header>
        <h1>ElderCare Patient Dashboard</h1>
        <p>Logged in as: {role} (ID: {userId}) | <button onClick={handleLogout}>Logout</button></p>
      </header>
      <HealthCoach patientId={patientId} />
      <p>Today's Schedule for Patient {patientId}</p>
      <ul className="schedule-list">
        {schedule.map((item, index) => (
          <li key={index}>
            <strong>{item.DrugName}</strong> - {item.Dosage} at {item.TimeSchedule}
            <br />Status: {item.Status} | Appt: {item.ApptTime || 'None'}
            {item.Status === 'PENDING' && item.ReminderID && (
              <button onClick={() => markDone(item.ReminderID)}>Mark Done</button>
            )}
          </li>
        ))}
      </ul>
      {schedule.some(item => item.Status === 'PENDING') && (
        <div className="reminder-alert">🚨 Reminder: Check pending meds!</div>
      )}
      {showReminder && (
        <ReminderPopup
          reminder={pendingReminder}
          onClose={() => setShowReminder(false)}
          onMarkDone={() => markDone(pendingReminder.ReminderID)}
        />
      )}
    </div>
  );
};

// CaregiverDashboard Component
const CaregiverDashboard = () => {
  const [schedule, setSchedule] = useState([]);
  const [missedCount, setMissedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const stored = JSON.parse(localStorage.getItem('auth'));
  const { role, id: userId } = stored || {};
  useEffect(() => {
    if (role !== 'caregiver') {
      navigate('/login');
      return;
    }
    fetchCaregiverSchedule();
    fetchMissed();
    const interval = setInterval(() => {
      fetchCaregiverSchedule();
      fetchMissed();
    }, 60000);
    return () => clearInterval(interval);
  }, [role, userId, navigate]);
  const fetchCaregiverSchedule = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:3001/caregiver/${userId}`);
      setSchedule(response.data);
    } catch (error) {
      console.error('Error fetching caregiver schedule:', error.message);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  };
  const fetchMissed = async () => {
    try {
      const response = await axios.get('http://localhost:3001/alerts');
      setMissedCount(response.data.count || 0);
    } catch (error) {
      console.error(error);
    }
  };
  const markDone = async (reminderId) => {
    try {
      await axios.post(`http://localhost:3001/reminder/${reminderId}/done`);
      fetchCaregiverSchedule();
    } catch (error) {
      console.error('Error marking done:', error);
    }
  };
  const handleLogout = () => {
    localStorage.removeItem('auth');
    navigate('/login');
  };
  if (loading) return <div className="loading">Loading...</div>;
  return (
    <div className="dashboard">
      <header>
        <h1>ElderCare Caregiver Dashboard</h1>
        <p>Logged in as: {role} (ID: {userId}) | <button onClick={handleLogout}>Logout</button></p>
      </header>
      <h2>Assigned Patients' Schedules</h2>
      <ul className="schedule-list">
        {schedule.map((pat, patIndex) => (
          <li key={patIndex}>
            <strong>Patient {pat.patientId}</strong>
            <HealthCoach patientId={pat.patientId} />
            <ul>
              {pat.schedule.map((item, index) => (
                <li key={index}>
                  {item.DrugName} - {item.Dosage} at {item.TimeSchedule}
                  <br />Status: {item.Status} | Appt: {item.ApptTime || 'None'}
                  {item.Status === 'PENDING' && item.ReminderID && (
                    <button onClick={() => markDone(item.ReminderID)}>Mark Done</button>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className="missed-alert">
        Missed Alerts: {missedCount} (from Redis)
      </div>
    </div>
  );
};

// NEW: FamilyDashboard Component (Read-Only)
const FamilyDashboard = () => {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const stored = JSON.parse(localStorage.getItem('auth'));
  const { role, id: userId } = stored || {};
  useEffect(() => {
    if (role !== 'family') {
      navigate('/login');
      return;
    }
    fetchFamilySchedule();
    const interval = setInterval(fetchFamilySchedule, 60000);
    return () => clearInterval(interval);
  }, [role, userId, navigate]);
  const fetchFamilySchedule = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:3001/family/${userId}`);
      setSchedule(response.data);
    } catch (error) {
      console.error('Error fetching family schedule:', error.message);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  };
  const handleLogout = () => {
    localStorage.removeItem('auth');
    navigate('/login');
  };
  if (loading) return <div className="loading">Loading...</div>;
  return (
    <div className="dashboard">
      <header>
        <h1>ElderCare Family Dashboard (View Only)</h1>
        <p>Logged in as: {role} (ID: {userId}) | <button onClick={handleLogout}>Logout</button></p>
      </header>
      <h2>Assigned Patients' Schedules</h2>
      <ul className="schedule-list">
        {schedule.map((pat, patIndex) => (
          <li key={patIndex}>
            <strong>Patient {pat.patientId}</strong>
            <HealthCoach patientId={pat.patientId} />
            <ul>
              {pat.schedule.map((item, index) => (
                <li key={index}>
                  {item.DrugName} - {item.Dosage} at {item.TimeSchedule}
                  <br />Status: {item.Status} | Appt: {item.ApptTime || 'None'}
                  {item.Status === 'PENDING' && (
                    <span className="disabled-action"> (View Only - Contact Caregiver)</span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className="note">Note: Family access is view-only for monitoring. Contact the caregiver for updates.</div>
    </div>
  );
};

// AdminDashboard Component (Full, Fixed)
const AdminDashboard = () => {
  const [reports, setReports] = useState([]);
  const [patients, setPatients] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [family, setFamily] = useState([]); // NEW: Family list
  const [appointments, setAppointments] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [newPatient, setNewPatient] = useState({ name: '', contact: '', medicalHistory: '' });
  const [newCaregiver, setNewCaregiver] = useState({ name: '', contact: '', assignedPatients: '' });
  const [newFamily, setNewFamily] = useState({ name: '', contact: '', assignedPatients: '' }); // NEW: Family form
  const [newAppointment, setNewAppointment] = useState({ patientId: '', caregiverId: '', dateTime: '', description: '' });
  const [newMedication, setNewMedication] = useState({ patientId: '', drugName: '', dosage: '', timeSchedule: '' });
  const stored = JSON.parse(localStorage.getItem('auth'));
  const { role } = stored || {};
  useEffect(() => {
    if (role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchAllData();
    const interval = setInterval(fetchAllData, 60000);
    return () => clearInterval(interval);
  }, [role, navigate]);
  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [reportsRes, patientsRes, caregiversRes, familyRes, appointmentsRes, medicationsRes] = await Promise.all([
        axios.get('http://localhost:3001/reports').catch(() => ({ data: [] })),
        axios.get('http://localhost:3001/patients').catch(() => ({ data: [] })),
        axios.get('http://localhost:3001/caregivers').catch(() => ({ data: [] })),
        axios.get('http://localhost:3001/family').catch(() => ({ data: [] })), // NEW
        axios.get('http://localhost:3001/appointments').catch(() => ({ data: [] })),
        axios.get('http://localhost:3001/medications').catch(() => ({ data: [] }))
      ]);
      setReports(reportsRes.data);
      setPatients(patientsRes.data);
      setCaregivers(caregiversRes.data);
      setFamily(familyRes.data); // NEW
      setAppointments(appointmentsRes.data);
      setMedications(medicationsRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error.message);
      setReports([]);
      setPatients([]);
      setCaregivers([]);
      setFamily([]); // NEW
      setAppointments([]);
      setMedications([]);
    } finally {
      setLoading(false);
    }
  };
  const handleAddPatient = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/patients', newPatient);
      alert('Patient added!');
      setNewPatient({ name: '', contact: '', medicalHistory: '' });
      fetchAllData();
    } catch (error) {
      alert(`Failed to add patient: ${error.response?.data?.error || 'Unknown error'}`);
      console.error(error);
    }
  };
  const handleRemovePatient = async (id) => {
    if (!window.confirm('Remove this patient? This will cascade to meds/reminders.')) return;
    try {
      await axios.delete(`http://localhost:3001/patients/${id}`);
      alert('Patient removed!');
      fetchAllData();
    } catch (error) {
      alert(`Failed to remove patient: ${error.response?.data?.error || 'Unknown error'}`);
      console.error(error);
    }
  };
  const handleAddCaregiver = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/caregivers', newCaregiver);
      alert('Caregiver added!');
      setNewCaregiver({ name: '', contact: '', assignedPatients: '' });
      fetchAllData();
    } catch (error) {
      alert(`Failed to add caregiver: ${error.response?.data?.error || 'Unknown error'}`);
      console.error(error);
    }
  };
  const handleRemoveCaregiver = async (id) => {
    if (!window.confirm('Remove this caregiver?')) return;
    try {
      await axios.delete(`http://localhost:3001/caregivers/${id}`);
      alert('Caregiver removed!');
      fetchAllData();
    } catch (error) {
      alert(`Failed to remove caregiver: ${error.response?.data?.error || 'Unknown error'}`);
      console.error(error);
    }
  };
  // NEW: Family CRUD
  const handleAddFamily = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/family', newFamily);
      alert('Family member added!');
      setNewFamily({ name: '', contact: '', assignedPatients: '' });
      fetchAllData();
    } catch (error) {
      alert(`Failed to add family member: ${error.response?.data?.error || 'Unknown error'}`);
      console.error(error);
    }
  };
  const handleRemoveFamily = async (id) => {
    if (!window.confirm('Remove this family member?')) return;
    try {
      await axios.delete(`http://localhost:3001/family/${id}`);
      alert('Family member removed!');
      fetchAllData();
    } catch (error) {
      alert(`Failed to remove family member: ${error.response?.data?.error || 'Unknown error'}`);
      console.error(error);
    }
  };
  const handleAddAppointment = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/appointments', newAppointment);
      alert('Appointment added!');
      setNewAppointment({ patientId: '', caregiverId: '', dateTime: '', description: '' });
      fetchAllData();
    } catch (error) {
      alert(`Failed to add appointment: ${error.response?.data?.error || 'Unknown error'}`);
      console.error(error);
    }
  };
  const handleRemoveAppointment = async (id) => {
    if (!window.confirm('Remove this appointment?')) return;
    try {
      await axios.delete(`http://localhost:3001/appointments/${id}`);
      alert('Appointment removed!');
      fetchAllData();
    } catch (error) {
      alert(`Failed to remove appointment: ${error.response?.data?.error || 'Unknown error'}`);
      console.error(error);
    }
  };
  const handleAddMedication = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/medications', newMedication);
      alert('Medication added!');
      setNewMedication({ patientId: '', drugName: '', dosage: '', timeSchedule: '' });
      fetchAllData();
    } catch (error) {
      alert(`Failed to add medication: ${error.response?.data?.error || 'Unknown error'}`);
      console.error(error);
    }
  };
  const handleRemoveMedication = async (id) => {
    if (!window.confirm('Remove this medication?')) return;
    try {
      await axios.delete(`http://localhost:3001/medications/${id}`);
      alert('Medication removed!');
      fetchAllData();
    } catch (error) {
      alert(`Failed to remove medication: ${error.response?.data?.error || 'Unknown error'}`);
      console.error(error);
    }
  };
  const handleLogout = () => {
    localStorage.removeItem('auth');
    navigate('/login');
  };
  if (loading) return <div className="loading">Loading...</div>;
  return (
    <div className="dashboard">
      <header>
        <h1>ElderCare Admin Dashboard</h1>
        <p>Logged in as: {role} | <button onClick={handleLogout}>Logout</button></p>
      </header>
      <section>
        <h2>Reports: Missed Dose Statistics</h2>
        <table className="report-table">
          <thead>
            <tr>
              <th>Patient ID</th>
              <th>Name</th>
              <th>Total Reminders</th>
              <th>Missed Count</th>
              <th>Adherence %</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report, index) => (
              <tr key={index}>
                <td>{report.PatientID}</td>
                <td>{report.Name}</td>
                <td>{report.totalReminders}</td>
                <td>{report.missedCount}</td>
                <td>{report.adherencePercent || 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>Manage Patients</h2>
        <form onSubmit={handleAddPatient} className="form">
          <label>
            Name: <input type="text" value={newPatient.name} onChange={(e) => setNewPatient({...newPatient, name: e.target.value})} required />
          </label>
          <br />
          <label>
            Contact: <input type="text" value={newPatient.contact} onChange={(e) => setNewPatient({...newPatient, contact: e.target.value})} required />
          </label>
          <br />
          <label>
            Medical History: <textarea value={newPatient.medicalHistory} onChange={(e) => setNewPatient({...newPatient, medicalHistory: e.target.value})} rows="3" />
          </label>
          <br />
          <button type="submit">Add Patient</button>
        </form>
        <h3>Patients List</h3>
        <ul className="list">
          {patients.map((p) => (
            <li key={p.PatientID}>
              <strong>{p.Name}</strong> - Contact: {p.Contact}<br />
              Medical History: {p.MedicalHistory}<br />
              <button onClick={() => handleRemovePatient(p.PatientID)}>Remove Patient</button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Manage Caregivers</h2>
        <form onSubmit={handleAddCaregiver} className="form">
          <label>
            Name: <input type="text" value={newCaregiver.name} onChange={(e) => setNewCaregiver({...newCaregiver, name: e.target.value})} required />
          </label>
          <br />
          <label>
            Contact: <input type="text" value={newCaregiver.contact} onChange={(e) => setNewCaregiver({...newCaregiver, contact: e.target.value})} required />
          </label>
          <br />
          <label>
            Assigned Patients (comma-separated IDs): <input type="text" value={newCaregiver.assignedPatients} onChange={(e) => setNewCaregiver({...newCaregiver, assignedPatients: e.target.value})} required />
          </label>
          <br />
          <button type="submit">Add Caregiver</button>
        </form>
        <h3>Existing Caregivers</h3>
        <ul className="list">
          {caregivers.map((c) => (
            <li key={c.CaregiverID}>
              {c.Name} - {c.Contact} - Assigned: {c.AssignedPatients}
              <button onClick={() => handleRemoveCaregiver(c.CaregiverID)}>Remove</button>
            </li>
          ))}
        </ul>
      </section>
      {/* NEW: Manage Family Section */}
      <section>
        <h2>Manage Family Members</h2>
        <form onSubmit={handleAddFamily} className="form">
          <label>
            Name: <input type="text" value={newFamily.name} onChange={(e) => setNewFamily({...newFamily, name: e.target.value})} required />
          </label>
          <br />
          <label>
            Contact: <input type="text" value={newFamily.contact} onChange={(e) => setNewFamily({...newFamily, contact: e.target.value})} required />
          </label>
          <br />
          <label>
            Assigned Patients (comma-separated IDs): <input type="text" value={newFamily.assignedPatients} onChange={(e) => setNewFamily({...newFamily, assignedPatients: e.target.value})} required />
          </label>
          <br />
          <button type="submit">Add Family Member</button>
        </form>
        <h3>Existing Family Members</h3>
        <ul className="list">
          {family.map((f) => (
            <li key={f.FamilyID}>
              {f.Name} - {f.Contact} - Assigned: {f.AssignedPatients}
              <button onClick={() => handleRemoveFamily(f.FamilyID)}>Remove</button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Manage Appointments</h2>
        <form onSubmit={handleAddAppointment} className="form">
          <label>
            Patient ID: <input type="number" value={newAppointment.patientId} onChange={(e) => setNewAppointment({...newAppointment, patientId: e.target.value})} required />
          </label>
          <br />
          <label>
            Caregiver ID: <input type="number" value={newAppointment.caregiverId} onChange={(e) => setNewAppointment({...newAppointment, caregiverId: e.target.value})} required />
          </label>
          <br />
          <label>
            DateTime (YYYY-MM-DD HH:MM:SS): <input type="text" value={newAppointment.dateTime} onChange={(e) => setNewAppointment({...newAppointment, dateTime: e.target.value})} required />
          </label>
          <br />
          <label>
            Description: <input type="text" value={newAppointment.description} onChange={(e) => setNewAppointment({...newAppointment, description: e.target.value})} required />
          </label>
          <br />
          <button type="submit">Add Appointment</button>
        </form>
        <h3>Existing Appointments</h3>
        <ul className="list">
          {appointments.map((a) => (
            <li key={a.ApptID}>
              Patient {a.PatientID} with Caregiver {a.CaregiverID} on {a.DateTime}: {a.Description}
              <button onClick={() => handleRemoveAppointment(a.ApptID)}>Remove</button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Manage Medications</h2>
        <form onSubmit={handleAddMedication} className="form">
          <label>
            Patient ID: <input type="number" value={newMedication.patientId} onChange={(e) => setNewMedication({...newMedication, patientId: e.target.value})} required />
          </label>
          <br />
          <label>
            Drug Name: <input type="text" value={newMedication.drugName} onChange={(e) => setNewMedication({...newMedication, drugName: e.target.value})} required />
          </label>
          <br />
          <label>
            Dosage: <input type="text" value={newMedication.dosage} onChange={(e) => setNewMedication({...newMedication, dosage: e.target.value})} required />
          </label>
          <br />
          <label>
            Time Schedule: <input type="text" value={newMedication.timeSchedule} onChange={(e) => setNewMedication({...newMedication, timeSchedule: e.target.value})} required />
          </label>
          <br />
          <button type="submit">Add Medication</button>
        </form>
        <h3>Existing Medications</h3>
        <ul className="list">
          {medications.map((m) => (
            <li key={m.MedID}>
              {m.DrugName} ({m.Dosage}) for Patient {m.PatientID} at {m.TimeSchedule}
              <button onClick={() => handleRemoveMedication(m.MedID)}>Remove</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ component: Component, allowedRoles }) => {
  const stored = localStorage.getItem('auth');
  if (!stored) {
    return <Navigate to="/login" replace />;
  }
  const { role } = JSON.parse(stored);
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }
  return <Component />;
};

// Main App Component
function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/patient/:patientId" element={<ProtectedRoute component={PatientDashboard} allowedRoles={['patient']} />} />
          <Route path="/caregiver" element={<ProtectedRoute component={CaregiverDashboard} allowedRoles={['caregiver']} />} />
          <Route path="/family" element={<ProtectedRoute component={FamilyDashboard} allowedRoles={['family']} />} />
          <Route path="/admin" element={<ProtectedRoute component={AdminDashboard} allowedRoles={['admin']} />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;