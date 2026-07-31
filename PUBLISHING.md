# Publishing a new lesson

The Old Code remains a static website. The publishing script removes the repetitive work without adding a CMS or external dependency.

## 1. Prepare the assets

- Add the article cover to `assets/` as an optimized WebP file.
- Recommended on-page format: 1200 × 1200 or 1600 × 900.
- Add a dedicated 1200 × 630 social card when available. Otherwise the shared `assets/social-card.png` is used.

## 2. Prepare the lesson JSON

Save the input outside the public website folder, for example as `../lesson-06.json`.

```json
{
  "number": 6,
  "slug": "example-lesson-slug",
  "title": "Example Lesson Title",
  "h1Lines": ["Example lesson", "title"],
  "seoTitle": "Example Lesson Title",
  "description": "A concise SEO description of the lesson.",
  "category": "Viking Life",
  "cardCategory": "Daily life",
  "cardSummary": "A short archive-card summary.",
  "readTime": "7 min",
  "date": "2026-08-01",
  "deck": "A short sentence below the article title.",
  "intro": "The opening paragraph of the article.",
  "cover": {
    "file": "example-cover.webp",
    "width": 1200,
    "height": 1200,
    "alt": "A precise description of the cover image",
    "caption": "THE OLD CODE — a short cover caption.",
    "className": ""
  },
  "sections": [
    {
      "id": "first-section",
      "title": "First section",
      "paragraphs": ["First paragraph.", "Second paragraph."],
      "quote": "An optional pull quote."
    },
    {
      "id": "second-section",
      "title": "Second section",
      "paragraphs": ["Another paragraph."]
    }
  ],
  "sources": [
    {"title": "Institution — Source title", "url": "https://example.org/source-one"},
    {"title": "Institution — Source title", "url": "https://example.org/source-two"}
  ],
  "previous": {
    "number": 5,
    "slug": "daily-life-farms-longhouses-work",
    "title": "Farms, Longhouses and Work"
  }
}
```

## 3. Publish and validate

```bash
node scripts/publish-lesson.mjs ../lesson-06.json
node scripts/validate-site.mjs
git diff --check
```

The publisher creates the article and updates:

- the lesson grid,
- the latest-lesson panel,
- previous/next navigation,
- `sitemap.xml`,
- canonical, Open Graph, Twitter Card and Article structured data.

Review the generated article and the Git diff before committing.
