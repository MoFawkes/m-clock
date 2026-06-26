# m-clock Student (desktop app)

A small always-on-top desktop app that shows the **upcoming notifications**
widget and **rings + pops a notification** whenever the teacher fires an alert
for your group (full-time student / part-time student / teacher).

It is a thin wrapper around the server's `/widget` page — all the real work
happens on the main computer's m-clock server.

## Run it during development

```bash
cd student-app
npm install
npm start
```

On first launch it asks for the **server address** (the main computer's m-clock
URL, e.g. `http://192.168.1.50:3000`) and **which group** you are in. After that
it connects automatically each time.

## Build installers (to put on a website for students to download)

```bash
cd student-app
npm install
npm run dist          # build for the current OS
# or target a specific OS:
npm run dist:win      # Windows  .exe installer (NSIS)
npm run dist:mac      # macOS    .dmg
npm run dist:linux    # Linux    .AppImage
```

The installers appear in `student-app/dist/`. Upload those to your website's
download page.

> **App icon:** add `student-app/build/icon.png` (512×512) and, optionally, a
> `student-app/tray.png` (small, ~16–32px) before building to brand the app and
> its tray icon. Without them the app still builds, using defaults.

## Important: reaching the server from students' own devices

- **On the school network (same Wi-Fi):** use the main computer's local IP, e.g.
  `http://192.168.1.50:3000`. Works out of the box.
- **From home / mobile data:** the main computer must be reachable over the
  internet. Options: host the m-clock server somewhere public, or use a tunnel
  (e.g. Cloudflare Tunnel / ngrok) and give students that public URL. The app
  accepts any URL, so no code change is needed — just enter the public address.
