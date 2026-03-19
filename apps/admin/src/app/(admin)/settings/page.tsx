'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

export default function SettingsPage(): ReactElement {
  const [platformName, setPlatformName] = useState('SERVIX');
  const [supportEmail, setSupportEmail] = useState('support@servix.sa');
  const [supportPhone, setSupportPhone] = useState('+966500000000');
  const [defaultCurrency, setDefaultCurrency] = useState('SAR');
  const [defaultLanguage, setDefaultLanguage] = useState('ar');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch {
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="الإعدادات"
        description="إعدادات المنصة العامة"
      />

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>الإعدادات العامة</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="اسم المنصة"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
              />
              <Input
                label="البريد الإلكتروني للدعم"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                dir="ltr"
              />
              <Input
                label="هاتف الدعم"
                type="tel"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                dir="ltr"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="w-full space-y-1.5">
                  <label className="block text-sm font-medium text-[var(--foreground)]">
                    العملة الافتراضية
                  </label>
                  <select
                    value={defaultCurrency}
                    onChange={(e) => setDefaultCurrency(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="AED">درهم إماراتي (AED)</option>
                    <option value="KWD">دينار كويتي (KWD)</option>
                    <option value="BHD">دينار بحريني (BHD)</option>
                    <option value="QAR">ريال قطري (QAR)</option>
                    <option value="OMR">ريال عماني (OMR)</option>
                  </select>
                </div>
                <div className="w-full space-y-1.5">
                  <label className="block text-sm font-medium text-[var(--foreground)]">
                    اللغة الافتراضية
                  </label>
                  <select
                    value={defaultLanguage}
                    onChange={(e) => setDefaultLanguage(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    <option value="ar">العربية</option>
                    <option value="en">الإنجليزية</option>
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
