'use client';

export default function OfflinePage() {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'linear-gradient(135deg, #07051a 0%, #1a0f3c 100%)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '24px',
          background: 'rgba(139, 92, 246, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
          fontSize: '2.5rem',
        }}
      >
        📡
      </div>
      <h1
        style={{
          fontSize: '1.75rem',
          fontWeight: 900,
          marginBottom: '0.75rem',
          background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        غير متصل بالإنترنت
      </h1>
      <p
        style={{
          fontSize: '0.95rem',
          color: 'rgba(255,255,255,0.6)',
          maxWidth: '300px',
          lineHeight: 1.7,
          marginBottom: '2rem',
        }}
      >
        تأكد من اتصالك بالإنترنت وحاول مجدداً. سيتم تحميل آخر نسخة محفوظة تلقائياً.
      </p>
      <button
        onClick={() => typeof window !== 'undefined' && window.location.reload()}
        style={{
          padding: '0.875rem 2rem',
          borderRadius: '1rem',
          border: 'none',
          background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.95rem',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
        }}
      >
        🔄 إعادة المحاولة
      </button>
    </div>
  );
}
