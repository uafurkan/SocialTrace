# Homepage Search + Avatar Fallback

Two rounds of changes to the homepage `@username` box, and one shared
UI fix that came out of the first round.

## Round 1 → reverted: search-as-you-type

The box originally had a debounced suggestions dropdown
(`/api/v1/search`, backed by `provider.searchUsers`). Against the mock
provider this was free but low-quality: unmatched queries were padded
with usernames like `query483` (a random 3-digit suffix) which read as
noise rather than real accounts. That part was improved once (plausible
word-suffixed handles instead of digits — see `docs/DECISIONS.md`), but
the more the fake results were polished, the more they looked like real
accounts they aren't — this build's mock provider does not represent
real Instagram data, and dressing up its filler text risked implying
otherwise.

**Then the feature was removed outright**, for a cost reason as well as
a data-honesty one: the real (Apify) implementation this dropdown was
built to eventually use bills per API call. A suggestions box fires on
every pause in typing — the 500ms debounce reduces call volume but
doesn't change the shape of the problem, since a user typing and
correcting a query can still trigger many calls before landing on the
one they want. Once `SOCIAL_PROVIDER=apify` is enabled, that's real,
recurring cost for a convenience feature, not the core lookup.

## Round 2 → what exists now

`src/components/home/profile-search-form.tsx` takes either:

- a bare username (`nike`, `@nike`), or
- a full Instagram profile link (`instagram.com/nike`,
  `https://www.instagram.com/nike/`) — parsed client-side
  (`extractUsername`), rejecting non-profile paths (`/p/`, `/reel/`,
  `/explore/`, etc.) rather than guessing.

and makes **exactly one** navigation on submit, straight to
`/profile/[username]` — the same single `getProfile` lookup the profile
page itself performs. No dropdown, no per-keystroke network call, no
autocomplete API surface at all (`/api/v1/search` and
`provider.searchUsers` were deleted along with it —
`src/lib/providers/apify/search.ts` is gone, and
`SocialDataProvider`/`ProviderCapabilities` no longer mention search).

This means the cost of a lookup, real-provider or not, is bounded to
exactly what viewing the profile costs — never more for "just typing."

## Avatar fallback (survived both rounds)

Every mock profile's `avatarUrl` is empty (mock mode has no real image
source), so a flat gray circle everywhere read as broken rather than
intentional — this applied on the profile header, followers/following
list, tracking dashboard, and snapshot comparison, independent of the
search box changes above. `src/components/ui/avatar.tsx` +
`src/lib/avatar-color.ts` render a deterministic colored-initials
fallback instead: the color is derived from a hash of the username, so
a given identity always gets the same color everywhere it appears. Six
palette pairs are defined as CSS custom properties in
`src/styles/tokens.css` (`--avatar-{1-6}-bg` / `--avatar-{1-6}-fg}`),
following the project's "tokens only, no hardcoded hex in components"
rule (spec §7.2). If a real `avatarUrl` is present but fails to load,
the component falls back to the same colored-initials treatment rather
than a broken image icon.

## Verified live

`npx tsc --noEmit` / `npm run lint` / `npm run build` clean after
deleting the search route, the Apify search module, and the
`searchUsers`/`userSearch` contract members. Manually exercised the new
form: a bare username, `instagram.com/nike`, `https://instagram.com/nike/`,
and a non-profile URL (`instagram.com/p/abc123`, correctly rejected)
each behave as documented above.

## When this needs to change

If the product later wants real-time account discovery, it needs to be
re-added as a deliberately rate-limited/billed opt-in feature (e.g. only
after N confirmed characters, or gated behind its own quota), not
revived as an unthrottled debounce — see `docs/DECISIONS.md` for the
reasoning.
