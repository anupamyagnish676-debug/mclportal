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

