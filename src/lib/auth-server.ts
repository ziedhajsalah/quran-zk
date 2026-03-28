import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'

function getRequiredEnv(name: 'VITE_CONVEX_URL' | 'VITE_CONVEX_SITE_URL') {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name} environment variable.`)
  }
  return value
}

export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  convexUrl: getRequiredEnv('VITE_CONVEX_URL'),
  convexSiteUrl: getRequiredEnv('VITE_CONVEX_SITE_URL'),
})
