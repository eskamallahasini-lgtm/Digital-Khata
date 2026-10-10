# Digital Khata

**Simple Credit. Clear Records.**

Digital Khata is a full-stack web application that replaces the paper credit notebook ("khata") used by small shopkeepers. A shopkeeper can register, add customers, record what each customer owes and pays, and see at a glance who is overdue, who is due today and who will be due soon. Payments are matched to the oldest credit first (FIFO), so the app always knows exactly how much of each credit is still unpaid.

> Team: _[Team member 1]_, _[Team member 2]_, _[Team member 3]_, _[Team member 4]_ (replace with your names and roll numbers)

---

## Table of contents

1. [Problem and solution](#problem-and-solution)
2. [Features](#features)
3. [Tech stack](#tech-stack)
4. [System architecture](#system-architecture)
5. [Project structure](#project-structure)
6. [Getting started](#getting-started)
7. [Environment variables](#environment-variables)
8. [API reference](#api-reference)
9. [How balances, FIFO and reminders work](#how-balances-fifo-and-reminders-work)
10. [Database design](#database-design)
11. [Security](#security)
12. [Testing checklist](#testing-checklist)
13. [Troubleshooting](#troubleshooting)
14. [Known limitations and future scope](#known-limitations-and-future-scope)
15. [License](#license)

---

## Problem and solution

**Problem.** Small shops in India give goods on credit every day. The records live in a paper notebook, which gets lost, damaged, mis-added or disputed. There is no way to see total dues quickly, no reminder when a payment is late, and no proof to show a customer.

**Solution.** Digital Khata is a simple, mobile-friendly ledger that keeps every credit and payment in a database, calculates balances automatically, and highlights overdue payments so the shopkeeper can follow up in time.

---

## Features

### Core features

| Feature | Description |
|---------|-------------|
| Shopkeeper accounts | Register and log in with a 10-digit phone number and password. Passwords are hashed with bcrypt and sessions use JWT. |
| Customer management | Add customers and search by name or phone number. Phone numbers are unique per shopkeeper. |
| Credit ledger | Record **You Gave** (credit) and **You Got** (payment) entries with amount, note, entry date and an optional due date. |
| Running balance | Every ledger row shows the balance after that entry. |
| FIFO payment allocation | Payments are applied to the oldest credit first, so each credit shows its remaining unpaid amount. |
| Automatic reminders | Unpaid credit with a due date is marked overdue, due today or upcoming, nearest due date first. |
| Dashboard | Total outstanding, number of customers, overdue and upcoming counts, customer list and a reminders preview. |
| Data isolation | A shopkeeper can only ever see their own customers and transactions. |
| Responsive design | Works on desktop and phone; the sidebar becomes a slide-in menu on small screens. |

### Enhancements

| Feature | Description |
|---------|-------------|
| WhatsApp reminder button | Opens WhatsApp with a ready-written message to the customer. No paid API needed. |
| Edit customer / edit entry | Fix mistakes without deleting and re-entering. |
| Undo delete | Deleted entries can be restored for 6 seconds. |
| Printable statement | Print or save a customer statement as PDF from the ledger page. |
| Customer-wise totals | Reminders page groups unpaid amounts by customer. |
| Collect-today card | Dashboard card and filter for everything overdue or due today. |
| Risk tag | "Reliable", "Sometimes late" or "Often late", worked out from payment history. |
| Monthly chart | Credit given vs payments received for the last 6 months. |
| Language switch | English, Hindi and Telugu for the main screens. |
| CSV export | Download your own customers and entries as a spreadsheet backup. |
| Change password | Available from the Settings page. |
| Rate limiting and secure headers | `express-rate-limit` on login/register and `helmet` on all responses. |
| Installable web app (PWA) | Manifest and service worker so it can be added to a phone home screen. |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, React Router, Vite, plain CSS (custom design system) |
| Backend | Node.js, Express |
| Database | SQLite via `better-sqlite3` |
| Authentication | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` |
| Security | `helmet`, `express-rate-limit`, CORS allow-list |
| Tools | VS Code, npm, Git, a browser's developer tools |

---

## System architecture

```
┌──────────────────────┐    HTTPS / JSON     ┌────────────────────────────┐    SQL     ┌──────────────┐
│  React client (Vite) │ ──────────────────▶ │  Express REST API          │ ─────────▶ │   SQLite     │
│  pages, components,  │  Authorization:     │  helmet · CORS · rate limit│            │  khata.db    │
│  AuthContext, api.js │  Bearer <JWT>       │  auth middleware (JWT)     │ ◀───────── │ users        │
│                      │ ◀────────────────── │  routes + ledger.js logic  │   rows     │ customers    │
└──────────────────────┘   { success, data } └────────────────────────────┘            │ transactions │
                                                                                         └──────────────┘
```

1. The browser sends a request through `client/src/services/api.js`, attaching the JWT.
2. Express applies security middleware, then `auth.js` verifies the token and sets `req.userId`.
3. The route validates the input and queries SQLite using prepared statements.
4. Balances, FIFO remaining amounts and reminder status are **calculated on every request** from the stored transactions, so they are always consistent.
5. The API replies with `{ "success": true, "data": ... }` or `{ "success": false, "message": "..." }`.

---

## Project structure

```
digital-khata/
├── README.md
├── .gitignore
├── server/
│   ├── app.js                    # Express app, middleware, route mounting
│   ├── package.json
│   ├── .env.example
│   ├── database/db.js            # SQLite connection and table creation
│   ├── middleware/auth.js        # JWT verification
│   ├── utils/ledger.js           # money, dates, FIFO, reminders, risk tag
│   └── routes/
│       ├── auth.js               # register, login, change password
│       ├── customers.js          # list/search, add, edit, ledger, add transaction
│       ├── transactions.js       # edit and delete transaction
│       └── summary.js            # dashboard summary, reminders, monthly, CSV export
└── client/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── .env.example
    ├── public/                   # favicon, manifest.webmanifest, sw.js, icons
    └── src/
        ├── main.jsx, App.jsx, index.css
        ├── context/              # AuthContext, LanguageContext
        ├── i18n/translations.js  # English / Hindi / Telugu text
        ├── services/             # api.js, format.js
        ├── components/           # Logo, Layout, ProtectedRoute, Spinner, Toast,
        │                         # ConfirmDialog, PasswordInput, DueBadge, CustomerRow,
        │                         # AddCustomerModal, EditCustomerModal,
        │                         # TransactionModal, RiskBadge, MonthlyChart
        └── pages/                # Login, Register, Dashboard, Customers,
                                  # CustomerLedger, Reminders, Settings
```

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) LTS (v18 or newer)
- VS Code or any code editor

### 1. Backend (terminal 1)

```powershell
cd server
copy .env.example .env          # macOS/Linux: cp .env.example .env
npm install express cors dotenv bcryptjs jsonwebtoken better-sqlite3 helmet express-rate-limit
npm start
```

Expected output: `Digital Khata server running at http://localhost:5000`
Health check: http://localhost:5000/api/health → `{"success":true,"data":{"status":"ok"}}`

### 2. Frontend (terminal 2)

```powershell
cd client
npm install react react-dom react-router-dom
npm install -D vite @vitejs/plugin-react
npm run dev
```

Open http://localhost:5173, choose **Create an account**, and start using the app.

Next time, only the two start commands (`npm start` and `npm run dev`) are needed.

---

## Environment variables

**server/.env**

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Server port | `5000` |
| `JWT_SECRET` | Secret used to sign tokens (**required**, use a long random text) | none |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `CLIENT_URL` | Allowed frontend origin for CORS | `http://localhost:5173` |

**client/.env** (optional)

| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:5000/api` |

---

## API reference

All responses use `{ "success": true, "data": ... }` or `{ "success": false, "message": "..." }`.
Every route except `/api/auth/register`, `/api/auth/login` and `/api/health` needs the header `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/register` | Create a shopkeeper account |
| POST | `/api/auth/login` | Log in and receive a token |
| PUT | `/api/auth/password` | Change password |
| GET | `/api/customers?q=` | List or search customers with balances and risk tag |
| POST | `/api/customers` | Add a customer |
| PUT | `/api/customers/:id` | Edit a customer |
| GET | `/api/customers/:id/ledger` | Ledger with running balance and remaining unpaid amounts |
| POST | `/api/customers/:id/transactions` | Add a credit or payment |
| PUT | `/api/transactions/:id` | Edit a transaction |
| DELETE | `/api/transactions/:id` | Delete a transaction |
| GET | `/api/summary` | Dashboard totals and reminder preview |
| GET | `/api/reminders` | All pending reminders |
| GET | `/api/monthly` | Last 6 months of credit vs payments |
| GET | `/api/export` | CSV export of the logged-in shopkeeper's data |
| GET | `/api/health` | Server health check |

---

## How balances, FIFO and reminders work

- **Balance** = total credit given − total payments received. Positive means the customer owes money.
- **FIFO rule.** All payments of a customer form one pool. The pool is applied to that customer's credit entries oldest first (by entry date, then id). What remains on each credit is its *remaining unpaid amount*.
- **Example.** Credits of ₹500 (1 Oct), ₹300 (5 Oct), ₹200 (9 Oct) and a payment of ₹600. The first credit is fully paid, the second has ₹200 remaining, the third has ₹200 remaining.
- **Reminders** list only credits that have a due date and a remaining amount above zero. Status is *overdue* (due date passed), *due today* or *upcoming*.
- **Risk tag.** For credits with due dates, the app checks whether each was settled after its due date. With at least 2 such credits: none late → Reliable, fewer than half late → Sometimes late, half or more → Often late.
- Everything is recalculated from the database on each request, so editing or deleting an entry updates all balances and reminders automatically.

---

## Database design

SQLite file `server/database/khata.db`, created automatically on first start.

| Table | Columns | Notes |
|-------|---------|-------|
| `users` | id, shop_name, phone (unique), passwordHash | One row per shopkeeper |
| `customers` | id, user_id → users, name, phone, created_at | Phone unique per shopkeeper; deleted with the user |
| `transactions` | id, customer_id → customers, type (`credit`/`payment`), amount (> 0), note, entry_date, due_date | Deleted with the customer |

Foreign keys are enforced, and indexes exist on `user_id`, `customer_id` and `due_date`.

To reset all data: stop the server and delete `khata.db`, `khata.db-shm` and `khata.db-wal`.

---

## Security

- Passwords are hashed with bcrypt; plain passwords are never stored.
- The user id always comes from the verified JWT, never from the request body.
- Every query joins through `user_id`, so one shopkeeper cannot read or change another's data.
- Inputs are validated on both client and server (phone format, amount > 0, valid dates, length limits).
- All SQL uses prepared statements (protection against SQL injection).
- `helmet` sets secure HTTP headers; login and register are limited to 30 attempts per 15 minutes per IP.
- CSV export neutralises cells starting with `=`, `+`, `-` or `@` so spreadsheets never run them as formulas.
- CORS only allows the configured frontend origin.

---

## Testing checklist

| Test | Expected result |
|------|-----------------|
| Register with a 10-digit phone | Account created, redirected to dashboard |
| Register the same phone again | "already registered" error |
| Add a customer with a duplicate phone | Error shown |
| Add a credit with a past due date | Appears under Reminders as overdue |
| Add a payment smaller than the credit | Remaining unpaid amount drops; still listed |
| Add a payment that covers the credit | Credit disappears from Reminders |
| Delete an entry | Row hides with Undo; balances update after 6 seconds |
| Edit an entry | Balance and reminders recalculate |
| Switch language | Main screens change; choice persists after refresh |
| WhatsApp reminder | WhatsApp opens with the customer's number and message |
| Download statement | Print dialog opens; save as PDF |
| Export CSV | File downloads and opens in Excel |
| Log in as a second shopkeeper | Sees none of the first shopkeeper's data |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `JWT_SECRET is missing` | Copy `.env.example` to `.env` inside `server`, then restart |
| "Cannot connect to the server" | Start the backend and open `/api/health` |
| CORS error | Make `CLIENT_URL` match the browser address and restart the backend |
| Port 5000 in use | Change `PORT` in `server/.env` and set `VITE_API_URL` in `client/.env` |
| `Cannot find module 'helmet'` | Run `npm install helmet express-rate-limit` in `server` |
| `better-sqlite3` install fails | Use the latest Node LTS, delete `server/node_modules`, reinstall |
| Blank page | Press F12, read the red console error, check for an unsaved or half-pasted file |

---

## Known limitations and future scope

- Only the main screens are translated into Hindi and Telugu; the remaining text is still English.
- SQLite is ideal for a prototype and a single shop; a hosted database (PostgreSQL) is better for many shops.
- Reminders are sent by opening WhatsApp manually; automatic SMS/WhatsApp sending needs a paid provider.
- No forgot-password flow yet (needs OTP over SMS).
- Planned: automatic reminders, multiple staff accounts per shop, product-wise billing, cloud deployment and a mobile app.

---

## License

MIT

