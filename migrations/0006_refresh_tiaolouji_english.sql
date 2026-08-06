-- Replace the original dictionary-concatenated English for 跳楼机 with the
-- Groq/Qwen contextual draft, lightly edited for natural lyrical English.
WITH translations(source_text, english_text) AS (
  SELECT key, value
  FROM jsonb_each_text($verse$
    {
      "风走了只留下一条街的叶落": "The wind moved on, leaving a whole street of fallen leaves.",
      "你走了只留下我双眼的红": "You moved on, leaving me with nothing but tear-reddened eyes.",
      "逼着自己早点睡": "I force myself to go to bed early—",
      "能不能再做一个有你的美梦": "could I have one more beautiful dream with you in it?",
      "我好像一束极光": "I feel like a ray of the aurora,",
      "守在遥远的世界尽头": "keeping watch at the farthest edge of the world.",
      "看过了你的眼眸": "Only after looking into your eyes",
      "才知道孤独很难忍受": "did I realize how unbearable loneliness can be.",
      "可笑吗": "Isn't it ridiculous?",
      "我删访问记录的时候有多慌张": "how frantic I was as I erased my viewing history.",
      "他会看见吗曾经只有我能看的模样": "Will he see the side of you that once was mine alone?",
      "从夜深人静一直难过到天亮": "I kept hurting from the still of night until daybreak.",
      "你反正不会再担心": "After all, you no longer have to worry about",
      "我隐隐作疼的心脏": "the dull ache in my heart.",
      "好像遇到我你才对自由向往": "It's as if meeting me was what made you long for freedom.",
      "怎么为他失去一切也无妨": "How is it that losing everything for him doesn't bother you at all?",
      "可能是我贱吧": "Maybe I'm just pathetic,",
      "不爱我的非要上": "always chasing someone who doesn't love me,",
      "那么硬的南墙非要撞": "always throwing myself against the hardest wall.",
      "是不是内心希望": "Maybe deep down I'm hoping",
      "头破血流就会让你想起": "that seeing me battered and bleeding will remind you",
      "最爱我的时光": "of the days when you loved me most.",
      "Baby我们的感情好像跳楼机": "Baby, our love is like a drop-tower ride—",
      "让我突然地升空又急速落地": "you shoot me into the sky, then send me plummeting down.",
      "你带给我一场疯狂": "You drove me into a frenzy;",
      "劫后余生好难呼吸": "I made it out alive, yet I can barely breathe.",
      "那天的天气难得放晴": "The skies finally cleared that day,",
      "你说的话却把我困在雨季": "but your words left me trapped in the rainy season.",
      "其实你不是不爱了吧": "You haven't truly fallen out of love, have you?",
      "只是有些摩擦没处理": "We just never dealt with the friction between us.",
      "怎么你闭口不语": "Then why won't you say a word?",
      "是不是我正好": "Did I just happen to",
      "说中你的心": "say exactly what's in your heart?",
      "就承认还是在意吧": "Then admit that you still care.",
      "就骗骗我也可以": "Even a comforting lie would be enough.",
      "你的出现是我不能规避的伤": "You came into my life and became a wound I could never escape.",
      "怎么能接受这荒唐": "How am I supposed to accept something so absurd?",
      "哪怕骗骗我也可以": "Even if it's a lie, that would be enough."
    }
  $verse$::jsonb)
), rebuilt AS (
  SELECT
    song.id,
    jsonb_agg(
      CASE
        WHEN translations.english_text IS NULL THEN cue.item
        ELSE jsonb_set(
          cue.item,
          '{translations,natural}',
          to_jsonb(translations.english_text),
          true
        )
      END
      ORDER BY cue.ordinality
    ) AS cues
  FROM songs AS song
  CROSS JOIN LATERAL jsonb_array_elements(song.lesson_json->'cues')
    WITH ORDINALITY AS cue(item, ordinality)
  LEFT JOIN translations
    ON translations.source_text = cue.item->>'sourceText'
  WHERE song.id = 'song-c9f3f8a3'
  GROUP BY song.id
)
UPDATE songs AS song
SET
  lesson_json = jsonb_set(song.lesson_json, '{cues}', rebuilt.cues, true),
  updated_at = NOW()
FROM rebuilt
WHERE song.id = rebuilt.id;

-- Remove the short-lived accounts used to exercise the authenticated live
-- enrichment endpoint. Their sessions are removed by the foreign key cascade.
DELETE FROM users
WHERE username IN ('codex_groq_tlj_0805', 'codex_groq_tlj2_0805');
