import { Outlet } from 'react-router-dom';

/** Bare layout for unauthenticated screens (login). */
export function AuthLayout() {
  return <Outlet />;
}
