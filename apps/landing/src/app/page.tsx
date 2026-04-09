import Navbar          from '@/components/navbar';
import Hero            from '@/components/hero';
import Marquee         from '@/components/marquee';
import ProductShowcase from '@/components/product-showcase';
import Capabilities    from '@/components/capabilities';
import HowItWorks      from '@/components/how-it-works';
import Stats           from '@/components/stats';
import Testimonials    from '@/components/testimonials';
import Pricing         from '@/components/pricing';
import FAQ             from '@/components/faq';
import CTASection      from '@/components/cta-section';
import Footer          from '@/components/footer';

export default function LandingPage(): React.ReactElement {
  return (
    <>
      <Navbar />

      <main>
        <Hero />
        <Marquee />
        <ProductShowcase />
        <Capabilities />
        <HowItWorks />
        <Stats />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CTASection />
      </main>

      <Footer />
    </>
  );
}
