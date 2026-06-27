'use strict';

/*
 * AQI Clock — Networked classroom alarm system.
 *
 * One "main computer" runs this server and opens /control.
 * Every other computer opens / (the display) in a browser.
 * When the main computer fires an alert — manually or on a schedule —
 * the server pushes it to every connected display over Server-Sent
 * Events, and each display plays a sound and shows a full-screen message.
 *
 * No external dependencies: only Node.js built-ins, so it runs offline.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SCHEDULE_FILE = path.join(__dirname, 'schedule.json');
const BROADCASTS_FILE = path.join(__dirname, 'broadcasts.json');

// ---------------------------------------------------------------------------
// Connected displays (Server-Sent Events clients)
// ---------------------------------------------------------------------------

/** @type {Map<number, {res: http.ServerResponse, name: string, since: number}>} */
const clients = new Map();
let nextClientId = 1;

// Known audience groups. A display belongs to exactly one; an alert may target
// one or more (empty target = everyone). "teacher" is its own group too.
const GROUPS = ['fulltime', 'parttime', 'teacher'];
function normGroup(g) {
  g = String(g || '').toLowerCase();
  return GROUPS.includes(g) ? g : 'all';
}
// Sanitise a target list to known groups; empty/invalid means "everyone".
function normTargets(groups) {
  if (!Array.isArray(groups)) return [];
  return groups.map((g) => String(g).toLowerCase()).filter((g) => GROUPS.includes(g));
}

// A display receives an alert when it targets everyone, or its group is
// targeted, or it is a classroom "monitor" (group "all") that sees everything.
function receives(c, targets) {
  return !targets || targets.length === 0 || c.group === 'all' || targets.includes(c.group);
}

// Send to every display, or only those whose group is in `targets`.
function broadcast(event, data, targets) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients.values()) {
    if (receives(c, targets)) c.res.write(payload);
  }
}

/**
 * Fire an alert to every connected display, or only to the targeted groups.
 * @param {{type?: string, title?: string, message?: string, sound?: string, duration?: number, source?: string, groups?: string[]}} alert
 */
function fireAlert(alert) {
  const targets = normTargets(alert.groups);
  const payload = {
    type: alert.type || 'lesson',
    title: alert.title || 'Alert',
    message: alert.message || '',
    sound: alert.sound || 'bell',
    duration: Number(alert.duration) || 30,
    source: alert.source || 'manual',
    groups: targets,
    at: Date.now(),
  };
  const reached = [...clients.values()].filter((c) => receives(c, targets)).length;
  console.log(
    `[${new Date().toLocaleTimeString()}] ALERT (${payload.source}): ` +
      `${payload.title} -> ${reached} display(s)` +
      (targets.length ? ` [${targets.join(', ')}]` : '')
  );
  broadcast('alert', payload, targets);
  return { payload, reached };
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

// Weekday numbers: 0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat.
// An event's `days` array lists the weekdays it runs on. Empty == every day.
// The control panel offers quick groups: Mon–Thu [1,2,3,4], Fri [5],
// Sat [6], Sun [0] — so each part of the week can have its own timetable.
const MON_THU = [1, 2, 3, 4];

const DEFAULT_SCHEDULE = {
  enabled: true,
  events: [
    // Salah times — every day.
    { id: 'fajr', time: '05:15', type: 'salah', title: 'Salah Time — Fajr', message: 'الصلاة خير من النوم', sound: 'adhan', days: [] },
    { id: 'dhuhr', time: '13:15', type: 'salah', title: 'Salah Time — Dhuhr', message: 'حَيَّ عَلَى الصَّلَاة', sound: 'adhan', days: [] },
    { id: 'asr', time: '16:45', type: 'salah', title: 'Salah Time — Asr', message: 'حَيَّ عَلَى الصَّلَاة', sound: 'adhan', days: [] },
    { id: 'maghrib', time: '20:30', type: 'salah', title: 'Salah Time — Maghrib', message: 'حَيَّ عَلَى الصَّلَاة', sound: 'adhan', days: [] },
    { id: 'isha', time: '22:00', type: 'salah', title: 'Salah Time — Isha', message: 'حَيَّ عَلَى الصَّلَاة', sound: 'adhan', days: [] },
    // Monday–Thursday timetable.
    { id: 'mt_start', time: '09:00', type: 'lesson', title: 'Lesson Starting', message: 'Please be seated', sound: 'bell', days: MON_THU },
    { id: 'mt_break', time: '10:30', type: 'lesson', title: 'Break Time', message: 'End of lesson', sound: 'bell', days: MON_THU },
    { id: 'mt_lesson2', time: '11:00', type: 'lesson', title: 'Lesson Starting', message: 'Please be seated', sound: 'bell', days: MON_THU },
    { id: 'mt_lunch', time: '12:30', type: 'lesson', title: 'Lunch Break', message: 'End of lesson', sound: 'bell', days: MON_THU },
    { id: 'mt_home', time: '15:30', type: 'lesson', title: 'End of School Day', message: 'See you tomorrow, in shā’ Allāh', sound: 'bell', days: MON_THU },
    // Friday — shorter day for Jumu‘ah.
    { id: 'fri_start', time: '09:00', type: 'lesson', title: 'Lesson Starting', message: 'Please be seated', sound: 'bell', days: [5] },
    { id: 'fri_jummah', time: '12:00', type: 'salah', title: 'Jumu‘ah Preparation', message: 'Prepare for Jumu‘ah', sound: 'adhan', days: [5] },
    // Saturday timetable.
    { id: 'sat_start', time: '10:00', type: 'lesson', title: 'Lesson Starting', message: 'Please be seated', sound: 'bell', days: [6] },
    { id: 'sat_home', time: '13:00', type: 'lesson', title: 'End of Day', message: 'Jazākum Allāhu khayran', sound: 'bell', days: [6] },
    // Sunday has Salah only by default (no lesson bells).
  ],
  // Date-specific overrides (e.g. holidays, Ramadan, exams). For a matching
  // date, `mode: "off"` cancels all automatic alerts that day, while
  // `mode: "custom"` runs `events` INSTEAD of the normal weekday timetable.
  overrides: [
    // Example (disabled by default — edit in the control panel):
    // { id: 'eid', date: '2026-03-20', label: 'Eid al-Fitr', mode: 'off', events: [] },
  ],
};

function loadSchedule() {
  try {
    const raw = fs.readFileSync(SCHEDULE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.events)) throw new Error('invalid schedule');
    if (!Array.isArray(parsed.overrides)) parsed.overrides = [];
    return parsed;
  } catch (err) {
    saveSchedule(DEFAULT_SCHEDULE);
    return JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
  }
}

function saveSchedule(schedule) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
}

let schedule = loadSchedule();

// ---------------------------------------------------------------------------
// Saved broadcasts (reusable custom messages)
// ---------------------------------------------------------------------------

function loadBroadcasts() {
  try {
    const arr = JSON.parse(fs.readFileSync(BROADCASTS_FILE, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch (err) {
    return [];
  }
}
function saveBroadcasts(list) {
  fs.writeFileSync(BROADCASTS_FILE, JSON.stringify(list, null, 2));
}
let broadcasts = loadBroadcasts();

// Track which events already fired today so we never double-fire.
let firedToday = new Set();
let firedDay = new Date().toDateString();

// Local YYYY-MM-DD for the given date (used to match date overrides).
function localYMD(d) {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

// A date override matches a single date, or any day within an (optional)
// inclusive date range [date .. endDate].
function overrideMatches(o, ymd) {
  if (!o.date) return false;
  const end = o.endDate && o.endDate >= o.date ? o.endDate : o.date;
  return ymd >= o.date && ymd <= end;
}

// Which events apply today: a date override (off / custom) wins over the
// normal weekday timetable.
function eventsForToday(now) {
  const ymd = localYMD(now);
  const override = (schedule.overrides || []).find((o) => overrideMatches(o, ymd));
  if (override) {
    if (override.mode === 'off') return [];
    if (override.mode === 'custom') return override.events || [];
  }
  return schedule.events;
}

function checkSchedule() {
  const now = new Date();
  const today = now.toDateString();
  if (today !== firedDay) {
    firedDay = today;
    firedToday = new Set();
  }
  if (!schedule.enabled) return;

  const hhmm =
    String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const weekday = now.getDay();

  for (const ev of eventsForToday(now)) {
    if (ev.time !== hhmm) continue;
    if (firedToday.has(ev.id)) continue;
    if (Array.isArray(ev.days) && ev.days.length > 0 && !ev.days.includes(weekday)) continue;
    firedToday.add(ev.id);
    fireAlert({
      type: ev.type,
      title: ev.title,
      message: ev.message,
      sound: ev.sound,
      duration: ev.duration,
      groups: ev.groups,
      source: 'schedule',
    });
  }
}

// Check every 15s so we never miss a minute boundary.
setInterval(checkSchedule, 15 * 1000);

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) reject(new Error('payload too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? '/display.html' : urlPath;
  if (rel === '/control') rel = '/control.html';
  if (rel === '/widget') rel = '/widget.html';
  // Prevent path traversal.
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------------------------------------------------------------------------
// Request router
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // --- SSE stream for displays ---
  if (pathname === '/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');

    const id = nextClientId++;
    const name = url.searchParams.get('name') || `Display ${id}`;
    const group = normGroup(url.searchParams.get('group'));
    clients.set(id, { res, name, group, since: Date.now() });
    res.write(`event: hello\ndata: ${JSON.stringify({ id, name, group })}\n\n`);
    broadcast('displays', { count: clients.size });

    const keepAlive = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(keepAlive);
      clients.delete(id);
      broadcast('displays', { count: clients.size });
    });
    return;
  }

  // --- Fire an alert now ---
  if (pathname === '/api/trigger' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const { payload, reached } = fireAlert({ ...body, source: 'manual' });
      return sendJson(res, 200, { ok: true, alert: payload, displays: reached });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  // --- Stop / dismiss alert on all displays ---
  if (pathname === '/api/stop' && req.method === 'POST') {
    broadcast('stop', { at: Date.now() });
    return sendJson(res, 200, { ok: true });
  }

  // --- Status (for the control panel) ---
  if (pathname === '/api/status' && req.method === 'GET') {
    const byGroup = { all: 0, fulltime: 0, parttime: 0, teacher: 0 };
    for (const c of clients.values()) byGroup[c.group] = (byGroup[c.group] || 0) + 1;
    return sendJson(res, 200, {
      ok: true,
      displays: [...clients.values()].map((c) => ({ name: c.name, group: c.group, since: c.since })),
      count: clients.size,
      byGroup,
      time: new Date().toISOString(),
    });
  }

  // --- Read / write the schedule ---
  if (pathname === '/api/schedule' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, schedule });
  }
  if (pathname === '/api/schedule' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      if (!Array.isArray(body.events)) throw new Error('events must be an array');
      const TYPES = ['lesson', 'salah', 'naseehah'];
      const SOUNDS = ['bell', 'adhan', 'chime'];
      const cleanEvent = (e, i, prefix) => ({
        id: e.id || `${prefix}${Date.now()}_${i}`,
        time: e.time,
        type: TYPES.includes(e.type) ? e.type : 'lesson',
        title: e.title || 'Alert',
        message: e.message || '',
        sound: SOUNDS.includes(e.sound) ? e.sound : 'bell',
        days: Array.isArray(e.days) ? e.days.map(Number).filter((d) => d >= 0 && d <= 6) : [],
        groups: normTargets(e.groups),
      });
      // Keep each day's events ordered by time.
      const byTime = (a, b) => (a.time || '').localeCompare(b.time || '');
      schedule = {
        enabled: body.enabled !== false,
        events: body.events.map((e, i) => cleanEvent(e, i, 'ev')).sort(byTime),
        overrides: Array.isArray(body.overrides)
          ? body.overrides
              .filter((o) => /^\d{4}-\d{2}-\d{2}$/.test(o.date || ''))
              .map((o, i) => ({
                id: o.id || `ov${Date.now()}_${i}`,
                date: o.date,
                endDate: /^\d{4}-\d{2}-\d{2}$/.test(o.endDate || '') && o.endDate >= o.date ? o.endDate : '',
                label: o.label || '',
                mode: o.mode === 'custom' ? 'custom' : 'off',
                events: Array.isArray(o.events)
                  ? o.events.map((e, j) => cleanEvent(e, j, `ovv${i}_`)).sort(byTime)
                  : [],
              }))
          : [],
      };
      saveSchedule(schedule);
      // Allow an edited event to fire again later today.
      firedToday = new Set();
      return sendJson(res, 200, { ok: true, schedule });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  // --- Saved broadcasts (reusable custom messages) ---
  if (pathname === '/api/broadcasts' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, broadcasts });
  }
  if (pathname === '/api/broadcasts' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      if (!Array.isArray(body.broadcasts)) throw new Error('broadcasts must be an array');
      const TYPES = ['lesson', 'salah', 'naseehah'];
      const SOUNDS = ['bell', 'adhan', 'chime'];
      broadcasts = body.broadcasts.slice(0, 100).map((b, i) => ({
        id: b.id || `bc${Date.now()}_${i}`,
        title: (b.title || 'Untitled').slice(0, 120),
        type: TYPES.includes(b.type) ? b.type : 'lesson',
        sound: SOUNDS.includes(b.sound) ? b.sound : 'bell',
        message: (b.message || '').slice(0, 500),
        duration: Math.min(600, Math.max(3, Number(b.duration) || 30)),
        groups: normTargets(b.groups),
      }));
      saveBroadcasts(broadcasts);
      return sendJson(res, 200, { ok: true, broadcasts });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  // --- Static files / pages ---
  if (req.method === 'GET') {
    return serveStatic(req, res, pathname);
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function localIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

server.listen(PORT, () => {
  const ips = localIPs();
  console.log('\n  AQI Clock — classroom alarm system is running\n');
  console.log('  On THIS (main) computer, open the control panel:');
  console.log(`    http://localhost:${PORT}/control\n`);
  console.log('  On EVERY OTHER computer, open the display screen:');
  if (ips.length === 0) {
    console.log(`    http://<this-computer-ip>:${PORT}/`);
  } else {
    for (const ip of ips) console.log(`    http://${ip}:${PORT}/`);
  }
  console.log('\n  (Keep this window open. Press Ctrl+C to stop.)\n');
});
