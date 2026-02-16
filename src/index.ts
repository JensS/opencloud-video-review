import { AppWrapperRoute, defineWebApplication } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import { computed } from 'vue'
import App from './App.vue'

const appId = 'video-review'

const VIDEO_EXTENSIONS = [
  'mp4', 'mov', 'webm', 'mkv', 'avi', 'mxf', 'm4v', 'ogv'
]

const VIDEO_MIMETYPES = [
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
  'video/avi', 'video/x-msvideo', 'video/mxf', 'video/ogg'
]

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const routes = [
      {
        name: 'video-review',
        path: '/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(App, {
          applicationId: appId
        }),
        meta: {
          authContext: 'hybrid' as const,
          title: $gettext('Video Review'),
          patchCleanPath: true
        }
      }
    ]

    const fileExtensions = VIDEO_EXTENSIONS.map((ext, i) => ({
      extension: ext,
      routeName: 'video-review',
      label: $gettext('Open in Video Review'),
      ...(VIDEO_MIMETYPES[i] ? { mimeType: VIDEO_MIMETYPES[i] } : {})
    }))

    return {
      appInfo: {
        name: $gettext('Video Review'),
        id: appId,
        icon: 'vidicon-line',
        extensions: fileExtensions
      },
      routes
    }
  }
})
