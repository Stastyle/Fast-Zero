/**
 * App version derived from the merged PR number, injected at build time
 * by the deploy workflow via VITE_PR_NUMBER. Local dev builds show v0.dev.
 */
const prNumber = import.meta.env.VITE_PR_NUMBER

export const appVersion = prNumber ? `v0.${prNumber}` : 'v0.dev'
