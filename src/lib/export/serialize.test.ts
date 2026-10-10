import { describe, expect, it } from "vitest";

import type { Post, SocialUser } from "@/lib/domain/types";

import { toMemberCsv, toPostCsv } from "./serialize";

const POST_HEADER = "id,media_type,caption,like_count,comment_count,view_count,posted_at";

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: "3000001",
    profileId: "profile-1",
    mediaType: "image",
    thumbnailUrl: "https://example.com/thumb.jpg",
    mediaUrl: "https://example.com/media.jpg",
    permalink: "https://instagram.com/p/abc/",
    caption: "hello",
    likeCount: 10,
    commentCount: 2,
    viewCount: null,
    postedAt: "2025-01-02T03:04:05.000Z",
    ...overrides,
  };
}

function user(overrides: Partial<SocialUser> = {}): SocialUser {
  return {
    id: "1001",
    platform: "instagram",
    username: "nike",
    displayName: "Nike",
    avatarUrl: "https://example.com/avatar.jpg",
    isVerified: true,
    ...overrides,
  };
}

/** Returns the data row of a one-post CSV (header is line 1). */
function postRow(overrides: Partial<Post>): string {
  return toPostCsv([post(overrides)]).split("\n")[1];
}

describe("toPostCsv formula guard", () => {
  it("prefixes a caption that starts with = and quotes the cell it sits in", () => {
    const csv = toPostCsv([post({ caption: '=HYPERLINK("https://evil.example","click")' })]);
    expect(csv).toBe(
      `${POST_HEADER}\n3000001,image,"'=HYPERLINK(""https://evil.example"",""click"")",10,2,,2025-01-02T03:04:05.000Z`,
    );
  });

  it("prefixes a caption that starts with + without quoting it", () => {
    expect(postRow({ caption: "+1 555 0100" })).toContain(",'+1 555 0100,");
  });

  it("prefixes a caption that starts with a tab", () => {
    expect(postRow({ caption: "\tcmd" })).toContain(",'\tcmd,");
  });

  it("prefixes a leading - in free text", () => {
    expect(postRow({ caption: "-SUM(A1:A2)" })).toContain(",'-SUM(A1:A2),");
  });

  it("does not prefix a caption where the trigger character is not the first one", () => {
    expect(postRow({ caption: "sale = 20%" })).toContain(",sale = 20%,");
  });

  it("leaves a plain caption unchanged", () => {
    expect(postRow({ caption: "Summer collection" })).toBe(
      "3000001,image,Summer collection,10,2,,2025-01-02T03:04:05.000Z",
    );
  });

  it("quotes a caption that contains a carriage return", () => {
    expect(postRow({ caption: "line one\rline two" })).toContain(',"line one\rline two",');
  });

  it("quotes and prefixes a caption that starts with a carriage return", () => {
    expect(postRow({ caption: "\rfirst" })).toContain(`,"'\rfirst",`);
  });

  it("does not prefix numeric cells, even when negative", () => {
    const cells = postRow({ likeCount: -5, commentCount: -1, viewCount: -3 }).split(",");
    expect(cells[3]).toBe("-5");
    expect(cells[4]).toBe("-1");
    expect(cells[5]).toBe("-3");
  });
});

describe("toMemberCsv formula guard", () => {
  it("prefixes a leading @ in username and display name", () => {
    const csv = toMemberCsv([user({ username: "@handle", displayName: "@Handle" })]);
    expect(csv.split("\n")[1]).toBe("1001,'@handle,'@Handle,https://instagram.com/@handle,true");
  });

  it("prefixes a leading - in username", () => {
    const csv = toMemberCsv([user({ username: "-dash" })]);
    expect(csv.split("\n")[1]).toContain(",'-dash,");
  });

  it("leaves a plain member row unchanged and keeps is_verified as a boolean literal", () => {
    const csv = toMemberCsv([user({ isVerified: false })]);
    expect(csv).toBe(
      "platform_user_id,username,display_name,profile_url,is_verified\n1001,nike,Nike,https://instagram.com/nike,false",
    );
  });

  it("quotes a display name that contains a comma and doubles inner quotes", () => {
    const csv = toMemberCsv([user({ displayName: 'Brand, "Co"' })]);
    expect(csv.split("\n")[1]).toContain(',"Brand, ""Co""",');
  });
});
