# Address format rule

How every postal address is rendered, in the API and in every app.
One implementation: **`@workspace/address`** (`lib/address/`).

## The rule

Per **UPU S42** — the international addressing standard Korea Post, USPS,
Royal Mail and Japan Post all follow:

1. **The address body is written the way the address's own country writes it.**
   That country's postal service does the final delivery, so its order is the
   one that matters. The body is never reordered and never translated.
2. **Only the country name is written in the reader's language.**

So the language of the document or the UI decides *nothing* about ordering — it
only picks which language the country name appears in.

| Address country | Order | Rendered in a Korean document |
| --- | --- | --- |
| 대한민국 / 일본 / 중국 / 대만 | largest unit first, space-separated | `대한민국 경기도 안양시 동안구 동안로 35, 109동 901호 (우) 14054` |
| Everything else (incl. 베트남, 태국) | street first, comma-separated | `Level 5, 120 Collins St, Melbourne, VIC 3000, 호주` |

The postcode marker belongs to the address's own convention: `(우)` for Korea,
`〒` for Japan, plain elsewhere.

### Two deliberate decisions

- **CJK country name goes first**, not on a trailing line. S42's trailing-country
  rule is for envelopes; Korean and Japanese business documents put the country
  at the front so the address stays consistently largest-unit-first.
- **The country is always shown** (not dropped for domestic addresses), and it is
  translated into the reader's language rather than left in English.

## Using it

```ts
import { formatPostalAddress, orderFallbackFromLang } from "@workspace/address";

formatPostalAddress(
  { line1, line2, suburb, state, postcode, country },
  lang,                       // "en" | "ko" | "ja" | "zh" | "th" | "vi"
);
```

Never hand-join address fields — `[line1, suburb, state, country].join(", ")`
hard-codes the Western order and is the bug this package exists to prevent.

### Records saved without a country

`accounts.address_country` is free text and some rows are blank. A blank country
almost always means a domestic address, so pass a fallback used **for ordering
only** — it is never printed, because inventing a country on a document is worse
than omitting one.

- **API:** `{ orderFallbackCountry: await resolveIssuerCountry() }` — the issuer's
  own country from Settings → Organisation.
- **Frontend:** `{ orderFallbackCountry: orderFallbackFromLang(uiLang) }` — the UI
  language is the only signal an app has.

## Countries

`lib/address/src/countries.ts` holds the ordering, the six-locale names and the
aliases. Legacy values resolve: `"KR"`, `"Korea"`, `"한국"` all map onto 대한민국.
An unrecognised country is passed through exactly as typed rather than dropped.

`property-admin/src/lib/countries.ts` is a separate list that drives the admin
**dropdown** (stored values + legacy aliases). When adding a country, add it to
both.
