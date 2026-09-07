NAVEEN ENTERPRISES — V8 FULL-STACK

Customer website: http://localhost:3000/
Admin panel:     http://localhost:3000/admin/

Backend: Node.js built-in HTTP server + SQLite database.
Node requirement: 22.5+.

Start:
1. Install Node.js 22.5+.
2. Open this folder in terminal.
3. Run: node server.js
   or double-click START_V8.bat on Windows.

Default demo credentials:
Username: admin
Password: change-me-now

IMPORTANT:
Change ADMIN_PASS before real deployment:
Windows CMD:
  set ADMIN_PASS=YourStrongPassword
  node server.js

V8 features:
- Separate customer website and admin panel.
- Real SQLite database, not localStorage.
- Product CRUD.
- Gallery CRUD.
- Enquiry storage.
- Hero color settings.
- Customer website reads live API data.
- Responsive admin UI.

For public hosting, deploy the Node app to a Node-capable server and put the customer
site and admin under separate routes/subdomains. Use HTTPS and a strong admin password.
