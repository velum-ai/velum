"use client";

import { useEffect, useState } from "react";

// Sun / moon toggle. Persists to localStorage and flips data-theme on <html>.
// The no-flash script in the root layout applies the stored choice before paint;
// this only needs to reflect and update it.
const SunIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

function currentTheme() {
  if (typeof document === "undefined") return "dark";
  if (document.documentElement.dataset.theme) {
    return document.documentElement.dataset.theme;
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    // reflect the theme the pre-paint script already applied to <html>
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(currentTheme());
  }, []);

  const toggle = () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("velum_theme", next);
    } catch {
      /* storage blocked */
    }
    setTheme(next);
  };

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "switch to light" : "switch to dark"}
      aria-label="toggle theme"
      className={`grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground ${className}`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
