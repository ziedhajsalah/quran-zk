import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useHydrated,
} from '@tanstack/react-router'
import {
  ColorSchemeScript,
  DirectionProvider,
  MantineProvider,
  mantineHtmlProps,
} from '@mantine/core'
import * as React from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { fetchAppSession } from '~/lib/auth'
import appCss from '~/styles/app.css?url'
import { appTheme } from '~/theme'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  beforeLoad: async () => {
    const session = await fetchAppSession()
    return { isAuthenticated: Boolean(session.currentUser) }
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'المكتبة المباركة',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  notFoundComponent: () => <div>الصفحة غير موجودة</div>,
  component: RootComponent,
})

function RootComponent() {
  return (
    <DirectionProvider initialDirection="rtl">
      <RootDocument>
        <MantineProvider theme={appTheme} defaultColorScheme="auto">
          <Outlet />
        </MantineProvider>
      </RootDocument>
    </DirectionProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated()
  return (
    <html {...mantineHtmlProps} lang="ar" dir="rtl">
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
        <HeadContent />
      </head>
      <body data-app-ready={hydrated}>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
