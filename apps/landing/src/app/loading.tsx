export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#03020a' }}>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-400/20 border-t-purple-400" />
    </div>
  );
}
