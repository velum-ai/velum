import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />

      <main className="flex flex-1 items-center">
        <Hero />
      </main>

      <Footer />
    </>
  );
}
