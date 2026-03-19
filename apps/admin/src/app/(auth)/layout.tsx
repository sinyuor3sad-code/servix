import type { ReactNode, ReactElement } from 'react';

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--primary-950)] p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
