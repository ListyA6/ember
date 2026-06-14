# Ember — Harsh QA + UX Audit (Trainer ↔ Client Pivot)

**Auditor posture:** senior product QA + UX. This is read-only; no app files were modified except this report.
**Scope:** judge every existing feature for a *non-owner* user, then map the redesign needed to become a trainer↔client ecosystem.
**Reviewed:** `store.js`, `router.js`, all 8 views, `seed.js`, `components.css`, `README.md`, `CONTRACT.md`.

---

## 1. Verdict in 3 sentences

Visually, Ember is genuinely premium — the glass/flame design system, count-ups, ring/heatmap charts, and live session/rest timers would *not* embarrass the owner in front of a stranger; it looks like a real product. But the moment a second human touches it, the illusion collapses: there is exactly **one** profile concept (`S.me`), the workout program is the owner's hardcoded personal Upper/Lower split baked into `store.PROGRAMS` + `DAY_PLAN`, and there is **no notion of a coach, an assignment, feedback, or "another person's data I'm responsible for."** Shown to a real gym client it would read as "a nice logbook that already decided what I train on Mondays," and shown to a competing trainer it would read as "a single-user demo with no coaching surface at all" — so for the *stated goal* it absolutely would embarrass him, not because it's ugly, but because it's architecturally single-tenant and the "social" framing (Feed, Goals, Badges) is cosmetic, not relational.

---

## 2. Feature-by-feature audit (rated for a NON-owner user)

Legend: **KEEP** = works as-is for any user · **REWORK** = right idea, wrong shape for two roles · **CUT** = makes sense only for the owner / actively misleads.

### Onboarding (`onboarding.js`) — **REWORK (blocker)**
Asks Name, Goal, Height, Units, then drops you on the dashboard. It never asks **"are you a coach or an athlete?"** — the single most important question in a two-role product. It also calls `store.addProfile({isMe:true})` and `completeOnboarding()` with no concept of *who invited you* or *which trainer you belong to*. A client who installs this has no way to connect to their coach; a coach has no way to declare themselves a coach. This is the first thing a stranger hits and it silently assumes "you are the only person who exists." Must branch on role and, for clients, capture a trainer link/invite code.

### Dashboard / Home (`dashboard.js`) — **REWORK**
Good bones for a *client*: greeting, today's session, steps check, this-week tiles, goals rail, recent. But it is hardwired to "me": `store.moveStreak()`, `store.programFor()`, `store.weekBars()` all default to `S.me`. For a **client** this is fine *if* "today's session" comes from an assigned plan instead of `DAY_PLAN`. For a **trainer** this home screen is wrong entirely — a coach opening the app does not care about *their own* bench PR first; they need a **roster + "who needs attention"** triage. There is currently zero trainer home. The "Today's session" card pulling from the owner's Mon/Tue/Thu/Fri split (`DAY_PLAN = {1:'upperA',2:'lowerA',4:'upperB',5:'lowerB'}`) is the clearest "this is Listy's app" tell.

### Workout logger (`workout.js`) — **REWORK (core)**
The actual logging UX is the best part of the app: live session timer, 90s rest controller that survives re-renders, per-set cells, `lastSetFor()` prefill, PR detection on finish, optional gym photo. **Keep the logging engine.** But the *program* is the owner's. `openProgramPicker()` only offers `upperA/upperB/lowerA/lowerB/rest` — five hardcoded splits from `store.PROGRAMS`. A client must train **the plan their trainer assigned**, with the trainer's exercises, set/rep targets, and notes — not pick from Listy's personal rotation. Today there is no data path for "assigned program," no `programs` collection keyed by author, and no per-exercise coaching cue. The whole `PROGRAMS`/`DAY_PLAN` constant needs to become *data* (assignable, per-client), not code.

### Feed (`feed.js`) — **CUT as-is / REWORK into a review surface**
The file header literally says *"Strava-style social feed"* but the README admits *"there's no social feed, likes, or friends."* It is a **solo log mislabeled as social.** `store.feed()` filters to a single profile; there are no kudos, comments, or other athletes — the "social" affordances are absent. For a stranger this is confusing (why call it Feed if it's just my own list?). In the two-role world, "Feed" should die as a concept and be reborn as: (a) for the **client**, "My activity" (fine, rename); (b) for the **trainer**, a **review feed of all clients' recent sessions** where each card is tappable into "leave feedback." The share-to-PNG card is a nice keepsake — keep it, but it is not coaching.

### Goals / Challenges (`challenges.js`) — **REWORK**
Internally honest (the file calls them personal "goals," no leaderboards), and the create/progress/ring UI is solid. But `createChallenge()` defaults `members:[S.me]` and `createdBy:S.me` — there is dead infrastructure for multi-member challenges that the UI never exposes. For coaching, the valuable move is **trainer-assigned goals**: the coach sets "12 workouts in June" *for a client* and watches it from the roster. Right now a client can only set goals for themselves and the trainer can't see or set them. Rework so a goal has an `assignedBy` (trainer) vs `setBy` (self) distinction and shows up on the trainer's client drill-down.

### Badges (`store.BADGES` + `profile.js`) — **CUT (or demote hard)**
Twelve gamification badges (First Spark, Inferno, Forged, Champion…). For a self-motivated owner, fun. For a **client being coached**, near-worthless — a client's motivation is the coach's feedback and visible progress, not "Dawn Patrol." For a **trainer**, badges are noise. They also create a credibility risk: a paying client who opens the app and sees cartoon achievement medals before they see their coach's plan will read the product as a toy. Demote to a tiny optional strip, or cut for the coaching context and keep only behind a "fun stats" area.

### Stats (`stats.js`) — **KEEP (reframe per role)**
Totals, weight trend, 8-week volume, 17-week heatmap, this-week, PR table. This is genuinely the screen a coach *needs* — but it's currently only ever rendered for `S.me`. The data and charts are exactly right; the gap is purely that there's no way to view **a client's** stats as the trainer. `personalRecords(pid)`, `volumeSeries(pid)`, `heatmap(pid)` already take a `pid` argument — the plumbing exists, the entry point doesn't. High-leverage: this becomes the per-client drill-down with almost no chart rework.

### Profile (`profile.js`) — **REWORK**
File comment says *"your athlete page (and friends')"* and routes `/profile/:id` — but nothing ever links to another id, and edit/goal/export are all `isMe`-gated. It's a single-user page pretending to support others. For coaching: the trainer needs `/profile/:clientId` to actually resolve to *that client's* header, stats, assigned plan, goals, and progress photos. The bones (`profile(id)`, stat strip taking `pid`) are there; the role wiring is not.

### Settings → Data: Export / Backup / Sync (`settings.js`, `store.js`) — **REWORK**
`exportJSON()` / `exportProfile()` / `importProfile()` and the `fit.sidestudio.id` sync hook are built for *one device, one person, hand-the-file-to-Claude.* `importProfile()` even hardcodes `p.isMe = false` — a fossil of a half-imagined "import a friend" idea that no UI reaches. In a real trainer↔client product the data has to **sync to a shared backend** so the coach sees the client's sessions without anyone emailing a JSON file. The current localStorage-only model is the deepest architectural blocker to the whole pivot: **two people on two phones cannot see each other's data at all today.**

### Sharing / PNG cards (`share.js` via feed/detail) — **KEEP**
Branded share card is a legitimate, low-cost delight and works for any user. No change needed beyond not calling the surface it lives in "social."

---

## 3. The role model (concrete)

Today the entire app keys off a single `S.me` and `store.meId()`. The pivot requires a real identity split at login. Minimum viable model:

- **Account/auth** with a `role: 'trainer' | 'client'`.
- **Relationship edge:** `client.trainerId` (a client belongs to one coach); `trainer` owns many clients.
- **Shared backend** (the localStorage model cannot support two devices seeing one dataset — this is non-negotiable for the pivot).
- **Program as data, not code:** a `programs` collection (`{id, authorId, name, days:[{exercises:[{name,sets,reps,cue}]}]}`) and an **assignment** (`{clientId, programId, schedule}`) replacing the hardcoded `PROGRAMS`/`DAY_PLAN`.
- **Feedback object:** `{fromTrainerId, clientId, targetType:'session'|'photo'|'week', targetId, text, createdAt, seenByClient}`.

### Trainer — home + must-have screens
1. **Client roster** (this is the trainer home, replacing the current self-dashboard): each row = avatar, name, *last active*, this-week workouts vs target, a status dot (on-track / slipping / silent for N days), and an unread-feedback/new-photo indicator. Sort by "needs attention."
2. **Per-client drill-down** — what a coach actually needs to "develop" someone:
   - Adherence: sessions this week vs assigned, current streak, last-active date (you already have `moveStreak`, `weekBars`, `activeDays` — just pass the client's `pid`).
   - Progression: per-lift volume trend + PR table + e1RM (`volumeSeries`, `personalRecords` already accept `pid`).
   - The assigned plan and whether they're following it (assigned vs actually-logged exercises).
   - **Progress photos** over time (front/side/back, dated) — *does not exist today*; the only photo concept is a single gym snapshot stapled to one session.
   - Bodyweight trend (`weightSeries(pid)` exists).
   - Notes/feedback history with this client.
3. **Assign / edit a program** for a client (build days + exercises + set/rep + cue, attach a schedule).
4. **Assign a goal** to a client and watch the ring from the roster.
5. **Leave feedback** on a specific session, a progress photo, or the week — and have the client see it.

### Client — home + must-have screens
1. **Today, from my assigned plan** (not `DAY_PLAN`): "Your coach has you on *Lower B* today," start → the existing logger but driven by the assigned program's exercises/targets/cues.
2. **My plan** — the full week the trainer assigned, with the coach's per-exercise notes.
3. **Log against the plan** — keep the excellent live session/rest/PR logger; just feed it assigned exercises.
4. **Share progress with my coach** — submit dated **progress photos** (front/side/back) + bodyweight; today only a gym selfie on a session exists.
5. **My coach's feedback** — an inbox/thread: "Coach commented on your squat session," "Coach reviewed your week." Must be unmissable (badge/dot on nav).
6. My own stats (keep current Stats screen as-is).

### Gaps between this and what exists (the punch list)
- No roles, no auth, no trainer↔client edge. *(everything keys off one `S.me`)*
- No shared backend — two phones can't see one dataset. *(localStorage + dormant single-user sync hook only)*
- Programs are hardcoded constants, not assignable data. *(`PROGRAMS` / `DAY_PLAN`)*
- No feedback/comment object anywhere in the model.
- No progress-photo concept (front/side/back, dated, reviewable) — only one gym photo per session.
- "Feed" is a solo log mislabeled social; no cross-user review surface.
- Goals/challenges have dormant `members[]`/`createdBy` but no assignment UI.
- `/profile/:id` and `pid`-parameterized stats exist but nothing routes another person's id into them.

---

## 4. Honest UX problems (specific, current build)

1. **`onboarding.js` never asks role.** The single biggest miss. A new user is silently assumed to be the sole owner. A client can't reach their coach; a coach can't declare themselves.
2. **Dashboard "Today's session" is the owner's calendar.** `DAY_PLAN` hardwires Mon=Upper A, Tue=Lower A, etc. A new user on a Wednesday sees "Rest day — walk only" decided *for* them by Listy's split. Confusing and presumptuous.
3. **"Feed" tab lies.** Labeled and commented as a "Strava-style social feed," it's your own list with no social anything. A stranger taps Feed expecting people and finds only themselves.
4. **`/profile/:id` is a dead route.** The code claims to support viewing "friends," but nothing links to another profile and all the meaningful controls are `isMe`-gated, so the param is unreachable. Looks like a bug to anyone poking the URL.
5. **Sharing data = "hand a JSON file to Claude" (`settings.js` hint text).** For a coaching product this is absurd — the client shouldn't WhatsApp a `.json` to their coach. The primary "share" action exposes the single-user origin story directly in the UI copy.
6. **Badges greet a paying client before their plan does.** Profile leads with a 4-wide badge grid (Inferno, Forged, Champion). For someone who came to be *coached*, gamification-before-substance reads as a toy and undercuts the trainer's authority.
7. **Program picker offers Listy's five splits to everyone.** `openProgramPicker()` in `workout.js` lets any user "override today" with upperA/upperB/lowerA/lowerB — i.e. pick from one specific person's training rotation. Meaningless for a client on a different program.
8. **Goal "Distance" unit + walks double-write are owner-shaped quirks.** `addActivity` auto-checks the day's step box only `if (a.profileId === S.me)` — logic literally branches on "is this me," which breaks the instant a second person logs a walk.
9. **No "who am I looking at" context anywhere.** Because everything defaults to `S.me`, there's no header/breadcrumb telling a trainer "you're viewing Client X." The moment you add multi-user, every screen needs an identity banner it doesn't have.
10. **Seed data is "Listy."** `seed.js` hardcodes the owner as the demo profile with his real goal and weights. Fine for him; it means the out-of-box experience for anyone else is literally another man's body data.

---

## 5. Top 8 prioritized fixes (ranked, actionable)

1. **Add a role choice to onboarding (`trainer` | `client`) + a client→trainer invite/link code.** Everything else depends on this. — **Medium**
2. **Stand up a shared backend and replace the dormant single-user sync with real two-way sync** (extend the `fit.sidestudio.id` pattern), so a coach actually sees a client's data. — **Big**
3. **Turn `PROGRAMS`/`DAY_PLAN` into assignable program *data*** (programs collection + per-client assignment); feed the existing logger from the assigned plan, not constants. — **Big**
4. **Build the trainer home = client roster with "needs attention" triage** (last active, week adherence, unread photos/feedback). New screen, but reuses `weekBars`/`moveStreak`/`activeDays`. — **Medium**
5. **Make the per-client drill-down real by routing `clientId` into the existing Stats/Profile views** (`volumeSeries`, `personalRecords`, `heatmap`, `weightSeries` already take `pid`). — **Quick win** (plumbing exists).
6. **Add a feedback object + thread** (trainer comments on a session/photo/week; client sees an unmissable inbox with a nav dot). — **Medium**
7. **Add dated progress photos (front/side/back) for clients, reviewable by the trainer** — distinct from the one-off gym session photo. — **Medium**
8. **Rename/repurpose "Feed" → client "My Activity" and trainer "Client Review feed"; demote Badges out of the client's first screen.** — **Quick win** (mostly relabeling + reordering).

---

## 6. GPS run tracking (Strava-grade)

What separates premium from cheap is **trust in the line and zero fiddling.** Premium run-tracking earns trust three ways: an *accurate, smoothed* GPS trace (raw GPS jitters — you must filter with `accuracy` thresholds and a light smoothing pass, drop bad fixes, and snap-feel the path so the map shows a clean route, not a drunk scribble), *honest live metrics* (distance, current/avg pace, duration, and a split-by-km table that match what the user expects, with auto-pause when they stop at a light), and a *beautiful finished artifact* — a map snapshot of the route with a pace-colored polyline, splits, and elevation that's worth sharing. Cheap apps show a jagged line, a pace number that lurches between 3:00 and 12:00/km, and lose the run if the screen locks. The **top 3 things that make it feel smooth:** (1) **rock-solid background tracking with screen off / app backgrounded plus auto-pause** — if it ever drops the run, the whole feature is dead on arrival; (2) a **live map that follows you with a clean smoothed trace and a single, stable pace readout** (smoothed/rolling, not raw per-second), so the screen feels calm while moving; (3) a **gorgeous post-run summary** — map thumbnail with the route, per-km splits, pace/elevation graph, and a one-tap share card in Ember's flame style — which, conveniently, plugs straight into the existing `share.js` card generator and the `run` activity type already defined in `store.ACT`.

---

*End of audit. The good news: the logging engine, charts, and design system are genuinely strong and almost all reusable. The pivot is not a rebuild of the UI — it is a rebuild of the **identity and data layer** (roles, shared backend, programs-as-data, feedback, photos) underneath a UI that's already nicer than most.*
