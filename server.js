'use strict';

/*
 * m-clock — Networked classroom alarm system.
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

// ---------------------------------------------------------------------------
// Connected displays (Server-Sent Events clients)
// ---------------------------------------------------------------------------

/** @type {Map<number, {res: http.ServerResponse, name: string, since: number}>} */
const clients = new Map();
let nextClientId = 1;

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const { res } of clients.values()) {
    res.write(payload);
  }
}

/**
 * Fire an alert to every connected display.
 * @param {{type?: string, title?: string, message?: string, sound?: string, duration?: number, source?: string}} alert
 */
function fireAlert(alert) {
  const payload = {
    type: alert.type || 'lesson',
    title: alert.title || 'Alert',
    message: alert.message || '',
    sound: alert.sound || 'bell',
    duration: Number(alert.duration) || 30,
    source: alert.source || 'manual',
    at: Date.now(),
  };
  console.log(
    `[${new Date().toLocaleTimeString()}] ALERT (${payload.source}): ` +
      `${payload.title} -> ${clients.size} display(s)`
  );
  broadcast('alert', payload);
  return payload;
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

const DEFAULT_SCHEDULE = {
  // Weekday is 0 (Sun) .. 6 (Sat). Empty `days` means every day.
  enabled: true,
  events: [
    { id: 'fajr', time: '05:15', type: 'salah', title: 'Salah Time — Fajr', message: 'الصلاة خير من النوم', sound: 'adhan', days: [] },
    { id: 'dhuhr', time: '13:15', type: 'salah', title: 'Salah Time — Dhuhr', message: 'حَيَّ عَلَى الصَّلَاة', sound: 'adhan', days: [] },
    { id: 'asr', time: '16:45', type: 'salah', title: 'Salah Time — Asr', message: 'حَيَّ عَلَى الصَّلَاة', sound: 'adhan', days: [] },
    { id: 'maghrib', time: '20:30', type: 'salah', title: 'Salah Time — Maghrib', message: 'حَيَّ عَلَى الصَّلَاة', sound: 'adhan', days: [] },
    { id: 'isha', time: '22:00', type: 'salah', title: 'Salah Time — Isha', message: 'حَيَّ عَلَى الصَّلَاة', sound: 'adhan', days: [] },
    { id: 'lesson1', time: '09:00', type: 'lesson', title: 'Lesson Starting', message: 'Please be seated', sound: 'bell', days: [0, 1, 2, 3, 4] },
    { id: 'break1', time: '10:30', type: 'lesson', title: 'Break Time', message: 'End of lesson', sound: 'bell', days: [0, 1, 2, 3, 4] },
    { id: 'lesson2', time: '11:00', type: 'lesson', title: 'Lesson Starting', message: 'Please be seated', sound: 'bell', days: [0, 1, 2, 3, 4] },
    { id: 'lunch', time: '12:30', type: 'lesson', title: 'Lunch Break', message: 'End of lesson', sound: 'bell', days: [0, 1, 2, 3, 4] },
    { id: 'home', time: '15:30', type: 'lesson', title: 'End of School Day', message: 'See you tomorrow, in shā’ Allāh', sound: 'bell', days: [0, 1, 2, 3, 4] },
  ],
};

function loadSchedule() {
  try {
    const raw = fs.readFileSync(SCHEDULE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.events)) throw new Error('invalid schedule');
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

// Track which events already fired today so we never double-fire.
let firedToday = new Set();
let firedDay = new Date().toDateString();

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

  for (const ev of schedule.events) {
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
    clients.set(id, { res, name, since: Date.now() });
    res.write(`event: hello\ndata: ${JSON.stringify({ id, name })}\n\n`);
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
      const alert = fireAlert({ ...body, source: 'manual' });
      return sendJson(res, 200, { ok: true, alert, displays: clients.size });
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
    return sendJson(res, 200, {
      ok: true,
      displays: [...clients.values()].map((c) => ({ name: c.name, since: c.since })),
      count: clients.size,
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
      schedule = {
        enabled: body.enabled !== false,
        events: body.events.map((e, i) => ({
          id: e.id || `ev${Date.now()}_${i}`,
          time: e.time,
          type: e.type || 'lesson',
          title: e.title || 'Alert',
          message: e.message || '',
          sound: e.sound || 'bell',
          days: Array.isArray(e.days) ? e.days : [],
        })),
      };
      saveSchedule(schedule);
      // Allow an edited event to fire again later today.
      firedToday = new Set();
      return sendJson(res, 200, { ok: true, schedule });
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
  console.log('\n  m-clock — classroom alarm system is running\n');
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
