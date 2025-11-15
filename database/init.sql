USE eldercare_db;

-- Sample data (REPLACE INTO forces insert/overwrite)
REPLACE INTO Patients (PatientID, Name, Contact, MedicalHistory) VALUES 
(1, 'John Doe', '123-456-7890', 'Hypertension, Diabetes'),
(2, 'Alice Johnson', '111-222-3333', 'Arthritis, High Cholesterol'),
(3, 'Bob Wilson', '444-555-6666', 'Heart Disease, Osteoporosis');

REPLACE INTO Caregivers (CaregiverID, Name, Contact, AssignedPatients) VALUES 
(1, 'Jane Smith', '987-654-3210', '1,2,3');

REPLACE INTO Family (FamilyID, Name, Contact, AssignedPatients) VALUES 
(1, 'Mary Johnson', '555-123-4567', '1');

REPLACE INTO Appointments (ApptID, PatientID, CaregiverID, DateTime, Description) VALUES 
(1, 1, 1, '2025-11-12 10:00:00', 'Check-up with Dr. Lee'),
(2, 2, 1, '2025-11-13 14:00:00', 'Physical therapy session'),
(3, 3, 1, '2025-11-14 09:30:00', 'Cardiology follow-up');

-- Updated Medications with DoseTime for automated reminders
REPLACE INTO Medications (MedID, PatientID, DrugName, Dosage, TimeSchedule, DoseTime) VALUES 
(1, 1, 'Aspirin', '1 tablet', 'Daily at 9:00 AM', '09:00:00'),
(2, 1, 'Metformin', '500mg', 'Daily morning with breakfast', '08:00:00'),
(3, 2, 'Ibuprofen', '200mg', 'As needed for pain around 2 PM', '14:00:00'),
(4, 2, 'Lipitor', '20mg', 'Daily in the evening', '20:00:00'),
(5, 3, 'Lisinopril', '10mg', 'Daily at 10:00 AM', '10:00:00'),
(6, 3, 'Calcium Supplement', '600mg', 'Daily with dinner', '19:00:00');

-- Reminders (~35% miss for John) - historical for October
REPLACE INTO Reminders (ReminderID, MedID, PatientID, AlertTime, Status) VALUES 
(1, 1, 1, '2025-10-11 09:00:00', 'DONE'),
(2, 1, 1, '2025-10-12 09:00:00', 'DONE'),
(3, 1, 1, '2025-10-13 09:00:00', 'MISSED'),
(4, 1, 1, '2025-10-14 09:00:00', 'DONE'),
(5, 1, 1, '2025-10-15 09:00:00', 'DONE'),
(6, 1, 1, '2025-10-16 09:00:00', 'MISSED'),
(7, 1, 1, '2025-10-17 09:00:00', 'DONE'),
(8, 1, 1, '2025-10-18 09:00:00', 'DONE'),
(9, 1, 1, '2025-10-19 09:00:00', 'MISSED'),
(10, 1, 1, '2025-10-20 09:00:00', 'DONE'),
(11, 2, 1, '2025-10-21 08:00:00', 'DONE'),
(12, 2, 1, '2025-10-22 08:00:00', 'MISSED'),
(13, 2, 1, '2025-10-23 08:00:00', 'DONE'),
(14, 2, 1, '2025-10-24 08:00:00', 'MISSED'),
(15, 2, 1, '2025-10-25 08:00:00', 'DONE'),
(16, 3, 2, '2025-10-26 14:00:00', 'MISSED'),
(17, 3, 2, '2025-10-27 14:00:00', 'DONE');

-- Users (FORCE with REPLACE)
REPLACE INTO Users (UserID, Username, Password, Role, LinkedID) VALUES 
(1, 'john123', 'pass', 'patient', 1),
(2, 'alice789', 'pass', 'patient', 2),
(3, 'bob456', 'pass', 'patient', 3),
(4, 'jane456', 'pass', 'caregiver', 1),
(5, 'family123', 'pass', 'family', 1),
(6, 'admin123', 'pass', 'admin', NULL);

-- Verification
SELECT CONCAT('Users loaded: ', COUNT(*), ' rows') AS status FROM Users;

-- Seed reminders for today (November 12, 2025)
CALL GenerateDailyReminders();