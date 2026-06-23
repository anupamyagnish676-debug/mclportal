# Mahanadi Coalfields Limited (MCL) Internship Portal

A secure, role-based enterprise web application designed to digitalize, streamline, and audit the end-to-end internship workflow for the Human Resource Development (HRD) department and Area Training Offices at Mahanadi Coalfields Limited.

---

## 🚀 Key Features

### 1. Unified Student Onboarding
* **LOR Forwarding:** Employees can submit Letters of Recommendation (LOR) for students.
* **Inline Creation:** Local Area Admins can review approved applications and register student accounts directly on the Applications dashboard.
* **Merged Notifications:** The system sends a single combined **Joining & Portal Login Credential Email** containing temporary login details and placement information, minimizing administrative friction.

### 2. Multi-Role Portals
* **Student Intern Portal:** Log daily work (Logbook), submit leave applications, upload assignment solutions, read study materials, and download final certificates.
* **Project Mentor Portal:** Manage assigned interns, mark daily attendance within the internship date range, upload study materials, grade assignments, and approve certificate requests.
* **Area Admin Portal:** Review/approve forwarded LOR submissions, register students, and track active interns in the local Area.
* **Global HQ Admin Portal:** Coordinate overall placements, manage departments, bulk-onboard cohorts, and manage system-wide settings.
* **Employee Portal:** Submit student referrals (LOR) and monitor their screening status.

### 3. Digital Signatures & Dynamic Certificates
* **Drawing Pad Canvas:** Mentors and Admins can draw and save their digital signatures in their account settings.
* **Dynamic Generation:** Certificates are generated programmatically on the server side using `pdf-lib` to embed:
  * Dynamic student details and project title.
  * Three signature lines (Project Mentor, Area Training Officer, and General Manager HRD).
  * A center-bottom **Verification QR Code** linking back to the portal.
* **Tamper-Proof Verification:** Scanning the QR code reads the certificate's unique UUIDv4 from the PostgreSQL database in real-time, instantly exposing any manual text modifications made to the PDF.

### 4. Separate Certificate Tracker
* Dedicated **Issue Certificate** dashboard separates certificate generation, downloads, and re-issuances from the general intern account access list (Activate/Delete).

---

## 🛠️ Technology Stack

* **Frontend:** Next.js 14 (React)
* **Styling:** Tailwind CSS & Custom Glassmorphism UI
* **Database & Auth:** Supabase (PostgreSQL)
* **Storage:** Supabase Storage Buckets (for LORs, reports, and certificates)
* **SMTP Service:** NodeMailer (Google App Passwords)
* **PDF Compiler:** pdf-lib

---

## ⚙️ Configuration Setup

To run this application, you must create a `.env.local` file in the root directory. 

### Required Keys (Template):
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# SMTP Email Configuration
GMAIL_USER=YOUR_SENDER_GMAIL_ADDRESS
GMAIL_PASS=YOUR_GMAIL_APP_PASSWORD_16_CHARS
```

*Note: Never commit your actual keys or credentials to version control.*

---

## 💻 Local Development

### 1. Installation
Install the project dependencies using npm:
```bash
npm install
```

### 2. Run Development Server
Start the Next.js development server:
```bash
npm run dev -- -p 3001
```
Open [http://localhost:3001](http://localhost:3001) in your browser to view the application.

### 3. Production Compilation
Compile and optimize the application for production:
```bash
npm run build
```

### 4. Start Production Server
Launch the compiled production build:
```bash
npm start
```
