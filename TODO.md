# Verse TODO

## P2: duplicate-song recognition

- Check for an existing song after the contributor confirms the title and artist, before lyrics enrichment or timing work begins.
- Match the underlying song rather than only the YouTube video ID, because official videos, lyric videos, live performances, reuploads, and region-specific uploads can all represent the same song.
- Start with normalized title and artist aliases (including original-language and translated names), then improve confidence with a normalized lyrics fingerprint when lyrics are available.
- When likely matches exist, show **“Is this song already in the library?”** with the matching lessons, artist, artwork, and current playback source.
- Let the contributor open the existing lesson or explicitly continue if this is a genuinely different recording/version.
- Longer term, separate the canonical song/lesson from its playback sources so one lesson can have multiple YouTube videos instead of creating duplicate lessons.

