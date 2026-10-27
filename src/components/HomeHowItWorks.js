import { HashIcon, CoinIcon, ChatIcon, ShieldIcon } from "@/components/HomeIcons";

const steps = [
  { icon: HashIcon, title: "create an account", body: "a random number, nothing else" },
  { icon: CoinIcon, title: "add credit", body: "pay only for what you use" },
  { icon: ChatIcon, title: "pick a model", body: "leading models, tools built in" },
  { icon: ShieldIcon, title: "stay private", body: "conversations encrypted at rest" },
];

export default function HomeHowItWorks() {
  return (
    <section className="mx-auto w-full max-w-5xl border-t border-border px-5 py-16 sm:px-8 sm:py-20">
      <h2 className="text-sm uppercase tracking-[0.14em] text-faint">
        how it works
      </h2>
      <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
        {steps.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex flex-col gap-3">
            <span className="text-foreground">
              <Icon />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="text-sm leading-6 text-muted">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
