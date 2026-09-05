import { describe, expect, it } from "vitest";

import { isAllowedMediaHost, sanitizeFilename } from "./utils";

describe("isAllowedMediaHost", () => {
  it("allows Instagram's CDN domains and subdomains", () => {
    expect(isAllowedMediaHost("cdninstagram.com")).toBe(true);
    expect(isAllowedMediaHost("scontent-dfw5-1.cdninstagram.com")).toBe(true);
    expect(isAllowedMediaHost("instagram.ffra1-1.fna.fbcdn.net")).toBe(true);
  });

  it("allows the mock provider's placeholder image host", () => {
    expect(isAllowedMediaHost("picsum.photos")).toBe(true);
  });

  it("rejects everything else, including lookalike hosts", () => {
    expect(isAllowedMediaHost("evil.com")).toBe(false);
    expect(isAllowedMediaHost("cdninstagram.com.evil.com")).toBe(false);
    expect(isAllowedMediaHost("notcdninstagram.com")).toBe(false);
    expect(isAllowedMediaHost("169.254.169.254")).toBe(false);
  });
});

describe("sanitizeFilename", () => {
  it("keeps a plain safe name as-is", () => {
    expect(sanitizeFilename("profile_nike_post_1")).toBe("profile_nike_post_1");
  });

  it("strips characters that aren't safe in a filename", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(sanitizeFilename("weird name?.jpg")).toBe("weird_name_.jpg");
  });

  it("falls back to a default for an empty name", () => {
    expect(sanitizeFilename("")).toBe("socialtrace-media");
  });
});
