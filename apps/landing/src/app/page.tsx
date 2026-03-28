import CosmicBg       from '@/components/cosmic-bg';
import Navbar          from '@/components/navbar';
import Hero            from '@/components/hero';
import Features        from '@/components/features';
import DevicesShowcase from '@/components/devices-showcase';
import HowItWorks      from '@/components/how-it-works';
import Pricing         from '@/components/pricing';
import Testimonials    from '@/components/testimonials';
import FAQ             from '@/components/faq';
import CTASection      from '@/components/cta-section';
import Footer          from '@/components/footer';

export default function LandingPage(): React.ReactElement {
  return (
    <>
      {/* ── Persistent cosmic canvas (fixed, behind everything) ── */}
      <CosmicBg />

      <Navbar />

      <main className="relative overflow-hidden">
        <Hero />
        <Features />
        <DevicesShowcase />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <FAQ />
        <CTASection />
      </main>

      <Footer />
    </>
  );
}
