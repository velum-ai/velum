import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "learn more",
};

const steps = [
  {
    heading: "create an account",
    body: "click get started. a random 16-digit number is generated on the spot, that's the account: no email, no password, no name attached to it anywhere. it's also the only way back in, so save it before moving on.",
  },
  {
    heading: "add credit",
    body: "top up any amount, no subscription or recurring charge. 100 credits = $1.00, and it sits there until you spend it.",
  },
  {
    heading: "pick a model and chat",
    body: "choose a model from the menu above the message box. every reply shows what it cost right after it lands, so there's never a guess about where credit went.",
  },
  {
    heading: "your conversations stay private",
    body: "message content, titles, and any custom instructions are encrypted before they touch the database. even a full server breach only exposes ciphertext.",
  },
  {
    heading: "or run it yourself",
    body: "the whole codebase is open source. point it at your own database and api keys and it's a fully independent instance, same code, your infrastructure.",
  },
];

export default function LearnPage() {
  return (
    <>
      <Header />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-medium tracking-tight sm:text-4xl">
            how it works
          </h1>
          <p className="leading-7 text-muted">
            start to finish, in five steps.
          </p>
        </div>

        <section className="flex flex-col">
          {steps.map((item, i) => (
            <div
              key={item.heading}
              className={`flex gap-4 py-5 sm:py-6 ${
                i < steps.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="w-6 shrink-0 text-sm text-faint tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-base font-medium">{item.heading}</h2>
                <p className="max-w-2xl leading-7 text-muted">{item.body}</p>
              </div>
            </div>
          ))}
        </section>
      </main>

      <Footer />
    </>
  );
}
