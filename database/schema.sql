USE eldercare_db;

-- Patients table
CREATE TABLE IF NOT EXISTS Patients (
    PatientID INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Contact VARCHAR(20),
    MedicalHistory TEXT
);

-- Medications table
CREATE TABLE IF NOT EXISTS Medications (
    MedID INT AUTO_INCREMENT PRIMARY KEY,
    PatientID INT,
    DrugName VARCHAR(100) NOT NULL,
    Dosage VARCHAR(50),
    TimeSchedule VARCHAR(100),
    DoseTime TIME NULL,
    FOREIGN KEY (PatientID) REFERENCES Patients(PatientID)
);

-- Caregivers table
CREATE TABLE IF NOT EXISTS Caregivers (
    CaregiverID INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Contact VARCHAR(20),
    AssignedPatients TEXT
);

-- Family table
CREATE TABLE IF NOT EXISTS Family (
    FamilyID INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Contact VARCHAR(20),
    AssignedPatients TEXT
);

-- Appointments table
CREATE TABLE IF NOT EXISTS Appointments (
    ApptID INT AUTO_INCREMENT PRIMARY KEY,
    PatientID INT,
    CaregiverID INT,
    DateTime DATETIME NOT NULL,
    Description VARCHAR(200),
    FOREIGN KEY (PatientID) REFERENCES Patients(PatientID),
    FOREIGN KEY (CaregiverID) REFERENCES Caregivers(CaregiverID)
);

-- Reminders table
CREATE TABLE IF NOT EXISTS Reminders (
    ReminderID INT AUTO_INCREMENT PRIMARY KEY,
    MedID INT,
    PatientID INT,
    AlertTime DATETIME,
    Status ENUM('PENDING', 'DONE', 'MISSED') DEFAULT 'PENDING',
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (MedID) REFERENCES Medications(MedID),
    FOREIGN KEY (PatientID) REFERENCES Patients(PatientID)
);

-- Users table (full ENUM)
CREATE TABLE IF NOT EXISTS Users (
    UserID INT AUTO_INCREMENT PRIMARY KEY,
    Username VARCHAR(50) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL,
    Role ENUM('patient', 'caregiver', 'family', 'admin') NOT NULL,
    LinkedID INT NULL
);

-- Verify/force full ENUM
SET @roles = (
    SELECT GROUP_CONCAT(DISTINCT CONCAT('"', value, '"') SEPARATOR ', ') 
    FROM (SELECT 'patient' AS value UNION SELECT 'caregiver' UNION SELECT 'family' UNION SELECT 'admin') AS all_roles
);
SET @alter_sql = CONCAT('ALTER TABLE Users MODIFY COLUMN Role ENUM(', @roles, ') NOT NULL');
PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt ;

-- Procedure for daily schedule (unchanged)
DELIMITER //
DROP PROCEDURE IF EXISTS GenerateDailySchedule;
CREATE PROCEDURE GenerateDailySchedule(IN patient_id INT)
BEGIN
    SELECT m.DrugName, m.Dosage, m.TimeSchedule, COALESCE(r.Status, 'NO_REMINDER') AS Status, a.DateTime AS ApptTime, r.ReminderID
    FROM Medications m
    LEFT JOIN Reminders r ON m.MedID = r.MedID AND DATE(r.AlertTime) = CURDATE()
    LEFT JOIN Appointments a ON m.PatientID = a.PatientID AND DATE(a.DateTime) = CURDATE()
    WHERE m.PatientID = patient_id;
END //
DELIMITER ;

-- New procedure to generate daily reminders
DELIMITER //
DROP PROCEDURE IF EXISTS GenerateDailyReminders;
CREATE PROCEDURE GenerateDailyReminders()
BEGIN
    INSERT INTO Reminders (MedID, PatientID, AlertTime, Status)
    SELECT m.MedID, m.PatientID, 
           STR_TO_DATE(CONCAT(DATE(CURDATE()), ' ', TIME_FORMAT(m.DoseTime, '%H:%i:%s')), '%Y-%m-%d %H:%i:%s') AS AlertTime, 
           'PENDING'
    FROM Medications m 
    WHERE m.DoseTime IS NOT NULL 
      AND NOT EXISTS (
        SELECT 1 FROM Reminders r 
        WHERE r.MedID = m.MedID 
          AND DATE(r.AlertTime) = CURDATE()
      );
END //
DELIMITER ;

-- Enable event scheduler (if not already)
SET GLOBAL event_scheduler = ON;

-- Create daily event to generate reminders
DELIMITER //
DROP EVENT IF EXISTS daily_reminders;
CREATE EVENT daily_reminders
ON SCHEDULE EVERY 1 DAY
STARTS '2025-11-13 00:00:00'
DO
  CALL GenerateDailyReminders();
//
DELIMITER ;