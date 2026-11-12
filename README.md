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
| Admin | `admin` | Create teams and users, assign leads and assistants, edit criteria and points, view everything, override or reverse any approval, reports and Excel export |
| Team Lead | `teamLead` | Manage own team, approve or reject member entries and team monthly points for **own team only**. Cannot submit team points |
| Team Assistant | `teamAssistant` | Data entry for own team: attendance, late marks, referral and one-to-one counts, submit team monthly points. Cannot approve |
| Member | `member` | View own points and penalties, upload proof photos, view leaderboard |

Every API route must check the user's role (role-based access control) using `auth` and `roleCheck` middleware. A lead or assistant can only access data of their own team.

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
  submittedBy (assistant), approvedBy (team lead or admin), approvedAt
```

---

## 4. Database Collections

- **User**: name, phone, password (hashed), role, team
- **Team**: name, lead, assistant, members[]
- **Criteria**: see above
- **PointEntry**: member-level points and penalties
- **TeamPointEntry**: team-level monthly and one-time points
- **Meeting**: date, weekNumber, attendance list (present, late, absent, left early)
- **Notification** (optional): approval and rejection messages

---

## 5. Approval Flows

**Member entries (meeting day and non-meeting day)**
1. Assistant or member submits an entry. Status is `pending`.
2. Team Lead approves or rejects.
3. Points count only after approval.

**Team monthly and one-time points**
1. Assistant submits (with proof where required). Status is `pending`.
2. Team Lead of the same team approves or rejects.
3. Admin can override or reverse any approval at any time.
4. Every approval stores `approvedBy` and `approvedAt` for audit.

---

## 5.1 Meeting Day Flow

1. Assistant marks each member as present, late or absent.
2. The app auto-creates penalties (for example, late after 7:59 AM and absent for the weekly meeting).
3. Assistant ticks the activities done (Early Bird, Full Attire, visitors count, and so on).
4. Lead reviews and approves.

---

## 6. Game Criteria (seed data from the official PDF)

### Meeting Day Activities (member level)

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
| Photo of your specific ask sheet (with name) | 20 | Per Member |
| Training | 50 | Per Member |
| Connecting Specific Ask | 20 | Per Member / Per Specific Ask |

### Non-Meeting Day Activities (member level)

| Activity | Points | Basis |
|---|---|---|
| Early Morning Health Activity (selfie), min. 4 days per week | 20 | Per Member |
| Know Our Member Meeting (group photo) | 20 | Per Member |
| WhatsApp Status Promotion | 20 | Per Member |
| Power Team Meeting | 20 | Per Member |
| Team Sports with Members | 20 | Per Member |
| Team Outing (with your team members only) | 25 | Per Member |
| Tea sapda polama? Min. 4 members (team members only) | 25 | Per Member |
| Attending Cross Chapter Meeting (Observer) | 30 | Per Member |
| Posting Success Story message in BNI Kadambas main group | 100 | Per Member |
| Sunday selfie with family | 20 | Per Member |

### Monthly Points (team level, 1,000 each, total 5,000)

- Kitty fee on time payment
- MSP Completion
- New Member sponsor
- Full Present with whole team
- Traffic light Green Score

### One Time Bonus Points (team level, 1,000 each, total 5,000)

- 100% BNI Connect updation
- 100% Contact Save in WhatsApp
- 121 Dance Card Submission
- Completing passport to success
- Following Kadambas social media page

### Negative Points (penalties)

| Frequency | Criteria | Points | Basis |
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
- **Lead screen**: pending approvals with two tabs (Member entries, Team monthly points)
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

FILE RULES (strict):
- Only edit or create the files needed for this task. Do not create any other file: no docs, summaries, notes, test files, sample files, backups or duplicates.
- Edit existing files instead of making new versions of them.
- Do not touch files unrelated to this task.
- If you think a new file is needed, tell me the file name and why, and wait for my approval first.
- When finished, list every file you changed or created.