import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { bookingApi } from '@/lib/api';
import { lightenColor, darkenColor } from '@/lib/utils';

type SalonLayoutProps = {
  params: Promise<{ slug: string }>;
  children: ReactNode;
};

export default async function SalonLayout({
  params,
  children,
}: SalonLayoutProps): Promise<ReactElement> {
  const { slug } = await params;

  let primaryColor = '#8b5cf6';

  try {
    const salon = await bookingApi.getSalonInfo(slug);
    primaryColor = salon.primaryColor;
  } catch {
    // Default theme applied; page component handles not-found
  }

  return (
    <div
      style={
        {
          '--brand-primary': primaryColor,
          '--brand-primary-light': lightenColor(primaryColor),
          '--brand-primary-dark': darkenColor(primaryColor),
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
