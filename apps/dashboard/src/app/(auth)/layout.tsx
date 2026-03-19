export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--primary-50)] via-[var(--background)] to-[var(--primary-100)] p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-primary)] text-white shadow-lg">
            <span className="text-2xl font-bold">S</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">SERVIX</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            منصة إدارة صالونات التجميل
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}
