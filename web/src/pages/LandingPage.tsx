import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { Hero } from "../components/landing/Hero";
import { PainPoints } from "../components/landing/PainPoints";
import { HowItWorks } from "../components/landing/HowItWorks";
import { Features } from "../components/landing/Features";
import { SocialProof } from "../components/landing/SocialProof";
import { Pricing } from "../components/landing/Pricing";
import { CTAFinal } from "../components/landing/CTAFinal";

export function LandingPage() {
  return (
    <div className="relative min-h-screen">
      <Header />
      <main>
        <Hero />
        <PainPoints />
        <HowItWorks />
        <Features />
        <SocialProof />
        <Pricing />
        <CTAFinal />
      </main>
      <Footer />
    </div>
  );
}
