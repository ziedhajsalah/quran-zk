import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from '@tanstack/react-router'
import {
  ClerkProvider,
  UserButton,
  useAuth,
} from '@clerk/tanstack-react-start'
import { ColorSchemeScript, DirectionProvider, MantineProvider, mantineHtmlProps } from '@mantine/core'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import * as React from 'react'
import type { QueryClient } from '@tanstack/react-query'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import type { ConvexReactClient } from 'convex/react'
import appCss from '~/styles/app.css?url'
import { fetchClerkSession } from '~/lib/auth'
import { appTheme } from '~/theme'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexClient: ConvexReactClient
  convexQueryClient: ConvexQueryClient
}>()({
  beforeLoad: async ({ context }) => {
    const session = await fetchClerkSession()
    if (session.token) {
      context.convexQueryClient.serverHttpClient?.setAuth(session.token)
    }
    return session
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
  const context = useRouteContext({ from: Route.id })
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

  if (!publishableKey) {
    throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable.')
  }

  return (
    <ClerkProvider publishableKey={publishableKey} signInUrl="/login">
      <ConvexProviderWithClerk client={context.convexClient} useAuth={useAuth}>
        <DirectionProvider initialDirection="rtl">
          <MantineProvider theme={appTheme} defaultColorScheme="auto">
            <RootDocument>
              <Outlet />
            </RootDocument>
          </MantineProvider>
        </DirectionProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html {...mantineHtmlProps} lang="ar" dir="rtl">
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
        <HeadContent />
      </head>
      <body>
        <header style={{ display: 'flex', justifyContent: 'flex-start', padding: '1rem 1rem 0' }}>
          <AuthControls />
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function AuthControls() {
  const { isSignedIn } = useAuth()

  if (!isSignedIn) {
    return <div />
  }

  return <UserButton />
}
