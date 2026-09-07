NAVEEN ENTERPRISES — V8 FINAL ADMIN

Customer website:
  http://localhost:3000/

Admin:
  http://localhost:3000/admin/

DEFAULT LOGIN
  Username: admin
  Password: change-me-now

IMPORTANT:
Use the Admin > Profile & Password section to change the password after first login.
The password is stored as a SHA-256 hash, not plain text.

V8 FINAL MODULES
1. Dashboard
2. Products: add, edit, hide, category, price, featured, image
3. Categories: add, edit, hide
4. Gallery: add, edit, delete, title, image URL, alt text, sort order
5. Enquiries: list and status workflow
6. Website Settings: hero colors and contact details
7. Profile & Password: profile update + change password
8. Admin Users: create admin/staff users
9. File Manager: URL-based file metadata
10. Activity Log
11. Database Backup: JSON snapshot
12. Separate customer website + admin panel
13. Shared SQLite database/API

RUN
1. Install Node.js 22.5+.
2. Open this folder in terminal.
3. Run: node server.js
   or double-click START_V8.bat.

For public production deployment, use HTTPS, set a strong ADMIN_PASS, and place
the app behind a proper reverse proxy/hosting environment.
