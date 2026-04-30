import { redirect } from 'next/navigation';

// Legacy route — superseded by /settings/billing in 2026-05.
// Kept as a redirect so old bookmarks/links don't break.
export default function ZatcaRedirectPage(): never {
  redirect('/settings/billing');
}
