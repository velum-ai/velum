import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "not found",
};

export default function NotFound() {
  return (
    <>
      <Header />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
        <h1 className="text-3xl font-medium tracking-tight sm:text-5xl">404</h1>

        <p className="max-w-md leading-7 text-muted sm:leading-8">
          this page doesn’t exist.{" "}
          <Link href="/" className="underline hover:text-foreground">
            back home
          </Link>
        </p>
      </main>

      <Footer />
    </>
  );
}
