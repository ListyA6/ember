# Ember — Build Contract (read fully before writing any view)

Ember is a **zero-build, vanilla-JS PWA**. No frameworks, no imports, no `fetch` for
templates. Files are plain `<script>` tags sharing a single global `window.App`.
Design: **white/warm canvas + orange "ember" accents, glassmorphism, energetic, futuristic,
emoji-free, GPU-smooth motion.** Match this exactly. Never use emoji — use `App.icon(name)`.

The foundation (tokens/base/components/animations CSS, icons, store, ui, charts, router,
share, app) is DONE and frozen. You implement **one view file**. Do not edit foundation
files or other views. Do not add `<script>`/`<link>` tags (index.html already lists yours).

---

## View file contract

Each view is `js/views/<name>.js`, an IIFE that self-registers:

```js
(function (App) {
  const { el, h, $, $$, fmt, avatar, segmented, openSheet, confirm, toast, haptic, icon, pageTitle, empty } = App.ui;
  const store = App.store, charts = App.charts, router = App.router;

  function render(root, params) {
    const page = el('div', { class: 'stagger' });          // top-level wrapper → entrance animation
    page.appendChild(pageTitle('Title', 'optional subtitle'));
    // ...build cards with el(...) and append to page...
    root.appendChild(page);
  }

  App.registerView('<name>', { render, title: 'Title' });
})(window.App);
```

- `render(root, params)` **clears nothing** — `root` is already empty. Build & append.
- `params.id` is the path segment (e.g. `#/feed/<id>` → `params.id`).
- Mutating the store auto-triggers a full re-render of the current view (no transition).
  So just call store mutators; don't manually re-render. Keep render() pure/idempotent.
- Live tickers (timers) must update a DOM node via their own `setInterval`, NOT the store.
- Open detail/edit UIs with `openSheet(...)` (lives outside `#view`, survives refresh).
- Wrap the main column in `class:'stagger'` for the staggered entrance. Use `.card` for panels.

Views to build and their routes (nav tabs: dashboard, feed, challenges, profile; others linked):
`onboarding`, `dashboard` (`/dashboard`, home), `workout` (`/workout`), `feed` (`/feed`, `/feed/:id`),
`challenges` (`/challenges`, `/challenges/:id`), `stats` (`/stats`), `profile` (`/profile`, `/profile/:id`), `settings` (`/settings`).

---

## `App.store` — data + logic (all you need; do not invent fields)

`store.state` (live), `store.today()` → 'YYYY-MM-DD', `store.D` (date helpers:
`key(d)`, `parse(s)`, `add(d,n)`, `startOfWeek()`, `weekId(dk)`, `inRange(dk,a,b)`, `fmt(d,opts)`).
`store.PROGRAMS` (lift programs map), `store.DAY_PLAN` (weekday→program), `store.ACT`
(activity type meta: `{label,icon,color,metric}` for `lift|walk|run|cycle|cardio`),
`store.BADGES` (catalog: `{id,name,desc,icon}`), `store.START`, `store.GOAL_END`.

**Profiles (personal app — single profile, no friends/following):** `meId()`, `me()`, `profile(id)`, `allProfiles()`,
`addProfile({name,handle,avatar,color,goal,heightCm,isMe})`→id, `updateProfile(id,patch)`,
`removeProfile(id)`, `initials(name)`.

**Settings:** `settings()`→`{onboarded,units('metric'|'imperial'),accent('default'|'vivid'),theme('light'|'dark'),createdAt}`,
`completeOnboarding()`, `setUnits(u)`, `setAccent(a)`, `setTheme(t)`, `goals()`→`{stepsPerDay,workoutsPerWeek,startDate,endDate}`, `setGoals(patch)`.

**Weight:** `logWeight(kg)`, `weightSeries(pid)`→`[{date,kg}]`, `latestWeight(pid)`→`{date,kg}|null`.

**Walks (daily step checkbox):** `isWalked(date?,pid?)`, `toggleWalk(date?,pid?)`,
`walkStreak(pid?)`, `walkDates(pid?)`.

**Live lift session (the workout view owns this):** `programFor(date?)`→`{key,name,color,ex:[{n,sets,reps}]}`,
`setTodayProgram(key)`, `currentSession()`→`null|{id,date,type,program,startedAt,sets:[{ex,idx,kg,reps,t}],photo}`,
`startSession(programKey?)`, `logSet(ex,idx,kg,reps)`, `editSet(arrIndex,kg,reps)`, `deleteSet(arrIndex)`,
`cancelSession()`, `finishSession({photo,note})`→activity (also detects PRs + badges),
`lastSetFor(ex,pid?)`→`{kg,reps}|null`.

**Activities (feed entries):** `addActivity({type,date,durationSec,distanceKm,steps,calories,note,photo,title})`→activity,
`updateActivity(id,patch)`, `deleteActivity(id)`, `getActivity(id)`, `activitiesFor(pid?)` (asc),
`feed({profileId?,onlyMine?,limit?})` (desc; single profile, so this is your own log). No kudos/likes — personal app.
Activity shape: `{id,profileId,type,date,startedAt,endedAt,durationSec,title,note,photo,distanceKm,steps,calories,sets,prs:[{ex,kind,value,reps}]}`.

**Records / stats:** `personalRecords(pid?)`→`[{ex,weight,reps,e1rm,date}]`, `totalPRs(pid?)`,
`totalVolume(pid?)`, `totalDistance(pid?)`, `totalSessions(pid?)`, `totalActivities(pid?)`, `totalDuration(pid?)`,
`moveStreak(pid?)`, `activeDays(pid?)`→`{dk:true}`, `volumeSeries(pid?,weeks=8)`→`[{week,label,value}]`,
`weekBars(pid?)`→`[{day,date,count,walked,isToday}]` (Mon–Sun), `heatmap(pid?,days=119)`→`[{date,level0-4}]`.

**Goals (personal challenges — no leaderboards):** `allChallenges()`, `activeChallenges(pid?)`, `challenge(id)`,
`createChallenge({name,desc,metric,goal,unit,startDate,endDate,icon,color})`→id (members defaults to just you),
`deleteChallenge(id)`, `challengeProgress(id,pid?)`→`{value,goal,pct,done}`, `challengeValue(c,pid?)`, `wonAnyChallenge(pid?)` (an ended goal whose target was hit).
Metrics: `workouts | distance | minutes | volume | walkDays | streak`. `challenge` shape:
`{id,name,desc,metric,goal,unit,startDate,endDate,createdBy,members:[pid],icon,color}`.

**Badges:** `earnedBadges(pid?)`→`[{id,earnedAt}]`, `hasBadge(id,pid?)`, `badgeDef(id)`→`{id,name,desc,icon}`, `BADGES`.

**Import/export/sync:** `exportJSON()`, `exportProfile(pid?)`, `importJSON(str)`, `importProfile(obj)`,
`syncNow()` (async, only if sync.enabled), `setSync(patch)`, `state.sync`={url,token,enabled,lastAt}.
`reset()` wipes everything. Events: `store.on('change',fn)`, `store.on('badges',fn)`.

---

## `App.ui` — rendering + UX

- `el(tag, props, children)` — props: `class, id, html, text, style:{}, on:{click:fn}, dataset:{}, onClick:fn, ...attrs`. children: node|string|array.
- `h(htmlString)`→node, `frag(...)`, `clear(node)`, `mount(container, ...nodes)`, `$(sel)`, `$$(sel)`.
- `fmt`: `weight(kg)`('+unit'), `distance(km)`, `distUnit()`, `duration(sec)`('45:12'/'1h 02m'),
  `clock(sec)`('05:30'), `volume(kg)`('12.4t'), `num(n,dec)`('1,234'), `relative(ts)`('3h ago'),
  `dayLabel(dk)`('Today'/'Yesterday'/'Mon, 2 Jun'), `rawWeightUnit()`.
- `avatar(profile, size?)` → element (`size`: undefined|'sm'|'lg'). Uses profile color/initials/photo.
- `segmented([{value,label}], active, onChange)` → sliding pill switcher element.
- `openSheet({title,hint,content,actions,center,dismissible,onClose,autofocus})` → `{close()}`.
  `content` = node | html | `fn(api)`. `actions`=`[{label,class('flame'|'ghost'|'danger'|'dark'),icon,onClick(api)→false to keep open,close}]`.
- `confirm({title,message,confirmText,cancelText,danger})` → Promise<bool>.
- `toast(msg,{type('good'|'flame'),icon,duration})`, `haptic(pattern)`, `burst(colors?)` (confetti).
- `countUp(node, to, {from,decimals,dur,prefix,suffix})` — animates a number.
- `resizeImage(file, max, q)` → Promise<dataURL> (for photos).
- `pageTitle(title, sub?)` → element, `empty(icon,title,sub)` → element, `medal(def, earned)` → element.

## `App.charts` — return elements, auto-animated

- `ring(pct, {size,stroke,color,gradient,centerTop,centerBig,centerSub})` → element (progress ring w/ optional center text).
- `line(series, {height,color,area,dots,labels,goal})` — `series`=`[{value,label}]|[num]`. Weight/volume trends.
- `bars(data, {height,valueFmt,showValues})` — `data`=`[{label,value,highlight,sub}]`. Weekly bars.
- `heatmap(cells, {cols})` — `cells`=`[{date,level0-4}]`. Contribution calendar (7 rows).
- `sparkline(values, {width,height,color})` → inline mini svg.

## `App.share`

- `shareActivity(activity, profile?)` — builds card, native-share or downloads PNG.
- `previewActivity(activity, profile?)` → Promise<dataURL> (for preview). `downloadText(text,name,type)`.
- `shareData(text, name, type?)` → Promise<{shared}|{downloaded}|{cancelled}> — wraps text in a `File` and opens the OS share sheet (WhatsApp/Files on mobile); falls back to download when file-share is unsupported (desktop). Settings → Data uses it with `store.exportJSON()` to hand the full training file off (no server).

## `App.flows` (shared, already built — reuse, don't reinvent)

- `App.flows.logWeight()` — weight sheet. `App.flows.logActivity(type)` — cardio/walk/run/cycle sheet.
- `App.quickAdd()` — the FAB menu. `App.celebrate(title, sub)`, `App.celebratePRs(activity)`.

## `App.router`

- `router.go('/feed')`, `router.replace(...)`, `router.current`, `router.params`. Navigation animates.
- Register: `App.registerView(name, {render, title})`.

---

## Icons (use `App.icon(name, size?)` → svg string, or `App.iconEl`)

home feed trophy chart user users plus minus plusCircle flame flameLine settings camera check
checkCircle dumbbell walk run heart heartFill timer clock share scale calendar medal lock chevR
chevL chevD chevU x edit trash target zap zapLine arrowU arrowD play pause stop route pin trend
bell download upload sync info star starFill moon sun more ruler fork bolt crown add

## CSS classes (compose these — avoid new CSS; tiny inline `style` is OK for layout)

Layout: `row col between wrap grow center gap-1..4 mt-1..6 mb-2..4 hide rail grid-2 grid-3 stagger page-title`.
Type/color: `t-xs t-sm t-lg t-xl semi bold upper truncate tnum muted dim flame good bad`.
Surfaces: `card` (glass), `card flat|nested|tint|pad-lg|pad-sm`, `hero` (flame gradient panel), `label`.
Controls: `btn` (+`block lg sm ghost glass danger dark`), `iconbtn` (+`plain`), `pill` (+`flame good solid`),
`seg`, `chip`, `stepper`, `field`, `input` (+`big`), `bar` (+`good`, inner `<i>` width%).
Bits: `avatar`(+`sm lg`), `avatar-stack`, `tile` (`.k .v .delta(.up/.down)`), `item` (`.body .t .s`, `.tail`),
`medal`(+`locked sm`), `empty`, `skel`, `toast`. FX classes: `pop flash pulse pulse-ring flicker shake kudos-pop fade-in`.

## Design rules (non-negotiable)
1. **No emoji anywhere.** Icons only.
2. White/warm canvas; orange `--flame` gradient for primary actions & highlights; coral `--coral` for hot/PR; green `--good` for done/streak.
3. Glass cards over the animated background. Generous spacing. Tabular numerals for all stats (`tnum`).
4. Motion is smooth and GPU-driven (transform/opacity). Use entrance `stagger`, count-ups, ring/line draw-ins, button press feedback, `haptic()` on key taps.
5. Premium & editorial, not playful. Restrained, confident, energetic.
6. **Type system (self-hosted, offline):** body/UI = **Plus Jakarta Sans** (`--font`); display headings + wordmark + all numerals = **Space Grotesk** (`--font-display`, `--num`). `h1–h4` and `.tnum` already pull these — don't override `font-family`. Wordmark = uppercase, tracked (`--ls-wordmark`). Fonts live in `assets/fonts/*.woff2`, declared in `styles/fonts.css`, precached by `sw.js`. Weights shipped: 500/600/700 (Space Grotesk), 400–800 (Plus Jakarta) — `--w-med 500 / --w-semi 600 / --w-bold 700`.
