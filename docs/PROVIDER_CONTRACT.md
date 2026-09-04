# Provider Contract

Spec §34/§35. The domain and UI layers depend only on the
`SocialDataProvider` interface (`src/lib/providers/types.ts`) —
never on a specific acquisition provider (spec §1.3).

```ts
interface SocialDataProvider {
  readonly capabilities: ProviderCapabilities;
  getProfile(username: string): Promise<ProviderProfileResult>;
  getPosts(profileId: string, cursor?: string, limit?: number): Promise<CursorPage<Post>>;
  getReels(profileId: string, cursor?: string, limit?: number): Promise<CursorPage<Post>>;
  getFollowers(profileId: string, cursor?: string, limit?: number, query?: string): Promise<CursorPage<SocialUser>>;
  getFollowing(profileId: string, cursor?: string, limit?: number, query?: string): Promise<CursorPage<SocialUser>>;
}
```

`ProviderCapabilities` declares what a given implementation can actually
do — `stories`/`highlights`/`followerHistory` are `false` on the mock
provider, and the UI renders an honest "not available" state rather than
faking that data (spec §154 Feature Capability UI).

## Current implementation: `MockSocialDataProvider`

`src/lib/providers/mock-provider.ts`. No network calls, no real Instagram
data. Deterministic: the same username always produces the same profile
via a seeded PRNG (`mulberry32` keyed by a hash of the username), so pages
are reproducible across requests and in tests.

Two usernames are hand-seeded to exercise the coverage UI honestly (spec
§1.2's own worked examples):

- `nike` — 312.4M followers, ~80K indexed → ~0.03% coverage (partial).
- `smallcreator` — 42,183 followers, fully indexed → 100% coverage.

Any other username gets a randomly generated profile with coverage
weighted by follower count (larger accounts get proportionally less
indexed). `doesnotexist` / `notfound` throw `ProfileNotFoundError`, which
`src/lib/server/profile.ts` translates into Next.js `notFound()`.

Follower/following generation is capped at 5,000 in-memory users per
profile regardless of the fake `followerCount`, to keep the mock fast —
this is a mock-only limitation, not a modeled "coverage" number.

## Adding a real provider later

1. Implement `SocialDataProvider` against the real source (e.g. a
   licensed data API), including honest `capabilities` flags — never
   claim a capability the source doesn't reliably provide (spec §2.3).
2. Update `src/lib/providers/index.ts`'s `provider` export (behind a
   feature flag / env check per spec §35 if multiple providers need to
   coexist).
3. No changes should be required in `src/app/**` or `src/components/**` —
   if a change there turns out to be necessary, the interface was
   under-specified and should be fixed instead.
