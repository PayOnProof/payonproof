"use client";

import { WalletProvider } from "@/lib/wallet-context";
import { PopHeader } from "@/components/pop-header";
import { GradientMesh } from "@/components/gradient-mesh";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FeaturesSection } from "@/components/landing/features-section";
import { CtaSection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

export default function Page() {
  return (
    <WalletProvider>
      <div className="relative min-h-screen overflow-x-hidden bg-background">
        <GradientMesh />
        <PopHeader />
        <main>
          <HeroSection />
          <HowItWorks />
          <FeaturesSection />
          <CtaSection />
        </main>
        <Footer />
      </div>
    </WalletProvider>
  );
}