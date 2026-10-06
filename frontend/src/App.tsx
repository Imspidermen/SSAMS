import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthProvider';
import { ThemeProvider } from '@/context/ThemeProvider';
import { ToastProvider } from '@/context/ToastProvider';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppRoutes } from '@/routes/AppRoutes';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

/**
 * Wires the error boundary to the session so "Return to dashboard" lands on the
 * dashboard of the role that is actually signed in.
 */
function GuardedRoutes() {
  const { role } = useAuth();

  return (
    <ErrorBoundary role={role}>
      <AppRoutes />
    </ErrorBoundary>
  );
}

/**
 * Application root.
 *
 * Provider order matters:
 *   QueryClientProvider - server state cache (cleared on logout / session expiry)
 *   ThemeProvider       - persisted light/dark preference (UI only)
 *   ToastProvider       - replaces every browser alert()/confirm()
 *   BrowserRouter       - routing context for the guards and links
 *   AuthProvider        - session bootstrap; uses the query client
 *   ErrorBoundary       - last line of defence before a blank screen
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <GuardedRoutes />
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
