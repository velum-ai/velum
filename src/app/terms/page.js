import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "terms",
};

const points = [
  {
    title: "your account number",
    body: "it's the only way to access your account. if you lose it, we have no way to recover it for you, since we don't collect any other information about you.",
  },
  {
    title: "credit",
    body: "credit is prepaid and non-refundable once used. unused credit doesn't expire.",
  },
  {
    title: "payments",
    body: "payments are handled by dodo payments, our merchant of record. adding credit is also subject to their terms.",
  },
  {
    title: "fair use",
    body: "don't use velum for anything illegal, or to abuse or overload the service.",
  },
  {
    title: "changes",
    body: "these terms may be updated from time to time. continuing to use velum means you accept the current version.",
  },
];

export default function TermsPage() {
  return (
    <>
      <Header />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-medium tracking-tight sm:text-4xl">
            terms
          </h1>
          <p className="leading-7 text-muted">what you’re agreeing to.</p>
        </div>

        <section className="flex flex-col border-t border-border">
          {points.map((point) => (
            <div
              key={point.title}
              className="flex flex-col gap-2 border-b border-border py-5 sm:py-6"
            >
              <h2 className="text-base font-medium">{point.title}</h2>
              <p className="max-w-2xl leading-7 text-muted">{point.body}</p>
            </div>
          ))}
        </section>
      </main>

      <Footer />
    </>
  );
}
