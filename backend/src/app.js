require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const redis = require('redis');
const cron = require('node-cron');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

// DB Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: 'root',
  password: 'password',
  database: 'eldercare_db'
});

db.connect((err) => {
  if (err) throw err;
  console.log('MySQL Connected!');
});

// Redis Connection
const redisClient = redis.createClient({ url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379` });
redisClient.on('error', (err) => console.log('Redis Error', err));
redisClient.connect().then(() => console.log('Redis Connected!'));

// Rule-Based Adherence Prediction
async function predictAdherence(patientId) {
  return new Promise((resolve, reject) => {
    db.query(`
      SELECT Status, DATE(AlertTime) as date 
      FROM Reminders 
      WHERE PatientID = ? AND AlertTime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY AlertTime
    `, [patientId], (err, results) => {
      if (err || results.length < 10) {
        resolve({ risk: 0.5, tip: 'Start tracking more reminders for better insights!' });
        return;
      }

      const statuses = results.map(r => r.Status === 'MISSED' ? 1 : 0);
      const totalReminders = results.length;
      const last7DaysStatuses = statuses.slice(-7);
      const missedRateLast7 = last7DaysStatuses.reduce((a, b) => a + b, 0) / last7DaysStatuses.length || 0;

      const k = 0.1;
      const linear = missedRateLast7 * totalReminders * k;
      const risk = 1 / (1 + Math.exp(-linear));

      let tip;
      if (risk > 0.7) tip = 'High risk! Pair Metformin with your morning walk for better routine.';
      else if (risk > 0.4) tip = 'Medium risk. Set a phone alarm 10 mins early.';
      else tip = 'Great job! Keep the streak—reward yourself with a favorite tea.';

      resolve({ risk: Math.round(risk * 100) / 100, tip });
    });
  });
}

// GET /predict-adherence/:patientId
app.get('/predict-adherence/:patientId', async (req, res) => {
  const { patientId } = req.params;
  const cacheKey = `adherence:${patientId}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const prediction = await predictAdherence(patientId);
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(prediction));
    res.json(prediction);
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ error: 'Prediction failed; using fallback.' });
  }
});

// POST /login (enhanced with full logging + fallback)
app.post('/login', (req, res) => {
  const { username, password, role } = req.body;
  console.log(`Login attempt: ${username}/${password}/${role}`);
  db.query('SELECT * FROM Users WHERE Username = ? AND Password = ? AND Role = ?', [username, password, role], (err, results) => {
    if (err) {
      console.error('Login DB error:', err.message);
      // Fallback: Log all users for debug
      db.query('SELECT Username, Role FROM Users', (err2, allUsers) => {
        if (!err2) console.log('Available users:', allUsers.map(u => `${u.Username} (${u.Role})`));
      });
      return res.status(500).json({ error: 'DB query failed - check logs' });
    }
    if (results.length === 0) {
      console.log(`No match for ${username}/${role}`);
      // Fallback log
      db.query('SELECT Username, Role FROM Users', (err2, allUsers) => {
        if (!err2) console.log('Available users:', allUsers.map(u => `${u.Username} (${u.Role})`));
      });
      return res.status(401).json({ error: 'Invalid credentials - user/role not found' });
    }
    const user = results[0];
    console.log(`Login success: ${username} (ID: ${user.LinkedID})`);
    res.json({ role: user.Role, id: user.LinkedID });
  });
});

// GET /patients
app.get('/patients', (req, res) => {
  db.query('SELECT * FROM Patients', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST /patients
app.post('/patients', (req, res) => {
  const { name, contact, medicalHistory } = req.body;
  db.query('INSERT INTO Patients (Name, Contact, MedicalHistory) VALUES (?, ?, ?)', [name, contact, medicalHistory], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    redisClient.keys('schedule:*').then((keys) => {
      if (keys.length > 0) redisClient.del(keys);
    }).catch((err) => console.error('Cache clear error:', err));
    res.json({ message: 'Patient added!', id: results.insertId });
  });
});

// DELETE /patients/:id
app.delete('/patients/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM Patients WHERE PatientID = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.affectedRows === 0) return res.status(404).json({ error: 'Patient not found' });
    redisClient.keys('schedule:*').then((keys) => {
      if (keys.length > 0) redisClient.del(keys);
    }).catch((err) => console.error('Cache clear error:', err));
    res.json({ message: 'Patient removed!' });
  });
});

// GET /caregivers
app.get('/caregivers', (req, res) => {
  db.query('SELECT * FROM Caregivers', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST /caregivers
app.post('/caregivers', (req, res) => {
  const { name, contact, assignedPatients } = req.body;
  db.query(`INSERT INTO Caregivers (Name, Contact, AssignedPatients) VALUES (?, ?, ?)`, [name, contact, assignedPatients], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    redisClient.del('caregiver:all');
    res.json({ message: 'Caregiver added!', id: results.insertId });
  });
});

// DELETE /caregivers/:id
app.delete('/caregivers/:id', (req, res) => {
  const { id } = req.params;
  db.query(`DELETE FROM Caregivers WHERE CaregiverID = ?`, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.affectedRows === 0) return res.status(404).json({ error: 'Caregiver not found' });
    redisClient.del('caregiver:all');
    res.json({ message: 'Caregiver removed!' });
  });
});

// GET /family
app.get('/family', (req, res) => {
  db.query('SELECT * FROM Family', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST /family
app.post('/family', (req, res) => {
  const { name, contact, assignedPatients } = req.body;
  db.query(`INSERT INTO Family (Name, Contact, AssignedPatients) VALUES (?, ?, ?)`, [name, contact, assignedPatients], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    redisClient.del('family:all');
    res.json({ message: 'Family member added!', id: results.insertId });
  });
});

// DELETE /family/:id
app.delete('/family/:id', (req, res) => {
  const { id } = req.params;
  db.query(`DELETE FROM Family WHERE FamilyID = ?`, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.affectedRows === 0) return res.status(404).json({ error: 'Family member not found' });
    redisClient.del('family:all');
    res.json({ message: 'Family member removed!' });
  });
});

// GET /family/:id
app.get('/family/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT AssignedPatients FROM Family WHERE FamilyID = ?', [id], (err, famResults) => {
    if (err || famResults.length === 0) return res.json([]);
    const assignedStr = famResults[0].AssignedPatients;
    if (!assignedStr) return res.json([]);
    const patientIds = assignedStr.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
    if (patientIds.length === 0) return res.json([]);
    
    let allSchedules = [];
    let completed = 0;
    patientIds.forEach(pId => {
      db.query(`CALL GenerateDailySchedule(${pId})`, (err, results) => {
        completed++;
        if (!err && results[0].length > 0) {
          allSchedules.push({ patientId: pId, schedule: results[0] });
        }
        if (completed === patientIds.length) {
          redisClient.setEx(`family:${id}`, 1800, JSON.stringify(allSchedules));
          res.json(allSchedules);
        }
      });
    });
  });
});

// GET /appointments
app.get('/appointments', (req, res) => {
  db.query('SELECT * FROM Appointments', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST /appointments
app.post('/appointments', (req, res) => {
  const { patientId, caregiverId, dateTime, description } = req.body;
  db.query(`INSERT INTO Appointments (PatientID, CaregiverID, DateTime, Description) VALUES (?, ?, ?, ?)`, [patientId, caregiverId, dateTime, description], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    redisClient.keys('schedule:*').then((keys) => {
      if (keys.length > 0) redisClient.del(keys);
    });
    res.json({ message: 'Appointment added!', id: results.insertId });
  });
});

// DELETE /appointments/:id
app.delete('/appointments/:id', (req, res) => {
  const { id } = req.params;
  db.query(`DELETE FROM Appointments WHERE ApptID = ?`, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.affectedRows === 0) return res.status(404).json({ error: 'Appointment not found' });
    redisClient.keys('schedule:*').then((keys) => {
      if (keys.length > 0) redisClient.del(keys);
    });
    res.json({ message: 'Appointment removed!' });
  });
});

// GET /medications
app.get('/medications', (req, res) => {
  db.query('SELECT * FROM Medications', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST /medications
app.post('/medications', (req, res) => {
  const { patientId, drugName, dosage, timeSchedule } = req.body;
  db.query(`INSERT INTO Medications (PatientID, DrugName, Dosage, TimeSchedule) VALUES (?, ?, ?, ?)`, [patientId, drugName, dosage, timeSchedule], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    redisClient.keys('schedule:*').then((keys) => {
      if (keys.length > 0) redisClient.del(keys);
    });
    redisClient.keys('adherence:*').then((keys) => {
      if (keys.length > 0) redisClient.del(keys);
    }).catch((err) => console.error('Adherence cache clear error:', err));
    res.json({ message: 'Medication added!', id: results.insertId });
  });
});

// DELETE /medications/:id
app.delete('/medications/:id', (req, res) => {
  const { id } = req.params;
  db.query(`DELETE FROM Medications WHERE MedID = ?`, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.affectedRows === 0) return res.status(404).json({ error: 'Medication not found' });
    db.query(`DELETE FROM Reminders WHERE MedID = ?`, [id], (err2) => {
      if (err2) console.error('Reminder cleanup error:', err2);
    });
    redisClient.keys('schedule:*').then((keys) => {
      if (keys.length > 0) redisClient.del(keys);
    });
    redisClient.keys('adherence:*').then((keys) => {
      if (keys.length > 0) redisClient.del(keys);
    }).catch((err) => console.error('Adherence cache clear error:', err));
    res.json({ message: 'Medication removed!' });
  });
});

// GET /caregiver/:id
app.get('/caregiver/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT AssignedPatients FROM Caregivers WHERE CaregiverID = ?', [id], (err, cgResults) => {
    if (err || cgResults.length === 0) return res.json([]);
    const assignedStr = cgResults[0].AssignedPatients;
    if (!assignedStr) return res.json([]);
    const patientIds = assignedStr.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
    if (patientIds.length === 0) return res.json([]);
    
    let allSchedules = [];
    let completed = 0;
    patientIds.forEach(pId => {
      db.query(`CALL GenerateDailySchedule(${pId})`, (err, results) => {
        completed++;
        if (!err && results[0].length > 0) {
          allSchedules.push({ patientId: pId, schedule: results[0] });
        }
        if (completed === patientIds.length) {
          redisClient.setEx(`caregiver:${id}`, 1800, JSON.stringify(allSchedules));
          res.json(allSchedules);
        }
      });
    });
  });
});

// GET /schedule/:patientId
app.get('/schedule/:patientId', (req, res) => {
  const { patientId } = req.params;
  redisClient.get(`schedule:${patientId}`).then((cached) => {
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    db.query(`CALL GenerateDailySchedule(${patientId})`, (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      redisClient.setEx(`schedule:${patientId}`, 3600, JSON.stringify(results[0]));
      res.json(results[0]);
    });
  });
});

// POST /reminder/:id/done
app.post('/reminder/:id/done', (req, res) => {
  const { id } = req.params;
  db.query(`UPDATE Reminders SET Status = 'DONE' WHERE ReminderID = ?`, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.affectedRows === 0) return res.status(404).json({ error: 'Reminder not found' });
    redisClient.keys('schedule:*').then((keys) => {
      if (keys.length > 0) redisClient.del(keys); 
    }).catch((err) => console.error('Cache clear error:', err));
    redisClient.keys('adherence:*').then((keys) => {
      if (keys.length > 0) redisClient.del(keys);
    }).catch((err) => console.error('Adherence cache clear error:', err));
    res.json({ message: 'Marked as done!' });
  });
});

// GET /reports
app.get('/reports', (req, res) => {
  db.query(`
    SELECT p.PatientID, p.Name, COUNT(r.ReminderID) as totalReminders, 
           SUM(CASE WHEN r.Status = 'MISSED' THEN 1 ELSE 0 END) as missedCount,
           ROUND((SUM(CASE WHEN r.Status = 'DONE' THEN 1 ELSE 0 END) / NULLIF(COUNT(r.ReminderID), 0) * 100), 2) as adherencePercent
    FROM Patients p LEFT JOIN Reminders r ON p.PatientID = r.PatientID
    GROUP BY p.PatientID, p.Name
  `, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    redisClient.setEx('admin:reports', 3600, JSON.stringify(results));
    res.json(results);
  });
});

// Cron Job
cron.schedule('* * * * *', () => {
  console.log('Checking reminders...');
  db.query("UPDATE Reminders SET Status='MISSED' WHERE AlertTime < NOW() AND Status='PENDING'", (err) => {
    if (err) {
      console.error('Error updating missed reminders:', err);
    } else {
      console.log('Updated missed reminders');
      redisClient.del('admin:reports').catch((cacheErr) => console.error('Cache clear error:', cacheErr));
      redisClient.keys('adherence:*').then((keys) => {
        if (keys.length > 0) redisClient.del(keys);
      }).catch((err) => console.error('Adherence cache clear error:', err));
    }
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));