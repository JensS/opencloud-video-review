# 🎬 OpenCloud Video Review

**Frame.io-style video review and annotation for OpenCloud.**

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
2. Extract to your OpenCloud web apps directory
3. Add to your OpenCloud Web configuration:

```yaml
web:
  config:
    external_apps:
      - id: video-review
        path: /path/to/web-app-video-review.js
```

4. Restart OpenCloud

### Development

```bash
# Clone
git clone https://github.com/jenssage/opencloud-video-review.git
cd opencloud-video-review

# Install dependencies
pnpm install

# Development with hot reload
pnpm build:w

# In another terminal, start OpenCloud dev environment
docker compose up

# Open https://host.docker.internal:9200
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

- Inspired by [Frame.io](https://frame.io) and [OpenVidReview](https://github.com/davidguva/OpenVidReview)
- Built for the [OpenCloud](https://opencloud.eu) ecosystem
- Created by [Jens Sage](https://jenssage.com) / [Studio Oggi](https://studio-oggi.com)
