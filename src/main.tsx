import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { apiErrorMessage, apiErrorCode } from '@/lib/api/client'
import { DirectionProvider } from './context/direction-provider'
import { FontProvider } from './context/font-provider'
import { ThemeProvider } from './context/theme-provider'
import { routeTree } from './routeTree.gen'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const code = apiErrorCode(error)
        if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
      staleTime: 15 * 1000,
    },
    mutations: {
      onError: (error) => {
        const code = apiErrorCode(error)
        if (code === 'UNAUTHORIZED') return
        toast.error(apiErrorMessage(error))
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (apiErrorCode(error) === 'UNAUTHORIZED') {
        useAuthStore.getState().reset()
        const redirect = `${router.history.location.pathname}`
        if (!redirect.startsWith('/sign-in')) {
          router.navigate({ to: '/sign-in', search: { redirect }, replace: true })
        }
      }
    },
  }),
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FontProvider>
            <DirectionProvider>
              <RouterProvider router={router} />
            </DirectionProvider>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
