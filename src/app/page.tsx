import { SiteHeader } from "@/components/landing/site-header";
import { HeroSection } from "@/components/landing/hero-section";
import { ThesisSection } from "@/components/landing/thesis-section";
import { HashStrip } from "@/components/landing/hash-strip";
import { LivePreviewSection } from "@/components/landing/live-preview-section";
import { FooterWordmark } from "@/components/landing/footer-wordmark";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-black text-grey">
        <HeroSection />
        <ThesisSection />
        <HashStrip />
        <LivePreviewSection />
        <FooterWordmark />
      </main>
    </>
  );
}
