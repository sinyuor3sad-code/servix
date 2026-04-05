'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { adminService } from '@/services/admin.service';
import { ApiError } from '@/lib/api';
import { Eye, EyeOff, Lock, Mail, ArrowLeft, Shield } from 'lucide-react';

export default function AdminLoginPage(): ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuthStore();
  const router = useRouter();

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!email || !password) {
      toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);
    try {
      const result = await adminService.login(email, password);
      login(result.user, result.accessToken, result.refreshToken);
      toast.success('تم تسجيل الدخول بنجاح');
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('حدث خطأ أثناء تسجيل الدخول');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Logo + Title */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        {/* Animated logo */}
        <div style={{
          width: 72, height: 72,
          margin: '0 auto 20px',
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(201,168,76,0.15) 0%, rgba(99,102,241,0.1) 100%)',
          border: '1px solid rgba(201,168,76,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 60px rgba(201,168,76,0.1), 0 0 30px rgba(99,102,241,0.05), inset 0 0 30px rgba(201,168,76,0.05)',
          position: 'relative',
        }}>
          <span style={{
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: '0.02em',
            background: 'linear-gradient(135deg, #C9A84C, #E8D48B)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: "'Inter', sans-serif",
          }}>S</span>
          {/* Subtle ring animation */}
          <div style={{
            position: 'absolute', inset: -4,
            borderRadius: 24,
            border: '1px solid rgba(201,168,76,0.1)',
            animation: 'pulse 3s ease-in-out infinite',
          }} />
        </div>

        <h1 style={{
          fontSize: 24,
          fontWeight: 800,
          color: 'var(--slate)',
          letterSpacing: '-0.02em',
          fontFamily: "'Inter', 'Cairo', sans-serif",
        }}>
          SERVIX
        </h1>
        <p style={{
          fontSize: 13,
          color: 'var(--muted)',
          marginTop: 6,
          fontWeight: 500,
        }}>
          نظام القيادة السيادي
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: 32,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Security badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 24,
          padding: '10px 14px',
          borderRadius: 12,
          background: 'rgba(201,168,76,0.04)',
          border: '1px solid rgba(201,168,76,0.08)',
        }}>
          <Shield size={14} style={{ color: 'var(--gold)', opacity: 0.6 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
            اتصال آمن ومشفّر — وصول المدير فقط
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ghost)',
              marginBottom: 8,
            }}>
              البريد الإلكتروني
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                right: 14, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--ghost)',
                pointerEvents: 'none',
              }}>
                <Mail size={16} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@servi-x.com"
                dir="ltr"
                style={{
                  width: '100%',
                  height: 48,
                  paddingInlineStart: 44,
                  paddingInlineEnd: 14,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--slate)',
                  fontSize: 14,
                  fontWeight: 500,
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  fontFamily: "'Inter', monospace",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(201,168,76,0.3)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.06)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ghost)',
              marginBottom: 8,
            }}>
              كلمة المرور
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                right: 14, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--ghost)',
                pointerEvents: 'none',
              }}>
                <Lock size={16} />
              </div>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                style={{
                  width: '100%',
                  height: 48,
                  paddingInlineStart: 44,
                  paddingInlineEnd: 44,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--slate)',
                  fontSize: 14,
                  fontWeight: 500,
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  fontFamily: "'Inter', monospace",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(201,168,76,0.3)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.06)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  left: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'var(--ghost)', cursor: 'pointer',
                  padding: 0,
                }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 14,
              border: 'none',
              background: loading
                ? 'rgba(201,168,76,0.2)'
                : 'linear-gradient(135deg, #C9A84C 0%, #B8943F 50%, #A68435 100%)',
              color: loading ? 'var(--muted)' : '#0A0A0F',
              fontSize: 15,
              fontWeight: 800,
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'all 0.3s',
              boxShadow: loading ? 'none' : '0 6px 24px rgba(201,168,76,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
              fontFamily: "'Cairo', 'Inter', sans-serif",
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 18, height: 18,
                  border: '2px solid rgba(0,0,0,0.2)',
                  borderTopColor: 'rgba(0,0,0,0.6)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  display: 'inline-block',
                }} />
                جارٍ الدخول...
              </>
            ) : (
              <>
                <ArrowLeft size={16} />
                دخول نظام القيادة
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p style={{
        textAlign: 'center',
        marginTop: 20,
        fontSize: 11,
        color: 'var(--ghost)',
        fontWeight: 500,
      }}>
        SERVIX v9 — Sovereign Command Environment
      </p>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
}
