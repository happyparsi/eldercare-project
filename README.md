# ElderCare Project

## Project Description

ElderCare is a comprehensive web-based healthcare management system designed specifically for elderly care facilities. It provides an integrated platform for managing patient medical records, medication schedules, caregiver assignments, and health reminders.

### Key Features

- *Multi-user Dashboard*: Admin, Caregiver, and Patient roles with role-based access control
- *Patient Management*: Add, view, update, and remove patient records
- *Medication Scheduling*: Automated medication reminders and tracking
- *Caregiver Assignment*: Assign caregivers to patients and track care activities
- *Real-time Notifications*: Schedule reminders for medications and health checkups
- *Responsive UI*: User-friendly interface built with React
- *Secure Backend*: RESTful API with MySQL database and Redis caching

### Technology Stack

*Frontend:*
- React.js
- CSS
- Responsive Web Design

*Backend:*
- Node.js with Express
- MySQL Database
- Redis (caching and session management)

*Deployment:*
- Docker & Docker Compose
- Multi-container orchestration

---

## Project Structure


eldercare-project/
├── backend/                 # Node.js Express server
│   ├── src/
│   │   ├── app.js            # Express configuration
│   │   ├── procedures/       # SQL stored procedures
│   │   └── triggers/         # Database triggers
│   ├── package.json       # Dependencies
│   ├── Dockerfile         # Backend container config
│   └── .env                # Environment variables
├── database/                # Database schema
├── App.js                   # React main component
├── App.css                  # Styling
├── docker-compose.yml      # Multi-container setup
├── package.json            # Frontend dependencies
├── redis.conf              # Redis configuration
└── README.md               # This file


---

## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- Git (for cloning the repository)
- Terminal/Command line access

### Installation & Running

#### Step 1: Stop Existing Containers (if any)

bash
cd project-root
docker-compose down


#### Step 2: Build and Start Services

bash
docker-compose up --build


*Wait 2-5 minutes* for Docker to:
- Pull required images
- Build containers
- Initialize MySQL database
- Create tables and load initial data
- Start Redis caching service

You'll see logs indicating:
- MySQL connected
- Redis connected
- Backend running on port 3001
- Frontend running on port 3000

#### Step 3: Access the Application

Open your browser and navigate to: *http://localhost:3000*

---

## How to Present the Working

### Demo Walkthrough

#### 1. *Login & Role Selection*
   - Navigate to the home page
   - Select role: "Patient", "Caregiver", or "Admin"
   - Enter credentials

#### 2. *Patient Features*

*Test Credentials:*
- Username: john123
- Password: pass

*Demo Actions:*
1. View your medication schedule
   - Show meds assigned for today
   - Display reminders and timing
2. View health history
   - Show medical records
   - Display past appointments
3. Update personal information
   - Edit contact details
   - Change emergency contacts

#### 3. *Caregiver Features*

*Test Credentials:*
- Username: jane456
- Password: pass

*Demo Actions:*
1. View assigned patients
   - List all patients under care
   - See schedules (Patients 1, 2, 3)
2. Mark medications as administered
   - Select patient and medication
   - Mark as done
   - Observe status updates
3. Track care activities
   - View activity history
   - Check Redis cache updates (medications cleared after completion)
4. Update patient notes
   - Add observations
   - Document care activities

#### 4. *Admin Features*

*Test Credentials:*
- Username: admin123
- Password: pass

*Demo Actions:*
1. *Add New Patient*
   - Click "Add Patient"
   - Enter: Name, Age, Medical History
   - Submit
   - Observe new patient appears in list instantly

2. *View All Patients*
   - Display patient database
   - Show details: ID, Name, Age, Status
   - Demonstrate filtering/search

3. *Remove Patient*
   - Select a patient
   - Click "Remove"
   - Observe:
     - Patient deleted from list
     - Cascade delete: All related medications removed
     - All care records deleted

4. *Assign Medications*
   - Select patient
   - Add medication details: Name, Dosage, Frequency, Time
   - Assign to caregivers
   - Verify in patient's schedule

5. *View Reports*
   - Medication adherence reports
   - Care activity logs
   - Patient statistics

#### 5. *Data Persistence Demo*

1. *Change Patient ID Test:*
   - Login as Patient
   - Change ID from 1 to 2 in browser console or URL
   - Observe: Alice's schedule loads instead of John's
   - Shows proper data isolation

2. *Redis Caching Demonstration:*
   - Check Docker logs: docker-compose logs
   - Observe cache hits/misses
   - Show schedule data being cached
   - Demonstrate cache clearing after medication completion

---

## API Endpoints

### User Authentication
- POST /api/auth/login - User login
- GET /api/auth/verify - Verify session

### Patient Management
- GET /api/patients - Get all patients
- POST /api/patients - Create new patient
- GET /api/patients/:id - Get patient details
- PUT /api/patients/:id - Update patient
- DELETE /api/patients/:id - Remove patient (cascades medications)

### Medication Management
- GET /api/medications/:patientId - Get patient medications
- POST /api/medications - Add medication
- PUT /api/medications/:id - Update medication status
- DELETE /api/medications/:id - Remove medication

### Caregiver Operations
- GET /api/caregivers - Get caregiver list
- GET /api/caregivers/schedule/:id - Get assigned schedule
- POST /api/caregivers/markdone - Mark medication as completed

### Reports
- GET /api/reports/adherence - Medication adherence report
- GET /api/reports/activity - Care activity log

---

## Database Schema

### Main Tables

*users* - User credentials and roles
*patients* - Patient information
*medications* - Medication records
*schedules* - Medication schedules
*caregivers* - Caregiver assignments
*activity_logs* - Care activity tracking

### Key Features
- Foreign key relationships
- Cascading deletes (patient deletion removes all related records)
- Indexed queries for performance
- Redis caching for schedule queries

---

## Docker Compose Services

### Services Running

1. *MySQL (Database)*
   - Port: 3306
   - Initializes schema on first run
   - Persists data in volume

2. *Redis (Cache)*
   - Port: 6379
   - Configuration: redis.conf
   - Caches patient schedules

3. *Backend (Node.js)*
   - Port: 3001
   - Express server
   - Connects to MySQL and Redis

4. *Frontend (React)*
   - Port: 3000
   - React development server
   - Hot-reload enabled

---

## Testing Checklist

- [ ] Login with all three roles (Admin, Caregiver, Patient)
- [ ] Admin: Add patient and verify in list
- [ ] Admin: Remove patient and verify cascade deletion
- [ ] Caregiver: View assigned patients
- [ ] Caregiver: Mark medication as done and verify status update
- [ ] Patient: View personal schedule and medications
- [ ] Patient: Check medication reminders
- [ ] Verify Docker logs show MySQL, Redis, Backend, Frontend connections
- [ ] Test data isolation with different patient IDs
- [ ] Verify Redis cache in logs (SETEX/GET operations)

---

## Troubleshooting

### Port Already in Use
bash
# Kill process on specific port (e.g., 3000)
lsof -ti :3000 | xargs kill -9


### Docker Build Issues
bash
# Clean rebuild
docker-compose down -v
docker system prune -a
docker-compose up --build


### Database Connection Errors
- Check MySQL is ready (logs should show "Ready for connections")
- Wait full 2-5 minutes before accessing UI
- Verify docker-compose.yml port mappings

### Redis Connection Issues
- Verify redis.conf is mounted correctly
- Check Docker logs: docker-compose logs redis
- Ensure port 6379 is available

---

## Future Enhancements

- Mobile app for patients and caregivers
- SMS/Email notifications for reminders
- Wearable device integration
- AI-powered health predictions
- Video consultation support
- Advanced analytics and reporting
- Integration with hospital ERP systems

---

## Development Notes

- All services run in isolated Docker containers
- Data persists between container restarts (unless volumes are deleted)
- MySQL credentials: User=root, Password from docker-compose.yml
- Redis has no authentication by default (local network only)

---

## License

This project is open-source and available under the MIT License.

## Support

For issues or questions, please open an issue on GitHub or contact the development team.
