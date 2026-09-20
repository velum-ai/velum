"use client";

import { useEffect } from "react";

export const TWCLID_KEY = "velum_twclid";

// Captures X's ad click id from the landing URL (?twclid=...) so it can be
// attached to a signup later and reported server-side. No script, no cookie,
// nothing sent anywhere from here, just a local note for account creation to
// pick up if this visit came from an ad.
export default function AdClickCapture() {
  useEffect(() => {
    const twclid = new URLSearchParams(window.location.search).get("twclid");
    if (twclid) localStorage.setItem(TWCLID_KEY, twclid);
  }, []);
  return null;
}
