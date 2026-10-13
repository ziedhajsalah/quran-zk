import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, gcTime: 5 * 60_000 } },
  })

  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      defaultPreload: 'intent',
      context: { queryClient },
      scrollRestoration: true,
      defaultPreloadStaleTime: 30_000,
      defaultErrorComponent: () => <p>تعذر تحميل الصفحة. حاول مرة أخرى.</p>,
      defaultNotFoundComponent: () => <p>الصفحة غير موجودة</p>,
    }),
    queryClient,
  )

  return router
}
