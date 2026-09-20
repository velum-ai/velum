# Velum

LLM chat proxy: numbered accounts (no identity), token-metered credits,
OpenRouter upstream. This file names the domain so code and conversation use
the same words.

## Language

**Account**:
A 16-digit anonymous number owning credits and chats - the only identity in the system.
_Avoid_: user, customer

**Credit**:
The billing unit, pegged at 100 credits = 1 USD.
_Avoid_: token (tokens are the upstream unit credits are computed from)

**Reservation**:
Worst-case credits deducted before an upstream call, settled to actual afterwards.
_Avoid_: hold, lock

**Settle**:
Refunding the unused part of a reservation once actual usage is known (or estimated on abort).

**Exchange**:
One user message plus its assistant reply - the unit that is billed, persisted, and streamed.
_Avoid_: turn, round-trip

**Chat**:
An ordered list of exchanges under one account, with a title and accumulated spend.
_Avoid_: conversation, thread

**Guard**:
The admission check every API route runs first: per-ip rate limit, then uniform account validation (no account oracle).

**Upstream**:
The LLM provider (OpenRouter, or any OpenAI-compatible `/chat/completions` API via env). Its wire format is confined to `src/lib/upstream.js`.
_Avoid_: provider, backend

## Relationships

- An **Account** owns many **Chats** and one credit balance.
- A **Chat** is a list of **Exchanges**; each exchange's cost accumulates on the chat's spend.
- An **Exchange** starts with a **Reservation** and ends with a **Settle**, even when the stream aborts.
- Every API route passes through the **Guard** before touching an **Account**.

## Example dialogue

> **Dev:** "If the user hits stop mid-stream, do we refund the whole **Reservation**?"
> **Domain expert:** "No - the **Exchange** still happened. We **Settle** from a character-based estimate of the partial reply and persist it on the **Chat**."

## Flagged ambiguities

- "account" previously meant both the number (string) and the stored record - resolved: **Account** is the record; the number is its key.
