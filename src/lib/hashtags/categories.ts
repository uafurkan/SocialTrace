/**
 * Hand-written, hand-maintained hashtag dataset — never scraped or
 * generated on the spot. Treat this the same as any other reviewed,
 * hard-coded constant in this codebase: a fixed, small reference table,
 * not authoritative "trending" data. No popularity/volume numbers are
 * attached anywhere — see generate.ts.
 */
export const HASHTAG_CATEGORIES: Record<string, string[]> = {
  fitness: [
    "#fitness", "#gym", "#workout", "#fitnessmotivation", "#training",
    "#bodybuilding", "#fitfam", "#health", "#exercise", "#strength",
    "#personaltrainer", "#gains", "#cardio", "#fitlife", "#weightloss",
    "#crossfit", "#homeworkout", "#gymlife", "#muscle", "#healthylifestyle",
  ],
  food: [
    "#food", "#foodie", "#foodphotography", "#instafood", "#foodstagram",
    "#delicious", "#homemade", "#cooking", "#yummy", "#recipe",
    "#foodblogger", "#tasty", "#dinner", "#foodlover", "#baking",
    "#healthyfood", "#chef", "#foodgasm", "#brunch", "#dessert",
  ],
  travel: [
    "#travel", "#travelgram", "#wanderlust", "#travelphotography", "#vacation",
    "#explore", "#adventure", "#instatravel", "#trip", "#traveling",
    "#travelblogger", "#backpacking", "#roadtrip", "#nature", "#tourism",
    "#travelling", "#travelholic", "#exploremore", "#worldtravel", "#getaway",
  ],
  tech: [
    "#tech", "#technology", "#coding", "#programming", "#developer",
    "#software", "#startup", "#innovation", "#ai", "#gadgets",
    "#webdev", "#engineering", "#computerscience", "#coder", "#machinelearning",
    "#technews", "#electronics", "#futuretech", "#digital", "#techlife",
  ],
  fashion: [
    "#fashion", "#style", "#ootd", "#fashionblogger", "#outfit",
    "#fashionista", "#streetstyle", "#instafashion", "#trendy", "#lookbook",
    "#fashionstyle", "#clothing", "#outfitoftheday", "#styleinspo", "#accessories",
    "#fashiondesign", "#model", "#wardrobe", "#fashionweek", "#chic",
  ],
  beauty: [
    "#beauty", "#makeup", "#skincare", "#beautyblogger", "#cosmetics",
    "#makeupartist", "#skincareroutine", "#glam", "#beautytips", "#mua",
    "#makeuplover", "#glowingskin", "#beautyproducts", "#selfcare", "#hairstyle",
    "#nails", "#instabeauty", "#beautycare", "#makeuptutorial", "#glowup",
  ],
  business: [
    "#business", "#entrepreneur", "#marketing", "#smallbusiness", "#success",
    "#entrepreneurship", "#startup", "#businessowner", "#leadership", "#branding",
    "#digitalmarketing", "#sales", "#motivation", "#growth", "#businesstips",
    "#networking", "#hustle", "#ecommerce", "#finance", "#productivity",
  ],
  music: [
    "#music", "#musician", "#singer", "#newmusic", "#musicvideo",
    "#producer", "#songwriter", "#livemusic", "#hiphop", "#instamusic",
    "#band", "#musicproducer", "#song", "#artist", "#rap",
    "#musiclife", "#studiosession", "#indiemusic", "#dj", "#concert",
  ],
  gaming: [
    "#gaming", "#gamer", "#videogames", "#twitch", "#esports",
    "#pcgaming", "#streamer", "#gamingcommunity", "#gameplay", "#playstation",
    "#xbox", "#nintendo", "#gamersunite", "#retrogaming", "#mobilegaming",
    "#gamingsetup", "#speedrun", "#indiegame", "#gamedev", "#gamingnews",
  ],
  pets: [
    "#pets", "#dog", "#cat", "#dogsofinstagram", "#catsofinstagram",
    "#puppy", "#kitten", "#petstagram", "#animals", "#dogmom",
    "#petlovers", "#doglover", "#catlover", "#rescuedog", "#petsofinstagram",
    "#doglife", "#catlife", "#instapet", "#puppylove", "#adoptdontshop",
  ],
};

/**
 * Small keyword lists used to match free-text input to a category —
 * intentionally separate from the hashtag lists above so matching logic
 * (generate.ts) never has to guess a keyword from a hashtag string.
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  fitness: ["gym", "workout", "fitness", "training", "exercise", "muscle", "cardio", "crossfit", "lifting", "squat"],
  food: ["food", "recipe", "cooking", "meal", "dinner", "lunch", "breakfast", "chef", "baking", "restaurant"],
  travel: ["travel", "trip", "vacation", "wanderlust", "explore", "backpacking", "flight", "hotel", "tourism", "adventure"],
  tech: ["tech", "coding", "programming", "software", "developer", "startup", "app", "ai", "computer", "engineering"],
  fashion: ["fashion", "outfit", "style", "clothing", "ootd", "wardrobe", "streetstyle", "dress", "accessories", "trendy"],
  beauty: ["makeup", "skincare", "beauty", "cosmetics", "hair", "nails", "glow", "mua", "lipstick", "foundation"],
  business: ["business", "entrepreneur", "startup", "marketing", "sales", "branding", "leadership", "networking", "finance", "hustle"],
  music: ["music", "song", "singer", "musician", "band", "album", "producer", "concert", "dj", "rap"],
  gaming: ["gaming", "gamer", "game", "esports", "twitch", "streamer", "console", "playstation", "xbox", "nintendo"],
  pets: ["dog", "cat", "puppy", "kitten", "pet", "animal", "rescue", "vet", "paw", "adopt"],
};

/** Clearly generic — shown only when no category matches at all, never implying targeted relevance. */
export const GENERIC_HASHTAGS = ["#reels", "#explore", "#instagood", "#viral", "#trending"];
