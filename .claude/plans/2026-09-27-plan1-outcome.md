# Plan 1 outcome (checkpoint, 2026-09-27)

## Result

- **Tests.** 69 pass (`python -m pytest tests -q`).
- **Decoding.** Every glyph code in the six PDFs is decoded: 2,664 of 2,664. That covers all 5,309 headwords and all 66,966 sentence characters (`data/reports/decode_v004.txt`, `data/decode/cidmap_v004.csv`).
- **Where the decodings came from.**
  - 2,409 codes came from matching headwords to the public word lists.
  - 245 codes were read by eye from glyph sheets.
  - 11 codes came from the footer font's own character table.
- **Checks on the eye reading.**
  - Hidden check glyphs: 24 of 24 read correctly.
  - Two readers read each sheet independently and agreed on 267 of 269 cells. A third reader settled the other 2.
- **Planted-mistake checks.** Every decoded code was drawn next to its proposed character, with deliberate mistakes mixed in.
  - Round 1 covered all headword-derived codes and caught 121 of 121 planted mistakes, with no real errors found.
  - Round 2 covered the 245 eye-read codes and caught 20 of 20, with no suspects.
- **One correction.** Code 6440 was first read as 衮 and was corrected to 袤 (广袤). It was found by the audit and confirmed by a picture of the glyph.
- **Independent audits.** 80 random headwords, all 333 choices between same-sounding words, the 9 mixed-vote codes and 90 sentences all read correctly.

## Issues Plan 3 (word list) must handle

1. **The PDFs and the public old-HSK list differ.**
   - 28 PDF entries match no word in either public list.
     - 22 of these are words missing from the list: the pattern words below, 踢足球, 黄河, 百分之, 弹钢琴, 柑橘, 涮火锅, 素食主义, 通货膨胀, 烟花爆竹.
     - 6 have PDF pinyin that is cut short or spelled differently: 窗帘 chuāng, 嗯 èng, 湖泊 hú bó, 开拓 kāi tà, 嘛 mɑ, 水龙头 shuǐ lóng.
   - Everyday PDF words missing from the old list (说, 没有, 哪儿, 一点儿, 天, 饭店...) exist in the complete list.
   - 71 of the list's 598 HSK4 words appear in no PDF.
2. **The HSK5 PDF stops at "guǒ shí".** 908 HSK5 words from H to Z have no PDF entry and no PDF sentence. 6 words from A to G are also missing: 从事, 发抖, 发挥, 辅导, 高速, 提.
3. **Headwords cut short by line wrapping (HSK6).** In each case stray text lands in the sentence.
   - #2479 is decoded as 致力 but is 致力于.
   - #27 is decoded as 拔苗 but is 拔苗助长.
   - #2593 is decoded as 总而 but is 总而言之.
   - Only the pinyin is cut in HSK5 #173 窗帘 (lián) and HSK6 #1796 水龙头 (tóu).
4. **Two-part pattern words use ～ twice.** These are 虽然…但是… (HSK2 to 4 #250), 因为…所以… (#281) and 不但…而且… (HSK3 and 4 #326). Each ～ gets its own half.
5. **HSK4 entry 677 is missing from the PDF.** It is one of 弹, 当 or 当地, and the files cannot say which.
6. **Smaller issues.**
   - 9 entries use the ASCII ~ instead of ～, and HSK1 #121 小 has neither.
   - The ～ in 那（那儿） and 这（这儿） must be filled with 那 or 这.
   - In 15 "contradicted" entries the decoded glyphs give the right word, so headwords should come from the decoded glyphs, not from the pinyin match.
7. **HSK1 to 4 sentences use ～ for the headword; HSK5 and 6 write the word out.**

## Decision after the checkpoint (user, 2026-09-27)

The flashcards teach every word from both sources. That means every word in the PDFs, plus every HSK 2.0 public-list word the PDFs lack (for example HSK5 H to Z and the 71 extra HSK4 words). Each word appears once, at its lowest level. This makes the question of which word HSK4 entry 677 was irrelevant, because 弹, 当 and 当地 are all included from the public list.

## Decisions while reviewing Plans 2 and 3 (user, 2026-09-28)

1. **After a wrong answer, the next scheduled review is a recall card.** It shows the character, pinyin and sound, and the learner rates themselves. After that the step rule resumes. The spec's 苹果 example was corrected to match.
2. **The Starter Kit widens to about 40 words.** It also includes 和, 太, 还, 就, 没有 and 一点儿.
3. **Card pinyin uses textbook word spacing (汉语拼音正词法).** Examples are "bú kèqi" and "bámiáo-zhùzhǎng".
4. **Defaults kept, because the user did not object.** Plan 2's gap-filling choices stand (for example, "Unsure" brings a word back after half the gap, rounded down). A public-list word with several readings gets one card, using the reading HSK teaches.
