# eldercare-project

Stop old containers: In terminal (project root): docker-compose down.
Rebuild & Start: docker-compose up --build.

Wait 2-5 mins: Docker pulls/builds (MySQL runs schema/init, creates tables/data/users).
Logs show: MySQL connected, Redis connected, Backend on 3001, Frontend on 3000.
Redis caches schedules (check logs for sets/dels).


Test Login:

Browser: http://localhost:3000.
Select "Patient" → john123 / pass → See schedule for John (meds + reminders).
Select "Caregiver" → jane456 / pass → See schedules for patients 1,2,3.
Select "Admin" → admin123 / pass → See reports, add patient (e.g., Name: Test, History: None), view list, remove.


Test Features:

Admin: Add patient → Refresh, see in list. Remove → Gone (meds cascade).
Caregiver: Mark done → Status updates, Redis cache clears.
Patient: Change ID to 2 → See Alice's schedule.
