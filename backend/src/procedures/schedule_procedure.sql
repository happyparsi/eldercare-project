-- daily sechedule generate karne ka procedure ka code

DELIMITER //
CREATE PROCEDURE GenerateDailySchedule(IN patient_id INT)
BEGIN
    SELECT m.DrugName, m.Dosage, m.TimeSchedule, r.Status, a.DateTime AS ApptTime
    FROM Medications m
    LEFT JOIN Reminders r ON m.MedID = r.MedID AND DATE(r.AlertTime) = CURDATE()
    LEFT JOIN Appointments a ON m.PatientID = a.PatientID AND DATE(a.DateTime) = CURDATE()
    WHERE m.PatientID = patient_id;
END //
DELIMITER ;