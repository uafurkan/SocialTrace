/**
 * The provider used wherever no compliant source is configured. Production
 * uses it for every platform until one is wired in, so a visitor sees an
 * honest "not available" state instead of mock data.
 *
 * Every call throws ProviderUnavailableError and returns nothing else. No
 * sample, placeholder or guessed value is ever produced here. All capabilities
 * are false, so the pages that check them (stories, highlights, tagged posts,
 * post engagement) show their not-available state without calling in at all.
 */
import { ProviderUnavailableError, type ProviderCapabilities, type SocialDataProvider } from "./types";

const NO_CAPABILITIES: ProviderCapabilities = {
  profile: false,
  posts: false,
  reels: false,
  stories: false,
  highlights: false,
  taggedPosts: false,
  postEngagement: false,
  followers: false,
  following: false,
  followerHistory: false,
};

export class UnavailableProvider implements SocialDataProvider {
  readonly capabilities = NO_CAPABILITIES;

  constructor(private readonly platform: string) {}

  private fail(resource: string): never {
    throw new ProviderUnavailableError(`${this.platform} ${resource}`);
  }

  async getProfile(): Promise<never> {
    return this.fail("profile");
  }

  async getPosts(): Promise<never> {
    return this.fail("posts");
  }

  async getReels(): Promise<never> {
    return this.fail("reels");
  }

  async getStories(): Promise<never> {
    return this.fail("stories");
  }

  async getHighlights(): Promise<never> {
    return this.fail("highlights");
  }

  async getTaggedPosts(): Promise<never> {
    return this.fail("tagged posts");
  }

  async getLikers(): Promise<never> {
    return this.fail("likers");
  }

  async getComments(): Promise<never> {
    return this.fail("comments");
  }

  async getFollowers(): Promise<never> {
    return this.fail("followers");
  }

  async getFollowing(): Promise<never> {
    return this.fail("following");
  }
}
