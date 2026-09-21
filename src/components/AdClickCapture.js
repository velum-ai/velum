"use client";

import { useEffect } from "react";

export const TWCLID_KEY = "velum_twclid";
export const RDT_CID_KEY = "velum_rdt_cid";

// Captures an ad network's click id from the landing URL (X: ?twclid=,
// Reddit: ?rdt_cid=) so it can be attached to a signup later and reported
// server-side. No script, no cookie, nothing sent anywhere from here, just a
// local note for account creation to pick up if this visit came from an ad.
export default function AdClickCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const twclid = params.get("twclid");
    const rdtCid = params.get("rdt_cid");
    if (twclid) localStorage.setItem(TWCLID_KEY, twclid);
    if (rdtCid) localStorage.setItem(RDT_CID_KEY, rdtCid);
  }, []);
  return null;
}
