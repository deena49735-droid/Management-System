# Kadambas Game Management System

A MERN-stack web application to run the **Kadambas Game**, a points game where members and teams earn points for good activities and lose points for penalties. The app records activities, calculates points automatically, handles approvals, and shows leaderboards.

> **Note for the AI agent:** Read this whole file before writing code. Build one phase at a time, and only when asked. Do not hardcode point values anywhere.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), React Router, Tailwind CSS, Axios, Recharts |
| Backend | Node.js, Express, JWT auth, bcrypt, Multer |
| Database | MongoDB Atlas with Mongoose |
| Image storage | Cloudinary |
| Scheduled jobs | node-cron |
| Reports | exceljs |

The UI must be **mobile-first**, because most users will open it on a phone.

---

## 2. Roles and Permissions

| Role | Value in DB | Can do |
|---|---|---|
| Admin | `admin` | Create teams and users, assign team heads and assistants, edit criteria and points, view everything, override or reverse any approval, reports and Excel export |
| Team Head | `teamHead` | Manage own team, approve or reject member entries and team monthly points for **own team only**. Cannot submit team points |
| Team Assistant | `teamAssistant` | Data entry for own team: attendance, late marks, referral and one-to-one counts, submit team monthly points. Cannot approve |
| Member | `member` | View own points and penalties, upload proof photos, view leaderboard |

Every API route must check the user's role (role-based access control) using `auth` and `roleCheck` middleware. A team head or assistant can only access data of their own team.

---

## 3. Core Design Rules

### Rule 1: Points are never hardcoded
All point values live in the **Criteria** collection, so the admin can change them without editing code.

```
Criteria
  name          "Early Bird @ 7:25 AM"
  category      meeting_day | non_meeting_day | monthly | one_time | penalty
  points        20            (negative for penalties)
  basis         per_member | per_team | per_visitor | per_testimonial | per_specific_ask
  frequency     weekly | monthly | one_time
  needsProof    true | false
  isActive      true | false
```

### Rule 2: Points ledger (like a bank passbook)
Every earned or lost point creates **one entry**. Totals are always calculated by summing **approved** entries. Never edit a total directly. To fix a mistake, reject or reverse the entry.

```
PointEntry (member-level)
  member, team, criteria
  quantity      e.g. 2 visitors
  points        criteria.points x quantity
  date, weekNumber, month, year
  proofImage    Cloudinary URL (if needed)
  status        pending | approved | rejected
  enteredBy, approvedBy, approvedAt

TeamPointEntry (team-level: monthly and one-time)
  team, criteria, points, month, year
  proofImage
  status        pending | approved | rejected
  submittedBy (assistant), approvedBy (team head or admin), approvedAt
```

---

## 4. Database Collections

- **User**: name, username (used to log in), phone (contact only), password (hashed), role, team
- **Team**: name, head (the Team Head), assistant, members[]
- **Criteria**: see above
- **PointEntry**: member-level points and penalties
- **TeamPointEntry**: team-level monthly and one-time points
- **Meeting**: date, weekNumber, attendance list (present, late, absent, left early)
- **Notification** (optional): approval and rejection messages

---

## 5. Approval Flows

**Member entries (meeting day and non-meeting day)**
1. Assistant or member submits an entry. Status is `pending`.
2. Team Head approves or rejects.
3. Points count only after approval.

**Team monthly and one-time points**
1. Assistant submits (with proof where required). Status is `pending`.
2. Team Head of the same team approves or rejects.
3. Admin can override or reverse any approval at any time.
4. Every approval stores `approvedBy` and `approvedAt` for audit.

---

## 5.1 Meeting Day Flow

1. Assistant marks each member as present, late or absent.
2. The app auto-creates penalties (for example, late after 7:59 AM and absent for the weekly meeting).
3. Assistant ticks the activities done (Early Bird, Full Attire, visitors count, and so on).
4. Team Head reviews and approves.

---

## 6. Game Criteria (exact structure of the official PDF)

The app must show and store the criteria in exactly this structure, order, wording and points. Every row has a display order and a `basisLabel` (the Basis text exactly as printed). Category totals are calculated from the active rows, and they are the maximum if each activity is earned once.

### 6.1 Meeting Day Activities (member level, category `meeting_day`)

| Activity | Points | Basis |
|---|---|---|
| Early Bird @ 7:25 AM | 20 | Per Member |
| Highest Giver | 50 | Per Member |
| Highest Referral | 50 | Per Member |
| Highest One-to-One | 50 | Per Member |
| Full Attire (Tie + Pin + Badge) | 10 | Per Member |
| Best 30-Second Presentation | 20 | Per Member |
| Best Attire | 20 | Per Member |
| Star of the Week | 20 | Per Member |
| Bringing Visitors | 50 | Per Member / Per Visitor |
| 30 Sec theme presentation | 20 | Per Member |
| Physical Testimonials | 200 | Per Member / Per Testimonial |
| Take a photo of your specific ask sheet (With Name) | 20 | Per Member |
| Training | 50 | Per Member |
| Connecting Specific Ask | 20 | Per Member / Per Specific Ask |
| **TOTAL, Meeting Day Activities** | **600** | |

### 6.2 Non-Meeting Day Activities (member level, category `non_meeting_day`)

| Activity | Points | Basis |
|---|---|---|
| Early Morning Health Activity (Put Selfie) Min. 4 Days Per Week | 20 | Per Member |
| Know Our Member Meeting (Group Photo) | 20 | Per Member |
| Whatsapp Status Promotion | 20 | Per Member |
| Power Team Meeting | 20 | Per Member |
| Team Sports with Members | 20 | Per Member |
| Team Outing (With Your Team Members Only) | 25 | Per Member |
| Tea sapda polama? Min. 4 Members (With Your Team Members Only) | 25 | Per Member |
| Attending Cross Chapter Meeting (Observer) | 30 | Per Member |
| Posting Success Story message in BNI Kadambas main Group | 100 | Per Member |
| Sunday selfie with family | 20 | Per Member |
| **TOTAL, Non-Meeting Day Activities** | **300** | |

### 6.3 Monthly Points (team level, category `monthly`)

| Activity | Points | Basis |
|---|---|---|
| Kitty fee on time payment | 1,000 | Per Team |
| MSP Completion | 1,000 | Per Team |
| New Member sponsor | 1,000 | Per Team |
| Full Present with whole team | 1,000 | Per Team |
| Traffic light Green Score | 1,000 | Per Team |
| **TOTAL, Monthly Points** | **5000** | |

### 6.4 One Time Bonus Points (team level, category `one_time`)

| Activity | Points | Basis |
|---|---|---|
| 100% BNI Connect updation | 1,000 | Per Team |
| 100% Contact Save in Whatsapp | 1,000 | Per Team |
| 121 Dance Card Submission | 1,000 | Per Team |
| Completing passport to success | 1,000 | Per Team |
| Following Kadambas social media page | 1,000 | Per Team |
| **TOTAL, One Time Bonus Points** | **5000** | |

### 6.5 Negative Points Criteria (member level, category `penalty`, grouped by Frequency)

| Frequency | Negative Points Criteria | Penalty Points | Basis |
|---|---|---|---|
| Weekly | Late after 7:59 AM | -100 | Per Member |
| Weekly | Absent for Weekly BNI Meeting | -100 | Per Member |
| Weekly | Missing Pin & Badge | -100 | Per Member |
| Weekly | Absent for Power Team Meeting | -100 | Per Member |
| Weekly | 0 Referral for the Week | -50 | Per Member |
| Weekly | 0 One-to-One for the Week | -50 | Per Member |
| Weekly | Walking Out During Meeting | -300 | Per Member |
| Monthly | Kitty Fee Unpaid Before 15th | -500 | Per Member / Per Week |
| Monthly | MSP Incomplete | -1000 | Per Member / Per Month |
| Monthly | Traffic Light Score - Grey | -3000 | Per Member |
| Monthly | Traffic Light Score - Red | -1000 | Per Member |

Total criteria rows: 14 + 10 + 5 + 5 + 11 = 45.

---

## 7. Automatic Penalties (node-cron)

Scheduled jobs create penalty entries, for example:
- 0 referrals in the week: -50
- 0 one-to-ones in the week: -50
- Kitty fee unpaid before the 15th: -500

Traffic light Grey or Red is entered monthly by the admin.

---

## 8. Screens

- **Login**
- **Member dashboard**: total points, this week's points, penalties, upload proof
- **Leaderboard**: team ranking and top members, filter by week or month
- **Assistant screen**: attendance sheet and quick-entry form, submit team points
- **Team Head screen**: pending approvals with two tabs (Member entries, Team monthly points)
- **Admin panel**: users, teams, criteria, reports, Excel export

---

## 9. Folder Structure

```
Management System/
├── README.md
├── server/
│   ├── models/        (User, Team, Criteria, PointEntry, TeamPointEntry, Meeting)
│   ├── routes/        (auth, users, teams, criteria, entries, leaderboard)
│   ├── controllers/
│   ├── middleware/    (auth.js, roleCheck.js)
│   ├── jobs/          (weeklyPenalties.js, monthlyPenalties.js)
│   ├── seed/          (criteria seed script)
│   ├── .env
│   └── server.js
└── client/
    └── src/
        ├── pages/     (Login, Dashboard, Leaderboard, Approvals, Admin)
        ├── components/
        ├── context/   (AuthContext)
        └── api/
```

---

## 10. Build Phases

Build **one phase at a time**. Wait for confirmation before starting the next.

1. **Phase 1**: Backend setup, User and Team models, JWT login, role middleware
2. **Phase 2**: Frontend setup, Login page, AuthContext, protected routes by role
3. **Phase 3**: Admin: users and teams CRUD
4. **Phase 4**: Criteria model, seed script, PointEntry and TeamPointEntry with approval flow
5. **Phase 5**: Leaderboard using MongoDB aggregation (sum approved points per member and team)
6. **Phase 6**: Photo upload (Cloudinary), attendance sheet, automatic penalties (node-cron)
7. **Phase 7**: Reports, Excel export, notifications, mobile polish

---

## 11. Coding Rules for the Agent

- Keep secrets (MongoDB URI, JWT secret, Cloudinary keys) in `.env`. Never commit `.env`.
- Hash passwords with bcrypt. Never return the password field in API responses.
- Validate all inputs on the server.
- Use clear folder separation: routes call controllers, controllers hold the logic.
- This is a real project for real users. Write clean, maintainable, production-quality code with clear comments where logic is not obvious.
- Handle errors properly (try/catch, consistent error responses) and never expose stack traces to the client.
- Add rate limiting and basic security headers (helmet) before going live.
- **Do not create any file that was not asked for or is not strictly needed for the current phase.** No extra documentation, summary or notes files, no sample or test files, no duplicate files, no unused components, and no extra folders.
- Before creating a new file, first list the files you plan to create and wait for approval if it is not in the folder structure above.
- Edit existing files instead of creating new versions of them.
- Do not delete, rename or rewrite files from earlier phases unless the current prompt says so.
- After each phase, explain how to run and test it.

---

## 12. Naming Rule

The role is called **Team Head** everywhere: screens, buttons, menus, messages, API paths, route paths, database values, field names, variable and file names. The role value in the database is `teamHead`, the Team model field is `head`, the API path is `/api/teams/:id/head`, and the client route is `/head`. Never use "Team Lead", "teamLead" or "lead" for this role anywhere in the code.

The app has exactly four dashboards: Admin, Team Head, Team Assistant and Member.

---

## 13. Login Rule

Users log in with **username and password**. The phone number is only a contact detail and is never used to log in. Usernames are stored in lowercase, are unique, 3 to 30 characters, and may contain only lowercase letters, digits, dot and underscore. The admin creates users and sets their usernames. There is no public registration. Login errors are always generic ("Invalid username or password").

---

## 14. UI Standards

- Keep the existing colour palette. Do not introduce new brand colours. Use neutral greys plus the existing green (positive), red (negative) and amber (pending) for status.
- Professional, clean, business-style interface: consistent spacing scale, one font family, subtle shadows, consistent border radius, clear visual hierarchy.
- Mobile-first and fully responsive (360px to 1440px+). No horizontal page scroll. Tables become cards on mobile. Tap targets at least 44px.
- Reuse shared components (Button, Input, Select, Card, StatCard, Table, Badge, Modal, Tabs, EmptyState, Skeleton, Pagination). Do not copy styles into each page.
- Accessible: labels on every field, visible focus states, sufficient contrast.
- Use lucide-react icons. No emoji as icons.

---

## 15. System Architecture

- **Client**: React single page app (Vite). Role-based routes: exactly four dashboards, Admin, Team Head, Team Assistant, Member. Talks to the API only through one axios instance.
- **API**: Express REST API. Flow: route -> validation -> auth -> roleCheck (and team scope check) -> controller -> model. Central error handler.
- **Database**: MongoDB Atlas (Mongoose). Collections: User, Team, Criteria, PointEntry, TeamPointEntry, Meeting, Notification.
- **Files**: Cloudinary for proof photos (Phase 6). Only the image URL is stored in the database.
- **Jobs**: node-cron for weekly and monthly automatic penalties (Phase 6).
- **Security**: JWT, bcrypt, helmet, rate limiting on login, server-side validation, team scoping on every team-related query, secrets only in .env.
- **Data flow**: criteria (rules) -> point entries (ledger, pending/approved/rejected) -> MongoDB aggregation -> leaderboard and dashboards. Totals are never stored, they are always calculated from approved entries.
- **Indexes**: User.username (unique), Criteria.key (unique), PointEntry (status, team, year, month, weekNumber), TeamPointEntry (status, team, year, month).
- **Deployment**: client on Vercel or Netlify, API on Render or Railway, database on Atlas.