import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "learn more",
};

const sections = [
  {
    heading: "no signup, just a number",
    body: "there's no name, email, or phone number anywhere in the system. creating an account generates a random 16-digit number, that's your entire identity, and your only way back in. there's no recovery, so keep it somewhere safe.",
  },
  {
    heading: "add credit, spend only what you use",
    body: "there's no subscription and no monthly fee. add credit whenever you want, and each reply is billed for exactly what it cost to generate. unused credit just sits there until you need it.",
  },
  {
    heading: "open source, self-hostable",
    body: "the entire codebase is public. if you'd rather not trust our servers with your conversations, run your own instance instead, same code, your infrastructure.",
  },
];

export default function LearnPage() {
  return (
    <>
      <Header />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
        <h1 className="text-2xl font-medium tracking-tight sm:text-4xl">
          learn more
        </h1>

        <section className="flex flex-col border-t border-border">
          {sections.map((item) => (
            <div
              key={item.heading}
              className="flex flex-col gap-2 border-b border-border py-5 sm:py-6"
            >
              <h2 className="text-base font-medium">{item.heading}</h2>
              <p className="max-w-2xl leading-7 text-muted">{item.body}</p>
            </div>
          ))}
        </section>
      </main>

      <Footer />
    </>
  );
}
