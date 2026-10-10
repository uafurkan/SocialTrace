import { describe, expect, it } from "vitest";

import type { Comment, Liker, Post, SocialUser } from "@/lib/domain/types";

import { toCommentCsv, toLikerCsv, toMemberCsv, toPostCsv } from "./serialize";

const POST_HEADER = "id,media_type,caption,like_count,comment_count,view_count,posted_at";
const LIKER_HEADER = "username,display_name,verified";
const COMMENT_HEADER = "author_username,text,like_count,posted_at";

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

function liker(overrides: Partial<Liker> = {}): Liker {
  return {
    username: "nike",
    displayName: "Nike",
    avatarUrl: "https://example.com/avatar.jpg",
    isVerified: true,
    isPrivate: false,
    ...overrides,
  };
}

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "c-1",
    authorUsername: "nike",
    authorAvatarUrl: "https://example.com/avatar.jpg",
    authorIsVerified: false,
    text: "nice",
    likeCount: 4,
    postedAt: "2025-01-02T03:04:05.000Z",
    ...overrides,
  };
}

describe("toLikerCsv", () => {
  it("writes only the header row for an empty list", () => {
    expect(toLikerCsv([])).toBe(LIKER_HEADER);
  });

  it("writes a plain verified liker with yes", () => {
    expect(toLikerCsv([liker()])).toBe(`${LIKER_HEADER}\nnike,Nike,yes`);
  });

  it("writes an unverified liker with no", () => {
    expect(toLikerCsv([liker({ isVerified: false })])).toBe(`${LIKER_HEADER}\nnike,Nike,no`);
  });

  it("omits a profile URL column because the Liker type has no URL field", () => {
    const [header, row] = toLikerCsv([liker()]).split("\n");
    expect(header.split(",")).toHaveLength(3);
    expect(row.split(",")).toHaveLength(3);
  });

  it("prefixes formula-like usernames and display names", () => {
    expect(toLikerCsv([liker({ username: "@handle", displayName: "=1+1", isVerified: false })])).toBe(
      `${LIKER_HEADER}\n'@handle,'=1+1,no`,
    );
    expect(toLikerCsv([liker({ username: "-dash" })])).toContain("\n'-dash,");
  });

  it("prefixes and quotes a display name that is a formula with quotes and commas", () => {
    const csv = toLikerCsv([liker({ displayName: '=HYPERLINK("https://evil.example","click")' })]);
    expect(csv.split("\n")[1]).toBe(`nike,"'=HYPERLINK(""https://evil.example"",""click"")",yes`);
  });

  it("quotes a display name that contains a comma", () => {
    expect(toLikerCsv([liker({ displayName: "Brand, Inc" })]).split("\n")[1]).toBe('nike,"Brand, Inc",yes');
  });

  it("doubles inner quotes in a display name", () => {
    expect(toLikerCsv([liker({ displayName: 'Brand "Co"' })]).split("\n")[1]).toBe('nike,"Brand ""Co""",yes');
  });

  it("quotes a display name that contains a line break", () => {
    expect(toLikerCsv([liker({ displayName: "line one\nline two" })]).split("\n").slice(1).join("\n")).toBe(
      'nike,"line one\nline two",yes',
    );
  });

  it("writes one row per liker after the header", () => {
    const csv = toLikerCsv([liker({ username: "a" }), liker({ username: "b", isVerified: false })]);
    expect(csv).toBe(`${LIKER_HEADER}\na,Nike,yes\nb,Nike,no`);
  });
});

describe("toCommentCsv", () => {
  it("writes only the header row for an empty list", () => {
    expect(toCommentCsv([])).toBe(COMMENT_HEADER);
  });

  it("writes a plain comment with its date and like count", () => {
    expect(toCommentCsv([comment()])).toBe(`${COMMENT_HEADER}\nnike,nice,4,2025-01-02T03:04:05.000Z`);
  });

  it("leaves postedAt empty when the source gave no date, never a made-up one", () => {
    expect(toCommentCsv([comment({ postedAt: null, likeCount: 0 })])).toBe(`${COMMENT_HEADER}\nnike,nice,0,`);
  });

  it("prefixes a formula-like author username and comment text", () => {
    expect(toCommentCsv([comment({ authorUsername: "@handle", text: "=1+1" })]).split("\n")[1]).toBe(
      "'@handle,'=1+1,4,2025-01-02T03:04:05.000Z",
    );
  });

  it("prefixes a comment that starts with - without quoting it", () => {
    expect(toCommentCsv([comment({ text: "-SUM(A1:A2)" })]).split("\n")[1]).toContain(",'-SUM(A1:A2),");
  });

  it("prefixes a comment that starts with a tab", () => {
    expect(toCommentCsv([comment({ text: "\tcmd" })]).split("\n")[1]).toContain(",'\tcmd,");
  });

  it("does not prefix a trigger character that is not the first one", () => {
    expect(toCommentCsv([comment({ text: "hi @nike" })]).split("\n")[1]).toContain(",hi @nike,");
  });

  it("quotes and prefixes a formula that contains quotes and commas", () => {
    expect(toCommentCsv([comment({ text: '=HYPERLINK("https://evil.example","click")' })]).split("\n")[1]).toBe(
      `nike,"'=HYPERLINK(""https://evil.example"",""click"")",4,2025-01-02T03:04:05.000Z`,
    );
  });

  it("quotes a comment with a comma, a quote, and a line break", () => {
    expect(toCommentCsv([comment({ text: 'Great, "really" great\nthanks' })]).split("\n").slice(1).join("\n")).toBe(
      'nike,"Great, ""really"" great\nthanks",4,2025-01-02T03:04:05.000Z',
    );
  });

  it("quotes and prefixes a comment that starts with a carriage return", () => {
    expect(toCommentCsv([comment({ text: "\rfirst" })]).split("\n").slice(1).join("\n")).toBe(
      `nike,"'\rfirst",4,2025-01-02T03:04:05.000Z`,
    );
  });
});
