import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "faq",
};

const questions = [
  {
    question: "what is an account number?",
    answer:
      "a random 16-digit number. it is the only identity velum has for you, and the only way to sign in. we can't recover it, so keep it safe.",
  },
  {
    question: "is my chat data encrypted?",
    answer:
      "yes. message content, reasoning, chat titles, and custom instructions are encrypted at rest. a database leak or backup exposes ciphertext, not conversations.",
  },
  {
    question: "how does billing work?",
    answer:
      "pay-as-you-go. 100 credits = $1.00. each message costs the model's token price plus a 40% markup that covers payment fees, refunds on cancelled replies, and hosting. you are billed for the tokens actually used and unused credit never expires. see the pricing page for per-model rates.",
  },
  {
    question: "what payment methods do you accept?",
    answer:
      "card, apple pay, google pay, bank transfer, and more through dodo payments, or monero through a self-hosted btcpay server with no processor in the middle. no bank or card details reach us either way.",
  },
  {
    question: "which models can i use?",
    answer:
      "a curated set through openrouter, grouped into efficient, flagship, coding, vision, long context, and uncensored. each group starts with its 5 best picks; add or remove models per group from the account page. pick one per message from the model menu; the cost of each reply is shown under it.",
  },
  {
    question: "what happens if a reply fails or i cancel it?",
    answer:
      "each reply reserves worst-case credits up front and settles to what it actually used. if it errors or you stop it, the unused credits are returned automatically.",
  },
  {
    question: "can i get a refund?",
    answer:
      "credit is non-refundable once used. unused credit never expires, so there's rarely a reason to need one. a genuine mistaken purchase you haven't spent is refundable on request.",
  },
  {
    question: "do i pay tax on top-ups?",
    answer:
      "dodo payments, our merchant of record, adds any sales tax or vat required for your location. the full total is shown on the checkout page before you pay.",
  },
  {
    question: "what are custom instructions?",
    answer:
      "optional text you save on the account page. it is added as a system message at the start of every new chat.",
  },
  {
    question: "can the model run code or search the web?",
    answer:
      "yes, automatically, whenever it decides it would help answer you. it can run python in an isolated sandbox (via e2b), search the web (via brave search), fetch the full content of a specific page, and generate images. each real use adds a small flat cost on top of the tokens spent, shown in the reply's cost breakdown.",
  },
  {
    question: "what happens to code the model runs?",
    answer:
      "it runs in a fresh, disposable sandbox created for that one call and destroyed right after. nothing persists between calls, and the sandbox has no access to other users' data.",
  },
  {
    question: "can i organize my chats?",
    answer: "yes, group them into projects from the sidebar.",
  },
  {
    question: "is there a free tier?",
    answer: "no. you add credit before your first message.",
  },
];

export default function FAQPage() {
  return (
    <>
      <Header />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
        <h1 className="text-2xl font-medium tracking-tight sm:text-4xl">faq</h1>

        <section className="flex flex-col border-t border-border">
          {questions.map((item) => (
            <div
              key={item.question}
              className="flex flex-col gap-2 border-b border-border py-5 sm:py-6"
            >
              <h2 className="text-base font-medium">{item.question}</h2>
              <p className="max-w-2xl leading-7 text-muted">{item.answer}</p>
            </div>
          ))}
        </section>
      </main>

      <Footer />
    </>
  );
}
