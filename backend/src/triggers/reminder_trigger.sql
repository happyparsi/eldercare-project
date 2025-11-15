
-- notification add karne ka trigger

DELIMITER //
CREATE TRIGGER GenerateReminder AFTER INSERT ON Medications
FOR EACH ROW
BEGIN

    INSERT INTO Reminders (MedID, PatientID, AlertTime, Status)
    VALUES (NEW.MedID, NEW.PatientID, ADDTIME(NOW(), '00:01:00'), 'PENDING');
END //
DELIMITER ;