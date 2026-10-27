import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HomeAbout from "@/components/HomeAbout";
import HomeHowItWorks from "@/components/HomeHowItWorks";
import HomeCTA from "@/components/HomeCTA";
import Footer from "@/components/Footer";

// The root layout's title template only applies to nested routes, not the
// root page itself, so the full string is written out here directly.
export const metadata = {
  title: "velum - chat with the best ai models without giving up your identity",
  description:
    "chat with the best ai models without giving up your identity. no email or password, pay-as-you-go credit, encrypted conversations.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <Header />

      <main className="flex flex-1 flex-col">
        <Hero />
        <HomeAbout />
        <HomeHowItWorks />
        <HomeCTA />
      </main>

      <Footer />
    </>
  );
}
