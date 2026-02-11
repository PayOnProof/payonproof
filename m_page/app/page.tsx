"use client";

import { WalletProvider } from "@/lib/wallet-context";
import { PopHeader } from "@/components/pop-header";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FeaturesSection } from "@/components/landing/features-section";
import { CtaSection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

export default function Page() {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-background">
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
