import { describe, expect, it } from "vitest";

import { toPosts, type WebProfileUser } from "./web-profile-info";

type Edges = NonNullable<WebProfileUser["edge_owner_to_timeline_media"]["edges"]>;

function userWith(edges: Edges): WebProfileUser {
  return {
    username: "someone",
    edge_followed_by: { count: 10 },
    edge_follow: { count: 5 },
    edge_owner_to_timeline_media: { edges },
  };
}

describe("toPosts", () => {
  it("dates each post from its Unix timestamp", () => {
    const posts = toPosts(userWith([{ node: { id: "1", shortcode: "abc", taken_at_timestamp: 1_767_607_200 } }]), "p1");
    expect(posts.map((post) => post.postedAt)).toEqual(["2026-01-05T10:00:00.000Z"]);
  });

  it("leaves postedAt null when the timestamp is missing, rather than inventing a date", () => {
    const posts = toPosts(userWith([{ node: { id: "1", shortcode: "abc" } }]), "p1");
    expect(posts.map((post) => post.postedAt)).toEqual([null]);
  });

  it("leaves postedAt null, without throwing, when the timestamp is out of range", () => {
    const posts = toPosts(userWith([{ node: { id: "1", shortcode: "abc", taken_at_timestamp: 1e20 } }]), "p1");
    expect(posts.map((post) => post.postedAt)).toEqual([null]);
  });
});
