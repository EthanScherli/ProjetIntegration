/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// Activate new versions right away (registerType: 'autoUpdate')
self.skipWaiting()
clientsClaim()

// Cache every built file; the list is injected at build time
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Serve the app shell for page navigations so it opens offline,
// but let API calls go to the server
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api/] }))
