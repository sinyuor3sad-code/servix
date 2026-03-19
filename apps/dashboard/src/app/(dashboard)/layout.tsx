'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar, Header, BottomNav } from '@/components/layout';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui';
import { useQuery } from '@tanstack/react-query';
import { settingsService } from '@/services/settings.service';

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  const { isAuthenticated, isLoading, accessToken } = useAuth();
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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && !settingsLoading && isAuthenticated && !isOnboardingPage && accessToken && settings !== undefined && !onboardingCompleted) {
      router.replace('/onboarding');
    }
  }, [isLoading, settingsLoading, isAuthenticated, isOnboardingPage, onboardingCompleted, router, accessToken, settings]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isOnboardingPage) {
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
