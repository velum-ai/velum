import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <main className="flex flex-1 items-center">
        <Hero />
      </main>

      <Footer />
    </div>
  );
}
