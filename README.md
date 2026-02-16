# 🎬 OpenCloud Video Review

**Video review and annotation for OpenCloud.**

A web extension for [OpenCloud](https://opencloud.eu) that turns any shared video link into a collaborative review tool. Clients and collaborators can leave timestamped comments, draw annotations on frames, approve or request revisions — and you can export everything as an EDL for DaVinci Resolve.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ Features

- **Timestamped Comments** — Click the timeline to leave frame-accurate notes
- **Color Tags** — Mark comments as issues (red), notes (yellow), approvals (green), suggestions (blue), or creative ideas (purple)
- **Frame Annotations** — Draw directly on the video frame, attached to comments
- **Approval Workflow** — ✅ Approved / 🔄 Revisions Needed / ⏳ Pending
- **EDL Export** — Export comments as CMX 3600 EDL for DaVinci Resolve, Premiere, Avid
- **JSON Export** — Full review data export for archival
- **Keyboard Shortcuts** — Frame-step with arrow keys, J/K/L for playback
- **Works with Public Links** — No login required for reviewers
- **Dark UI** — Clean, professional interface built for video work
- **Sidecar Storage** — Reviews stored as `.review.json` next to the video file
- **localStorage Fallback** — Works even when write access is limited

## 📦 Supported Formats

Any format the browser can play natively:
- `.mp4` (H.264, H.265)
- `.mov` (H.264)
- `.webm` (VP8, VP9, AV1)
- `.mkv` (VP8, VP9)
- `.ogv`

> **Note:** RAW formats like `.braw` or `.r3d` need to be transcoded to H.264 proxies first.

## 🚀 Installation

### As an OpenCloud Web App

1. Download the latest release from [Releases](https://github.com/jenssage/opencloud-video-review/releases)
2. Copy the `video-review/` folder into your OpenCloud web apps directory:
   ```
   $OC_BASE_DATA_PATH/web/assets/apps/video-review/
   ```
   By default this is `/var/lib/opencloud/web/assets/apps/video-review/`. If the `apps` directory doesn't exist, create it.

3. Register the app in your OpenCloud Web configuration (e.g. `web.yaml` referenced by `WEB_UI_CONFIG_FILE`):
   ```yaml
   apps:
     - files
     - search
     - text-editor
     - pdf-viewer
     - preview
     - app-store
     - video-review   # ← add this
   ```

4. **Content Security Policy:** Video playback requires `blob:` in `media-src`. Create a CSP config file (e.g. `csp.yaml`) and reference it via `PROXY_CSP_CONFIG_FILE_LOCATION`:
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
   > ⚠️ Use **hyphens** (`media-src`), not underscores (`media_src`).

5. Restart OpenCloud.

#### Docker Compose Example

```yaml
services:
  opencloud:
    image: opencloudeu/opencloud:latest
    ports:
      - "9200:9200"
    entrypoint: ["/bin/sh", "-c"]
    command: ["opencloud init || true; opencloud server"]
    environment:
      OC_URL: https://localhost:9200
      OC_INSECURE: "true"
      IDM_CREATE_DEMO_USERS: "true"
      IDM_ADMIN_PASSWORD: admin
      PROXY_ENABLE_BASIC_AUTH: "true"
      WEB_ASSET_APPS_PATH: /web/apps
      WEB_UI_CONFIG_FILE: /etc/opencloud/web.yaml
      PROXY_CSP_CONFIG_FILE_LOCATION: /etc/opencloud/csp.yaml
    volumes:
      - ocdata:/etc/opencloud
      - ./dist:/web/apps/video-review
      - ./config/csp.yaml:/etc/opencloud/csp.yaml:ro
      - ./config/web.yaml:/etc/opencloud/web.yaml:ro
volumes:
  ocdata:
```

#### Important Notes

- The build output **must** use `.js` extension — OpenCloud has no MIME mapping for `.cjs` and browsers reject it.
- CSS is inlined into the JS bundle via a custom Vite plugin (single-file deployment).
- The `opencloud init` entrypoint is required on first start to generate JWT secrets and certificates.

### Development

```bash
# Clone
git clone https://github.com/JensS/opencloud-video-review.git
cd opencloud-video-review

# Install dependencies
npm install

# Build (outputs single dist/web-app-video-review.js)
npm run build

# Start OpenCloud dev environment
docker compose up -d

# Open https://localhost:9200 (accept self-signed cert)
# Login: admin / admin
```

For development with rebuild-on-change:
```bash
npx vite build --watch
```

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
| `Ctrl+Enter` | Submit comment |

## 💾 Data Storage

Reviews are stored as **sidecar JSON files** next to the video:

```
project/
├── final_cut_v3.mp4
├── final_cut_v3.mp4.review.json   ← review data
```

When WebDAV write access is unavailable (e.g., read-only public links), comments fall back to browser `localStorage`.

### EDL Export

Comments export as standard CMX 3600 EDL files that DaVinci Resolve imports as markers:

```
TITLE: final_cut_v3 — Video Review
FCM: NON-DROP FRAME

001  AX       V     C        00:01:23:12 00:01:23:13 00:01:23:12 00:01:23:13
* FROM CLIP NAME: final_cut_v3.mp4
* LOC: 00:01:23:12 RED     Client: The color grading feels too warm here
* COMMENT: [RED] Client: The color grading feels too warm here
```

## 🏗️ Architecture

```
src/
├── index.ts                    # OpenCloud app registration
├── App.vue                     # Main review component
├── types.ts                    # TypeScript interfaces
├── composables/
│   └── useComments.ts          # Comment storage (WebDAV + localStorage)
├── utils/
│   ├── edl.ts                  # EDL export generator
│   └── time.ts                 # Timecode formatting
└── assets/
    └── style.scss              # Dark theme styles
```

## 🤝 Contributing

Contributions are welcome! This project is in early development.

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

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 🙏 Credits

- Inspired by [OpenVidReview](https://github.com/davidguva/OpenVidReview)
- Built for the [OpenCloud](https://opencloud.eu) ecosystem
- Created by [Jens Sage](https://jenssage.com) / [Studio Oggi](https://studio-oggi.com)
