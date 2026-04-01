'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar, Header, BottomNav } from '@/components/layout';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui';
import { useQuery } from '@tanstack/react-query';
import { settingsService } from '@/services/settings.service';

/** Routes the cashier role is allowed to access */
const CASHIER_ALLOWED = ['/pos', '/pos/quick'];

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  const { isAuthenticated, isLoading, accessToken, userRole, isOwner } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsService.getAll(accessToken!),
    enabled: !!accessToken && isAuthenticated,
  });

  const onboardingCompleted = settings?.onboarding_completed === 'true';
  const isOnboardingPage = pathname?.includes('/onboarding');

  const handleMobileOpen = useCallback(() => {
    setMobileMenuOpen(true);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const skipAuth = isLocalhost && !accessToken;

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!skipAuth && !isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router, skipAuth]);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!skipAuth && !isLoading && !settingsLoading && isAuthenticated && !isOnboardingPage && accessToken && settings !== undefined && !onboardingCompleted) {
      router.replace('/onboarding');
    }
  }, [skipAuth, isLoading, settingsLoading, isAuthenticated, isOnboardingPage, onboardingCompleted, router, accessToken, settings]);

  // RBAC: Cashier can ONLY access /pos and /pos/quick
  useEffect(() => {
    if (skipAuth || isLoading || !isAuthenticated || !userRole) return;

    const isCashierOnly = userRole === 'cashier' && !isOwner;
    const isPosRoute = CASHIER_ALLOWED.some((r) => pathname === r || pathname?.startsWith(r + '/'));

    if (isCashierOnly && !isPosRoute) {
      router.replace('/pos');
    }
  }, [skipAuth, isLoading, isAuthenticated, userRole, isOwner, pathname, router]);

  if (!skipAuth && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Not authenticated — useEffect will redirect to /login, show spinner briefly
  if (!skipAuth && !isAuthenticated) {
    return null;
  }

  if (isOnboardingPage) {
    return <>{children}</>;
  }

  // POS pages render fullscreen — no sidebar, header, or bottom nav
  const isPOSPage = pathname?.startsWith('/pos');
  if (isPOSPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={handleMobileClose} />

      <div className="flex flex-1 flex-col min-w-0">
        <Header onMenuToggle={handleMobileOpen} />

        <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
