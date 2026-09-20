import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "privacy",
};

const points = [
  {
    title: "numbered accounts",
    body: "velum accounts are identified only by a randomly generated account number. no name, email address or phone number is required or requested.",
  },
  {
    title: "what we store",
    body: "your account number, credit balance and chat history. chat content, reasoning, chat titles and custom instructions are encrypted at rest. that's all that's required for the service to work.",
  },
  {
    title: "payments",
    body: "payments are handled by dodo payments, our merchant of record. they collect an email and billing address to charge the card and issue a receipt, as tax rules require. velum never receives or stores it. we keep only the amount, the credits added, and the date.",
  },
  {
    title: "abuse prevention",
    body: "ip addresses are used briefly to rate limit requests and prevent abuse. they aren't attached to your account or stored long-term.",
  },
  {
    title: "tracking",
    body: "no analytics. no advertising. no third-party trackers. no fingerprinting.",
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Header />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-medium tracking-tight sm:text-4xl">
            privacy
          </h1>
          <p className="leading-7 text-muted">
            we collect only what’s necessary to operate the service.
          </p>
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
