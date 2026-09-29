export default function FullScreenNotice({ eyebrow, title, message, action }) {
  return (
    <main className="mx-auto -mt-[57px] flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      {eyebrow && (
        <p className="text-xs uppercase tracking-[0.12em] text-faint">
          {eyebrow}
        </p>
      )}
      <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
        {title}
      </h1>
      {message && <p className="leading-7 text-muted">{message}</p>}
      {action}
    </main>
  );
}
