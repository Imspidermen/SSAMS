import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@/context/ThemeProvider';
import { ToastProvider } from '@/context/ToastProvider';

/**
 * A query client with retries and caching disabled, so tests observe exactly one
 * fetch per query and never inherit state from a previous test.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface RenderOptions {
  route?: string;
  queryClient?: QueryClient;
  /** Extra providers (e.g. an auth stub) wrapped around the tree. */
  wrapper?: ({ children }: { children: ReactNode }) => ReactElement;
}

/**
 * Renders a component with the same provider stack the real app uses, minus
 * AuthProvider (tests stub `useAuth` directly so no network bootstrap happens).
 */
export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const Wrapper = options.wrapper;

  const tree = (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

  const result = render(Wrapper ? <Wrapper>{tree}</Wrapper> : tree);
  return { ...result, queryClient };
}
