# 🎬 OpenCloud Video Review

**Video review and annotation for OpenCloud.**

A web extension for [OpenCloud](https://opencloud.eu) that turns any video into a collaborative review tool. Clients and collaborators can leave timestamped comments, draw annotations on frames, approve or request revisions — all without leaving OpenCloud.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ Features

- **Timestamped Comments** — Click the timeline to leave frame-accurate notes
- **Color Tags** — Categorize comments: 🔴 Issue, 🟡 Note, 🟢 Approved, 🔵 Suggestion, 🟣 Creative
- **Frame Annotations** — Draw directly on the video frame with color-matched pen (5px, matches selected tag color)
- **Approval Workflow** — ✅ Approved / 🔄 Revisions Needed / ⏳ Pending
- **Share for Review** — One-click creates a public link that opens directly in the review UI
- **Review Mode Toggle** — Switch between 📝 review mode (comments, annotations, approval) and ▶️ playback-only mode
- **Auto-Save** — EDL and JSON sidecar files are automatically saved to the same OpenCloud folder on every comment change
- **Keyboard Shortcuts** — Frame-step with arrow keys, J/K/L for playback
- **Dark UI** — Clean, professional interface matching OpenCloud's design
- **Sidecar Storage** — Reviews stored as `.review.json` next to the video via WebDAV
- **localStorage Fallback** — Works even when write access is limited (public links)

## 📦 Supported Formats

Any format the browser can play natively:
- `.mp4` (H.264, H.265)
- `.mov` (H.264)
- `.webm` (VP8, VP9, AV1)
- `.mkv` (VP8, VP9)
- `.ogv`

> **Note:** RAW formats like `.braw` or `.r3d` need to be transcoded to H.264 proxies first.

## 🚀 Installation

### Quick Start

1. Copy the `video-review/` folder (containing `web-app-video-review.js`) into your OpenCloud web apps directory:
   ```
   /var/lib/opencloud/web/assets/apps/video-review/
   ```
   If the `apps/` directory doesn't exist, create it.

2. Register the app as an **external app** in your web UI config (JSON file referenced by `WEB_UI_CONFIG_FILE`):
   ```json
   {
     "apps": ["files", "search", "text-editor", "pdf-viewer", "external", "admin-settings", "preview", "app-store"],
     "external_apps": [
       {
         "id": "video-review",
         "path": "https://your-opencloud-domain/assets/apps/video-review/web-app-video-review.js"
       }
     ]
   }
   ```

3. **Content Security Policy:** Video playback uses `blob:` URLs which require a CSP override. Create a `csp.yaml` file and reference it via `PROXY_CSP_CONFIG_FILE_LOCATION`:
   ```yaml
   directives:
     child-src: "'self'"
     connect-src: "'self' blob:"
     default-src: "'none'"
     font-src: "'self'"
     frame-ancestors: "'self'"
     frame-src: "'self' blob:"
     img-src: "'self' data: blob:"
     manifest-src: "'self'"
     media-src: "'self' blob:"
     object-src: "'self' blob:"
     script-src: "'self' 'unsafe-inline'"
     style-src: "'self' 'unsafe-inline'"
   ```
   > ⚠️ Use **hyphens** (`media-src`), not underscores (`media_src`) — underscores are silently rejected by browsers.

4. Restart OpenCloud.

### Docker Compose (Development)

A complete development setup with OpenCloud 5 (rolling):

```yaml
services:
  opencloud:
    image: opencloudeu/opencloud-rolling:latest
    container_name: opencloud-video-review
    ports:
      - "9200:9200"
    entrypoint: ["/bin/sh", "-c"]
    command: ["opencloud init || true; opencloud server"]
    environment:
      OC_URL: https://localhost:9200
      OC_INSECURE: "true"
      OC_LOG_LEVEL: warn
      IDM_CREATE_DEMO_USERS: "true"
      IDM_ADMIN_PASSWORD: admin
      PROXY_ENABLE_BASIC_AUTH: "true"
      WEB_ASSET_APPS_PATH: /web/apps
      WEB_UI_CONFIG_FILE: /etc/opencloud/web.json
      PROXY_CSP_CONFIG_FILE_LOCATION: /etc/opencloud/csp.yaml
    volumes:
      - ocdata:/etc/opencloud
      - ./dist:/web/apps/video-review
      - ./dev/config/csp.yaml:/etc/opencloud/csp.yaml:ro
      - ./dev/config/web.json:/etc/opencloud/web.json:ro
volumes:
  ocdata:
```

### Important Notes

| Topic | Detail |
|-------|--------|
| **File extension** | Build output **must** use `.js` — OpenCloud has no MIME mapping for `.cjs` and browsers block it |
| **CSS** | Inlined into the JS bundle via a custom Vite plugin (single-file deployment, no separate CSS) |
| **First start** | `opencloud init` is required on first start to generate JWT secrets and TLS certificates |
| **Web config format** | Must be **JSON**, not YAML — despite the env var name `WEB_UI_CONFIG_FILE` |
| **App registration** | Use `external_apps` with a full URL `path` — just adding the name to `apps[]` causes a RuntimeError |
| **OpenCloud version** | Tested with OpenCloud 4.0 and 5.0/5.1 (rolling) |

## 🔗 Sharing for Review

The app includes a built-in **Share** button in the review sidebar:

1. Open a video file → right-click → **Open in Video Review**
2. Click the **🔗 Share** button in the sidebar header
3. A public share link is created (or reused if one already exists) and copied to your clipboard
4. Send the link to your client — it opens directly in the Video Review UI

The share link routes to `/video-review/public/{token}/{filename}` which loads the video review app directly, bypassing the default OpenCloud preview.

### Review Mode Toggle

Every viewer (including share link recipients) can toggle between:
- **📝 Review mode** — Full review UI with comments, drawing tools, approval workflow
- **▶️ Playback mode** — Clean video player without review UI

You can also control the default mode via URL parameter: `?review=false` starts in playback-only mode.

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` | Back 1 frame |
| `→` | Forward 1 frame |
| `Shift+←` | Back 1 second |
| `Shift+→` | Forward 1 second |
| `J` | Back 5 seconds |
| `K` | Play/Pause |
| `L` | Forward 5 seconds |
| `Ctrl+Enter` / `⌘+Enter` | Submit comment |

## 💾 Data Storage

### Auto-Save

On every comment change, the app automatically saves to the same OpenCloud folder:

```
project/
├── final_cut_v3.mp4
├── final_cut_v3.mp4.review.json   ← review data (auto-saved)
├── final_cut_v3.mp4.edl           ← EDL markers (auto-saved)
```

The EDL file is a standard **CMX 3600** format that DaVinci Resolve, Premiere, and Avid can import as timeline markers:

```
TITLE: final_cut_v3 — Video Review
FCM: NON-DROP FRAME

001  AX       V     C        00:01:23:12 00:01:23:13 00:01:23:12 00:01:23:13
* FROM CLIP NAME: final_cut_v3.mp4
* LOC: 00:01:23:12 RED     Client: The color grading feels too warm here
```

### Storage Strategy

1. **WebDAV sidecar** (primary) — `.review.json` next to the video file
2. **localStorage** (fallback) — For public links or read-only access

## 🏗️ Architecture

```
src/
├── index.ts                    # OpenCloud app registration (AppWrapperRoute)
├── App.vue                     # Main review component
├── types.ts                    # TypeScript interfaces
├── composables/
│   └── useComments.ts          # Comment storage (WebDAV + localStorage)
├── utils/
│   ├── edl.ts                  # CMX 3600 EDL generator
│   └── time.ts                 # Timecode formatting
└── assets/
    └── style.scss              # Dark theme styles
```

### Build

The build produces a single UMD JavaScript file with CSS inlined:

```bash
npm install
npm run build
# → dist/web-app-video-review.js (≈28 KB, ≈9 KB gzipped)
```

Key build details:
- **Vite** with custom `cssInjectPlugin()` — collects all CSS at bundle time and prepends a `<style>` injection IIFE
- **UMD format** with Vue, vue3-gettext, and @opencloud-eu/web-pkg as externals
- **`urlForResourceOptions: { disposition: 'inline' }`** — required for the AppWrapper to generate a playable video URL via the `url` prop

## 🤝 Contributing

Contributions welcome! This project is in active development.

**Areas where help is needed:**
- [ ] Real-time collaboration (WebSocket/Socket.io)
- [ ] Thumbnail timeline (frame strip below the player)
- [ ] Version comparison (side-by-side review of v1 vs v2)
- [ ] Mobile touch support
- [ ] Internationalization (i18n)
- [ ] Notification system (email when new comments arrive)
- [ ] Integration with DaVinci Resolve's remote API
- [ ] Support for image review (.jpg, .png, .exr sequences)

### Development Setup

```bash
git clone https://github.com/JensS/opencloud-video-review.git
cd opencloud-video-review
npm install
npm run build
docker compose up -d
# → https://localhost:9200 (accept self-signed cert, login: admin/admin)
```

For rebuild-on-change: `npx vite build --watch`

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

## 🙏 Credits

- Built for the [OpenCloud](https://opencloud.eu) ecosystem
- Inspired by [OpenVidReview](https://github.com/davidguva/OpenVidReview)
- Created by [Jens Sage](https://jenssage.com) / [Studio Oggi](https://studio-oggi.com)
