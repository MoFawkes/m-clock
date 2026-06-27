# 🕌 AQI Clock — Classroom Alarm System

A simple alarm/bell system for a classroom or madrasah where **one main
computer** sends a sound and a full-screen alert to **all the other
computers** automatically — for the end of a lesson, break times, or
**Salah (prayer) times**.

- **One main computer** runs the server and opens the **Control Panel**.
- **Every other computer** just opens a web page in its browser — no
  installation needed (Windows, Mac, Linux, tablets… anything with a browser).
- Alerts can be sent **instantly with a button**, or **automatically on a
  schedule** you set.
- Works **fully offline** on your local network. No internet, no accounts,
  no external services, and no extra software to install (only Node.js).

---

## Requirements

- [Node.js](https://nodejs.org) version 18 or newer, installed **only on the
  main computer**.
- All computers connected to the **same network** (same Wi‑Fi / LAN).

## How to run

On the **main computer**, the easiest way is to **double-click a launcher**
(it starts the server and opens the control panel for you):

- **Windows:** `start.bat`
- **macOS:** `start.command`
- **Linux:** `start.sh`

Or run it from a terminal:

```bash
node server.js
```

### Keep it without re-downloading (recommended)
Instead of downloading the ZIP from GitHub each time, **clone it once** and then
pull updates:

```bash
git clone -b claude/multi-computer-alarm-app-qr642l https://github.com/MoFawkes/m-clock.git
cd m-clock
```

From then on:
- **To run:** double-click `start.bat` / `start.command` / `start.sh`.
- **To update to the latest version + run:** double-click `update.bat` /
  `update.command` (this does `git pull` for you, then starts the server).

You'll see something like:

```
  On THIS (main) computer, open the control panel:
    http://localhost:3000/control

  On EVERY OTHER computer, open the display screen:
    http://192.168.1.50:3000/
```

1. On the **main computer**, open **http://localhost:3000/control** — this is
   your control panel.
2. On **each other computer**, open the address it shows (e.g.
   `http://192.168.1.50:3000/`). Then tap **“Enable sound”** once on each
   screen (web browsers require one tap before they may play sound).

That's it. Every screen now shows a live clock and will light up and ring
when you send an alert.

> Tip: keep the server window open on the main computer. Closing it stops the
> system. To have it start automatically you can later add it to the
> computer's startup programs.

---

## What you can do

### Send an alert instantly
On the control panel, press a button:
- **🕌 Salah Time** — plays a calm adhan-style call on every screen.
- **🔔 End of Lesson**, **📚 Start Lesson**, **☕ Break Time** — play a school bell.
- **⏹ Stop / Dismiss** — clears the alert on every screen at once.
- Or send a **custom alert** with your own title, message, sound and ring length.

### Weekly schedule (with custom weekdays)
In the **Weekly schedule** section, set the times for Salah and lessons.
Each entry has a time, a title, a sound, and **the days it runs on**.

Different parts of the week can have **different timetables** — for example a
Monday–Thursday timetable, a shorter **Friday** (Jumu‘ah) day, a **Saturday**
schedule, and a quiet **Sunday**. Use the quick group buttons on each row
(**Mon–Thu / Fri / Sat / Sun / Every day**) to set the days in one click, or
tap individual day chips. Use the **View day** filter at the top to preview
just one day's timetable.

The five Salah times and a sample timetable are pre-filled as a starting point
— **edit them to match your local prayer times and your timetable.** Press
**Save schedule** to keep your changes.

### Special dates (holidays, Ramadan, exams…)
In the **Special dates** section you can override the weekly schedule for a
specific calendar date:
- **No alerts (holiday)** — turns off all automatic alerts that day.
- **Custom timetable** — runs a different set of times *instead of* the normal
  weekday schedule, just for that date.

### Groups & targeting (full-time / part-time / teachers)
Every screen belongs to a **group**: when a display (or the student app) opens,
it picks **Full-time student**, **Part-time student**, **Teacher**, or
**Classroom screen** (a monitor that shows everything).

You can then **target** any alert:
- **Immediate Actions** and **Custom Broadcast** have a *Send to* selector
  (Everyone / Full-time / Part-time / Teachers).
- **Scheduled bells** have an *Audience* column, so e.g. a part-time session
  bell only reaches part-time students.

Alerts with no target go to everyone; a *Classroom screen* always sees every
alert. The control panel header shows how many of each group are connected.

### Student app (downloadable desktop app)
Students can install a small desktop app that shows the upcoming-notifications
**widget** and rings + pops a notification for their group. See
[`student-app/`](student-app/) for how to run and build installers. There is
also a browser version of the widget at **`/widget`**.

### Dates on the display
Every display screen shows both the normal (Gregorian) date and the Islamic
**Hijri** date, alongside the live clock. The Hijri date is calculated by the
browser and needs no internet.

---

## Notes & ideas

- **Prayer times:** they are entered manually so you stay in full control and
  it works offline. Update them as the times shift through the year (a future
  version could calculate them automatically from your location).
- **Sounds** are generated by the browser, so there are no audio files to
  manage. (A future version could let you upload a real adhan recording.)
- **Port:** set a different port with `PORT=8080 node server.js`.

---

## How it works (for the curious)

- `server.js` — a small Node.js HTTP server (no dependencies). It serves the
  pages, holds the schedule, and pushes alerts to every display using
  **Server-Sent Events**.
- `public/display.html` — the screen each computer shows (clock + alert overlay).
- `public/control.html` — the main computer's control panel.
- `public/sounds.js` — synthesises the bell and adhan tones in the browser.
- `schedule.json` — created automatically; stores your saved schedule.
- `public/assets/logo.jpg` — the brand logo shown on the screens.

## Branding

The interface uses the project's colour scheme:

| Colour | Hex |
| --- | --- |
| Primary Navy | `#112549` |
| Secondary Blue | `#2E6DD8` |
| Gold Accent | `#C89B3C` |
| Cream Background | `#F4F0E6` |
| Neutral Grey | `#6B7280` |

To change the logo, replace `public/assets/logo.jpg` with your own image.

Made with care. **Baarak Allāhu fīkum.** 🌙
