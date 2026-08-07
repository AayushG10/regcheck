import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import Comparison from "@/components/landing/Comparison";
import ROI from "@/components/landing/ROI";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import Footer from "@/components/landing/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Nav />
      <Hero />
      <HowItWorks />
      <Features />
      <Comparison />
      <ROI />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}
