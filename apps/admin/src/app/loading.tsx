export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#06060a' }}>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400/20 border-t-amber-400" />
    </div>
  );
}
