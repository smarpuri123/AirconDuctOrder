import type { CapacitorConfig } from '@capacitor/cli'

/** Production VPS — override with CAPACITOR_SERVER_URL for other hosts */
const serverHost =
  process.env.CAPACITOR_SERVER_URL?.replace(/\/$/, '') ?? 'http://94.136.190.140'

const config: CapacitorConfig = {
  appId: 'com.ecovent.dispatch',
  appName: 'ECOVENT Dispatch',
  webDir: 'dist',
  server: {
    url: `${serverHost}/m`,
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
