# Plan 3b: Sentences, Pinyin, Audio and the Words File Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the reviewed word list into the app's data. That means final themes, curriculum order and overlap lists, one checked example sentence per word with an English translation and pinyin that follows the pinyin style sheet, MP3 audio for every word and sentence, `docs/data/words_v001.json` exactly per the schema, a validation script, and `ATTRIBUTION.md`.

**Architecture:** Small tested modules hold the logic:
- `distract.py` and `review.py` for themes;
- `sentences.py` for choosing and checking sentences;
- `sentpinyin.py` for the draft of the sentence pinyin, and `pinyincheck.py` for the strict check of each corrected line;
- `ttsaudio.py` for audio names and checks;
- `wordsjson.py` and `validate.py` for the data file.

Numbered scripts (`06c` to `11`) chain them and write versioned outputs through `tools/common.py`. Claude-written content (new sentences, translations, the independent check, the polyphone check, the forms of four-character sentence words with the instructions of Plan 3a Task 7, and the correction of every sentence's pinyin against the pinyin style sheet with its independent check) comes from multi-agent workflows whose exact instructions are part of the plans. The user spot-checks 50 translations at a checkpoint.

**Tech Stack:** Python 3.10, pytest, pypinyin (installed in Task 10), jieba (installed in Plan 3a Task 7), edge-tts (installed in Task 15), the Plan 1 and Plan 3a modules, git 2.54, and Claude subagents.

**Spec:** `.claude/specs/2026-09-27-hsk-flashcards-design.md`. **Data contract:** `.claude/plans/words-json-schema.md`. **Follows:** `.claude/plans/2026-09-27-plan3a-wordlist-themes.md`, which must be finished, including the user's theme review.

---

## The pinyin style sheet the user fixed (2026-09-28)

The section "Pinyin style sheet" of `.claude/plans/words-json-schema.md` now governs card `py` and sentence `ex.py`. Where it leaves a case open, the PDFs' print decides first, then the rule that a single entry of the card list or the public lists is written joined, then GB/T 16159-2012. Its fixed choices are these:
1. 这个, 那个 and 哪个 are "zhège", "nàge" and "nǎge", and 这些 and 那些 "zhèxiē" and "nàxiē". Before any other measure word 这, 那 and 哪 stand apart ("zhè běn shū").
2. Month and weekday names are one word ("bāyuè", "xīngqīyī"), and a day number stands apart ("bāyuè jiǔ rì").
3. 了, 着 and 过 right after a verb join it ("kànle", "kànzhe", "kànguo"), and a 了 that ends a sentence or clause stands apart.
4. A verb and a one-syllable result or direction are one word ("xiěhǎo", "shōudào", "liúxià"), and a two-syllable complement stands apart ("zǒu jìnlai").
5. A potential complement is three words with a neutral bu ("zhǎo bu dào", "tīng bu dǒng", "mǎi bu qǐ"), except a card, which keeps its printed or listed form ("duìbuqǐ", "shòubuliǎo", "láibují", "kànbuqǐ").
6. Numbers follow GB/T 16159-2012 6.1.5 ("sānshísān", "yìqiān wǔbǎi", "jǐshí", "shíjǐ", "yì-liǎng", "dì-shí", "sān gè rén", "sān fēn zhī yī" in a sentence, the card "bǎifēnzhī", and a decimal digit by digit with no tone change for 一, "sān diǎn yī sì").
7. A surname and a given name are two words with capitals ("Lǐ Míng"), a title stands apart in lower case ("Lǐ lǎoshī", "Wáng xiānsheng"), every word of a place name takes a capital ("Fújiàn Shěng", "Běijīng Shì"), names of languages, countries and peoples take a capital ("Hànyǔ", "Zhōngguó"), and common nouns are in lower case ("xīngqīrì", "měiyuán", "xīfāng").
8. The tone changes of 一 and 不 are written as spoken, in `py` and `ex.py` ("yí gè", "bú shì", "yìqǐ"), and neutral tones as the dictionary gives them ("dōngxi", "xiàlai").
9. A sentence and a quotation after a colon start with a capital, and Chinese punctuation becomes the matching Western punctuation in `ex.py`.

A card's headword keeps its card's syllables, tones and spacing in its own sentence, even where a point would write it otherwise. In this plan the pinyin of step 8 becomes a draft, and Claude agents correct every line against the style sheet (Task 14), while a strict checker accepts a line only when it passes every check of Task 13. Point 5 settles what used to be Open decision 3 (the tone of 不 in a potential complement).

## Facts verified before writing this plan (2026-09-27, revised 2026-09-28)

Numbers come from running this plan's own code (extracted from this file) on the real data in a scratch copy of the project, using the 3a word list (5,043 cards). On 2026-09-28 the plan was revised for three user decisions (a 40-word Starter Kit with no size exemption, card pinyin in textbook word spacing, and sentence pinyin in the same spacing), and steps 6c to 11 were run again on the revised Plan 3a word list.
- Claude's answers and the user's review files were replaced there by stand-in files, only to exercise the scripts.
- Steps 6c to 7d, 10 and 11 ran end to end and validation passed.
- Steps 8b and 9 ran only with stand-in checker answers and a stand-in edge-tts, so the polyphone fixes and the audio are not measured yet. Step 8 first ran with stand-ins too, and on 2026-09-28 it ran with the real jieba and pypinyin (see "Sentence pinyin measured with the real pypinyin" below).

- **Sentences.** With the rules in Task 4:
  - **4,051 cards have a usable PDF sentence** and **992 need a new one**;
  - the 992 are HSK1 5, HSK2 9, HSK3 15, HSK4 72, HSK5 880 and HSK6 11;
  - the 12 PDF words among them are 谢谢 对不起 不客气 行 关怀 柑橘 意志 拜托 回避 当心 吹牛 滔滔不绝. Their sentences are dialogues ("甲：谢谢你！乙：不客气。"), under 3 characters ("拜托！") or missing.
  - Of the 4,051 chosen PDF sentences, 3,895 use no character above the word's level (at least HSK 2), 126 use one, 29 use two and 1 uses three.
- **Batch sizes that follow.** 17 writing batches of 60 words, 41 translation batches of 100 sentences, and a checker sample of 221 rows (99 written sentences and 122 PDF translations) in 2 files.
- **Overlap lists.** With the rule in Task 1, 3,024 of the 5,043 cards have at least one card whose meaning overlaps, at most 15 per card. As JSON the lists take about 144 KB.
- **edge-tts.** Checked today in the upstream repository (github.com/rany2/edge-tts):
  - The signature is `edge_tts.Communicate(text, voice, *, rate="+0%", ...)` with `save_sync(audio_fname)`, and the example code calls `edge_tts.Communicate(TEXT, VOICE)` then `communicate.save_sync(OUTPUT_FILE)`.
  - The package metadata declares LGPL-3.0, and the repository also holds a GPL-3.0 text.
- **pypinyin.** The documentation checked today gives:
  - `pinyin(hans, style, heteronym, errors, strict, v_to_u, neutral_tone_with_five)` and `lazy_pinyin(hans, style, errors, strict, v_to_u, neutral_tone_with_five, tone_sandhi)`;
  - a list input counts as words already cut by a segmenter;
  - `Style.TONE3` writes tone digits, for example `zhong1 guo2`.
- **Licences for ATTRIBUTION.md.**
  - `data/public/LICENSE_upstream_v001.txt` is the MIT License, "Copyright (c) 2026 Yanis Zafirópulos" (drkameleon).
  - Hanzi Writer is released under the MIT license.
  - hanzi-writer-data comes from the Make Me a Hanzi project, and its README says "You can redistribute and/or modify this data under the terms of the Arphic Public License".
- **Review files at other version numbers (checked in the scratch copy).**
  - Step 6c ran with a corrected sheet saved as `themes_reviewed_v002.csv`, the generated `themes_review_v001.csv`, and a `theme_list_reviewed_v001.csv` that reversed the theme order and renamed theme 1 "First Words". The report named all three files, the reversed order was applied, and a theme made larger than 350 words was split into Part 1 (249) and Part 2 (248).
  - Step 7d stopped with a clear message on an unanswered row (`translation_spotcheck_reviewed_v001.csv`) and on a deleted row (`_v002.csv`, "missing from the reviewed sheet"), then accepted a complete `_v003.csv` against the spot-check sheet `v001`.
  - Step 11 passed every check with theme 1 renamed "First Words" and holding 34 words. That run used the Starter Kit's size exemption, which the 2026-09-28 revision removed.
- **Second review (2026-09-27), rerun in a fresh scratch copy after the Plan 3a meaning repairs.**
  - The Plan 3a word list still has 5,043 cards with the same IDs. Steps 6c to 7d give the same sentence numbers as above, and the overlap count moved from 3,008 to 3,024 because some meanings changed.
  - Step 10 now checks that the sentence pinyin and the audio were made from the final sentences. With stand-in files for steps 8 and 9, a newer `sentences_final_v002.jsonl` that changed one sentence (w0048) made step 10 stop and name both the pinyin and the sentence audio of w0048. With new pinyin but the old audio map, it named only the audio. After both were redone, step 10 wrote the file and step 11 passed every check.
  - The new validator rule that no `en` or `enShort` starts with a part-of-speech label found 34 problems in the words file built before the repairs (16 "sv." cards and 次 "/vm.", each in `en` and `enShort`) and none after them.
- **Card pinyin.** `pyNum` is in dictionary tones (不客气 "bu4 ke4 qi5", 一下 "yi1 xia4", 一点儿 "yi1 dian3 r5" with `syl` 2), and only `py` shows the tone changes ("bú kèqi", "yíxià"). Since 2026-09-28 `py` is in textbook word spacing (Plan 3a Task 1), for example "bú kèqi", "dǎ diànhuà", "bámiáo-zhùzhǎng" and "nǚ'ér". This follows the schema file, which says both explicitly.
- **Third run (2026-09-28), after the revision.**
  - The revised Plan 3a word list has 5,043 cards with the same IDs, and its Starter Kit has 40 words. Steps 6c to 7d give the same sentence numbers as above, and the overlap count stays 3,024, because only `py` changed.
  - **Cross-review fixes (2026-09-28).** Plan 3a now writes the 儿 ending of 纽扣儿 as `r5` ("niǔkòur", niu3 kou4 r5, `syl` 2), and takes the capital of `py` from the HSK 1 to 4 PDFs' print where it takes the spacing from them (互联网 "hùliánwǎng"). The new validator check against a final `er5` was run on every card of both Plan 3a word lists, with stand-in values for the fields this plan adds. It named only 纽扣儿 (w5042) in the list from before the fix and nothing in the fixed list. The same sentence rule in Task 11 already turned a neutral `er5` at the end of a sentence word into `r5`, so the card and its sentence now agree.
  - The new validator check on `py` (`pinyin_text.py_problems`) finds no problem in any of the 5,043 cards. It rejects a missing apostrophe ("kěài" for 可爱), a tone that is not a tone change of 一 or 不 ("bù kèqí"), and any character other than letters, spaces, hyphens and apostrophes.
  - Step 11 passed every check with the Starter Kit holding 40 words and no size exemption. A reviewed copy that moved 太 out of theme 1 made step 6c stop with `Starter Kit: 39 words`.
  - Steps 8, 8b and 9 again ran only with stand-in versions of pypinyin and edge-tts, so their real readings, check-list size and audio were still not measured. Step 8 has been measured since (below). With the stand-in readings, the headword's card spacing appears inside the sentence pinyin of all 5,040 cards that are not pattern words, for example "Tā zài dǎ diànhuà ne." and "Bámiáo-zhùzhǎng de jiàoyù fāngshì bù kěqǔ." (the stand-in's tones are not pypinyin's, so only the spacing of these examples is meaningful). Before `regroup` (Task 10) this failed for 9 cards, because jieba cut across the headword (都市里 as 都 + 市里).
  - jieba leaves 儿 as a word of its own in 3 sentences (画画儿, 一大早儿, 小摊儿). `regroup` joins it to the word before it, so it is read and checked as the 儿 ending.
  - In the 4,051 chosen PDF sentences, jieba (with every card word added, then `regroup`) returns 319 words of four or more characters that are not card headwords. 3 are CC-CEDICT idioms and are written AB-CD (成千上万). 285 are spelled by several known words and are split into them (足球比赛 as 足球 + 比赛, 很感兴趣 as 很 + 感兴趣). 31 stay whole. 28 of those (27 different words, as 市场经济 appears twice) are four-character words, many of them idioms (眉清目秀, 出乎意料) but some ordinary compounds that are themselves words of the public list (市场经济, 售后服务, 玻璃器皿). They were all written AB-CD then. Since the third cross-review (below) every four-character sentence word that is not a card takes a form from `data/manual/four_char_words` instead, and since the fourth cross-review that includes the CC-CEDICT idioms. The other 3 are joined (第一次世界大战, 不明飞行物, 一大早儿).
- **Sentence pinyin measured with the real pypinyin (2026-09-28, after a cross-review).** pypinyin 0.55.0 was installed only in the scratch copy, and step 8 ran with it and the real jieba 0.42.1 on a stand-in `sentences_final` that holds the 4,051 chosen PDF sentences (the 992 new sentences are not written yet). The old step 8 had four faults, which Tasks 10, 11 and 16 now fix.
  - **Capitals.** A word got a capital when jieba tagged it as a name (nr, ns, nt). jieba gives these tags to many ordinary card words (东西 19 times, 城市 14, 美丽 11, 太阳 8, 哥哥 7), so 511 capitals stood inside sentences ("Wǒ zài shāngdiàn mǎi le hěnduō Dōngxi.", "Wǒ Gēge bǐ wǒ dà sānsuì."), while 汉语 stayed in lower case in 10 sentences and 元宵节 in 2. Now a card word takes its card's capital, and any other word takes the capital that `data/manual/capitals` gives it (Plan 3a Task 6), whose 11 sentence rows copy the public list (春节, 美元, 英语). 100 capitals stand inside sentences, all from capitalised cards (中国 29, 北京 24, 汉语 11), from those 11 words, or Latin letters (IT, DNA, JPEG).
  - **The headword as on its card.** The new validator check (Task 18) finds 136 sentences in the old output that do not show their headword as on its card, and none in the new output. Every one of the 5,043 cards passes it against its own `py`.
  - **Names that neither list has.** jieba tags 73 such words as names. Roughly half are real names (英国 9 times, 美国 5, 李老师 4, 上海 3, 杭州 3) and the rest are not (令人 9, 小狗 4, 爱慕 2). They are in lower case unless a row of `data/manual/capitals` gives them a capital, and step 8 lists them for review (Task 11 Step 3, which since the third cross-review also divides a person's name into its words). A copy of the file with rows for 上海 and 英国 changed exactly the 10 sentences that hold them ("Nǐ kěyǐ zuò chuán qù Shànghǎi.").
  - **Readings of other card words.** Words other than the headword took pypinyin's reading. Of 7,062 card words of two or more characters with one card, 701 in 645 sentences were read differently from their card, mostly because the neutral tone was lost. Examples are 喜欢 xi3 huan1 against the card's xi3 huan5 (60 times), 衣服 (32), 学生 (26), 妈妈 (24), and 东西 dong1 xi1, which means east and west (18). Now such a word is read as on its card, and none differs apart from the 一 and 不 tone changes ("Tā bú shì xuésheng.", "Nǐ rènshi zhè gè rén ma?").
  - **Spacing of words that neither list has (before the third cross-review).** 2,816 words of two or three characters that neither list has appear in the sentences (这个 183, 一个 135, 很多 47, 不能 38, jieba's 本书 from 这本书 27, 坐在 8). `split_words` (Task 10) splits 1,810 of them where the textbook rules put a space. That is after a numeral, pronoun or adverb, before a measure word or a preposition, and between a measure word and a noun, which gives "yí gè", "zhè gè", "hěn duō", "bù néng", "zhè běn shū" and "zuò zài". So 这个 is now "zhè gè", because the rules write 这, 那 and 哪 apart from a measure word, where the old output joined it ("zhège"). The other 1,006 stay joined. Many are ordinary words that neither list has (把守 "bǎshǒu", 为生 "wéishēng", 感冒药, 美国, 上海), and some follow a joining rule (看看 "kànkan", 去过, 同学们, 忘了). A first version that split every such word broke those words ("bǎ shǒu", "měi guó", "yǒu diǎn"), which is why the split depends on the word classes. Words of four or more characters are split as before.
  - **The check list (before the third cross-review).** The old step 8 listed 5,156 characters in 26 batches, mostly because pypinyin knows rare old readings (他 769 times for tuo2, 是 484 for ti2). With more single-character words after the split, the old rule would list 7,567. Now a character's readings come from the public list when it has the character (他 has only tā), and the characters of words that neither list has are listed too, because pypinyin may have read them one by one (跑得快 came out "pǎodékuài"). That gives 3,200 characters in 16 batches, made up of 2,555 single-character words, 602 characters of words that neither list has, and 43 儿 endings. The 992 new sentences will add more.
  - In all, 2,205 of the 4,051 sentences had different pinyin from the old step 8, and the suite gave `165 passed, 5 skipped` (the 5 skipped tests need the PDFs).
- **Third cross-review (2026-09-28), measured with the real pypinyin 0.55.0 and jieba 0.42.1 in a scratch copy.** Step 8 ran on the same stand-in `sentences_final` (the 4,051 chosen PDF sentences), and the form agents' and the user's answers were replaced by stand-ins. Five faults were fixed.
  - **Readings of public-list words.** 3,323 words in the sentences are words of the public list that are not card headwords and have one reading there. pypinyin read 124 of those of two or more characters (44 different words) differently from the list, mostly because it lost a neutral tone, for example 下来 "xiàlái" (11 times, the list has xia4 lai5), 那里 (9), 大部分 (9), 身上 (7) and 看起来 (6). The check list skipped them all, because it skipped every known word. Now `make_lookup` reads such a word as the list gives it ("Qìchē tíngle xiàlai."), which covered 2,412 words of two or more characters. A word whose one reading spells a character with other letters than pypinyin does goes on the check list with both readings, and so does a public-list word with several readings (35 characters, such as 来 in 出来). That catches 穿着, which the list reads chuān zhuó (attire) but which is chuān zhe in 穿着漂亮的鞋 (8 characters). The list writes 29 readings without spaces (城里 "chéngli"), and those are not used.
  - **Numbers.** Numerals next to numerals were written apart, so 六十岁 was "liù shí suì" and 九百七十家 "jiǔ bǎi qī shí jiā", and 零 was missing from the numerals after which 一 keeps its tone, so 二零一二年 was "èr líng yí èr nián". Now `split_words` writes numbers as the textbook rules do (`number_words`), which changed 47 sentences, such as "liùshí suì", "jiǔbǎi qīshí jiā", "èrshíyī shìjì", "yìqiān wǔbǎi yè", "èr líng yī èr nián", "yì-liǎng gè yuè" and "dì-shí kè".
  - **Names of people.** 李老师 was "lǐlǎoshī", 王先生 "wáng xiānsheng" and 小王 "xiǎowáng". The report of step 8 now also lists a surname with a title, and it listed 84 name candidates. A `capitals_v002.csv` with 43 name rows (42 of the candidates and 第一次世界大战, which jieba does not tag) changed 51 sentences, for example "Wèi, Lǐ lǎoshī zài ma?", "Nǐ yě rènshi Wáng xiānsheng?", "Chúle Xiǎo Wáng, …", "Wǒ de míngzi jiào Lǐ Míng." and "Dì-yī Cì Shìjiè Dàzhàn". The 42 candidates left were not names (令人, 小狗, 爱慕).
  - **Four-character sentence words.** The first run of step 8 stopped with `276 four-character sentence words need a form` and wrote three batch files. 12 are public-list words that CC-CEDICT does not mark as idioms (市场经济, 售后服务) and 264 are words that neither list has (足球比赛, 正月十五, 各行各业). With stand-in answers (31 idiom, 244 words, 1 joined) step 5b wrote `four_char_words_v002.csv` with 320 rows, and 44 sentences changed, for example "shìchǎng jīngjì", "shòuhòu fúwù", "Gèháng-gèyè", "tàn yì kǒu qì" and "Zhēngyuè shíwǔ".
  - **A quotation after a colon** now starts with a capital ('Tā xiào zhe shuō: "Nǐ bú rènshi wǒ, …"'), which changed 2 sentences.
  - **The check list** holds 4,177 characters in 21 batches after the name rows (4,198 before them). They are 2,552 single-character words, 1,546 characters of words that neither list has (each is checked, and the neutral tone is offered at every character but the first), 43 characters of public-list words with several readings or with a reading pypinyin spells differently, 34 儿 endings and 2 characters of words whose list reading has no spaces.
  - In all, 245 of the 4,051 sentences differ from the step 8 output before this revision, 126 of them in at least one syllable. The validator's headword check (Task 18) at first failed 4 sentences whose headword is a numeral inside a number word (千 in "yìqiān"), and after the change in Task 18 it fails none. The suite gave `176 passed, 5 skipped`.
- **Fourth cross-review (2026-09-28), measured the same way.** pypinyin 0.55.0 and jieba 0.42.1 ran in a fresh scratch copy on the revised Plan 3a word list, whose only changes are the forms of 总而言之, 层出不穷 and 兢兢业业, and on the same stand-in `sentences_final` of the 4,051 chosen PDF sentences. The earlier stand-in form answers and the 43 name rows of the earlier `capitals_v002.csv` were kept. The standard GB/T 16159-2012 was checked in its published text (pinyin.info/rules/GBT16159-2012.html). Seven faults were fixed.
  - **Guessed words.** Step 8 cut sentences with jieba's guessing of unknown words (HMM) switched on, while Plan 3a cuts without it. The guesses joined characters of different words, so 61 words (54 different) were in neither jieba's dictionary nor either list, and were written as one pinyin word, for example "Tiāntài hēi le" (天太黑了), "Nǐ gěiwǒ fā" and "shìgù lǜyǐ". Step 8 now cuts with `segment` (Task 10), which switches the guessing off, and a piece that the headword cuts from a longer jieba word is cut again (`regroup`), so 勇敢的人 gives "yǒnggǎn de rén" and 耸了耸肩 "sǒngle sǒngjiān". 7 such words are left (5 different), all made by the plan's own rules, such as 忘了, 一大早儿, and 好极 in 好极了, where a final 了 is split off.
  - **Short words.** The old rule split a short word that neither list has whenever its first piece could be a numeral, pronoun or adverb or its second a measure word, so it split names and words with a suffix ("xī bān yá" for 西班牙, "rì běn", "tiān ān mén", "táo zi", "qǐyè jiā", "fā dòngjī", "wǔ yī jié"). `_apart` (Task 10) now splits only where the standard writes words apart. That is after a pronoun or a word such as 这 or 每, after an adverb, between a number and a measure word, before a preposition after a verb, between a noun and a place word after it (the standard's "shān shàng"), and in a few more cases that it lists. In the 4,051 sentences it splits 1,501 short words (the old rule split 1,659 with the guessing off) and keeps 1,028 whole, and 西班牙, 日本, 天安门, 桃子, 企业家, 发动机, 五一节 and 五官 stay whole. 我国 stays "wǒ guó", because the standard writes 我校 "wǒ xiào" (6.1.4.3).
  - **Name candidates.** They are now taken from jieba's words before the split, so 西班牙, 日本 and 天安门 reach the list. Without name rows the report lists 120 candidates. The 43 name rows of the earlier `capitals_v002.csv` change 50 sentences and leave 82, among them those three, which need rows too.
  - **Particles and suffixes.** The standard joins the aspect particles 着, 了 and 过 to the verb (6.1.2.1) and writes a 了 that ends a sentence apart (6.1.2.2). Step 8 joined them only inside one jieba word, so the same particle was written two ways ("Tā zhǐ zhe qiánmiàn" but "dōu kànzhe tā"). `attached` (Task 10) now joins 们, 着, a 了 that does not end a sentence, 过 after a verb, and the suffixes 子, 者, 员, 性 and 化 of the standard's 5.5 ("jiàshǐyuán"). 83 着, 483 了, 23 过, 49 们 and 8 suffixes are joined. 487 了 that end a sentence stay apart, and so do 15 过 that are the verb guò ("yào guò Chūnjié") and the 2 着 of 睡不着.
  - **Card readings and potential complements.** Card words in a sentence were read from `pyNum`, so the neutral bu of 受不了 "shòubuliǎo" became "shòubùliǎo" (w1109, w3578), and the validator allowed any tone on 一 and 不. Now a card word takes the syllables its card shows (Plan 3a `syllables_of_py`), every syllable of the headword but the last keeps its card tone (不得了 in 开心得不得了 stays "bùdéliǎo"), and the validator lets only a 一 or 不 at the end of the headword show another tone. A 不 in a potential complement (找不到, 听不懂, 睡不着) is read in the neutral tone, as HSK 4 prints 受不了, and its 着 or 了 is zháo or liǎo (then Open decision 3, now point 5 of the pinyin style sheet). That gives "shuì bu zháo", "zhǎo bu dào", "tīng bu dǒng" and "jì bu qīngchu", 21 potential complements in all. A 着 or 不 inside a word that neither list has is now put on the check list too. The new headword check fails 2 sentences of the old output (w1109 受不了 and w2307 不得了) and none of the new one.
  - **Numbers.** 几 now joins 十, 百, 千 or 万 next to it, as the standard writes 十几 and 几十 (6.1.5.6), so w0364 is "qùguò jǐshí gè guójiā" and w2235 "yǒu shíjǐ jié chēxiāng".
  - **Four-character idioms.** Every four-character sentence word that is not a card now goes to the form agents, CC-CEDICT idioms included, with the mark as a hint (Plan 3a Task 7). The first run stopped with `279 four-character sentence words need a form` (3 batch files), 3 more than before (成千上万, 有所不同, 赞叹不已), and the stand-in answers (34 idiom, 244 words, 1 joined) gave 399 rows.
  - **Totals.** The check list holds 4,342 characters in 22 batches, which are 2,549 single-character words, 1,716 characters of words that neither list has or whose list reading has no spaces, 43 characters of public-list words with several readings or a reading that pypinyin spells differently, and 34 儿 endings. 888 of the 4,051 sentences differ from the output before this review, 34 of them in at least one syllable, and 553 only because a particle is joined. The validator's headword check passes every sentence and every card, and the suite gives `180 passed, 5 skipped`.
- **Fifth cross-review (2026-09-28), measured the same way.** pypinyin 0.55.0 and jieba 0.42.1 ran in a fresh scratch copy on the same stand-in `sentences_final` of the 4,051 chosen PDF sentences, with the earlier stand-in form answers and the 43 name rows. All eight findings were confirmed. The fixes follow, and two details of the proposed fixes were not taken (the last point).
  - **A headword inside a longer word.** `regroup` cut the headword out of every word that held it, so a one-character card split an ordinary word, as in "nǚ rén" (女, w0220), "Wài miàn" (外, w0232), "Chūn tiān" (春, w0582) and "tóu dǐng" (顶, w1475). Now a card word or a public-list word that holds the headword stays whole, as it does for any other headword ("nǚrén", "Wàimiàn", "Chūntiān", "tóudǐng shàng"), and 46 sentences changed. The validator (Task 18) lets the headword's syllables stand inside such a word at syllable edges. Two words that neither list has are still cut by the headword, so the one sentence shared by w2893 and w3212 still differs at 神圣不可 ("bùkě" and "bù kě"), and the one shared by w3311 and w4388 at 腥臭味.
  - **Short words that are one word.** `_apart` split a verb and a measure word even when the first piece is first of all a noun or an adjective, or has two characters, and it split 有点 and 差点, which gave "miàn kǒng", "rè tiān", "gēchàng jiā", "tǐyù mí" and "yǒu diǎn". Now only a verb of one character whose first part of speech is a verb stands apart from a measure word or its object (喝 杯 茶, 买 票), 有点 and 差点 stay whole, and 家, 迷 and 品 stay in the word of a noun or verb of two characters. 把 and 被 still stand apart from a noun (把 门 关上). 20 sentences changed. 拐角 "guǎi jiǎo" (w3491) and 租户 "Zū hù" (w3847) are still split, because nothing in the two lists tells them apart from a verb and its object such as 买票 "mǎi piào".
  - **Potential complements.** 来 and 去 were not among the results, jieba's 不了 and 不过 after a verb stayed one word, and public-list words such as 买不起 stayed whole. So "mǎi bù lái", "kuà búguò" and "rěnshòu bùliǎo" kept a full-tone bu. Now they are three words with a neutral bu ("mǎi bu lái", "kuà bu guò", "rěnshòu bu liǎo", "mǎi bu qǐ"), except after a verb of saying or wanting (他说不去), and a card keeps its card's spacing (受不了 "shòubuliǎo"). The sentences hold 31 potential complements (23 before, counted with the same rule), and 10 sentences changed.
  - **A verb and its result.** GB/T 16159-2012 6.1.2.4 joins a one-character verb and a one-character result or direction ("gǎohuài", "dǎsǐ"). `attached` now joins them ("xiěhǎo de xìn", "rǎnzāng le", "guānshàngle mén"), which changed 71 sentences. 收到, 留下 and 剩下 are public-list words and stay whole now ("shōudào", "liúxià", "shèngxià").
  - **Particles.** jieba's 咖啡吧 and 算了吧 joined a 吧 that ends the sentence to the word before it ("kāfēiba", "Suànleba"). Such a particle is now split off at the end of a sentence ("hē bēi kāfēi ba", "Suànle ba"), in 2 sentences.
  - **Fractions.** GB/T 16159-2012 6.1.5.1 writes every syllable of a fraction apart ("èr fèn zhī yī"). Now 三分之一 is "sān fēn zhī yī" and 百分之十 "bǎi fēn zhī shí" (4 sentences), except where the headword is 分之 or 百分之, whose cards join them. The form agents' instruction (Plan 3a Task 7) now gives 三 分 之 一.
  - **Place names.** GB/T 16159-2012 6.2.2.1 capitalises every part of a place name (河北省 "Héběi Shěng"), so the example in Task 11 Step 3 is now `福建省,福建 省,Y,sentence` ("Fújiàn Shěng").
  - **Examples.** The lookup test (Task 10) and the validator's docstring and test (Task 18) showed the aspect particle 了 apart ("tíng le", "mǎi le"). They now show it joined, as step 8 writes it ("Qìchē tíngle xiàlai.", w0736, and "mǎile hěn duō dōngxi.", w0062), and the lookup test renders with `attached`.
  - **Four-character words.** Two public-list words that the headword used to cut (独立自主, 粗心大意) now reach the form agents, so the first run stops with `281 four-character sentence words need a form`, and the stand-in answers (36 idiom, 244 words, 1 joined) give 401 rows.
  - **Totals.** 151 of the 4,051 sentences differ from the output before this review, 8 of them in at least one syllable (6 potential complements, 乐团 now read yuètuán, and 南边 "nánbian" as the public list reads it). The check list holds 4,406 characters in 23 batches (4,384 before), or 4,427 without the name rows. The validator's headword check passes every sentence and every card, while the check before this review fails 73 of the new sentences, each with the headword inside a longer word. The suite gives `185 passed, 5 skipped`.
  - **Not taken.** The finding proposed to split a two-character word only when jieba's dictionary does not hold it. With its guessing off, jieba returns only words of its dictionary (坐在, 本书 and 这个 are all in it), so that rule would stop every split the rules want ("zuò zài", "zhè běn shū"). The finding also proposed to keep 一点 joined. The only 一点 in the sentences means "one point" (她有一点是非常难能可贵的, w4928), where "yì diǎn" is right, so it stays apart.
- **The pinyin style sheet (sixth revision, 2026-09-28).** The user fixed a pinyin style sheet (the section above), and this plan stopped trying to make the rule-based pinyin of step 8 perfect. Step 8 now writes a draft, and in Task 14 Claude agents correct every line, while the strict checker of Task 13 accepts or rejects each answer. Everything below ran in a fresh scratch copy with pypinyin 0.55.0 and jieba 0.42.1. The inputs were the Plan 3a word list of this revision (with its stand-in form answers), the stand-in `sentences_final` of the 4,051 chosen PDF sentences, the earlier stand-in forms of the sentence words, and the 43 stand-in name rows plus 4 place names (山东省, 天安门广场, 西班牙, 日本). Claude's answers were replaced by stand-ins, only to exercise the scripts.
  - **Draft fixes.** Three draft faults that also touch the checker were fixed in Task 10. A decimal is now read digit by digit with 一 in its first tone (`_is_decimal`, `decimal_digits`), so 百分之三点一之间 (w4433) is "bǎi fēn zhī sān diǎn yī zhījiān" (it was "yì"), 三点一四 would be "sān diǎn yī sì" (it was "sān diǎn yí-sì", read as an approximate number), and 三点一刻 stays the time "sān diǎn yí kè". 好几十 keeps 几十 as one number word ("hǎo jǐshí gè", it was "hǎojǐ shí gè"). The Chinese dash, which jieba cuts into two marks, is one "-" (w2840 and w3069, "yíbùfen - jídù", they had "- -"). On the same inputs these fixes changed exactly 3 of the 4,051 draft lines, and the check list stayed at 4,416 characters in 23 batches. The form agents' rule 3 (Plan 3a Task 7) now also names 十几 and 几十 as one word each.
  - **Place names in the validator.** The style sheet capitalises every word of a place name, so the card 省 shows "Shěng" in "Wǒ láizì Shāndōng Shěng." (w0795), and the card 广场 "Guǎngchǎng" in "Tiān'ānmén Guǎngchǎng" (w1736). The validator's headword check (Task 18) rejected both, because it allowed a capital only where a sentence starts. It now also allows one where a word of a name of `data/manual/capitals` starts (`name_starts`). It passes all 4,051 draft lines, and without the names it fails exactly those 2.
  - **Capitals set by the style sheet.** With 正月, 星期天, 星期日, 美元, 英镑 and 西方 set to N in `capitals_v001.csv` (Plan 3a Task 6), 11 draft lines changed, for example "jìn 1 yì měiyuán" and "Jīntiān shì zhēngyuè shíwǔ".
  - **The strict checker (Task 13)** read the 4,051 draft lines in 1.5 seconds and rejected 2. One wrote "70 %" for 70% (w0952), and one wrote 除夕夜 in lower case, although 除夕 keeps its capital until the user decides (w4955). On the real data it accepted all 30 of a set of hand-made lines that follow the style sheet, and the validator's headword check accepted them too. Among them are "Nǐ rènshi zhège rén ma?", "Jīntiān xīngqīwǔ.", "Wǒ qùguo yí cì Běijīng.", "Qǐng chī diǎnr mǐfàn.", "Wǒ láizì Shāndōng Shěng.", "Wùchā de fúdù zài zhèngfù bǎi fēn zhī sān diǎn yī zhījiān." and "Zhège wèntí tài fùzá, wǒ tīng bu dǒng.". It rejected all 30 of a set of hand-made wrong lines, 6 each with misaligned syllables, a changed character, a wrong headword tone, a stray capital and a wrong reading, each with a plain message, such as "the headword 次 must be written 'cì' as on its card, but the line has 'cí'" and "'bǎn' is not a reading of 本; its readings are ben".
  - **What the draft still gets wrong.** 220 of the 4,051 draft lines write 这个, 那个 or 哪个 as two words, 5 write a month or weekday name as two words ("shí yuè", "xīngqī wǔ"), and single lines have "chuānzhuó" for 穿着, "biànhuà dé" for 变化得 and "diǎn'ér" for 点儿. The strict checker accepts these, because each syllable is a known reading and the checker does not judge spacing outside the headword, so the correcting agents and the independent checker must fix them. (The seventh revision below fixes the 这个 and month lines in the draft and makes the checker reject them.)
  - **Steps 8c to 8e with stand-in answers.** Step 8c wrote 41 batch files for the 4,051 sentences. The stand-in answers gave the draft for most lines, the 30 correct hand-made lines, 12 wrong lines and 2 missing rows. Step 8d sent 15 lines to redo files, then 2 more to a second redo, after which it kept those 2 as the draft and listed them, and it wrote a sample of 150 lines. Step 8e applied 3 stand-in fixes (2%) and wrote the final pinyin. A changed capitals row then made step 8c batch only the 1 changed line, and stand-in sentences for the 992 words without a PDF sentence went out as 10 batch files, while every other line kept its final pinyin. Step 10 read the final pinyin and wrote the words file, and it stopped with a clear message when the final pinyin was corrected from an older draft than the latest one. The validator passed that words file when it was given the names of `data/manual/capitals`.
  - The suite gives `198 passed, 5 skipped` (the 5 skipped tests need the PDFs). The new tests of Tasks 10 and 18 fail on the code from before this revision.
- **Review of the style-sheet run (seventh revision, 2026-09-28).** A reviewer ran the sixth revision's code and found eight faults. Each was checked first in a fresh scratch copy with pypinyin 0.55.0 and jieba 0.42.1 on the same inputs as the sixth revision (the Plan 3a word list, the stand-in `sentences_final` of the 4,051 PDF sentences, the stand-in forms, and the 43 name rows plus 4 place names), and all eight were real. Claude's answers were again replaced by stand-ins, only to exercise the scripts.
  - **Tones in the checker.** Outside the headword the old checker compared syllables without their tones, and it took every reading pypinyin knows, rare old ones included. On the real data it accepted "Tuó tí xuésheng." for 他是学生。 (pypinyin knows 他 tuó and 是 tí), "Tā zāi dǎ diànhuà nǐ.", "Wó ài nǐ.", "Zhè shī wǒ de shū.", "Wǒ bù qù.", "Wǒ yī gè rén qù." and "Sān diǎn yí sì.". Now `known_readings` gives numbered readings with tones, takes a character's readings from the public list when the list has it as a word of its own (as `make_readings_of` does in step 8, but with the readings of names too, so 蒙古包 keeps "měng"), and accepts a neutral tone the readings lack only inside a word ("xuésheng"). `_tone_change_problems` checks the 一 and 不 tone changes where a rule settles them ("bú" and "yí" before a fourth tone, "bù" and "yì" before the others, "yī" in a decimal, found by the new `decimal_positions`, and "yí gè", not "yī gè", unless 第 or a numeral stands before it). The new checker rejects all the lines above, each with one plain message such as "'Tuó' is not a reading of 他; its readings are tā" and "'bù' (不) comes before the fourth tone of 'qù', so it is written 'bú'".
  - **过 after a verb.** The reviewer counted 68 lines with the particle 过 in the fourth tone. The draft has 68 words that join a "guò", but only 27 of them, in 26 sentences, are the aspect particle ("jiànguò" 7 times, "qùguò" 4, "dúguò" 2, "jīnglìguò" 2 and 12 more). The other 41 are words of the public list or a direction ("tōngguò" 14, "jīngguò" 9, "chāoguò" 5, "búguò" 4, "nánguò" 3, "chuānguò" 3). Since guò is a real reading of 过, and 穿过 "chuānguò" is right, neither the checker nor a rule of the draft can tell the particle from the verb, so the correcting instructions (Task 14) now give "qùguo" as an example, and the independent checker reads the sample.
  - **Points 1 and 2 in the draft and in the checker.** Step 8 now treats 这个, 那个 and 哪个 as known words read "zhège", "nàge" and "nǎge" (`POINTING_WORDS`, except in the sentence of the card 个), and `attached` joins 月 to a month number and a weekday number to 星期 or 礼拜. Of the 4,051 draft lines 225 changed, 220 for 这个, 那个 or 哪个, 4 for a month or weekday name ("Jīntiān xīngqīwǔ." w0088, "Xiànzài shì shíyuè." w0104, "Jīntiān shì bāyuè jiǔ rì." w0134, "cóng jiǔyuè qǐ" w1648) and 1 for a percent sign (w0952, now "70%"). 六月份 (w4696) stays "liù yuèfèn", because the style sheet does not say whether 月份 joins a month number. The checker's new `_one_word_problems` rejects 这个, 那个, 哪个, 这些, 那些 or 哪些 and a month or weekday name that is not one pinyin word, except 这个 and 这些 in the sentences of the cards 个 and 些. On the draft from before this revision it rejects 227 lines (the 225 above and the 2 of the sixth revision), and on the new draft 2. One is w4955 (除夕夜, as before). The other is w3791 "ménkuāng", where pypinyin read 框 kuāng although the public list has only kuàng, a fault of the draft that only the tone check finds.
  - **Names that overlap.** "Xiǎo Lǐ míngtiān lái." for 小李明天来。 was rejected, because the checker found the name 李明 inside it and wanted "Míngtiān". Now a name needs its capitals only where its first character starts a pinyin word and its last character ends one, or the whole name stands inside one word ("Zhōngguórén"). Elsewhere the capitals are only allowed. Step 8c's note to the agents reads overlapping names from the left, so that sentence lists only 小李.
  - **Messages.** The headword message now quotes the line with its apostrophe ("nǎ'ér", it said "nǎér"), and step 8e gives the fix share with one decimal, so 8 fixes of 150 read "(5.3%), more than 5%" (it said "(5%), more than 5%").
  - **Hand-made lines.** The 30 correct lines of the sixth revision still pass the checker and the validator's headword check. 9 wrong lines were added, 3 with a wrong tone ("Zhè shī wǒ de shū."), 3 with a wrong tone change ("Wǒ bù shì xuésheng.", "Wǒ shì yī gè xuésheng.", "sān diǎn yì zhījiān") and 3 with a split word ("zhè gè rén", "shí yuè", "xīngqī wǔ"). The old checker accepted all 9, and the new one rejects all 39 wrong lines.
  - **The check list.** Without the name rows (the `capitals_v001.csv` of the sixth revision) step 8 lists `Characters still to check: 4401 in 23 batches` and 120 name candidates. With the 43 name rows and 4 place names it lists 4,380 in 22 batches and 80 candidates. Before this revision the same runs gave 4,437 and 4,416. The 4,427 that Task 11 Step 2 used to quote could not be reproduced. The sixth revision's step 8 and two older scratch copies of it all give 4,437 without the name rows, with the `capitals_v001.csv` of the sixth revision and with the earlier one that still had 正月 and five sentence words in capitals, so those capitals do not explain it. All 36 characters that left the list are 那, which 那个 now reads as nà.
  - **Steps 8c to 8e with stand-in answers.** Step 8c wrote 41 batch files. Step 8d sent 16 lines to redo files (2 missing rows, 12 wrong lines, w3791 and w4955), then 3 to a second redo, and kept those 3 as the draft. Its report now says for each kept line whether the draft itself passes the strict checker, and 1 of the 3 does not (w3791, which the report lists as known to be wrong). Step 8e applied 3 stand-in fixes and printed `(2.0%)`.
  - **Names from the agents' notes.** Task 14 Step 5 used to send the user to add a name and rerun step 8 before step 8e had written a final file. In a copy taken after step 8d had accepted every line, a new `capitals_v003.csv` with the row `黄土高原,黄土 高原,Y,sentence` and a new run of step 8 made step 8c batch `4051 of 4051` sentences again, because step 8c compares with the latest final file. After step 8e, the same row made step 8c batch `1 of 4051` sentences, w3895, whose draft became "Huángtǔ Gāoyuán". That line was accepted, and step 8e wrote `sentence_pinyin_final_v002.jsonl`. So the names from the notes are now added in Task 14 Step 9, after Step 8.
  - The stand-in sentences for the 992 words without a PDF sentence went out as 10 batch files, step 10 wrote the words file, and the validator passed every check with the names of `data/manual/capitals`. The suite gives `203 passed, 5 skipped`. The new tests of Tasks 10 and 13 fail on the code from before this revision.
- **Second review of the style-sheet run (eighth revision, 2026-09-28).** A reviewer ran the seventh revision's code and found seven faults. Each was checked first in a fresh scratch copy with pypinyin 0.55.0 and jieba 0.42.1, on the same inputs as the seventh revision plus a stand-in `sentences_final` in which the sentence of the card 年 (w0038) is 我在二〇〇八年去过北京。. All seven were real, and each fix below was run there. Claude's answers were again replaced by stand-ins.
  - **The zero of years.** 〇 (U+3007), the zero in years such as 二〇〇八年, lies outside the range U+4E00 to U+9FFF that every script used for Chinese characters. Step 8 wrote the draft "Wǒ zài èr 〇 〇 bā nián qùguò Běijīng.", the checker rejected the correct line "Wǒ zài èr líng líng bā nián qùguo Běijīng." with "the sentence holds '〇', which the checker does not know", and the validator passed the draft. Now 〇 counts as a Chinese character in `sentences.py`, `sentpinyin.py`, `08_pinyin.py`, `pinyincheck.py` and `validate.py`, it has only the reading líng in the checker and on the check list (pypinyin also knows yuán and xīng), `char_levels` gives it the level of 零, and the validator rejects any Chinese character in `ex.py`. Step 8 then writes "Wǒ zài èr líng líng bā nián qùguò Běijīng.", which changed only that line of the 4,051, the checker accepts the correct line and rejects the old draft with "the line holds Chinese characters (〇〇); write only pinyin", and 〇 does not go on the check list.
  - **Names in the validator.** The checker's names (`names_of`) include every card whose `py` starts with a capital, but the validator knew only the rows of `data/manual/capitals`. So for the card 长 (w0207) the checker accepted "Wǒ qùguo Chángchéng." and the validator rejected it ("does not show 'cháng' as on the card"), and the same held for the card 黄 in "Wǒ kànjiànle Huánghé.". Now `validate` adds the capitalised cards with the same `names_of`, and both lines pass both. The validator's headword check still passes all 4,051 draft lines and all 4,051 lines of the stand-in final file.
  - **Tones of 一 and 不.** The checker settled 一 only before 17 characters and let a neutral "bu" or "yi" pass anywhere, so it accepted "Yī nián yǒu 12 gè yuè.", "yī jīn", "yī tiān", "yīqiān yuán", "yīwàn míng", "yī jiā", "sān diǎn yī kè", "dì-yí gè", "dì-yí cì" for the card 第一, "shíyí gè", "Wǒ bu qù", "Tā bu shì xuésheng", "Wǒ shì yi gè xuésheng" and "qùguo yi cì". Now `word_facts` gives the checker the measure words of both lists (the label m., 235 characters without 月) and `_COUNTED` adds 百, 千, 万, 亿 and 刻. 一 keeps "yī" after 第, a numeral, 星期 or 礼拜, and a neutral "bu" or "yi" passes only in a doubled word, in a potential complement (`sentpinyin.potential`) or where a card or public-list word shows it (对不起, 差不多). In the 4,051 sentences the new rule settles 548 cases of 一 before a counted character, in 91 pairs such as 一个 139, 一下 55 and 一些 23, and none of them is an ordinal.
  - **Numbers and a final 了.** The checker accepted any spacing of numbers and of a 了 that ends a sentence, for example "shí èr diǎn", "yì qiān yuán", "dìshí kè", "dì shí kè", "sānfēnzhīyī", "yígè" and "Zuótiān xià yǔle." for the card 了. `_number_problems` now compares the joints in and around each run of numerals with `sentpinyin.number_words`, and `_final_le_problems` wants a final 了 as a word of its own. A first version also rejected three correct draft lines, 五一节 "wǔyījié" (w0669), 零零落落 "línglíngluòluò" (w4004) and 一天天 "yìtiāntiān" (w4648), so the digits of a date, a doubled word and a doubled measure word are left open (`_settled`).
  - **Overlapping names.** A name allowed capitals on all its characters even where the line does not write it as a name, so with the names 小李 and 李明 "Xiǎo Lǐ Míngtiān lái." passed. Now a name may have its capitals only where it must have them, and that line fails.
  - **Instructions.** Rule 4 of the correcting instructions did not say that the "…" of a pattern word is not written, and "Suīrán… xià yǔ le, dànshì… wǒ qù." for the card 虽然…但是… fails with "the sentence has the punctuation , . but the line has ... , ... .". Rule 4 now says so. Step 6 of Task 14 sent the checker agent's redo to the paragraph of Task 6, whose placeholder names the report of step 7b. It now has its own redo paragraph, filled from step 8e's messages.
  - **Measured.** 20 of the wrong lines above are written for real sentences of the data (all but "shíyí gè" and the 小李 line, which are in the tests). The old checker accepted all 20, and the new one rejects them all, together with the 39 wrong lines of the seventh revision. It accepts all 38 correct hand-made lines, the 30 of the sixth revision and 8 more ("Yì nián yǒu 12 gè yuè.", "Zhè shì wǒ dì-yī cì jiàndào tā.", "Qǐng ràng wǒ kàn yi kàn.", "Zhèlǐ tài chǎo le, zhēn ràng rén shòubuliǎo."). On the draft of the 4,051 PDF sentences it rejects 3 lines in about 2 seconds, w3791 and w4955 as before, and w3470, a real draft fault that the old checker missed. There the draft wrote "liǎng fèn, yi fèn" with a neutral yi, because Plan 3a `tone_change` sees 份，一份 as a doubled word once the comma is left out. The correcting agents fix such a line. Step 8d on the prototype's stand-in answers sent exactly one more line to a redo than before, w3470.
  - The suite gives `210 passed, 5 skipped`. The new tests of Tasks 4, 10, 13 and 18 fail on the code from before this revision.
- **Installed on 2026-09-28.** jieba 0.42.1 was installed by Plan 3a Task 7. pypinyin and edge-tts are not installed in the project (the measurement above used a copy of pypinyin in the scratch folder only). The jieba calls this plan uses (`add_word`, `posseg.lcut` with `HMM=False`, `setLogLevel`) are checked by a command in Task 10 before anything relies on them.

## Open decisions for the user

1. **Starter Kit size (decided 2026-09-28, carried over from Plan 3a).** The widened Starter Kit rule gives exactly 40 words, so the Starter Kit no longer has an exemption from the 40-word minimum. Step 6c and the validator check it like every other theme. If the user moves a word out of it during the review, step 6c stops and names it, and the user moves another word in.
2. **The form of each four-character sentence word (the rule follows the user's choice, carried over from Plan 3a Open decision 4).** The textbook rules the user chose write a four-character word as an idiom (two joined pairs with a hyphen), as separate words, or joined. A four-character sentence word that is not a card takes its form from `data/manual/four_char_words`, CC-CEDICT idioms included, because the standard joins an idiom that does not divide into two pairs. When such a word has no row, step 8 writes batch files for the form agents of Plan 3a Task 7, with CC-CEDICT's idiom mark as a hint, and stops, so a word of a newly written sentence gets a form too (Task 11 Step 2). There were 279 on the prototype run. The user reviewed the card rows at the Plan 3a checkpoint. The sentence rows are shown in the final report (Task 20), and a change goes in a new version of the file, after which steps 8, 10 and 11 are run again.

The earlier third decision, the tone of 不 in a potential complement such as 找不到, is settled by point 5 of the pinyin style sheet (a neutral bu, "zhǎo bu dào"), and so are the other questions of pinyin style that earlier versions of this plan left open.

## File map

| File | Responsibility |
|---|---|
| `tools/distract.py` | Overlapping meanings (`noDistract`) and usable wrong choices per quiz type |
| `tools/review.py` | Checks on the user's edited theme sheet and theme list |
| `tools/sentences.py` | Choose PDF sentences, rules for written sentences and translations, checker gates |
| `tools/sentpinyin.py` | Sentence pinyin, with jieba's words without guessing, readings from the cards, the public list and pypinyin, the forced headword reading, tone changes, word spacing like the cards (numbers, names, four-character forms, particles, suffixes and potential complements included) and the polyphone checks |
| `tools/ttsaudio.py` | Audio file names with a hash, spoken text, MP3 checks, stand-in rule |
| `tools/wordsjson.py` | Assemble the words file in the schema's shape, and find pinyin or audio made from outdated sentences |
| `tools/validate.py` | Every schema rule and the spec's data checks |
| `tools/06c_themes_finalize.py` | Apply the review: themes, parts, `ord`, `noDistract` |
| `tools/07_sentences.py` | Choose PDF sentences, write writing and translation batches |
| `tools/07b_sentences_merge.py` | Check the agents' sentences and translations, pick the checker sample |
| `tools/07c_checks_apply.py` | Apply the checker's verdicts, write the user's spot-check sheet |
| `tools/07d_spotcheck_apply.py` | Apply the user's spot-check |
| `tools/08_pinyin.py` | Sentence pinyin and the polyphone check list |
| `tools/08b_polyphone_merge.py` | Turn the polyphone checker's answers into pinyin fixes |
| `tools/pinyincheck.py` | The strict checker of a corrected sentence pinyin line, which checks the alignment of characters and syllables (〇 included), known readings with their tones, the tone changes of 一 and 不 where a rule settles them (with what `word_facts` knows about measure words, verbs and the words that show a tone), digits and Latin letters, punctuation, the headword as on its card, 这个 and month and weekday names as one word, the spacing of numbers, a final 了 as a word of its own, and capitals. Its `names_of` also gives the validator its names |
| `tools/08c_pinyin_batches.py` | Batch files for the agents that correct the draft pinyin against the style sheet (only sentences whose text or draft changed since the latest final file) |
| `tools/08d_pinyin_merge.py` | Check the agents' lines, write redo files, keep the draft after two failed redos and say whether that draft passes the checker, write the checked pinyin and the review sample |
| `tools/08e_pinyin_review_apply.py` | Apply the independent checker's fixes and write the final sentence pinyin |
| `tools/09_generate_audio.py` | Make the MP3s (resumable), suggest stand-ins |
| `tools/10_build_words_json.py` | Write `docs/data/words_vNNN.json` |
| `tools/11_validate.py` | Run the final checks and write a report |
| `data/manual/tts_standins_v001.csv` | Same-sound stand-ins for single characters |
| `data/manual/four_char_words_vNNN.csv`, `data/manual/capitals_vNNN.csv` | Written in Plan 3a (Task 7 and Task 6) and also read by step 8. They give the form of each four-character word, and which words that are not cards have capitals, with the words of a person's name. Step 5b adds the forms of sentence words in a new version, and the names of the sentences go in a new version of `capitals` (Task 11 Step 3) |
| `ATTRIBUTION.md` | Sources and licences |
| `tests/test_distract.py`, `test_review.py`, `test_sentences.py`, `test_sentpinyin.py`, `test_pinyincheck.py`, `test_ttsaudio.py`, `test_wordsjson_validate.py` | pytest |

Terms used below:
- **A polyphone** is a character with more than one reading, such as 长 (cháng, zhǎng) or 行 (xíng, háng).
- **A stand-in** is a different character with the same sound, read aloud instead of a single-character word whose default reading is wrong. For example, 杭 (háng) stands in for 行 when the card is 行 háng.
- **A batch agent** is a fresh Claude subagent that handles one input file and writes one answer file. **The independent checker** is a fresh subagent that did not write what it checks.

The workflow rules for every Claude-written step in this plan:
1. **Batch agents.** One fresh agent per batch file, at most 8 at a time, each given the step's instructions word for word with only the file paths filled in.
2. **Answer files.** An agent's answer goes to `data/claude/<kind>_vNNN/batch_KKK_v001.csv`, where `NNN` is the version of the batch folder. These answer files are committed.
3. **Redo.** When a merge script names a batch, a fresh agent redoes the whole batch. It gets the same instructions plus the "earlier attempt" paragraph with that batch's problem lines, and it writes the next answer version (`batch_KKK_v002.csv`). Earlier answer files are never edited or deleted.
4. **Limit.** After three redo rounds for the same batch, stop and ask the user.

Task 14 changes rules 3 and 4 for the pinyin correction. There a redo agent answers only the rejected lines, and after two redos a line keeps its draft and is listed for the user.

---

### Task 1: Overlapping meanings and usable wrong choices (`tools/distract.py`)

**Files:**
- Create: `tools/distract.py`
- Test: `tests/test_distract.py`

Two cards clash when their meanings share a sense after light clean-up (lower case, no brackets, no leading "to", "a", "the" or "be"). For example, 高兴 "happy; glad" and 快乐 "happy" share "happy". A clashing card is never a wrong choice for the other. Two cards sound the same when their tone-marked `py` matches after removing spaces, apostrophes and capitals. `py` is used rather than `pyNum`, because only `py` shows the 一 and 不 tone changes (see the schema file).

- [ ] **Step 1: Write the failing test `tests/test_distract.py`**

```python
from distract import meaning_keys, no_distract, sound, usable_choices


def test_meaning_keys():
    assert meaning_keys("to love; like doing sth.", "to love") == {"love", "like doing sth"}
    assert meaning_keys("happy (feeling); glad", "happy") == {"happy", "glad"}


def test_no_distract_links_overlapping_meanings_both_ways():
    words = [{"id": "w1", "en": "happy; glad", "enShort": "happy"}, {"id": "w2", "en": "happy", "enShort": "happy"},
             {"id": "w3", "en": "sad", "enShort": "sad"}]
    assert no_distract(words) == {"w1": ["w2"], "w2": ["w1"], "w3": []}


def W(wid, py, num, short, nd=()):
    return {"id": wid, "py": py, "pyNum": num, "enShort": short, "noDistract": list(nd)}


def test_usable_choices_per_quiz():
    ta = W("w1", "tā", "ta1", "he")
    pool = [ta, W("w2", "tā", "ta1", "she"), W("w3", "tā", "ta1", "it"), W("w4", "tǎ", "ta3", "tower"),
            W("w5", "hǎo", "hao3", "good", ["w1"]), W("w6", "hē", "he1", "he")]
    assert [w["id"] for w in usable_choices(ta, pool, "listen")] == ["w4"]
    assert [w["id"] for w in usable_choices(ta, pool, "pinyin")] == ["w4", "w6"]


def test_sound_uses_the_spoken_tones():
    assert sound({"py": "bú kèqi", "pyNum": "bu4 ke4 qi5"}) == "búkèqi"
    assert sound({"py": "Nǚ'ér", "pyNum": "nü3 er2"}) == "nǚér"
    assert sound({"py": "bámiáo-zhùzhǎng", "pyNum": "ba2 miao2 zhu4 zhang3"}) == "bámiáozhùzhǎng"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_distract.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'distract'`

- [ ] **Step 3: Write `tools/distract.py`**

```python
"""Which words must never be offered as each other's wrong quiz choices, and a count of usable ones.

Two words clash when their meanings overlap. For example 高兴 "happy; glad" and 快乐 "happy"
share "happy", so neither may be a wrong choice for the other.
"""
import re
from collections import defaultdict

_FILLER = re.compile(r"^(to|a|an|the|be)\s+")


def sound(word):
    """The word as it is spoken, which is its tone-marked py in lower case without spaces or apostrophes.

    It uses py, not pyNum, because only py shows the 一 and 不 tone changes (不客气 is "bú kèqi"),
    and it matches how the app (Plan 2, normPy) decides that two words sound the same.
    """
    return re.sub(r"[\s'’-]", "", word["py"].lower())


def meaning_keys(en, en_short):
    """The comparable senses of a card, in lower case, without brackets and without a leading "to", "a",
    "the" or "be".

    ("to love; like doing sth.", "to love") gives {"love", "like doing sth"}.
    """
    keys = set()
    for sense in en.split(";") + [en_short]:
        s = re.sub(r"\([^)]*\)", "", sense.lower()).strip(" .!?…")
        while _FILLER.match(s):
            s = _FILLER.sub("", s, count=1)
        s = re.sub(r"\s+", " ", s).strip()
        if s:
            keys.add(s)
    return keys


def no_distract(words):
    """{id: sorted ids whose meanings overlap}, over all words ("id", "en", "enShort")."""
    by_key = defaultdict(set)
    keys = {}
    for w in words:
        keys[w["id"]] = meaning_keys(w["en"], w["enShort"])
        for k in keys[w["id"]]:
            by_key[k].add(w["id"])
    out = {}
    for w in words:
        clash = set().union(*(by_key[k] for k in keys[w["id"]])) if keys[w["id"]] else set()
        out[w["id"]] = sorted(clash - {w["id"]})
    return out


def usable_choices(word, pool, quiz):
    """The words of `pool` that may be wrong choices for `word` in one quiz type.

    In the quiz "listen" the learner hears the word and picks its meaning, so a choice must not
    sound exactly the same (same sound()), must not show the same quiz meaning, and must not clash.
    In the quiz "pinyin" the learner sees the meaning and picks the pinyin, so a choice must show
    different pinyin and must not clash.
    """
    out = []
    for other in pool:
        if other["id"] == word["id"] or other["id"] in word["noDistract"] or word["id"] in other["noDistract"]:
            continue
        if quiz == "listen" and (sound(other) == sound(word)
                                 or other["enShort"].lower() == word["enShort"].lower()):
            continue
        if quiz == "pinyin" and sound(other) == sound(word):
            continue
        out.append(other)
    return out
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_distract.py -q`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/distract.py tests/test_distract.py && git commit -F - <<'EOF'
feat: overlapping meanings and usable wrong choices

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 2: Checks on the user's review (`tools/review.py`)

**Files:**
- Create: `tools/review.py`
- Test: `tests/test_review.py`

- [ ] **Step 1: Write the failing test `tests/test_review.py`**

```python
from review import check_review, check_theme_list

WORDS = {"w1": {"hz": "爱"}, "w2": {"hz": "八"}}
GENERATED = [{"id": "w1", "hz": "爱", "theme_no": "20", "theme_name": "Feelings"},
             {"id": "w2", "hz": "八", "theme_no": "3", "theme_name": "Numbers & Measure Words"}]


def test_an_unchanged_or_moved_sheet_is_accepted():
    assert check_review(WORDS, GENERATED, [dict(r) for r in GENERATED]) == ([], {"w1": 20, "w2": 3})
    moved = [dict(GENERATED[0], theme_no="22"), dict(GENERATED[1])]
    assert check_review(WORDS, GENERATED, moved) == ([], {"w1": 22, "w2": 3})


def test_review_problems():
    reviewed = [dict(GENERATED[0], hz="?"), dict(GENERATED[1], theme_no="31"),
                dict(GENERATED[0], theme_name="Food & Drink")]
    problems, _ = check_review(WORDS, GENERATED, reviewed)
    assert problems == ["w1: characters read as '?', so the file was not saved as CSV UTF-8",
                        "w2: theme_no '31' is not 1 to 30",
                        "w1: theme_name was changed but theme_no was not; change theme_no to move a word",
                        "w1: appears 2 times"]
    problems, _ = check_review(WORDS, GENERATED, [dict(GENERATED[0])])
    assert problems == ["w2: missing from the sheet"]


def test_theme_list():
    rows = [{"theme_no": str(n), "order": str(31 - n), "name": f"T{n}"} for n in range(1, 31)]
    problems, order, names = check_theme_list(rows)
    assert problems == [] and order[:3] == [30, 29, 28] and names[1] == "T1"
    problems, _, _ = check_theme_list(rows[:29] + [{"theme_no": "30", "order": "5", "name": ""}])
    assert problems == ["order must use 1 to 30, each once", "theme 30 has no name"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_review.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'review'`

- [ ] **Step 3: Write `tools/review.py`**

```python
"""Checks on the user's edited theme spreadsheet and theme list (from step 6b's review files).

The user moves a word by changing its theme_no; the theme_name column is only there to read.
"""
from themes import THEMES


def check_review(words, generated, reviewed):
    """Check the user's edited review sheet against the one step 6b wrote.

    words: {id: word}. generated and reviewed: lists of CSV rows. Returns (problems, {id: theme_no}).
    """
    problems, theme_of = [], {}
    generated = {r["id"]: r for r in generated}
    counts = {}
    for r in reviewed:
        rid = (r.get("id") or "").strip()
        counts[rid] = counts.get(rid, 0) + 1
        if rid not in words:
            problems.append(f"{rid!r}: not a word id")
            continue
        if (r.get("hz") or "").strip() != words[rid]["hz"]:
            problems.append(f"{rid}: characters read as {r.get('hz')!r}, so the file was not saved as CSV UTF-8")
        no = (r.get("theme_no") or "").strip()
        if not no.isdigit() or not 1 <= int(no) <= len(THEMES):
            problems.append(f"{rid}: theme_no {no!r} is not 1 to {len(THEMES)}")
            continue
        old = generated[rid]
        if (r.get("theme_name") or "").strip() != old["theme_name"] and no == old["theme_no"]:
            problems.append(f"{rid}: theme_name was changed but theme_no was not; change theme_no to move a word")
        theme_of[rid] = int(no)
    problems += [f"{rid}: appears {n} times" for rid, n in counts.items() if n > 1]
    problems += [f"{rid}: missing from the sheet" for rid in words if rid not in counts]
    return problems, theme_of


def check_theme_list(rows):
    """Check the theme list (theme_no, order, name). Returns (problems, order, names), where order
    lists theme numbers in study order and names maps theme_no to its (possibly renamed) name."""
    problems = []
    try:
        numbers = sorted(int(r["theme_no"]) for r in rows)
        orders = sorted(int(r["order"]) for r in rows)
    except (KeyError, ValueError):
        return ["theme_no and order must be whole numbers"], [], {}
    if numbers != list(range(1, len(THEMES) + 1)):
        problems.append(f"theme_no must be 1 to {len(THEMES)}, each once")
    if orders != list(range(1, len(THEMES) + 1)):
        problems.append(f"order must use 1 to {len(THEMES)}, each once")
    names = {int(r["theme_no"]): (r.get("name") or "").strip() for r in rows}
    problems += [f"theme {n} has no name" for n, name in names.items() if not name]
    order = [int(r["theme_no"]) for r in sorted(rows, key=lambda r: int(r["order"]))]
    return problems, order, names
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_review.py -q`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/review.py tests/test_review.py && git commit -F - <<'EOF'
feat: checks on the user's theme review

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 3: Apply the review (`tools/06c_themes_finalize.py`)

**Files:**
- Create: `tools/06c_themes_finalize.py`
- Input from the user: `data/manual/themes_reviewed_v001.csv` and, if the user edited it, `data/manual/theme_list_reviewed_v001.csv`
- Output: `data/build/curriculum_v001.jsonl`, `data/build/themes_v001.json`, `data/reports/curriculum_v001.txt`

The curriculum order goes theme by theme in the reviewed theme order, then by HSK level, then by frequency (`themes.curriculum` from Plan 3a). A theme over 350 words becomes "Name (Part 1)", "Name (Part 2)" and so on (`themes.split_by_level`). Theme IDs `t01`, `t02`... follow the final order, parts included.

The script picks its four input files by their own latest versions, so the version numbers do not need to match:
- the user's reviewed sheet is the latest `data/manual/themes_reviewed_vNNN.csv`;
- the sheet it is compared with is the latest `data/review/themes_review_vNNN.csv`, which step 6b wrote;
- the theme list is the latest `data/manual/theme_list_reviewed_vNNN.csv` if the user ever saved one, else the latest `data/review/theme_list_vNNN.csv`.

For example, a corrected `themes_reviewed_v002.csv` is used together with `themes_review_v001.csv` and `theme_list_reviewed_v001.csv`. Each theme in `themes_vNNN.json` also keeps `no`, its original theme number, so a theme part can be traced back to the review sheet. Every theme part needs at least 40 words, the Starter Kit included.

- [ ] **Step 1: Write `tools/06c_themes_finalize.py`**

```python
"""Step 6c. Apply the user's theme review: final themes, parts, curriculum order and overlap lists.

Inputs:  data/build/wordlist_vNNN.jsonl (latest)
         data/manual/themes_reviewed_vNNN.csv (latest), the user's edited copy of the review sheet
         data/review/themes_review_vNNN.csv (latest), the review sheet as step 6b wrote it
         data/manual/theme_list_reviewed_vNNN.csv (latest) if the user ever edited the theme list,
         else data/review/theme_list_vNNN.csv (latest)
         Each is picked by its own latest version, so their numbers need not match.
Outputs: data/build/curriculum_vNNN.jsonl (id, theme, ord, noDistract),
         data/build/themes_vNNN.json (id, order, name, count, and no, the original theme number),
         data/reports/curriculum_vNNN.txt
Nothing is written if the review has problems or a theme part ends up below 40 words. This holds
for the Starter Kit too, whose widened rule gives it exactly 40 words.
"""
import sys

from common import (all_version_paths, latest_version_path, next_versions, read_csv, read_jsonl, write_new_json,
                    write_new_jsonl, write_new_text)
from distract import no_distract
from review import check_review, check_theme_list
from themes import MIN_THEME, curriculum


def read_sheet(path):
    try:
        return read_csv(path)
    except UnicodeDecodeError:
        sys.exit(f"{path} is not UTF-8. In Excel use File, Save As, 'CSV UTF-8 (Comma delimited)', "
                 "under a new version number.")


def main():
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    reviewed_path = latest_version_path("data/manual/themes_reviewed", ".csv")
    generated_path = latest_version_path("data/review/themes_review", ".csv")
    edited_lists = all_version_paths("data/manual/theme_list_reviewed", ".csv")
    list_path = edited_lists[-1][1] if edited_lists else latest_version_path("data/review/theme_list", ".csv")
    problems, theme_of = check_review(words, read_csv(generated_path), read_sheet(reviewed_path))
    more, order, names = check_theme_list(read_sheet(list_path))
    problems += more
    if problems:
        sys.exit(f"Stopped, nothing written. {len(problems)} problems:\n  " + "\n  ".join(problems[:40]))

    parts = curriculum(list(words.values()), theme_of, order, names)
    small = [f"{name}: {len(ws)} words" for no, name, ws in parts if len(ws) < MIN_THEME]
    if small:
        sys.exit("Stopped, nothing written. These themes have fewer than 40 words; move their words or "
                 "merge themes in a new reviewed copy:\n  " + "\n  ".join(small))
    overlap = no_distract(list(words.values()))
    rows, themes, position = [], [], 0
    for k, (no, name, members) in enumerate(parts, start=1):
        tid = f"t{k:02d}"
        themes.append({"id": tid, "order": k, "name": name, "count": len(members), "no": no})
        for w in members:
            position += 1
            rows.append({"id": w["id"], "theme": tid, "ord": position, "noDistract": overlap[w["id"]]})

    paths = next_versions(curriculum=("data/build/curriculum", ".jsonl"), themes=("data/build/themes", ".json"),
                          report=("data/reports/curriculum", ".txt"))
    write_new_jsonl(paths["curriculum"], rows)
    write_new_json(paths["themes"], themes)
    lines = ["Curriculum report", "", f"Review used: {reviewed_path}, compared with {generated_path}",
             f"Theme list used: {list_path}", f"Words: {len(rows)} in {len(themes)} themes",
             f"Words with at least one overlapping meaning (noDistract): "
             f"{sum(1 for r in rows if r['noDistract'])}", ""]
    lines += [f"  {t['id']} {t['name']}: {t['count']}" for t in themes]
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"Curriculum: {paths['curriculum']}. Themes: {paths['themes']}. Report: {paths['report']}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `PYTHONIOENCODING=utf-8 python tools/06c_themes_finalize.py`
Expected: a report with `Words: 5043 in N themes` (N is 30 plus one extra per added part), `Words with at least one overlapping meaning (noDistract): 3024` (unchanged by the review, because it depends only on the meanings), `t01 Starter Kit: 40` unless the user moved words into or out of it, then every theme with its size.
If it stops with problems, show them to the user in plain words, ask for a corrected copy saved under the next free number (`data/manual/themes_reviewed_v002.csv`, and `data/manual/theme_list_reviewed_v002.csv` if the theme list needs a correction), and rerun. Nothing needs copying, because the script takes each input at its own latest version. Check that the `Review used` and `Theme list used` lines of the new report name the files the user meant.

- [ ] **Step 3: Commit the script and the user's reviewed files**

```bash
git add tools/06c_themes_finalize.py data/manual/themes_reviewed_v*.csv && git commit -F - <<'EOF'
feat: apply the theme review, split big themes, curriculum order

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```
If the user also saved `data/manual/theme_list_reviewed_vNNN.csv` files, add them to the same `git add`.

---

### Task 4: Choosing and checking sentences (`tools/sentences.py`)

**Files:**
- Create: `tools/sentences.py`
- Test: `tests/test_sentences.py`

A character's level is the lowest HSK level of any card that contains it, so 我 is level 1 and 餐 (in 餐厅, HSK 4) is level 4. 〇 (U+3007), the zero of years such as 二〇〇八年, counts as a Chinese character too, with the level of 零, because the writing agents write numbers in characters. A "hard" character is one above a limit, outside the headword.
- **Choosing a PDF sentence.** Among a card's usable PDF sentences, the one with the fewest hard characters (limit: the card's level, at least 2) wins, then the shortest.
- **Rejecting a PDF sentence.** A PDF sentence is unusable if any of these holds:
  - its ～ marks cannot be filled;
  - it lacks the headword;
  - it has stray Latin letters;
  - it is a two-speaker dialogue;
  - it is longer than 40 characters;
  - it has fewer than 3 Chinese characters.
- **Accepting a written sentence.** A written sentence must meet all of these:
  - it has 6 to 15 Chinese characters;
  - it ends in 。！ or ？;
  - it contains the headword exactly;
  - it has no Latin letters or ～;
  - it has at most one hard character, where the limit is HSK 2 for level 1 and 2 cards, the card's level for 3 and 4, and HSK 4 for 5 and 6.

- [ ] **Step 1: Write the failing test `tests/test_sentences.py`**

```python
from sentences import (char_levels, check_answers, choose_pdf_sentence, english_problems, fix_share, hard_chars,
                       pdf_problem, redo_batches, spotcheck_problems, verdict_problems, written_limit,
                       written_problems)

WORDS = [{"hz": "我", "lv": 1}, {"hz": "你", "lv": 1}, {"hz": "爱", "lv": 1}, {"hz": "吃", "lv": 1},
         {"hz": "米饭", "lv": 1}, {"hz": "喜欢", "lv": 1}, {"hz": "餐厅", "lv": 4}, {"hz": "今天", "lv": 1},
         {"hz": "很", "lv": 1}, {"hz": "好", "lv": 1}, {"hz": "这个", "lv": 1}]
LEVELS = char_levels(WORDS)


def test_char_levels_and_hard_chars():
    assert LEVELS["我"] == 1 and LEVELS["餐"] == 4
    assert hard_chars("我爱餐厅。", "爱", 2, LEVELS) == ["餐", "厅"]
    assert hard_chars("我爱鲸。", "爱", 6, LEVELS) == ["鲸"]


def test_the_zero_of_years_is_a_character_as_easy_as_ling():
    # 〇 (U+3007), the zero of years, lies outside the main block of Chinese characters. It counts as a
    # character with the level of 零, so a year such as 二〇〇八年 does not make a sentence hard.
    levels = char_levels(WORDS + [{"hz": "零", "lv": 2}, {"hz": "二", "lv": 1}, {"hz": "八", "lv": 1},
                                  {"hz": "年", "lv": 1}])
    assert levels["〇"] == 2
    assert written_problems("我在二〇〇八年很爱吃米饭。", {"hz": "爱", "lv": 1}, levels) == []


def test_pdf_problem():
    assert pdf_problem("妈妈，我爱你。", "爱") is None
    assert pdf_problem(None, "爱") == "the ～ marks do not match the headword"
    assert pdf_problem("我喜欢你。", "爱") == "the headword is missing"
    assert pdf_problem("甲：谢谢你！乙：不客气。", "不客气") == "a two-speaker dialogue"
    assert pdf_problem("拜托！", "拜托") == "too short"


def test_choose_pdf_sentence_prefers_easy_then_short():
    word = {"hz": "爱", "lv": 1, "sents": [["我～餐厅。", "HSK1 #1"], ["我～吃米饭，我～你。", "HSK1 #1"],
                                           ["我～你。", "HSK2 #1"], ["我～鲸", "HSK1 #1"]]}
    assert choose_pdf_sentence(word, LEVELS) == ("我爱你。", "HSK2 #1")
    assert choose_pdf_sentence({"hz": "爱", "lv": 1, "sents": []}, LEVELS) is None


def test_written_limit():
    assert [written_limit(lv) for lv in range(1, 7)] == [2, 2, 3, 4, 4, 4]


def test_written_problems():
    word = {"hz": "爱", "lv": 1}
    assert written_problems("我很爱吃米饭。", word, LEVELS) == []
    assert written_problems("我爱你。", word, LEVELS) == ["3 Chinese characters, not 6 to 15"]
    assert "does not contain the headword exactly" in written_problems("我很喜欢吃米饭。", word, LEVELS)
    assert "too many hard characters: 餐厅" in written_problems("我很爱这个餐厅。", word, LEVELS)
    assert "does not end with 。！ or ？" in written_problems("我很爱吃米饭", word, LEVELS)


def test_english_problems():
    assert english_problems("I love you.") == []
    assert english_problems("") == ["empty translation"]
    assert english_problems("I love 你") == ["Chinese characters in the translation",
                                             "translation does not end with . ! or ?"]


def test_check_answers():
    inputs = [{"id": "w1", "hz": "爱"}, {"id": "w2", "hz": "吃"}]
    outputs = [{"id": "w1", "hz": "爱", "sentence": "我很爱吃米饭。"}, {"id": "w1", "hz": "爱", "sentence": "x"},
               {"id": "w3", "hz": "好", "sentence": "好。"}]
    rule = lambda given, answer: [] if answer["sentence"].endswith("。") else ["bad"]
    problems, got = check_answers(inputs, outputs, "hz", rule)
    assert problems == ["w1: bad", "w3: not in the input", "w1: answered 2 times", "w2: missing"]
    assert set(got) == {"w1"}


def test_verdict_problems():
    word = {"hz": "爱", "lv": 1}
    assert verdict_problems({}, {"verdict": "OK"}, word, LEVELS) == []
    assert verdict_problems({}, {"verdict": "maybe"}, word, LEVELS) == ["verdict 'maybe' is not OK or FIX"]
    assert verdict_problems({}, {"verdict": "FIX", "fixed_en": ""}, word, LEVELS) == ["fixed_en: empty translation"]
    assert verdict_problems({}, {"verdict": "FIX", "fixed_en": "I love rice.", "fixed_sentence": "我爱。"},
                            word, LEVELS) == ["fixed_sentence: 2 Chinese characters, not 6 to 15"]


def test_redo_batches_and_fix_share():
    sample = [{"id": "w1", "batch": "sentences/batch_001", "src": "claude"},
              {"id": "w2", "batch": "sentences/batch_001", "src": "claude"},
              {"id": "w3", "batch": "translations/batch_004", "src": "pdf"},
              {"id": "w4", "batch": "translations/batch_004", "src": "pdf"}]
    assert redo_batches(sample, {"w1", "w2", "w3"}) == ["sentences/batch_001"]
    assert fix_share(sample, {"w1", "w3"}, "pdf") == 0.5
    assert fix_share(sample, set(), "claude") == 0.0


def test_spotcheck_problems():
    generated = [{"id": "w1"}, {"id": "w2"}, {"id": "w3"}]
    reviewed = [{"id": "w1", "ok": "y", "better_en": ""}, {"id": "w2", "ok": "N", "better_en": "I eat rice."},
                {"id": "w3", "ok": "Y", "better_en": ""}]
    assert spotcheck_problems(generated, reviewed) == ([], [("w2", "I eat rice.")])
    assert spotcheck_problems(generated, reviewed[:2])[0] == ["w3: missing from the reviewed sheet"]
    reviewed = [{"id": "w1", "ok": "", "better_en": ""}, {"id": "w2", "ok": "N", "better_en": ""},
                {"id": "w3", "ok": "Y"}, {"id": "w3", "ok": "Y"}, {"id": "w9", "ok": "Y"}]
    assert spotcheck_problems(generated, reviewed)[0] == [
        "w1: ok is '', write Y or N", "w2: better_en: empty translation", "'w9': not in the spot-check sheet",
        "w3: appears 2 times"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_sentences.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'sentences'`

- [ ] **Step 3: Write `tools/sentences.py`**

```python
"""Choosing, checking and scoring example sentences.

A card's sentence is taken from its PDF entry when one is usable, else Claude writes one.
"Easy" is measured per character. A character's level is the lowest HSK level of any card
that contains it, so 我 is level 1 and 餐 (in 餐厅, HSK 4) is level 4.
"""
import re
from collections import Counter

from pdfbody import PLACEHOLDER, contains_head, fill_placeholder

_HANZI = re.compile(r"[\u3007\u4e00-\u9fff]")  # Chinese characters, with the 〇 of years (二〇〇八年)
_DIALOGUE = re.compile(r"甲：|乙：|[AB]：")
PDF_MIN_HANZI, PDF_MAX_CHARS = 3, 40
WRITTEN_MIN, WRITTEN_MAX = 6, 15
UNKNOWN_LEVEL = 7


def char_levels(words):
    """{character: lowest HSK level of any card containing it}. 〇, the zero of years, has the level of 零."""
    out = {}
    for w in words:
        for ch in _HANZI.findall(w["hz"]):
            out[ch] = min(out.get(ch, UNKNOWN_LEVEL), w["lv"])
    if "零" in out:
        out.setdefault("〇", out["零"])
    return out


def hanzi_count(sentence):
    return len(_HANZI.findall(sentence))


def _outside_head(sentence, hz):
    """The sentence with every part of the headword removed, so only the other characters are scored."""
    for part in (p for p in hz.split("…") if p):
        sentence = sentence.replace(part, "")
    return sentence


def hard_chars(sentence, hz, limit, levels):
    """Characters outside the headword whose level is above `limit` (unknown characters count as hard)."""
    return [ch for ch in _HANZI.findall(_outside_head(sentence, hz)) if levels.get(ch, UNKNOWN_LEVEL) > limit]


def pdf_problem(sentence, hz):
    """Why a filled-in PDF sentence cannot be used, or None when it can."""
    if sentence is None:
        return "the ～ marks do not match the headword"
    if PLACEHOLDER in sentence or "□" in sentence:
        return "undecoded or unfilled text"
    if not contains_head(sentence, hz):
        return "the headword is missing"
    if re.search(r"[a-z]", sentence):
        return "stray Latin letters"
    if _DIALOGUE.search(sentence):
        return "a two-speaker dialogue"
    if len(sentence) > PDF_MAX_CHARS:
        return f"longer than {PDF_MAX_CHARS} characters"
    if hanzi_count(sentence) < PDF_MIN_HANZI:
        return "too short"
    return None


def choose_pdf_sentence(word, levels):
    """The best usable PDF sentence of a word as (sentence, ref), or None.

    word["sents"] holds [sentence, ref] pairs that may contain ～. The best sentence has the
    fewest characters above the word's level (at least level 2), then the fewest characters.
    """
    limit = max(word["lv"], 2)
    best = None
    for raw, ref in word["sents"]:
        s = fill_placeholder(raw, word["hz"])
        if pdf_problem(s, word["hz"]) is not None:
            continue
        score = (len(hard_chars(s, word["hz"], limit, levels)), len(s))
        if best is None or score < best[0]:
            best = (score, s, ref)
    return (best[1], best[2]) if best else None


def written_limit(lv):
    """The highest character level allowed in a written sentence, which is HSK 2 for levels 1 and 2,
    the word's own level for 3 and 4, and HSK 4 for levels 5 and 6."""
    return min(max(lv, 2), 4)


def written_problems(sentence, word, levels):
    """Every rule a newly written sentence breaks (an empty list means it is accepted).

    The rules: 6 to 15 Chinese characters, ends with 。！ or ？, contains the headword exactly
    (each half of a pattern word, in order), no Latin letters, no ～, and at most one character
    above written_limit(level) outside the headword.
    """
    s, hz = sentence.strip(), word["hz"]
    problems = []
    n = hanzi_count(s)
    if not WRITTEN_MIN <= n <= WRITTEN_MAX:
        problems.append(f"{n} Chinese characters, not {WRITTEN_MIN} to {WRITTEN_MAX}")
    if not s or s[-1] not in "。！？":
        problems.append("does not end with 。！ or ？")
    if not contains_head(s, hz):
        problems.append("does not contain the headword exactly")
    if re.search(r"[A-Za-z~～]", s):
        problems.append("contains Latin letters or ～")
    hard = hard_chars(s, hz, written_limit(word["lv"]), levels)
    if len(hard) > 1:
        problems.append(f"too many hard characters: {''.join(hard)}")
    return problems


def english_problems(en):
    """Rules for an English translation: not empty, no Chinese characters, at most 200 characters,
    and it ends like a sentence (. ! ? or a closing quote or bracket)."""
    en = (en or "").strip()
    if not en:
        return ["empty translation"]
    problems = []
    if _HANZI.search(en):
        problems.append("Chinese characters in the translation")
    if len(en) > 200:
        problems.append("translation longer than 200 characters")
    if en[-1] not in ".!?\"')”’":
        problems.append("translation does not end with . ! or ?")
    return problems


def check_answers(inputs, outputs, key_field, check_row):
    """Match one batch agent's rows to its input rows by id and collect every problem.

    key_field: the input column the answer must copy exactly ("hz" for written sentences,
    "sentence" for translations and checks). check_row(input_row, answer_row) gives the content
    problems. Returns (problems, {id: answer_row}).
    """
    want = {r["id"]: r for r in inputs}
    problems, got, counts = [], {}, {}
    for r in outputs:
        rid = (r.get("id") or "").strip()
        counts[rid] = counts.get(rid, 0) + 1
        if rid not in want:
            problems.append(f"{rid}: not in the input")
            continue
        if (r.get(key_field) or "").strip() != want[rid][key_field]:
            problems.append(f"{rid}: {key_field} {r.get(key_field)!r} differs from the input")
        problems += [f"{rid}: {p}" for p in check_row(want[rid], r)]
        got[rid] = r
    problems += [f"{rid}: answered {n} times" for rid, n in counts.items() if n > 1 and rid in want]
    problems += [f"{rid}: missing" for rid in want if rid not in counts]
    return problems, got


def verdict_problems(row, answer, word, levels):
    """Problems in the checker's answer for one sampled row.

    The verdict must be OK or FIX. A FIX needs fixed_en, a corrected translation. It may also
    give fixed_sentence, which must then follow the rules for written sentences.
    """
    verdict = (answer.get("verdict") or "").strip()
    if verdict not in ("OK", "FIX"):
        return [f"verdict {verdict!r} is not OK or FIX"]
    if verdict == "OK":
        return []
    problems = [f"fixed_en: {p}" for p in english_problems(answer.get("fixed_en"))]
    fixed = (answer.get("fixed_sentence") or "").strip()
    if fixed:
        problems += [f"fixed_sentence: {p}" for p in written_problems(fixed, word, levels)]
    return problems


def redo_batches(sample, fixed_ids):
    """Batches whose sampled rows needed two or more fixes, as sorted batch names."""
    counts = Counter(r["batch"] for r in sample if r["id"] in fixed_ids)
    return sorted(b for b, n in counts.items() if n >= 2)


def fix_share(sample, fixed_ids, src):
    """The share of sampled rows from one source ("claude" or "pdf") that needed a fix."""
    rows = [r for r in sample if r["src"] == src]
    return sum(1 for r in rows if r["id"] in fixed_ids) / len(rows) if rows else 0.0


def spotcheck_problems(generated, reviewed):
    """Check the user's spot-check sheet against the one step 7c wrote.

    generated and reviewed are lists of CSV rows. Every generated id must appear exactly once,
    with ok Y or N (either case), and every N row needs a usable better_en.
    Returns (problems, [(id, better_en)] for the N rows).
    """
    want = {r["id"] for r in generated}
    problems, wrong, counts = [], [], Counter()
    for r in reviewed:
        rid, ok = (r.get("id") or "").strip(), (r.get("ok") or "").strip().upper()
        counts[rid] += 1
        if rid not in want:
            problems.append(f"{rid!r}: not in the spot-check sheet")
        elif ok not in ("Y", "N"):
            problems.append(f"{rid}: ok is {r.get('ok')!r}, write Y or N")
        elif ok == "N":
            better = (r.get("better_en") or "").strip()
            problems += [f"{rid}: better_en: {p}" for p in english_problems(better)]
            wrong.append((rid, better))
    problems += [f"{rid}: appears {n} times" for rid, n in counts.items() if n > 1 and rid in want]
    problems += [f"{rid}: missing from the reviewed sheet" for rid in sorted(want) if rid not in counts]
    return problems, wrong
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_sentences.py -q`
Expected: `11 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/sentences.py tests/test_sentences.py && git commit -F - <<'EOF'
feat: choose and check example sentences and translations

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 5: Choose the PDF sentences and prepare the batches (`tools/07_sentences.py`)

**Files:**
- Create: `tools/07_sentences.py`
- Output: `data/build/sentences_pdf_v001.jsonl`, `data/build/sentence_batches_v001/`, `data/build/translation_batches_v001/`, `data/reports/sentences_v001.txt`

- [ ] **Step 1: Write `tools/07_sentences.py`**

```python
"""Step 7. Choose the PDF sentences and prepare the batches for the Claude writing and translating agents.

Inputs:  data/build/wordlist_vNNN.jsonl, data/build/curriculum_vNNN.jsonl, data/build/themes_vNNN.json (latest)
Outputs (one shared version NNN):
  data/build/sentences_pdf_vNNN.jsonl              {id, sentence, ref} for every word with a usable PDF sentence
  data/build/sentence_batches_vNNN/batch_001.csv   words that need a new sentence, 60 per batch
                                                   (id, hz, py, lv, pos, en, theme)
  data/build/translation_batches_vNNN/batch_001.csv  PDF sentences to translate, 100 per batch
                                                   (id, word, word_py, word_en, sentence)
  data/reports/sentences_vNNN.txt
The agents answer in data/claude/sentences_vNNN/batch_001_v001.csv (id, hz, sentence, en) and
data/claude/translations_vNNN/batch_001_v001.csv (id, sentence, en).
"""
from collections import Counter

from common import (latest_version_path, next_versions, read_json, read_jsonl, write_new_csv, write_new_jsonl,
                    write_new_text)
from sentences import char_levels, choose_pdf_sentence
from themes import chunks

WRITE_BATCH, TRANSLATE_BATCH = 60, 100


def main():
    words = read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))
    theme_of = {r["id"]: r["theme"] for r in read_jsonl(latest_version_path("data/build/curriculum", ".jsonl"))}
    theme_name = {t["id"]: t["name"] for t in read_json(latest_version_path("data/build/themes", ".json"))}
    levels = char_levels(words)
    chosen, needed = [], []
    for w in words:
        found = choose_pdf_sentence(w, levels)
        if found:
            chosen.append({"id": w["id"], "sentence": found[0], "ref": found[1], "word": w})
        else:
            needed.append(w)

    paths = next_versions(pdf=("data/build/sentences_pdf", ".jsonl"), write=("data/build/sentence_batches", ""),
                          translate=("data/build/translation_batches", ""), report=("data/reports/sentences", ".txt"))
    write_new_jsonl(paths["pdf"], [{k: c[k] for k in ("id", "sentence", "ref")} for c in chosen])
    paths["write"].mkdir()
    for n, batch in enumerate(chunks(needed, WRITE_BATCH), start=1):
        write_new_csv(paths["write"] / f"batch_{n:03d}.csv", ["id", "hz", "py", "lv", "pos", "en", "theme"],
                      [[w["id"], w["hz"], w["py"], w["lv"], " ".join(w["pos"]), w["en"],
                        theme_name[theme_of[w["id"]]]] for w in batch])
    paths["translate"].mkdir()
    for n, batch in enumerate(chunks(chosen, TRANSLATE_BATCH), start=1):
        write_new_csv(paths["translate"] / f"batch_{n:03d}.csv", ["id", "word", "word_py", "word_en", "sentence"],
                      [[c["id"], c["word"]["hz"], c["word"]["py"], c["word"]["en"], c["sentence"]] for c in batch])
    need_levels = Counter(w["lv"] for w in needed)
    lines = ["Sentence report", "",
             f"Words: {len(words)}. With a usable PDF sentence: {len(chosen)}. Need a new sentence: {len(needed)}.",
             "New sentences needed by HSK level: "
             + ", ".join(f"HSK{lv} {need_levels[lv]}" for lv in sorted(need_levels)),
             "PDF words whose sentences were all unusable: " + " ".join(w["hz"] for w in needed if w["src"] == "pdf"),
             f"Writing batches: {-(-len(needed) // WRITE_BATCH)} in {paths['write']}",
             f"Translation batches: {-(-len(chosen) // TRANSLATE_BATCH)} in {paths['translate']}", ""]
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `PYTHONIOENCODING=utf-8 python tools/07_sentences.py`
Expected (the sentence choice does not depend on themes, so these numbers hold after any review):
```
Sentence report

Words: 5043. With a usable PDF sentence: 4051. Need a new sentence: 992.
New sentences needed by HSK level: HSK1 5, HSK2 9, HSK3 15, HSK4 72, HSK5 880, HSK6 11
PDF words whose sentences were all unusable: 谢谢 对不起 不客气 行 关怀 柑橘 意志 拜托 回避 当心 吹牛 滔滔不绝
Writing batches: 17 in data\build\sentence_batches_v001
Translation batches: 41 in data\build\translation_batches_v001
```

- [ ] **Step 3: Read 20 chosen PDF sentences as a sanity check**

Run: `PYTHONIOENCODING=utf-8 python -c "import json,random;rows=[json.loads(l) for l in open('data/build/sentences_pdf_v001.jsonl',encoding='utf-8')];[print(r['id'],r['ref'],r['sentence']) for r in random.Random(3).sample(rows,20)]"`
Expected: 20 natural Chinese sentences with no ～, ~ or □ left in them. The pattern-word card (w0316) reads `虽然下雨了，但是我们还是想去看电影。`, and the wrapped-headword cards carry their repaired sentences from `pdf_fixes_v001.csv`.

- [ ] **Step 4: Commit**

```bash
git add tools/07_sentences.py && git commit -F - <<'EOF'
feat: choose PDF sentences and prepare writing and translation batches

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 6: Write the new sentences and translate the PDF sentences (multi-agent workflow)

**Files:**
- Create (by the agents): `data/claude/sentences_v001/batch_001_v001.csv` to `batch_017_v001.csv`, and `data/claude/translations_v001/batch_001_v001.csv` to `batch_041_v001.csv`

This step is done by Claude batch agents under the workflow rules above. The two instruction texts below are this step's code, given word for word with `{input}` and `{output}` filled in.
- **Writing agents.** For each `data/build/sentence_batches_v001/batch_KKK.csv`, use the writing instructions with `{output}` = `data/claude/sentences_v001/batch_KKK_v001.csv`.
- **Translating agents.** For each `data/build/translation_batches_v001/batch_KKK.csv`, use the translation instructions with `{output}` = `data/claude/translations_v001/batch_KKK_v001.csv`.

The writing instructions:

------------------------------------------------------------
You write one short example sentence in Chinese for each word on a beginner's flashcard, and translate each sentence into English.

Read the input file {input}. It is a UTF-8 CSV with the columns id, hz (the word), py (the word's pinyin on the card), lv (its HSK level, 1 to 6), pos (part-of-speech labels), en (the card's English meaning) and theme (the card's topic).

Write the output file {output} as a UTF-8 CSV with exactly this header line:
id,hz,sentence,en
Write one row per input row, in the input order. Copy id and hz exactly. Quote any field that contains a comma.

Rules for the sentence:
1. Simplified Chinese, 6 to 15 Chinese characters (punctuation does not count), ending with 。 or ？ or ！.
2. It contains hz exactly as written, used with the meaning in en and the pronunciation in py. For example, for 长 zhǎng (to grow) write about growing, not about length. A pattern word such as 虽然…但是… uses each half, in order, in the same sentence, and the "…" marks are not written.
3. Every other word is easy. For cards of level 1 and 2 use only HSK 1 and 2 words. For level 3 use HSK 1 to 3 words. For levels 4 to 6 use HSK 1 to 4 words. At most one character outside the headword may be harder than that.
4. It is natural, everyday Chinese that a teacher would say, with one clear idea, preferably fitting the theme.
5. No Latin letters, no names of real people or brands, and no politics, religion, violence or adult topics. Write numbers in Chinese characters.

Rules for en:
6. A natural English translation of the whole sentence, as one sentence ending with . or ? or !. Translate the meaning, not word by word. No Chinese characters and no pinyin.

A script checks rules 1, 2 and 3 for every row and rejects the whole batch if any row fails, so count the characters.

Do not read, create or change any other file. When you have finished, reply with one line: the number of rows written.
------------------------------------------------------------

The translation instructions:

------------------------------------------------------------
You translate Chinese example sentences into English for a beginner's flashcards.

Read the input file {input}. It is a UTF-8 CSV with the columns id, word (the card's word), word_py (its pinyin), word_en (the card's English meaning) and sentence (the Chinese example sentence).

Write the output file {output} as a UTF-8 CSV with exactly this header line:
id,sentence,en
Write one row per input row, in the input order. Copy id and sentence exactly. Quote any field that contains a comma or a double quote, and double any double quote inside it.

Rules for en:
1. Translate the whole sentence faithfully into natural English, as one English sentence (use two only when the Chinese has two).
2. Where it fits, translate the card's word with the card's meaning (word_en), so the learner can see the word in the translation.
3. End with . or ? or !. Keep numbers as digits. No Chinese characters, no pinyin, and no notes or brackets explaining grammar.
4. Write Chinese names in pinyin with capital letters, for example 小王 as Xiao Wang.

Do not read, create or change any other file. When you have finished, reply with one line: the number of rows written.
------------------------------------------------------------

The extra paragraph for a redo agent (append it to the instructions for that kind of batch):

------------------------------------------------------------
An earlier attempt at this batch was rejected for these problems:
{problem lines for this batch, from the report named by step 7b}
Write a complete new answer file for the whole batch, avoiding these problems.
------------------------------------------------------------

- [ ] **Step 1: Run the 17 writing agents and 41 translating agents**

- [ ] **Step 2: Confirm the answer files exist**

Run: `ls data/claude/sentences_v001 | wc -l; ls data/claude/translations_v001 | wc -l`
Expected: `17` and `41`

---

### Task 7: Check the answers and pick the checker's sample (`tools/07b_sentences_merge.py`)

**Files:**
- Create: `tools/07b_sentences_merge.py`
- Output: `data/build/sentences_en_vRRR.jsonl`, `data/build/check_batches_vRRR/`, `data/reports/sentences_merge_vRRR.txt`

The sample for the independent checker is 10% of the written sentences (at least 50) plus 3% of the PDF translations (at least 100). With 992 and 4,051 rows that is 99 + 122 = 221 rows in 2 files.

- [ ] **Step 1: Write `tools/07b_sentences_merge.py`**

```python
"""Step 7b. Check the written sentences and the translations, then pick the sample for the checker.

Inputs:  the latest data/build/sentence_batches_vNNN/ and translation_batches_vNNN/, the matching
         data/build/sentences_pdf_vNNN.jsonl, and the agents' answers in data/claude/sentences_vNNN/ and
         data/claude/translations_vNNN/ (for each batch_KKK.csv, the latest batch_KKK_vMMM.csv)
Outputs: data/build/sentences_en_vRRR.jsonl  {id, word, sentence, en, src, batch} for every word
         data/build/check_batches_vRRR/batch_001.csv  the checker's sample, 120 rows per file
                                            (id, word, word_py, word_en, sentence, en, src)
         data/reports/sentences_merge_vRRR.txt
When any batch has problems, only the report is written. It lists every problem by batch,
and those batches are redone by a new batch agent.
"""
import random
import sys
from pathlib import Path

from common import (all_version_paths, latest_version_path, next_version_path, next_versions, read_csv, read_jsonl,
                    write_new_csv, write_new_jsonl, write_new_text)
from sentences import char_levels, check_answers, english_problems, written_problems
from themes import chunks

CHECK_BATCH = 120


def answers_for(folder, batch):
    found = all_version_paths(folder / batch.stem, ".csv")
    return read_csv(found[-1][1]) if found else None


def main():
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    levels = char_levels(list(words.values()))
    write_dir = latest_version_path("data/build/sentence_batches", "")
    version = write_dir.name.rsplit("_", 1)[1]
    translate_dir = Path(f"data/build/translation_batches_{version}")
    pdf = {r["id"]: r for r in read_jsonl(f"data/build/sentences_pdf_{version}.jsonl")}

    def written_rule(given, answer):
        return written_problems(answer.get("sentence") or "", words[given["id"]], levels) + \
            english_problems(answer.get("en"))

    rows, problems = [], {}
    for kind, folder, key, rule in (("sentences", write_dir, "hz", written_rule),
                                    ("translations", translate_dir, "sentence",
                                     lambda given, answer: english_problems(answer.get("en")))):
        answers_dir = Path("data/claude") / f"{kind}_{version}"
        for batch in sorted(folder.glob("batch_*.csv")):
            answers = answers_for(answers_dir, batch)
            if answers is None:
                problems[f"{kind}/{batch.stem}"] = ["no answer file"]
                continue
            found, got = check_answers(read_csv(batch), answers, key, rule)
            if found:
                problems[f"{kind}/{batch.stem}"] = found
                continue
            for rid, a in got.items():
                sentence = a["sentence"].strip() if kind == "sentences" else pdf[rid]["sentence"]
                rows.append({"id": rid, "word": words[rid]["hz"], "sentence": sentence, "en": a["en"].strip(),
                             "src": "claude" if kind == "sentences" else "pdf", "batch": f"{kind}/{batch.stem}"})
    if problems:
        path = next_version_path("data/reports/sentences_merge", ".txt")
        lines = [f"Stopped. Redo these {len(problems)} batches:"]
        for batch, found in problems.items():
            lines += ["", f"{batch}:"] + [f"  {p}" for p in found]
        write_new_text(path, "\n".join(lines) + "\n")
        sys.exit(f"Stopped, only the problem list was written to {path}. Batches to redo: " + " ".join(problems))
    missing = sorted(set(words) - {r["id"] for r in rows})
    if missing:
        sys.exit(f"Stopped, nothing written. {len(missing)} words have no sentence, for example {missing[:5]}.")

    rng = random.Random(11)
    written = [r for r in rows if r["src"] == "claude"]
    translated = [r for r in rows if r["src"] == "pdf"]
    sample = rng.sample(written, max(50, len(written) // 10)) + rng.sample(translated, max(100, len(translated) // 33))
    rows.sort(key=lambda r: r["id"])
    paths = next_versions(rows=("data/build/sentences_en", ".jsonl"), check=("data/build/check_batches", ""),
                          report=("data/reports/sentences_merge", ".txt"))
    write_new_jsonl(paths["rows"], rows)
    paths["check"].mkdir()
    for n, part in enumerate(chunks(sorted(sample, key=lambda r: r["id"]), CHECK_BATCH), start=1):
        write_new_csv(paths["check"] / f"batch_{n:03d}.csv",
                      ["id", "word", "word_py", "word_en", "sentence", "en", "src"],
                      [[r["id"], r["word"], words[r["id"]]["py"], words[r["id"]]["en"], r["sentence"], r["en"],
                        r["src"]] for r in part])
    lines = ["Sentence merge report", "",
             f"Sentences: {len(rows)} ({len(written)} written, {len(translated)} from the PDFs)",
             f"Checker sample: {len(sample)} rows in {paths['check']}", ""]
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `PYTHONIOENCODING=utf-8 python tools/07b_sentences_merge.py`
Expected:
```
Sentence merge report

Sentences: 5043 (992 written, 4051 from the PDFs)
Checker sample: 221 rows in data\build\check_batches_v001
```
If it stops, it names a report such as `data\reports\sentences_merge_v001.txt`. Redo exactly the batches it lists (Task 6, with the redo paragraph), then rerun this step. Every run writes new version numbers, and the check folder carries the same number as the report and the sentences file of that run.

- [ ] **Step 3: Commit the script and the agents' answers**

```bash
git add tools/07b_sentences_merge.py data/claude/sentences_v001 data/claude/translations_v001 && git commit -F - <<'EOF'
feat: check written sentences and translations, sample for the checker

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 8: The independent check (multi-agent workflow and `tools/07c_checks_apply.py`)

**Files:**
- Create (by the agents): `data/claude/checks_vRRR/batch_001_v001.csv`, `batch_002_v001.csv` (RRR is the version of the check folder from Task 7)
- Create: `tools/07c_checks_apply.py`
- Output: `data/build/sentences_checked_vCCC.jsonl`, `data/review/translation_spotcheck_vCCC.csv`, `data/reports/checks_vCCC.txt`

The checker instructions below are this step's code. Start one fresh agent per `data/build/check_batches_vRRR/batch_KKK.csv`, with `{output}` = `data/claude/checks_vRRR/batch_KKK_v001.csv`. A checker must never be an agent that wrote or translated sentences in Task 6.

The gate in `07c_checks_apply.py` works in three parts:
- Every FIX is applied.
- A batch whose sampled rows needed two or more fixes is redone in full (Task 6), and then Tasks 7 and 8 run again on a new sample.
- If more than 10% of the sampled written sentences, or of the sampled translations, needed a fix, the script stops and the user decides what to do.

The checker instructions:

------------------------------------------------------------
You are an independent checker. You did not write or translate any of these sentences. For each row, decide whether it is good enough for a beginner's flashcard.

Read the input file {input}. It is a UTF-8 CSV with the columns id, word (the card's word), word_py (its pinyin), word_en (the card's meaning), sentence (the Chinese example), en (its English translation) and src (claude when the sentence was written for the app, pdf when it comes from a published textbook list).

Write the output file {output} as a UTF-8 CSV with exactly this header line:
id,sentence,verdict,problem,fixed_sentence,fixed_en
Write one row per input row, in the input order. Copy id and sentence exactly. Quote any field that contains a comma or a double quote.

Give verdict OK when all of these hold:
1. en is a faithful, natural English translation of the whole sentence.
2. For src claude rows only, the sentence is natural Chinese, uses the word with the card's meaning and pinyin, and uses easy everyday vocabulary.

Otherwise give verdict FIX, and then:
3. Write the problem in a few words in problem.
4. Always write a corrected translation in fixed_en, even when only the Chinese was wrong.
5. For a bad src claude sentence, write a corrected sentence in fixed_sentence. It must have 6 to 15 Chinese characters, contain the word exactly, use easy words and end with 。 or ？ or ！. fixed_en must then translate the corrected sentence.
6. Never rewrite a src pdf sentence; leave fixed_sentence empty for those rows.

Be strict about meaning errors, wrong readings and unnatural Chinese. Do not mark FIX for small matters of style. For OK rows leave problem, fixed_sentence and fixed_en empty.

Do not read, create or change any other file. When you have finished, reply with one line: the number of rows, and the counts of OK and FIX.
------------------------------------------------------------

- [ ] **Step 1: Run the checker agents (one per check batch file)**

- [ ] **Step 2: Write `tools/07c_checks_apply.py`**

```python
"""Step 7c. Apply the independent checker's verdicts and write the user's spot-check sheet.

Inputs:  the latest data/build/sentences_en_vRRR.jsonl, data/build/check_batches_vRRR/ and the checker's
         answers in data/claude/checks_vRRR/ (for each batch_KKK.csv the latest batch_KKK_vMMM.csv,
         columns id, sentence, verdict, problem, fixed_sentence, fixed_en)
Outputs: data/build/sentences_checked_vCCC.jsonl  every sentence with the checker's fixes applied
         data/review/translation_spotcheck_vCCC.csv  50 random translations for the user (opens in Excel)
         data/reports/checks_vCCC.txt
Nothing is written if an answer is missing or malformed, if a batch needed two or more fixes in
the sample (it is redone), or if more than 10% of either kind of sampled row needed a fix
(the user decides what happens next).
"""
import random
import sys
from pathlib import Path

from common import (all_version_paths, latest_version_path, next_versions, read_csv, read_jsonl, write_new_csv,
                    write_new_jsonl, write_new_text)
from sentences import char_levels, check_answers, fix_share, redo_batches, verdict_problems

SPOTCHECK_SIZE = 50
MAX_SHARE = 0.10


def main():
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    levels = char_levels(list(words.values()))
    rows_path = latest_version_path("data/build/sentences_en", ".jsonl")
    version = rows_path.stem.rsplit("_", 1)[1]
    rows = {r["id"]: r for r in read_jsonl(rows_path)}
    answers_dir = Path("data/claude") / f"checks_{version}"
    problems, verdicts, sample = [], {}, []
    for batch in sorted(Path(f"data/build/check_batches_{version}").glob("batch_*.csv")):
        given = read_csv(batch)
        sample += [rows[r["id"]] for r in given]
        found = all_version_paths(answers_dir / batch.stem, ".csv")
        if not found:
            problems.append(f"{batch.stem}: no answer file")
            continue
        more, got = check_answers(given, read_csv(found[-1][1]), "sentence",
                                  lambda g, a: verdict_problems(g, a, words[g["id"]], levels))
        problems += [f"{batch.stem}: {p}" for p in more]
        verdicts.update(got)
    if problems:
        sys.exit("Stopped, nothing written:\n  " + "\n  ".join(problems[:40]))
    fixed = {rid for rid, a in verdicts.items() if a["verdict"].strip() == "FIX"}
    redo = redo_batches(sample, fixed)
    shares = {src: fix_share(sample, fixed, src) for src in ("claude", "pdf")}
    if redo:
        sys.exit("Stopped, nothing written. Redo these batches with a new batch agent, then rerun step 7b: "
                 + " ".join(redo))
    if max(shares.values()) > MAX_SHARE:
        sys.exit(f"Stopped, nothing written. Fix share in the sample: written {shares['claude']:.0%}, "
                 f"translated {shares['pdf']:.0%}, above {MAX_SHARE:.0%}. Ask the user how to proceed.")

    for rid in fixed:
        a, r = verdicts[rid], rows[rid]
        r["en"] = a["fixed_en"].strip()
        if (a.get("fixed_sentence") or "").strip():
            r["sentence"], r["src"] = a["fixed_sentence"].strip(), "claude"
    final = [rows[rid] for rid in sorted(rows)]
    spot = sorted(random.Random(13).sample(final, SPOTCHECK_SIZE), key=lambda r: r["id"])
    paths = next_versions(rows=("data/build/sentences_checked", ".jsonl"),
                          spot=("data/review/translation_spotcheck", ".csv"), report=("data/reports/checks", ".txt"))
    write_new_jsonl(paths["rows"], final)
    write_new_csv(paths["spot"], ["id", "word", "sentence", "en", "ok", "better_en"],
                  [[r["id"], r["word"], r["sentence"], r["en"], "", ""] for r in spot], excel=True)
    lines = ["Checker report", "", f"Sampled rows: {len(sample)}. Fixed: {len(fixed)}.",
             f"Fix share: written sentences {shares['claude']:.0%}, PDF translations {shares['pdf']:.0%}.",
             f"Spot-check sheet for the user: {paths['spot']}", ""]
    lines += [f"  {rid} {rows[rid]['word']}: {verdicts[rid].get('problem', '').strip()}" for rid in sorted(fixed)]
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run it**

Run: `PYTHONIOENCODING=utf-8 python tools/07c_checks_apply.py`
Expected: `Checker report`, `Sampled rows: 221. Fixed: N.`, fix shares of at most 10%, and `Spot-check sheet for the user: data\review\translation_spotcheck_vCCC.csv`, followed by one line per fix.
- If it stops with "Redo these batches", redo them (Task 6), rerun Task 7, and run the checker again on the new sample.
- If it stops on the 10% share, report both shares and the listed problems to the user and ask how to proceed.

- [ ] **Step 4: Commit**

```bash
git add tools/07c_checks_apply.py data/claude/checks_v* data/review/translation_spotcheck_v* && git commit -F - <<'EOF'
feat: apply the independent checker's verdicts

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 9: Checkpoint with the user (spot-check of 50 translations) and `tools/07d_spotcheck_apply.py`

**Files:**
- Input from the user: `data/manual/translation_spotcheck_reviewed_vNNN.csv` (the next free number, v001 the first time)
- Create: `tools/07d_spotcheck_apply.py`
- Output: `data/build/sentences_final_vFFF.jsonl`, `data/reports/spotcheck_vFFF.txt`

- [ ] **Step 1: Hand the sheet to the user**

Tell the user, in plain words, how many sentences were written, how many came from the PDFs, and what the checker found (the fix shares and the listed problems from Task 8). Then give these instructions word for word, with CCC filled in and NNN set to the next free number in `data/manual/` (v001 the first time):

> Open `data/review/translation_spotcheck_vCCC.csv` in Excel. It has 50 randomly chosen example sentences with their English. For each row, write **Y** in the ok column if the English is right, or **N** if it is wrong, and for every N write a better English sentence in better_en. Then choose File, Save As, pick **"CSV UTF-8 (Comma delimited) (*.csv)"**, and save it as `data/manual/translation_spotcheck_reviewed_vNNN.csv`. If more than 5 rows are wrong, I will stop and ask you whether to redo the translations.

- [ ] **Step 2: Write `tools/07d_spotcheck_apply.py`**

```python
"""Step 7d. Apply the user's spot-check of 50 translations.

Inputs:  data/build/sentences_checked_vCCC.jsonl (latest) and data/review/translation_spotcheck_vCCC.csv
         (the sheet step 7c wrote in the same run, so the same CCC), and
         data/manual/translation_spotcheck_reviewed_vNNN.csv (latest), the user's copy of that sheet
         with ok = Y or N and better_en for every N. Its number need not match CCC, so a corrected
         copy saved as the next version is used as it is.
Outputs: data/build/sentences_final_vFFF.jsonl {id, sentence, en, src}, data/reports/spotcheck_vFFF.txt
Nothing is written if a row of the sheet is missing, repeated or unanswered, if an N row has no
usable better_en, or if more than 5 of the 50 translations were marked N (then the user decides
whether to redo translations).
"""
import sys

from common import latest_version_path, next_versions, read_csv, read_jsonl, write_new_jsonl, write_new_text
from sentences import spotcheck_problems

MAX_WRONG = 5


def main():
    checked_path = latest_version_path("data/build/sentences_checked", ".jsonl")
    version = checked_path.stem.rsplit("_", 1)[1]
    rows = {r["id"]: r for r in read_jsonl(checked_path)}
    generated = read_csv(f"data/review/translation_spotcheck_{version}.csv")
    reviewed_path = latest_version_path("data/manual/translation_spotcheck_reviewed", ".csv")
    try:
        reviewed = read_csv(reviewed_path)
    except UnicodeDecodeError:
        sys.exit(f"{reviewed_path} is not UTF-8. In Excel use Save As, 'CSV UTF-8 (Comma delimited)'.")
    problems, wrong = spotcheck_problems(generated, reviewed)
    if problems:
        sys.exit(f"Stopped, nothing written. {reviewed_path} compared with "
                 f"data/review/translation_spotcheck_{version}.csv:\n  " + "\n  ".join(problems))
    if len(wrong) > MAX_WRONG:
        sys.exit(f"Stopped, nothing written. {len(wrong)} of {len(reviewed)} translations were marked N, more "
                 f"than {MAX_WRONG}. Ask the user whether to redo the translation batches.")
    for rid, better in wrong:
        rows[rid]["en"] = better
    paths = next_versions(rows=("data/build/sentences_final", ".jsonl"), report=("data/reports/spotcheck", ".txt"))
    write_new_jsonl(paths["rows"], [{k: rows[rid][k] for k in ("id", "sentence", "en", "src")} for rid in sorted(rows)])
    lines = ["Spot-check report", "", f"Sheet used: {reviewed_path}",
             f"Reviewed: {len(reviewed)}. Marked N and corrected: {len(wrong)}.", ""]
    lines += [f"  {rid}: {better}" for rid, better in wrong]
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run it after the user has saved the reviewed sheet**

Run: `PYTHONIOENCODING=utf-8 python tools/07d_spotcheck_apply.py`
Expected: `Spot-check report`, the `Sheet used` line, then `Reviewed: 50. Marked N and corrected: K.` with K from 0 to 5, and one line per correction. If it stops on a row problem, show the user the listed rows and ask for a corrected copy saved under the next free number, for example `data/manual/translation_spotcheck_reviewed_v002.csv`. Then rerun. The script always takes the latest reviewed copy and compares it with the sheet of the latest checker run.

- [ ] **Step 4: Commit**

```bash
git add tools/07d_spotcheck_apply.py data/manual/translation_spotcheck_reviewed_v* && git commit -F - <<'EOF'
feat: apply the user's translation spot-check

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 10: Install pypinyin, and the sentence pinyin logic (`tools/sentpinyin.py`)

**Files:**
- Modify: `tools/requirements.txt`
- Create: `tools/sentpinyin.py`
- Test: `tests/test_sentpinyin.py`

pypinyin is a Python library that gives the pinyin of Chinese text. jieba is a Python library that cuts Chinese text into words, and Plan 3a Task 7 installed it. This task writes the draft of the sentence pinyin. It follows the rules below, which cover most of the pinyin style sheet, and Claude agents then correct every line against the whole style sheet (Task 14). Known differences remain in the draft, for example "qùguò" where point 3 of the style sheet wants the neutral "qùguo". The draft follows these rules.
- **Readings (`make_lookup`, `public_word_readings`).** The headword always gets the syllables its card shows, and every one of them but the last keeps its card tone. Any other word that is a card headword with one card is read with the syllables its card shows (受不了 "shòubuliǎo", with its neutral bu), and any other word of the public list with one reading gets the list's reading, neutral tones included (下来 "xiàlai", where pypinyin gives xiàlái). Other words take pypinyin's reading.
- **Fixes** from the polyphone check and the readings of potential complements (`potential_readings`, a neutral bu and 着 zháo in 睡不着) are applied, and then only the 一 and 不 tone changes (Plan 3a `tone_change`), across the whole sentence.
- **Words.** `segment` cuts the sentence with jieba's dictionary only, because jieba's guessing of unknown words joins characters of different words (天太黑了 as 天太黑 + 了). `regroup` makes the headword one word, cuts a piece left over from a longer word again (勇敢的人 gives 勇敢 + 的 + 人) and joins a lone 儿 to the word before it. A card word or a public-list word that holds the headword is not cut, so 男人 stays "nánrén" in the sentence of the card 男, as in any other sentence. `split_words` then splits words that neither list has where the textbook rules write them apart (`_apart`), splits a potential complement into its three characters (睡 + 不 + 着, and jieba's 忍受 + 不了 as 忍受 + 不 + 了), gives each four-character word its form (idiom, words or joined, from `data/manual/four_char_words`), writes numbers as the rules do (`number_words`, with 十几 and 几十 as one word, and a fraction syllable by syllable), and splits a 了 or a particle such as 吧 from the end of a sentence. Last, `name_words` divides a person's name into its words and says where capitals start.
- **Spacing and capitals.** The words are spaced like the cards (Plan 3a Task 1), with punctuation attached. `attached` says which words join the word before them. They are 们, the aspect particles 着, 了 (unless it ends a sentence) and 过 (after a verb), the suffixes 子, 者, 员, 性 and 化, and a one-character result or direction after a one-character verb, so the sentence has "kànzhe", "qùguo", "yòngle liǎng gè xiǎoshí", "jiàshǐyuán" and "xiěhǎo" but "Zuótiān xià yǔ le.". For points 1 and 2 of the style sheet, 月 joins a month number and a weekday number joins 星期 or 礼拜 ("bāyuè jiǔ rì", "xīngqīwǔ"), and step 8 adds 这个, 那个 and 哪个 to the known words with the readings of `POINTING_WORDS` ("zhège"), so they are never split. A percent sign stays with its number ("70%"). A word takes a capital only as its card or `data/manual/capitals` says (Task 11), and the first word of each sentence and of a quotation after a colon starts with a capital.
- **The check list (`spot_checks`)** holds single-character words with several readings, the characters of public-list words with several readings, every character of a word that neither list has (with the neutral tone as an option, and 着 and 不 included, only 一 left out), and an 儿 that was not read as the 儿 ending.

The spacing works per word, through `split_words` and `word_joints`. For example, in 他在打电话呢。 the word 打电话 is a card headword, so it is written as on its card ("dǎ diànhuà"). A word that neither list has is split into the fewest known words (card headwords or words of the public list) that spell it. That happens always when it has five or more characters, and for a four-character word that has no form yet. A four-character word with a form is written in it, so 市场经济 with the form words gives "shìchǎng jīngjì" and 各行各业 with the form idiom gives "gèháng-gèyè". A word of two or three characters is split only where the rules put a space (`_apart`), which is after a pronoun, after an adverb, between a number and a measure word, and in a few more places, so 一个 gives "yí gè" and 很多 "hěn duō", while 把守, 西班牙, 企业家, 发动机, 歌唱家, 面孔 and 有点 stay whole. Any other word is written joined.

Numbers follow the textbook rules. A whole number from 11 to 99 is one word, a digit with 百, 千, 万 or 亿 is one word, 十几 and 几十 are one word each, 零 is a word of its own, and a number stands apart from its measure word. So jieba's 九百 + 七十家 gives "jiǔbǎi qīshí jiā", and 九亿七万二千三百五十六 would give "jiǔyì qīwàn èrqiān sānbǎi wǔshíliù". 第 joins its number with a hyphen ("dì-shí kè"), two rising digits are an approximate number with a hyphen ("yì-liǎng gè yuè"), a year is read digit by digit ("èr líng yī èr nián"), and a fraction is written syllable by syllable ("sān fēn zhī yī"). A decimal is read digit by digit, and its 一 keeps its first tone (三点一四 "sān diǎn yī sì", 零点一米 "líng diǎn yī mǐ"), while 三点一刻 is a time of day ("sān diǎn yí kè"). `decimal_positions` finds the same decimals on the characters of a sentence, for the strict checker of Task 13. 好几十 keeps 几十 as one word ("hǎo jǐshí gè"), and the Chinese dash of two long dashes, which jieba cuts into two marks, is written as one "-". 〇 (U+3007), the zero of years, lies outside the main block of Chinese characters (U+4E00 to U+9FFF), and jieba cuts it off as a mark, but the pattern for Chinese characters (`_HANZI`) includes it, so it is read líng like any character and 二〇〇八年 gives "èr líng líng bā nián".

A person's name is written as the rules write it, with the surname apart from the given name, each with a capital, and a title apart in lower case ("Lǐ Míng", "Lǐ lǎoshī", "Xiǎo Wáng"). A row of `data/manual/capitals` gives the words of the name and a capital for each word.

- [ ] **Step 1: Write the new `tools/requirements.txt`**

It keeps the jieba line that Plan 3a Task 7 added and adds pypinyin and edge-tts:
```
pypdf>=6.0
fonttools>=4.43
matplotlib>=3.8
pytest>=8
jieba>=0.42
pypinyin>=0.49
edge-tts>=6.1
```

- [ ] **Step 2: Install pypinyin and check the calls this plan uses**

Run: `python -m pip install "pypinyin>=0.49"` (jieba is already installed by Plan 3a Task 7; if `python -c "import jieba"` fails, also run `python -m pip install "jieba>=0.42"`)
Then run:
```bash
PYTHONIOENCODING=utf-8 python -c "
from pypinyin import Style, lazy_pinyin, pinyin
import jieba, jieba.posseg, logging
jieba.setLogLevel(logging.WARNING)
jieba.add_word('踢足球')
print(lazy_pinyin('绿吗', style=Style.TONE3, neutral_tone_with_five=True, v_to_u=True))
print(pinyin('长', style=Style.TONE3, heteronym=True, neutral_tone_with_five=True, v_to_u=True))
print([(p.word, p.flag) for p in jieba.posseg.lcut('我们在北京踢足球。', HMM=False)])
print(jieba.lcut('天太黑了', HMM=False), jieba.lcut('天太黑了'))"
```
Expected: `['lü4', 'ma5']`, then a list that contains both `chang2` and `zhang3`, then a list of (word, tag) pairs that spell the sentence, with `北京` tagged `ns` and `踢足球` kept as one word, and last `['天', '太', '黑', '了'] ['天太黑', '了']`, which shows that switching the guessing off keeps jieba from making up the word 天太黑. If any call fails or gives another shape, stop and report it before writing more code.

- [ ] **Step 3: Write the failing test `tests/test_sentpinyin.py`**

```python
from pinyin_text import IDIOM_JOINTS
from sentpinyin import (POINTING_WORDS, attached, check_polyphone_answers, decimal_digits, decimal_positions,
                        head_positions, make_lookup, name_words, number_words, potential_readings, public_word_readings,
                        regroup, render, segment, spot_checks, split_words, syllables, word_joints)

TABLE = {"我": ["wo3"], "爱": ["ai4"], "的": ["de5"], "家": ["jia1"], "你好": ["ni3", "hao3"], "他": ["ta1"],
         "说": ["shuo1"], "不": ["bu4"], "去": ["qu4"], "统一": ["tong3", "yi1"], "中国": ["zhong1", "guo2"],
         "一": ["yi1"], "个": ["ge4"], "人": ["ren2"], "北京": ["bei3", "jing1"], "长": ["chang2"], "大": ["da4"],
         "了": ["le5"], "不客气": ["bu4", "ke4", "qi5"], "拔苗助长": ["ba2", "miao2", "zhu4", "zhang3"], "好": ["hao3"],
         "看": ["kan4"], "足球": ["zu2", "qiu2"], "比赛": ["bi3", "sai4"], "黄河": ["huang2", "he2"],
         "父亲": ["fu4", "qin5"], "今年": ["jin1", "nian2"], "八十三": ["ba1", "shi2", "san1"], "岁": ["sui4"],
         "是": ["shi4"], "二": ["er4"], "零": ["ling2"], "年": ["nian2"], "要": ["yao4"], "花": ["hua1"],
         "一两": ["yi1", "liang3"], "月": ["yue4"], "喂": ["wei4"], "李": ["li3"], "老师": ["lao3", "shi1"],
         "在": ["zai4"], "吗": ["ma5"], "指": ["zhi3"], "着": ["zhe5"], "你": ["ni3"], "小": ["xiao3"],
         "王": ["wang2"], "来": ["lai2"], "汽车": ["qi4", "che1"], "停": ["ting2"], "下来": ["xia4", "lai5"],
         "从": ["cong2"], "第十": ["di4", "shi2"], "课": ["ke4"], "开始": ["kai1", "shi3"], "我们": ["wo3", "men5"],
         "用": ["yong4"], "两": ["liang3"], "小时": ["xiao3", "shi2"], "睡": ["shui4"]}
CARDS = {"不客气": [" ", ""], "拔苗助长": IDIOM_JOINTS, "比赛": [""], "三": [], "分之": [""], "一": [], "科学": [""],
         "黄河": [" "], "千万": [""]}
KNOWN = set(CARDS) | {"足球", "科学家", "个", "很", "多", "本", "书", "坐", "在", "看", "去", "过", "同学", "们", "别",
                      "忘", "了", "这", "点", "不", "但", "十", "百", "千", "万", "亿", "零", "两", "二", "八", "九",
                      "七", "五", "岁", "家", "名", "页", "课", "年", "市场", "经济", "通货", "膨胀", "几", "节", "西",
                      "班", "牙", "日", "桃", "子", "企业", "我", "国", "篇", "文章", "张", "开", "睡", "记", "清楚",
                      "找", "到"}
POS = {"一": ["num."], "三": ["num."], "个": ["m."], "很": ["adv."], "多": ["adj."], "本": ["pron.", "m."],
       "书": ["n."], "坐": ["v."], "在": ["prep.", "v."], "看": ["v."], "去": ["v."], "别": ["adv."], "忘": ["v."],
       "这": ["pron."], "点": ["m."], "不": ["adv."], "但": ["conj."], "八": ["num."], "七": ["num."], "岁": ["m."],
       "名": ["m."], "家": ["n.", "m."], "年": ["m.", "n."], "几": ["num."], "节": ["n.", "m."], "班": ["n.", "m."],
       "日": ["n.", "m."], "子": ["m."], "企业": ["n."], "我": ["pron."], "国": ["n."], "篇": ["m."], "文章": ["n."],
       "张": ["m.", "v."], "开": ["v."], "用": ["v.", "prep."], "见": ["v."], "要": ["v."], "来": ["v."],
       "睡": ["v."], "记": ["v."], "找": ["v."], "说": ["v."], "到": ["v.", "prep."], "他": ["pron."], "买": ["v."]}
FORMS = {"市场经济": ("words", ["市场", "经济"]), "土生土长": ("idiom", []), "二氧化碳": ("joined", [])}


def lookup(word):
    return TABLE[word]


def pinyin(sentence, words, hz, head_nums, caps=(), fixes=None, joints_of=None):
    return render(sentence, words, syllables(sentence, words, lookup, hz, head_nums, fixes), caps, joints_of)


def test_plain_sentence():
    assert pinyin("我爱我的家。", ["我", "爱", "我", "的", "家", "。"], "爱", ["ai4"]) == "Wǒ ài wǒ de jiā."


def test_quotes_and_capitals():
    assert pinyin("“你好”他说。", ["“", "你好", "”", "他", "说", "。"], "说", ["shuo1"]) == '"Nǐhǎo" tā shuō.'
    assert pinyin("我爱北京。", ["我", "爱", "北京", "。"], "北京", ["bei3", "jing1"], caps={2}) == "Wǒ ài Běijīng."
    spaced = lambda word: word_joints(word, CARDS)
    assert pinyin("我看黄河。", ["我", "看", "黄河", "。"], "看", ["kan4"], caps={2}, joints_of=spaced) == \
        "Wǒ kàn Huáng Hé."


def test_a_quotation_after_a_colon_starts_with_a_capital_and_names_are_written_apart():
    sentence = "他指着前面，高兴地说：“你看，小王来了。”"
    jieba_words = ["他", "指", "着", "前面", "，", "高兴", "地", "说", "：", "“", "你", "看", "，", "小王", "来", "了", "。",
                   "”"]
    words, caps = name_words(sentence, jieba_words, {"小王": (["小", "王"], [True, True])})
    assert caps == {15, 16}
    table = {**TABLE, "前面": ["qian2", "mian4"], "高兴": ["gao1", "xing4"], "地": ["de5"]}
    sylls = syllables(sentence, words, lambda w: table[w], "指", ["zhi3"])
    attach = attached(words, {**POS, "指": ["v."]})
    assert render(sentence, words, sylls, caps, attach=attach) == \
        'Tā zhǐzhe qiánmiàn, gāoxìng de shuō: "Nǐ kàn, Xiǎo Wáng lái le."'


def test_a_surname_and_a_given_name_take_capitals_and_a_title_stays_in_lower_case():
    names = {"李老师": (["李", "老师"], [True, False]), "张先生": (["张", "先生"], [True, False]),
             "李明": (["李", "明"], [True, True])}
    words, caps = name_words("喂，李老师在吗？", ["喂", "，", "李老师", "在", "吗", "？"], names)
    assert (words, caps) == (["喂", "，", "李", "老师", "在", "吗", "？"], {2})
    assert pinyin("喂，李老师在吗？", words, "喂", ["wei4"], caps=caps) == "Wèi, Lǐ lǎoshī zài ma?"
    assert name_words("遇到了张先生。", ["遇到", "了", "张", "先生", "。"], names)[1] == {3}
    assert name_words("我叫李明。", ["我", "叫", "李明", "。"], names) == (["我", "叫", "李", "明", "。"], {2, 3})
    assert name_words("这是李子。", ["这", "是", "李子", "。"], names)[1] == set()


def test_tone_changes_cross_words_but_respect_word_ends():
    assert pinyin("我不去。统一中国！", ["我", "不", "去", "。", "统一", "中国", "！"], "统一", ["tong3", "yi1"]) == \
        "Wǒ bú qù. Tǒngyī zhōngguó!"
    assert pinyin("一个人长大了。", ["一", "个", "人", "长", "大", "了", "。"], "一", ["yi1"]) == "Yí gè rén cháng dà le."


def test_headword_reading_is_forced_and_fixes_apply_last():
    words = ["一", "个", "人", "长", "大", "了", "。"]
    assert pinyin("一个人长大了。", words, "长", ["zhang3"]) == "Yí gè rén zhǎng dà le."
    assert pinyin("一个人长大了。", words, "一", ["yi1"], fixes={3: "zhang3"}) == "Yí gè rén zhǎng dà le."
    table = {**TABLE, "开心": ["kai1", "xin1"], "得": ["de5"], "不得了": ["bu4", "de2", "liao3"]}
    words = ["开心", "得", "不得了", "。"]
    sylls = syllables("开心得不得了。", words, lambda w: table[w], "不得了", ["bu4", "de2", "liao3"])
    assert render("开心得不得了。", words, sylls) == "Kāixīn de bùdéliǎo."


def test_words_are_spaced_like_the_cards():
    spaced = lambda word: word_joints(word, CARDS)
    assert pinyin("他说不客气。", ["他", "说", "不客气", "。"], "说", ["shuo1"], joints_of=spaced) == "Tā shuō bú kèqi."
    assert pinyin("拔苗助长不好。", ["拔苗助长", "不", "好", "。"], "好", ["hao3"], joints_of=spaced) == \
        "Bámiáo-zhùzhǎng bù hǎo."
    words = split_words(["我", "看", "足球比赛", "。"], KNOWN, POS)
    assert pinyin("我看足球比赛。", words, "看", ["kan4"], joints_of=spaced) == "Wǒ kàn zúqiú bǐsài."


def test_split_words():
    assert split_words(["一个", "很多", "本书", "坐在", "这点儿"], KNOWN, POS) == \
        ["一", "个", "很", "多", "本", "书", "坐", "在", "这点儿"]
    # A fraction is written syllable by syllable ("sān fēn zhī yī"), as GB/T 16159-2012 6.1.5.1 writes 二分之一.
    assert split_words(["足球比赛", "三分之一", "科学家", "英国"], KNOWN, POS) == \
        ["足球", "比赛", "三", "分", "之", "一", "科学家", "英国"]
    assert split_words(["三", "分之", "一"], KNOWN, POS) == ["三", "分", "之", "一"]
    assert split_words(["三", "分之", "一"], KNOWN, POS, keep={"分之"}) == ["三", "分之", "一"]
    assert split_words(["看书", "看看", "去过", "同学们", "别忘了", "看"], KNOWN, POS) == \
        ["看书", "看看", "去过", "同学们", "别", "忘了", "看"]
    assert split_words(["不但"], KNOWN, POS, keep={"不但"}) == ["不但"]
    # Names and words with a suffix stay whole, even when a piece can be a measure word (班, 本, 子, 家).
    # 我 stands apart from a noun, as the rules write 我校 "wǒ xiào".
    assert split_words(["西班牙", "日本", "桃子", "企业家", "我国", "五一节"], KNOWN, POS) == \
        ["西班牙", "日本", "桃子", "企业家", "我", "国", "五一节"]
    # A measure word is apart from its noun only after a number or a word such as 这.
    assert split_words(["一", "篇文章", "他", "张开"], KNOWN, POS) == ["一", "篇", "文章", "他", "张开"]


def test_short_words_that_are_one_word_stay_whole():
    known = KNOWN | {"歌唱", "面", "孔", "有", "差", "热", "天", "体育", "迷", "喝", "杯", "茶", "买"}
    pos = {**POS, "歌唱": ["v."], "面": ["n.", "m.", "v."], "孔": ["n.", "m."], "有": ["v."], "差": ["adj.", "v."],
           "热": ["adj.", "n.", "v."], "天": ["m.", "n."], "体育": ["n."], "迷": ["v."], "喝": ["v."], "杯": ["m."],
           "茶": ["n."]}
    # 家, 迷 and 品 stay in the word of a noun or verb of two characters, and a first piece that is
    # first a noun or an adjective (面, 热) is not read as a verb with a measure word after it.
    assert split_words(["歌唱家", "面孔", "有点", "差点", "热天", "体育迷"], known, pos) == \
        ["歌唱家", "面孔", "有点", "差点", "热天", "体育迷"]
    # A verb of one character still stands apart from a measure word or 点 after it, and 把 from a noun.
    known |= {"把", "门"}
    pos.update({"把": ["prep.", "m.", "v."], "门": ["n.", "m."]})
    assert split_words(["喝杯", "茶", "买点儿", "把门", "关上"], known, pos) == \
        ["喝", "杯", "茶", "买", "点儿", "把", "门", "关上"]


def test_four_character_words_take_their_form():
    words = split_words(["积极", "的", "市场经济", "是", "中国", "土生土长", "的"], KNOWN, POS, forms=FORMS)
    assert words == ["积极", "的", "市场", "经济", "是", "中国", "土生土长", "的"]
    fixed = {**CARDS, "土生土长": IDIOM_JOINTS, "二氧化碳": ["", "", ""]}
    assert [word_joints(w, fixed) for w in ["土生土长", "二氧化碳"]] == [IDIOM_JOINTS, ["", "", ""]]


def test_number_words():
    assert number_words("三十三") == ["三十三"]
    assert number_words("九亿七万二千三百五十六") == ["九亿", "七万", "二千", "三百", "五十六"]
    assert number_words("一百零一") == ["一百", "零", "一"]
    assert number_words("二十亿") == ["二十", "亿"]
    assert number_words("十万") == ["十万"]
    assert number_words("二零一二") == ["二", "零", "一", "二"]
    assert number_words("两三") == ["两三"]
    assert [number_words("十几"), number_words("几十")] == [["十几"], ["几十"]]


def test_numbers_in_real_sentences():
    # 我父亲今年八十三岁了。 他现在拥有九百七十家连锁食品店。 这部辞典将扩充到一千五百页。 我们从第十课开始学习。
    assert split_words(["我", "父亲", "今年", "八十三岁", "了", "。"], KNOWN, POS) == \
        ["我", "父亲", "今年", "八十三", "岁", "了", "。"]
    assert split_words(["九百", "七十家"], KNOWN, POS) == ["九百", "七十", "家"]
    assert split_words(["一千五百", "页"], KNOWN, POS) == ["一千", "五百", "页"]
    assert split_words(["从", "第十课"], KNOWN, POS) == ["从", "第十", "课"]
    assert split_words(["超过", "二十亿", "人"], KNOWN, POS) == ["超过", "二十", "亿", "人"]
    assert split_words(["千万", "别", "忘"], KNOWN, POS) == ["千万", "别", "忘"]
    words = split_words(["我", "父亲", "今年", "八十三岁", "了", "。"], KNOWN, POS)
    assert pinyin("我父亲今年八十三岁了。", words, "父亲", ["fu4", "qin5"]) == "Wǒ fùqin jīnnián bāshísān suì le."
    words = split_words(["今年", "是", "二零", "一二年", "。"], KNOWN, POS)
    assert words == ["今年", "是", "二", "零", "一", "二", "年", "。"]
    assert pinyin("今年是二零一二年。", words, "零", ["ling2"]) == "Jīnnián shì èr líng yī èr nián."
    spaced = lambda word: word_joints(word, CARDS)
    words = split_words(["要", "花", "一两个", "月", "。"], KNOWN, POS)
    assert pinyin("要花一两个月。", words, "花", ["hua1"], joints_of=spaced) == "Yào huā yì-liǎng gè yuè."
    words = split_words(["我们", "从", "第十课", "开始", "。"], KNOWN, POS)
    assert pinyin("我们从第十课开始。", words, "开始", ["kai1", "shi3"], joints_of=spaced) == \
        "Wǒmen cóng dì-shí kè kāishǐ."
    # 我爱旅游，去过几十个国家。 这个火车有十几节车厢。
    assert split_words(["去过", "几十个", "国家"], KNOWN, POS) == ["去过", "几十", "个", "国家"]
    assert split_words(["有", "十几节", "车厢"], KNOWN, POS) == ["有", "十几", "节", "车厢"]


def test_decimals_rough_numbers_and_the_dash():
    known = KNOWN | {"四", "米", "刻", "好"}
    pos = {**POS, "四": ["num."], "米": ["m."], "刻": ["m."]}
    table = {**TABLE, "三": ["san1"], "点": ["dian3"], "四": ["si4"], "米": ["mi3"], "刻": ["ke4"]}
    look = lambda w: table[w]
    # A decimal is read digit by digit, and its 一 keeps the first tone ("sān diǎn yī sì", "líng diǎn yī mǐ"),
    # while 三点一刻 is a time of day ("sān diǎn yí kè").
    words = split_words(["是", "三点", "一", "四", "。"], known, pos)
    assert words == ["是", "三", "点", "一", "四", "。"] and decimal_digits(words) == {1, 3, 4}
    assert render("是三点一四。", words, syllables("是三点一四。", words, look, "是", ["shi4"])) == "Shì sān diǎn yī sì."
    words = split_words(["零点", "一米", "。"], known, pos)
    assert render("零点一米。", words, syllables("零点一米。", words, look, "零", ["ling2"])) == "Líng diǎn yī mǐ."
    words = split_words(["是", "三点", "一刻", "。"], known, pos)
    assert words == ["是", "三", "点", "一", "刻", "。"] and decimal_digits(words) == set()
    assert render("是三点一刻。", words, syllables("是三点一刻。", words, look, "是", ["shi4"])) == "Shì sān diǎn yí kè."
    # 几十 stays one number word after 好, as 十几 and 几十 do everywhere ("hǎo jǐshí gè rén").
    assert split_words(["来", "了", "好几十个", "人"], known | {"好几"}, pos) == ["来", "了", "好", "几十", "个", "人"]
    # The Chinese dash, two long dashes, is one mark "-", even when the segmenter cuts it in two.
    words = ["我", "\u2014", "\u2014", "你", "。"]
    sentence = "我\u2014\u2014你。"
    assert render(sentence, words, syllables(sentence, words, lookup, "你", ["ni3"])) == "Wǒ - nǐ."


def test_month_and_weekday_names_and_pointing_words_are_one_word():
    table = {**TABLE, "今天": ["jin1", "tian1"], "八": ["ba1"], "九": ["jiu3"], "日": ["ri4"], "星期": ["xing1", "qi1"],
             "五": ["wu3"], "下午": ["xia4", "wu3"]}
    look = lambda w: table[w]
    # Point 2 of the style sheet: a month or weekday name is one word, and the day number stands apart.
    words = ["今天", "是", "八", "月", "九", "日", "。"]
    assert attached(words, POS) == {4}
    sylls = syllables("今天是八月九日。", words, look, "九", ["jiu3"])
    assert render("今天是八月九日。", words, sylls, attach=attached(words, POS)) == "Jīntiān shì bāyuè jiǔ rì."
    words = ["今天", "星期", "五", "。"]  # the headword 五 cut jieba's 星期五
    sylls = syllables("今天星期五。", words, look, "五", ["wu3"])
    assert render("今天星期五。", words, sylls, attach=attached(words, POS)) == "Jīntiān xīngqīwǔ."
    # The 一 of 星期一 keeps its first tone when the headword 星期 cuts it off.
    words = ["星期", "一", "下午", "。"]
    sylls = syllables("星期一下午。", words, look, "星期", ["xing1", "qi1"])
    assert render("星期一下午。", words, sylls, attach=attached(words, POS)) == "Xīngqīyī xiàwǔ."
    assert attached(["三", "个", "月"], POS) == set() and attached(["几", "月"], POS) == set()
    # Point 1: step 8 adds 这个, 那个 and 哪个 to the known words, so they stay whole and are read "zhège".
    assert POINTING_WORDS["这个"] == "zhe4 ge5"
    assert split_words(["这个", "人"], KNOWN | set(POINTING_WORDS), POS) == ["这个", "人"]
    assert regroup("这个人。", ["这个", "人", "。"], "这", known=set(POINTING_WORDS)) == ["这个", "人", "。"]


def test_the_zero_of_years_is_read_ling():
    # 〇 (U+3007), the zero of years, lies outside the main block of Chinese characters, and jieba cuts it
    # off as a mark. It is read líng like any character, and the digits of a year stand apart, as
    # GB/T 16159-2012 6.1.5.1 writes 二〇〇八年 "èr líng líng bā nián".
    table = {**TABLE, "〇": ["ling2"], "八": ["ba1"]}
    words = split_words(["二", "〇", "〇", "八年", "。"], KNOWN, POS)
    assert words == ["二", "〇", "〇", "八", "年", "。"]
    sylls = syllables("二〇〇八年。", words, lambda w: table[w], "年", ["nian2"])
    assert render("二〇〇八年。", words, sylls) == "Èr líng líng bā nián."


def test_decimal_positions_and_a_percent_sign():
    # The strict checker (Task 13) finds the digits of a decimal on the characters of a sentence.
    assert decimal_positions("它是三点一四。") == {2, 4, 5}
    assert decimal_positions("百分之三点一之间") == {3, 5}
    assert decimal_positions("是三点一刻。") == set()
    # A percent sign stays with its number, as in the sentence (jieba cuts 70% into 70 and %).
    table = {**TABLE, "地球": ["di4", "qiu2"], "上": ["shang4"], "面积": ["mian4", "ji1"], "海洋": ["hai3", "yang2"]}
    words = ["地球", "上", "70", "%", "的", "面积", "是", "海洋", "。"]
    sentence = "地球上70%的面积是海洋。"
    sylls = syllables(sentence, words, lambda w: table[w], "海洋", ["hai3", "yang2"])
    assert render(sentence, words, sylls) == "Dìqiú shàng 70% de miànjī shì hǎiyáng."


def test_potential_complements():
    assert split_words(["我", "睡不着", "。"], KNOWN, POS) == ["我", "睡", "不", "着", "。"]
    assert split_words(["我", "记不清", "楚", "当时"], KNOWN, POS) == ["我", "记", "不", "清楚", "当时"]
    assert split_words(["找", "不到", "家"], KNOWN, POS) == ["找", "不", "到", "家"]
    words = ["我", "睡", "不", "着", "。"]
    assert potential_readings(words, POS) == {2: "bu5", 3: "zhao2"}
    sylls = syllables("我睡不着。", words, lookup, "睡", ["shui4"], potential_readings(words, POS))
    assert render("我睡不着。", words, sylls, attach=attached(words, POS)) == "Wǒ shuì bu zháo."
    assert potential_readings(["他", "说", "不", "去", "。"], POS) == {}
    assert potential_readings(["他", "不", "到", "十", "岁"], POS) == {}
    # A result 来, and jieba's 不了 or 不过 after a verb (钱买不来幸福。 孩子跨不过这条沟。 我忍受不了他。).
    words = ["钱", "买", "不", "来", "幸福", "。"]
    assert potential_readings(words, POS) == {2: "bu5"}
    table = {**TABLE, "钱": ["qian2"], "买": ["mai3"], "幸福": ["xing4", "fu2"], "忍受": ["ren3", "shou4"], "跨": ["kua4"],
             "过": ["guo4"]}
    sylls = syllables("钱买不来幸福。", words, lambda w: table[w], "钱", ["qian2"], potential_readings(words, POS))
    assert render("钱买不来幸福。", words, sylls, attach=attached(words, POS)) == "Qián mǎi bu lái xìngfú."
    pos = {**POS, "跨": ["v."], "忍受": ["v."]}
    assert split_words(["跨", "不过", "这"], KNOWN, pos) == ["跨", "不", "过", "这"]
    assert split_words(["他", "很", "好", "，", "不过", "我"], KNOWN, pos)[4] == "不过"
    words = split_words(["我", "忍受", "不了", "他", "。"], KNOWN, pos)
    assert words == ["我", "忍受", "不", "了", "他", "。"]
    sylls = syllables("我忍受不了他。", words, lambda w: table[w], "我", ["wo3"], potential_readings(words, pos))
    assert render("我忍受不了他。", words, sylls, attach=attached(words, pos)) == "Wǒ rěnshòu bu liǎo tā."
    # A potential complement of the public list is split too, but a card keeps its card's spacing.
    known = KNOWN | {"赶不上", "受不了", "火车"}
    pos = {**pos, "赶": ["v."], "受": ["v."]}
    assert split_words(["赶不上", "火车", "受不了"], known, pos, cards={"受不了"}) == ["赶", "不", "上", "火车", "受不了"]


def test_particles_join_the_word_before_them():
    words = ["我", "用", "了", "两", "个", "小时", "。"]
    assert attached(words, POS) == {2}
    sylls = syllables("我用了两个小时。", words, lookup, "用", ["yong4"])
    assert render("我用了两个小时。", words, sylls, attach=attached(words, POS)) == "Wǒ yòngle liǎng gè xiǎoshí."
    assert attached(["昨天", "下", "雨", "了", "。"], POS) == set()
    assert attached(["你", "来", "了", "吗", "？"], POS) == set()
    assert attached(["我", "见", "过", "他"], POS) == {2}
    assert attached(["要", "过", "春节", "了"], POS) == set()
    assert attached(["同学", "们", "睡", "不", "着"], POS) == {2}
    assert attached(["驾驶", "员", "回", "家"], POS) == {2}
    assert split_words(["衣服", "弄脏了", "。"], KNOWN, POS) == ["衣服", "弄脏", "了", "。"]


def test_a_particle_that_ends_a_sentence_stands_apart():
    known = KNOWN | {"咖啡", "喝", "杯", "算了"}
    pos = {**POS, "喝": ["v."], "杯": ["m."], "咖啡": ["n."]}
    assert split_words(["喝杯", "咖啡吧", "。"], known, pos) == ["喝", "杯", "咖啡", "吧", "。"]
    assert split_words(["算了吧", "，"], known, pos) == ["算了", "吧", "，"]
    # Inside a sentence jieba's 咖啡吧 is a coffee bar and stays whole.
    assert split_words(["咖啡吧", "很", "小"], known, pos) == ["咖啡吧", "很", "小"]


def test_a_one_character_verb_joins_a_one_character_result():
    pos = {**POS, "写": ["v."], "关": ["v.", "n."], "门": ["n.", "m."], "树": ["n.", "v."], "上": ["n.", "v."],
           "信": ["n.", "v."], "鸟": ["n."]}
    assert attached(["他", "写", "好", "了", "信", "。"], pos) == {2, 3}
    words = ["他", "关", "上", "了", "门", "。"]
    assert attached(words, pos) == {2, 3}
    table = {**TABLE, "关": ["guan1"], "上": ["shang4"], "门": ["men2"]}
    sylls = syllables("他关上了门。", words, lambda w: table[w], "关", ["guan1"])
    assert render("他关上了门。", words, sylls, attach=attached(words, pos)) == "Tā guānshàngle mén."
    # 上 after a word that is first a noun is a place word, and 是, 有 and a verb of wanting take no result.
    assert attached(["鸟", "在", "树", "上", "。"], pos) == set()
    assert attached(["这", "是", "好", "人"], pos) == set()
    assert attached(["我", "要", "去"], pos) == set()


def test_segment_and_regroup_with_jieba():
    assert [w for w, _ in segment("天太黑了，我不敢一个人出去。")] == \
        ["天", "太", "黑", "了", "，", "我", "不敢", "一个", "人", "出去", "。"]
    sentence = "哥哥是一个很勇敢的人。"
    words = regroup(sentence, [w for w, _ in segment(sentence)], "勇敢", cut=lambda piece: [w for w, _ in segment(piece)])
    assert words[-4:] == ["勇敢", "的", "人", "。"]


def test_word_joints():
    fixed = {**CARDS, "动荡不安": IDIOM_JOINTS, "二氧化碳": ["", "", ""]}
    assert word_joints("不客气", fixed) == [" ", ""]
    assert word_joints("动荡不安", fixed) == IDIOM_JOINTS
    assert word_joints("二氧化碳", fixed) == ["", "", ""]
    assert word_joints("科学家", fixed) == ["", ""]
    assert word_joints("一大早儿", fixed) == ["", "", ""]
    assert word_joints("第二十", fixed) == ["-", ""]
    assert word_joints("两三", fixed) == ["-"]


def test_lookup_reads_cards_then_public_list_words_then_the_guess():
    guess = {"下来": ["xia4", "lai2"], "喜欢": ["xi3", "huan1"], "看看": ["kan4", "kan4"], "哪儿": ["na3", "er2"],
             "穿着": ["chuan1", "zhe5"], "出来": ["chu1", "lai2"], "身上": ["shen1", "shang4"]}.get
    listed = {"下来": [{"num": "xia4 lai5"}], "身上": [{"num": "shen1 shang5"}], "穿着": [{"num": "chuan1 zhuo2"}],
              "出来": [{"num": "chu1 lai2"}, {"num": "chu1 lai5"}], "城里": [{"num": "chengli3"}],
              "喜欢": [{"num": "xi3 huan5"}]}
    public_nums, word_readings = public_word_readings(listed, {"喜欢"}, guess)
    assert public_nums == {"下来": "xia4 lai5", "身上": "shen1 shang5", "穿着": "chuan1 zhuo2"}
    assert word_readings == {"穿着": ["chuan1 zhuo2", "chuan1 zhe5"], "出来": ["chu1 lai2", "chu1 lai5"]}
    look = make_lookup({"哪儿"}, {"喜欢": "xi3 huan5"}, public_nums, guess)
    assert [look(w) for w in ["喜欢", "下来", "看看", "哪儿"]] == \
        [["xi3", "huan5"], ["xia4", "lai5"], ["kan4", "kan4"], ["na3", "r5"]]
    words = ["汽车", "停", "了", "下来", "。"]
    sylls = syllables("汽车停了下来。", words, lambda w: TABLE.get(w) or look(w), "停", ["ting2"])
    assert render("汽车停了下来。", words, sylls, attach=attached(words, POS)) == "Qìchē tíngle xiàlai."


def test_regroup_keeps_the_headword_whole_and_joins_a_lone_er():
    assert regroup("都市里很热闹。", ["都", "市里", "很", "热闹", "。"], "都市") == ["都市", "里", "很", "热闹", "。"]
    cut = {"了耸肩": ["了", "耸肩"], "里": ["里"]}.get
    assert regroup("他耸了耸肩。", ["他", "耸了耸肩", "。"], "耸", cut) == ["他", "耸", "了", "耸肩", "。"]
    assert regroup("有很多小摊儿。", ["有", "很多", "小摊", "儿", "。"], "有") == ["有", "很多", "小摊儿", "。"]
    words = ["虽然", "下雨", "了", "，", "但是", "我", "去", "。"]
    assert regroup("虽然下雨了，但是我去。", words, "虽然…但是…") == words


def test_regroup_keeps_a_known_word_that_holds_the_headword():
    known = {"男人", "春天", "外面", "下雨", "那个"}
    words = ["我", "不", "认识", "那个", "男人", "。"]
    assert regroup("我不认识那个男人。", words, "男", known=known) == words
    assert regroup("外面下雨了。", ["外面", "下雨", "了", "。"], "外", known=known) == ["外面", "下雨", "了", "。"]
    assert regroup("外面下雨了。", ["外面", "下雨", "了", "。"], "外") == ["外", "面", "下雨", "了", "。"]
    words = regroup("春天是一年的开始。", ["春天", "是", "一", "年", "的", "开始", "。"], "春", known=known)
    assert words[0] == "春天"
    table = {**TABLE, "春天": ["chun1", "tian1"], "的": ["de5"]}
    sylls = syllables("春天是一年的开始。", words, lambda w: table[w], "春", ["chun1"])
    assert render("春天是一年的开始。", words, sylls) == "Chūntiān shì yì nián de kāishǐ."
    # A word that neither list has is still cut, so the headword stands as a word of its own.
    assert regroup("都市里很热闹。", ["都", "市里", "很", "热闹", "。"], "都市", known=known)[:2] == ["都市", "里"]


def test_pattern_word_positions():
    assert head_positions("虽然下雨了，但是我去。", "虽然…但是…") == [0, 1, 6, 7]
    assert head_positions("我去。", "虽然…但是…") == []


def test_spot_checks_single_characters_with_several_readings():
    words = ["一", "个", "人", "长", "大", "了", "。"]
    sylls = syllables("一个人长大了。", words, lookup, "人", ["ren2"])
    readings = {"长": ["chang2", "zhang3"], "大": ["da4", "dai4"], "了": ["le5", "liao3"], "一": ["yi1"],
                "个": ["ge4", "ge3"]}
    found = spot_checks("一个人长大了。", words, sylls, "人", lambda ch: readings.get(ch, ["x1"]), set(), {})
    assert found == [(3, "长", "chang2", "chang2/zhang3"), (4, "大", "da4", "da4/dai4")]


def test_spot_checks_words_that_neither_list_has():
    words = ["缝到", "衬衫", "上", "。"]
    sylls = ["feng2", "dao4", "chen4", "shan1", "shang4", None]
    readings = {"缝": ["feng2", "feng4"], "到": ["dao4"], "上": ["shang4", "shang3"], "衫": ["shan1", "shan4"]}
    found = spot_checks("缝到衬衫上。", words, sylls, "上", lambda ch: readings.get(ch, ["x1"]), {"衬衫"}, {})
    assert found == [(0, "缝", "feng2", "feng2/feng4"), (1, "到", "dao4", "dao4/dao5")]
    readings = {"睡": ["shui4"], "着": ["zhe5", "zhao2", "zhuo2"], "了": ["le5", "liao3"]}
    sylls = ["wo3", "shui4", "zhe5", "le5", None]
    found = spot_checks("我睡着了。", ["我", "睡着", "了", "。"], sylls, "我", lambda ch: readings[ch], set(), {})
    assert found == [(2, "着", "zhe5", "zhe5/zhao2/zhuo2")]


def test_spot_checks_public_words_with_several_readings():
    words = ["他", "穿着", "红", "鞋", "。"]
    sylls = ["ta1", "chuan1", "zhuo2", "hong2", "xie2", None]
    several = {"穿着": ["chuan1 zhuo2", "chuan1 zhe5"]}
    found = spot_checks("他穿着红鞋。", words, sylls, "鞋", lambda ch: ["x1"], {"下来"}, several)
    assert found == [(2, "着", "zhuo2", "zhuo2/zhe5")]


def test_spot_checks_an_unmarked_er_ending():
    words = ["我", "在", "哪儿", "。"]
    table = {"我": ["wo3"], "在": ["zai4"], "哪儿": ["na3", "er2"]}
    sylls = syllables("我在哪儿。", words, lambda w: table[w], "在", ["zai4"])
    assert spot_checks("我在哪儿。", words, sylls, "在", lambda ch: ["x1"], {"哪儿"}, {}) == [(3, "儿", "er2", "er2/r5")]


def test_check_polyphone_answers():
    given = [{"id": "w1", "index": "3", "char": "长", "given": "chang2"},
             {"id": "w2", "index": "0", "char": "行", "given": "xing2"}]
    answers = [{"id": "w1", "index": "3", "char": "长", "verdict": "FIX", "syllable": "zhang3"},
               {"id": "w2", "index": "0", "char": "行", "verdict": "OK", "syllable": ""}]
    assert check_polyphone_answers(given, answers) == ([], [("w1", 3, "长", "zhang3"), ("w2", 0, "行", "xing2")])
    problems, _ = check_polyphone_answers(given, [{"id": "w1", "index": "3", "char": "长", "verdict": "FIX",
                                                   "syllable": "zhang"}])
    assert problems == ["w1 at 3: verdict 'FIX' with syllable 'zhang'", "w2 at 0: missing"]
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `python -m pytest tests/test_sentpinyin.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'sentpinyin'`

- [ ] **Step 5: Write `tools/sentpinyin.py`**

```python
"""Pinyin for example sentences.

The sentence is first cut into words (by the jieba segmenter in the build script). Each
word's syllables come from a lookup function (card readings, public-list readings and
pypinyin in the build script, a small table in the tests). The headword always gets the
card's own reading, then the 一 and 不 tone changes are applied across the whole sentence,
and the result is written in the cards' textbook word spacing (Plan 3a pinyin_text), so
"我爱我的家。" gives "Wǒ ài wǒ de jiā." and "他说不客气。" gives "Tā shuō bú kèqi."
"""
import re

import jieba.posseg

from pinyin_text import card_py, tone_change

# Chinese characters. 〇 (U+3007), the zero of years such as 二〇〇八年, lies outside the main block, but it
# is read like a character (líng, as in "èr líng líng bā nián").
_HANZI = re.compile(r"[\u3007\u4e00-\u9fff]")
_CLOSE = {"，": ",", "。": ".", "！": "!", "？": "?", "：": ":", "；": ";", "、": ",", "”": '"', "）": ")",
          "》": '"', "…": "...", "……": "..."}
_OPEN = {"“": '"', "（": "(", "《": '"'}
_DASH = {"\u2014": "-", "\u2014\u2014": "-"}
# Characters with several readings that pypinyin reads correctly when they are a word of their
# own, so such a word is not put on the spot-check list: 的 de, 了 le, 着 zhe, 个 gè, 们 men, 么 me,
# 子 zi, plus 一 and 不, whose tones the tone-change rule sets. Inside a longer word that neither
# list has they are checked like any other character (着 in 睡着 is zháo), except 一.
SAFE_ALONE = set("的了着个们么子一不")
SYLLABLE = re.compile(r"^[a-zü]+[1-5]$")
_WORD = re.compile(r"^[\u3007\u4e00-\u9fff]+$")
# 们 and the aspect particles 着, 了 and 过 join the word before them in the textbook rules (去过).
JOINS_BEFORE = set("们着了过")
# Suffixes that the rules join to the word before them (桃子, 作者, 驾驶员, 实质性, 现代化). Unlike 家, 手
# and 头, they are hardly ever a word of their own, so a lone one joins the word before it.
SUFFIXES = set("子者员性化")
# Endings that a noun or verb of two characters keeps in the same word, like the suffixes above
# (歌唱家 "gēchàngjiā", 体育迷 "tǐyùmí", 装饰品 "zhuāngshìpǐn"). 家 alone is also a word (回 家), so it
# is not one of the SUFFIXES.
WORD_ENDINGS = set("家迷品")
# In a short word that neither list has, the textbook rules put a space after these pieces:
# pronouns, and 这 那 哪 各 每 某 本 该 before a noun or a measure word (我 家, 这 件, 每 天), and
# adverbs (很 多, 不 能, 都 会).
PRONOUNS = {"我", "你", "您", "他", "她", "它", "谁", "我们", "你们", "他们", "她们", "它们", "咱们", "这", "那", "哪",
            "各", "每", "某", "本", "该", "此", "另", "这么", "那么", "这样", "那样", "怎么", "什么", "任何", "所有"}
ADVERBS = set("很不没都也还就才太最更真又再别只已刚挺极常总未仅略并越先少")
# Prepositions after a verb, which the rules write apart (坐 在, 送 给, 走 向, 生 于).
PREPOSITIONS = set("在给向往于")
# Place words, which the rules write apart from the noun before them (山 上, 河 里).
LOCATIVES = set("上下里外中内前后旁边")
# Adjectives that stand apart from one noun after them (大 树, 老 房子).
ADJECTIVES = set("大小老新旧全好")
# 这, 那 and 哪 are written joined to 点儿, 般, 边, 时 and 会儿 (这点儿 "zhèdiǎnr").
JOINED_AFTER_THIS = {"点", "点儿", "般", "边", "时", "会儿"}
# Point 1 of the pinyin style sheet writes these as one word each, with a neutral ge ("zhège", "nàge",
# "nǎge"), like 这些, 那些 and 哪些, which the public list has. Step 8 treats them as known words with
# these readings, so they are never split and never go on the check list.
POINTING_WORDS = {"这个": "zhe4 ge5", "那个": "na4 ge5", "哪个": "na3 ge5"}
# Point 2 writes a month or weekday name as one word ("bāyuè", "xīngqīwǔ"), so 月 joins a month
# number before it, and a weekday number joins 星期 or 礼拜 (see attached).
MONTH_NUMBERS = {"一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"}
WEEKDAY_NUMBERS = set("一二三四五六日天")
# Pieces that start a number in such a word, besides the numerals: 几 (几个), 好几 (好几种), and
# 多, 数 and 半 before a measure word (多名, 数个, 半个).
_NUMBER_WORDS = {"几", "好几", "多", "数", "半"}
# Words that point at a thing, after which a measure word stands apart from its noun (这 本 书).
_POINTING = {"这", "那", "哪", "每", "各", "某", "该", "此", "另", "这么", "那么"}
# Words after which a 了 ends its sentence, so the 了 is written apart ("Nǐ lái le ma?").
_FINAL_PARTICLES = set("吗吧呢啊呀啦嘛")
# Verbs of wanting and being able. A 过 after them is the verb guò (要过春节), not the particle.
_AUXILIARIES = {"要", "想", "能", "会", "可以", "应该", "应当", "得", "愿意", "敢", "肯", "可能", "需要", "打算"}
# Results and directions that follow 不 in a potential complement (找不到, 听不懂, 睡不着, 记不清楚).
COMPLEMENTS = set("到懂着了起上下开动完见清住出过及掉惯通透够来去")
COMPLEMENT_WORDS = {"起来", "出来", "出去", "下来", "下去", "上来", "上去", "进来", "进去", "过来", "过去", "回来", "回去",
                    "清楚", "明白"}
# Verbs of saying and deciding, and 是. After them 不来 and 不去 mean "will not come" and "will not go"
# (他说不去), and 不过 is "but", so these are not potential complements.
_SAYING = {"说", "想", "问", "讲", "答应", "决定", "表示", "是"}
# One-character results and directions that the rules join to a one-character verb before them.
# GB/T 16159-2012 6.1.2.4 writes 搞坏 "gǎohuài" and 打死 "dǎsǐ", so 写好 is "xiěhǎo" and 关上 "guānshàng".
RESULTS = set("好完到懂见住开坏死脏掉上下出进回来去走倒破断满成错清饱醒透光")
# One-character verbs after which such a character is not a result (是 好 人, 请 开 门, 到 死).
_NO_RESULT = {"是", "有", "在", "给", "爱", "像", "姓", "请", "到"}
# The reading of 不 in a potential complement (point 5 of the pinyin style sheet). A 着 or 了 there is zháo or liǎo.
POTENTIAL_BU = "bu5"
_COMPLEMENT_READING = {"着": "zhao2", "了": "liao3"}
# Characters that write numbers, and the value of each digit.
NUMERALS = set("〇零一二两三四五六七八九十百千万亿")
_DIGIT = {"〇": 0, "零": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
_FRACTION = re.compile(r"^([零一二两三四五六七八九十百千万亿]+)分之([零一二两三四五六七八九十百千万亿]+)$")
# The digits after the point of a decimal number (三点一四 "sān diǎn yī sì"), and the words that may follow
# a decimal. A time of day also has 点 and a digit (三点一刻 "sān diǎn yí kè", 九点零五分), so a single
# digit after 点 counts as a decimal only at the end of a sentence part, after 零点 or before a unit.
_DECIMAL_DIGITS = set("〇零一二三四五六七八九")
_UNITS = {"米", "厘米", "毫米", "公里", "千米", "公斤", "千克", "克", "吨", "升", "毫升", "秒", "度", "倍", "元", "万", "亿"}
_TIME = {"分", "刻", "点", "钟", "分钟"}


def segment(text):
    """jieba's words and part-of-speech tags for text, [(word, tag)], from its dictionary only.

    jieba's guessing of unknown words (HMM) is switched off, as in Plan 3a, because its guesses
    join characters of different words into made-up words. With it, the sentence 天太黑了，我不敢
    一个人出去。 starts with 天太 + 黑 + 了, written "Tiāntài hēi le", and without it with 天 + 太 + 黑 + 了.
    """
    return [(p.word, p.flag) for p in jieba.posseg.lcut(text, HMM=False)]


def make_lookup(erhua, card_nums, public_nums, guess):
    """lookup(word) gives one numbered syllable per Chinese character of the word.

    card_nums: {headword: the numbered syllables its card shows} for each headword that has exactly
    one card. Such a word is read as on its card, so 喜欢 is xi3 huan5 and 东西 is dong1 xi5, where
    pypinyin gives xi3 huan1 and dong1 xi1, and 受不了 is shou4 bu5 liao3 with the neutral bu that
    its card shows. public_nums: {word: numbered reading} for the other words of the public list
    that have exactly one reading, which are read as the list gives them, neutral tones included,
    so 下来 is xia4 lai5 and 身上 is shen1 shang5 (pypinyin gives xia4 lai2 and shen1 shang4). Any
    other word takes the reading guess(word) gives (pypinyin in step 8), and a word that ends in 儿
    and is a known 儿-ending word, or that guess reads with a neutral er5, ends in r5.
    """
    def lookup(word):
        hanzi = "".join(_HANZI.findall(word))
        if hanzi in card_nums:
            return card_nums[hanzi].split()
        if hanzi in public_nums:
            return public_nums[hanzi].split()
        sylls = list(guess(hanzi))
        if len(hanzi) > 1 and hanzi.endswith("儿") and (hanzi in erhua or sylls[-1] == "er5"):
            sylls[-1] = "r5"
        return sylls
    return lookup


def public_word_readings(listed, cards, guess):
    """The public list's readings of its words that are not card headwords, for make_lookup and spot_checks.

    listed: Plan 3a public_readings of the public list. guess(word) gives pypinyin's reading.
    Returns (public_nums, word_readings).
    public_nums holds each such word with exactly one numbered reading. word_readings holds each
    such word of two or more characters with several readings, and also a word whose one reading
    spells a character with other letters than pypinyin does (穿着 is chuan1 zhuo2 in the list, as
    in "attire", but chuan1 zhe5 in 穿着红鞋), with both readings, so its characters are checked.
    A reading that does not give one syllable per character is left out, because the list writes
    a few readings without spaces (城里 "chéngli").
    """
    public_nums, word_readings = {}, {}
    for hz, options in listed.items():
        nums = [n for n in dict.fromkeys(r["num"] for r in options)
                if len(n.split()) == len(hz) and all(SYLLABLE.match(x) for x in n.split())]
        if hz in cards or not nums:
            continue
        if len(nums) == 1:
            public_nums[hz] = nums[0]
            guessed = list(guess(hz))
            if len(hz) > 1 and len(guessed) == len(hz) and any(
                    ch != "儿" and a[:-1] != b[:-1] for ch, a, b in zip(hz, nums[0].split(), guessed)):
                word_readings[hz] = [nums[0], " ".join(guessed)]
        elif len(hz) > 1:
            word_readings[hz] = nums
    return public_nums, word_readings


def word_pieces(word, known):
    """The fewest known words that spell `word` exactly, in order, or None when there are none.

    known: a set of words. With 足球 and 比赛 known, 足球比赛 gives ["足球", "比赛"].
    """
    best = {0: []}
    for end in range(1, len(word) + 1):
        options = [best[start] + [word[start:end]] for start in range(end)
                   if start in best and word[start:end] in known]
        if options:
            best[end] = min(options, key=len)
    return best.get(len(word))


def number_words(run):
    """The words of a number written in characters, as the textbook rules write numbers.

    - A whole number from 11 to 99 is one word, so 三十三 gives ["三十三"] ("sānshísān").
    - A digit (or 十) with 百, 千, 万 or 亿 is one word, and each such group is a word of its own,
      so 九亿七万二千三百五十六 gives ["九亿", "七万", "二千", "三百", "五十六"]
      ("jiǔyì qīwàn èrqiān sānbǎi wǔshíliù").
    - 几 counts as a digit next to 十, 百, 千 or 万, so 十几 and 几十 are one word each (十几 gives
      ["十几"], "shíjǐ gè rén"), and so are 几百 and 几千.
    - 万 or 亿 after a number of two or more characters stands apart (二十亿 gives ["二十", "亿"]).
    - 零 is a word of its own (一百零一 gives ["一百", "零", "一"]).
    - Without 十, 百, 千, 万 or 亿 the digits are read one by one, as in a year, and written apart
      (二零一二 gives ["二", "零", "一", "二"]). Two digits where the second is larger give an
      approximate number, which stays one word (一两, 两三) and gets a hyphen from word_joints.
    """
    if not any(ch in "十百千万亿" for ch in run):
        return [run] if approximate(run) else list(run)
    out, current = [], ""
    for ch in run:
        if ch in "零〇":
            out += [current, ch] if current else [ch]
            current = ""
        elif ch in "百千":
            out.append(current + ch)
            current = ""
        elif ch in "万亿":
            out += [current + ch] if len(current) <= 1 else [current, ch]
            current = ""
        else:
            current += ch
    return out + ([current] if current else [])


def approximate(word):
    """True for two digits that give an approximate number (一两 "one or two", 两三, 七八)."""
    return len(word) == 2 and all(ch in _DIGIT for ch in word) and 0 < _DIGIT[word[0]] < _DIGIT[word[1]]


def split_words(words, known, pos_of, keep=(), forms=None, cards=()):
    """The segmenter's words, with words that neither list has split where the textbook rules write them apart.

    known: every card headword and every word of the public list. pos_of: {word: its part-of-speech
    labels, such as ["adv."]} for those words. keep: words never split (the headword's parts and
    the names of data/manual/capitals). forms: {hz: (form, words)} for four-character words, from
    data/manual/four_char_words (Plan 3a pinyin_text.form_rows). cards: the card headwords, which
    keep the spacing of their cards.
    - A four-character word with the form "words" is split into its listed words, even when it is
      known (市场经济 gives 市场 + 经济). One with the form idiom or joined stays whole.
    - Another word that is not known is split into the fewest known words that spell it, always
      when it has four or more characters, so 足球比赛 gives 足球 + 比赛. A word of two or three
      characters is split only where the rules put a space between the first two pieces (_apart).
      That is after a pronoun (我 + 家, 这 + 件, 每 + 天), after an adverb (很 + 多, 不 + 能), between a
      number and a measure word (一 + 个, 几 + 十 + 个, 好几 + 种), before a preposition after a verb
      (坐 + 在), and between a measure word and a noun after a number or 这 (jieba's 本书, cut from
      这本书, gives 本 + 书). Other short words stay whole, because many of them are ordinary words
      or names that neither list has (把守, 企业家, 西班牙, 桃子, 劳动节).
    - A potential complement, a verb, 不 and a result (睡不着, 听不懂), is split into its three
      characters, as the rules write 打不着 "dǎ bù zháo". When jieba cut it out of a longer word
      (记不清 + 楚), the result takes the rest of that word back (记 + 不 + 清楚).
    - One character written twice also stays whole (看看 "kànkan"). 们 and the aspect particles 着,
      了 and 过 join the piece before them, so 去过 and 同学们 stay whole and 别忘了 gives 别 + 忘了. A
      final 儿 joins the last piece (这点儿 stays whole, as the rules write "zhèdiǎnr").
    - A fraction is written syllable by syllable, as GB/T 16159-2012 6.1.5.1 writes 二分之一 "èr fèn
      zhī yī". So 三分之一 gives 三 + 分 + 之 + 一, and so do jieba's 分之 and 百分之 (百 + 分 + 之),
      unless they are the headword. 第 with a number stays one word (第十 "dì-shí").
    - Numbers are written as number_words says. Neighbouring words made only of numerals, and 几
      next to 十, 百, 千 or 万, are joined into one number and divided again, so jieba's 六 + 十 + 岁
      gives 六十 + 岁 ("liùshí suì") and 一 + 千 + 五 + 百 gives 一千 + 五百 ("yìqiān wǔbǎi"). A known
      word such as 千万 (be sure to) that stands alone is left as it is, and a number after a lone
      第 joins it (第 + 二十 gives 第二十). 好几 lets go of 几 before 十, 百, 千 or 万, so 几十 stays
      one word (好 + 几十 + 个). The digits after the point of a decimal are written one by one
      (三 + 点 + 一 + 四, "sān diǎn yī sì"), not as an approximate number (_is_decimal).
    - jieba's 不了 and 不过 after a verb are the end of a potential complement, so they are split
      (忍受 + 不了 gives 忍受 + 不 + 了, and 跨 + 不过 gives 跨 + 不 + 过, "kuà bu guò"). So is a potential
      complement of the public list that is not a card (赶不上 gives 赶 + 不 + 上, "gǎn bu shàng"),
      while a card keeps the spacing of its card (受不了 "shòubuliǎo").
    - Last, a 了 or a particle such as 吧 or 吗 that ends a sentence is split from a word that neither
      list has (弄脏了。 gives 弄脏 + 了, and jieba's 咖啡吧 in 喝杯咖啡吧。 gives 咖啡 + 吧), because the
      rules write them apart ("nòngzāng le.", "hē bēi kāfēi ba.").
    """
    out, words = [], list(words)
    for k, word in enumerate(words):
        if word in known and word not in cards and word not in keep and len(word) == 3 and word[1] == "不" \
                and potential(word[0], word[2], pos_of):
            out += list(word)
            continue
        if word in ("不了", "不过") and word not in keep and out and _WORD.match(out[-1]) \
                and "v." in pos_of.get(out[-1], ()) and out[-1] not in _SAYING and out[-1] not in _AUXILIARIES:
            out += ["不", word[1]]
            continue
        pieces = _pieces(word, known, pos_of, keep, forms or {}, out[-1] if out else "")
        if len(pieces) == 3 and pieces[1] == "不" and k + 1 < len(words) and pieces[2] + words[k + 1] in known:
            words[k + 1] = pieces.pop() + words[k + 1]
        out += pieces
    out = _numbers([piece for word in out for piece in _fraction(word, keep)], known)
    final = []
    for k, word in enumerate(out):
        final += _sentence_end(word, out[k + 1] if k + 1 < len(out) else "", known, keep)
    return final


def _fraction(word, keep):
    """A word 分之, with or without a number before it, written syllable by syllable (百分之 gives 百 + 分 + 之)."""
    if word in keep or not re.match(r"^[零一二两三四五六七八九十百千万亿]*分之$", word):
        return [word]
    return ([word[:-2]] if len(word) > 2 else []) + ["分", "之"]


def _sentence_end(word, after, known, keep):
    """A word that neither list has, with a 了 or a particle that ends the sentence split off (走了吧 gives 走 + 了 + 吧)."""
    if len(word) < 2 or word in known or word in keep or not _WORD.match(word) or not ends_sentence(after):
        return [word]
    if word[-1] in _FINAL_PARTICLES:
        return _sentence_end(word[:-1], word[-1], known, keep) + [word[-1]]
    if len(word) < 4 and word.endswith("了") and word[-2] != "不":
        return [word[:-1], "了"]
    return [word]


def ends_sentence(after):
    """True when a 了 before the word `after` ends its sentence: at the end, before punctuation or before 吗, 吧 and 呢."""
    return not _HANZI.match(after[:1]) or after in _FINAL_PARTICLES


def _pieces(word, known, pos_of, keep, forms, before=""):
    if len(word) < 2 or word in keep or not _WORD.match(word):
        return [word]
    stem, er = (word[:-1], "儿") if len(word) > 2 and word.endswith("儿") else (word, "")
    if len(stem) == 4 and stem in forms:
        form, parts = forms[stem]
        return parts[:-1] + [parts[-1] + er] if form == "words" else [word]
    fraction = _FRACTION.match(stem)
    if fraction:
        return [fraction.group(1), "分", "之", fraction.group(2) + er]
    if word in known:
        return [word]
    ordinal = re.match(r"^第[零一二两三四五六七八九十百千万亿几]+", stem)
    if ordinal and ordinal.group(0) != stem:
        return [ordinal.group(0)] + _pieces(word[ordinal.end():], known, pos_of, keep, forms, ordinal.group(0))
    if ordinal or (len(stem) == 2 and stem[0] == stem[1]):
        return [word]
    if len(stem) == 3 and ((stem[1] == "不" and potential(stem[0], stem[2], pos_of))
                           or (stem[1] == "得" and pos_of.get(stem[0], ()) and set(pos_of[stem[0]]) & {"v.", "adj."})):
        return [stem[0], stem[1], stem[2] + er]
    if len(stem) == 3 and stem[0] == stem[1] and stem[2] in "地的":
        return [stem[:2], stem[2] + er]
    merged, rough = [], stem[2:3] in ("十", "百", "千", "万")
    for piece in word_pieces(stem, known) or [stem]:
        if merged and piece in JOINS_BEFORE:
            merged[-1] += piece
        elif piece == "好几" and rough:
            merged += ["好", "几"]
        elif merged == ["好"] and piece == "几" and not rough:
            merged = ["好几"]
        else:
            merged.append(piece)
    if len(merged) < 2 or len(stem) > 3:
        return merged[:-1] + [merged[-1] + er]
    if merged[-1] in LOCATIVES and "n." in pos_of.get(merged[-2], ()) and not (merged == [stem[0], "中"]):
        return ["".join(merged[:-1]), merged[-1] + er]
    if not _apart(merged, er, before, pos_of):
        return [word]
    return merged[:-1] + [merged[-1] + er]


def _is_number(piece):
    return piece in _NUMBER_WORDS or all(ch in NUMERALS or ch == "几" for ch in piece)


def _apart(pieces, er, before, pos_of):
    """True when the textbook rules put a space between the pieces of a short word that neither list has.

    pieces: the known words that spell the word, er: its final 儿, before: the word before it.
    The rules write these apart:
    - a pronoun, 是, or a word such as 这, 每 or 所有, and what follows (我 家, 这 件, 每 天, 是 从),
      except that 这, 那 and 哪 join 点儿, 般, 边, 时 and 会儿 (这点儿 "zhèdiǎnr");
    - an adverb and what follows (很 多, 不 能, 少 吸), and an adverb after 要, 会 or 能 (要 先);
    - a number and a measure word, 月, 多, an adjective or a noun of two characters (一 个,
      几十 个, 好几 种, 八 月, 一 大, 三 年级), but not a festival named by its date (五一节);
    - a measure word and its noun after a number or 这 (这 本 书, 7 点 钟);
    - a verb and a preposition after it (坐 在), 点 or 些 after it (买 点儿, but 有点 and 差点 are
      one word), a measure word or its object after a verb of one character whose first part of
      speech is a verb (喝 杯 茶, 买 票), and a verb after 来 or 去 (来 说, 去 看);
    - 把 or 被 and a noun after it (把 门 关上);
    - 大, 小, 老, 新, 旧, 全 or 好 and one noun (大 树, 老 房子), a noun of two characters and a
      verb (电话 响), and 可 and a verb of two characters (可 更改).
    Other short words stay whole, such as 西班牙, 日本, 桃子, 企业家, 发动机 and 五官, and so do a
    noun or verb of two characters with 家, 迷 or 品 after it (歌唱家, 体育迷, 装饰品) and words
    whose first piece is also a noun or an adjective (面孔, 热天, 树丛).
    """
    first, second = pieces[0], pieces[1] + (er if len(pieces) == 2 else "")
    labels = [set(pos_of.get(p, ())) for p in pieces]
    if first in ("这", "那", "哪") and second in JOINED_AFTER_THIS:
        return False
    if first in PRONOUNS or first in ADVERBS or first == "是" or (len(first) > 1 and "adv." in labels[0]):
        return True
    if first in _AUXILIARIES and pieces[1] in ADVERBS:
        return True
    count = next((k for k, p in enumerate(pieces) if not _is_number(p)), len(pieces))
    if count:
        number, rest = "".join(pieces[:count]), pieces[count:]
        festival = rest == ["节"] and len(number) == 2 and all(ch in _DIGIT for ch in number) and not approximate(number)
        doubled = len(rest) == 2 and rest[0] == rest[1]
        if festival or doubled or not rest:
            return not (festival or doubled)
        after = set(pos_of.get(rest[0], ()))
        noun = len(rest[0]) > 1 and "n." in after and number != "半"
        return rest[0] in ("多", "月", "月份") or rest[0] in ADJECTIVES or "m." in after or noun
    if len(first) == 2 and len(pieces) == 2 and pieces[1] in WORD_ENDINGS and labels[0] & {"n.", "v."}:
        return False
    if first in ("把", "被") and "n." in labels[1]:
        return True
    if "m." in labels[0] and "n." in labels[1] and before and (_is_number(before) or before.isdigit()
                                                               or before in _POINTING):
        return True
    verb_first = len(first) == 1 and pos_of.get(first, [""])[:1] == ["v."] and first != "有"
    if "v." in labels[0] and (pieces[1] in PREPOSITIONS or (second in ("点", "点儿", "些") and first not in ("有", "差"))
                              or (verb_first and "m." in labels[1] and "v." not in labels[1])):
        return True
    if first in ("来", "去") and "v." in labels[1] and pieces[1] != "得":
        return True
    noun_verb = len(first) == 2 and len(pieces[1]) == 1 and "n." in labels[0] and labels[1] & {"v.", "n."} == {"v."}
    if len(pieces) == 2 and ((first in ADJECTIVES and "n." in labels[1]) or noun_verb):
        return True
    return first == "可" and len(pieces[1]) > 1 and "v." in labels[1]


def potential(verb, result, pos_of):
    """True when verb + 不 + result is a potential complement (找 不 到 "cannot find", 买 不 来 "cannot buy").

    After a verb of saying, deciding or wanting, 不来 and 不去 are "will not come" and "will not go"
    (他 说 不 去), so they are not one.
    """
    return bool(_WORD.match(verb)) and "v." in pos_of.get(verb, ()) and verb != result and (
        result in COMPLEMENTS or result in COMPLEMENT_WORDS) and not (
        result in ("来", "去") and (verb in _SAYING or verb in _AUXILIARIES))


def potential_readings(words, pos_of):
    """{sentence index: syllable} for the 不 of each potential complement, and a 着 or 了 after it.

    words: the words of split_words. A 不 between a verb and a result or direction (找 + 不 + 到,
    睡 + 不 + 着, 记 + 不 + 清楚) says that the action cannot reach its result. It is read POTENTIAL_BU,
    the neutral tone, as point 5 of the style sheet says and HSK 4 prints 受不了 "shòubuliǎo", and a 着
    or 了 after it is read zháo or liǎo. So ["我", "睡", "不", "着"] gives {2: "bu5", 3: "zhao2"}, which
    render writes "wǒ shuì bu zháo". Step 8 passes these to syllables with the polyphone fixes.
    """
    out, pos = {}, 0
    for k, word in enumerate(words):
        if word == "不" and 0 < k < len(words) - 1 and potential(words[k - 1], words[k + 1], pos_of):
            out[pos] = POTENTIAL_BU
            if words[k + 1] in _COMPLEMENT_READING:
                out[pos + 1] = _COMPLEMENT_READING[words[k + 1]]
        pos += len(word)
    return out


def attached(words, pos_of):
    """Sentence indexes where a word starts that is written joined to the word before it.

    The textbook rules write 们 and the aspect particles 着, 了 and 过 joined to the word before
    them, and so are the SUFFIXES. So 们, 着 and a suffix always join a Chinese word before them
    (孩子们 "háizimen", 指着 "zhǐzhe", jieba's 驾驶 + 员 "jiàshǐyuán").
    A 了 joins too ("yòngle liǎng gè xiǎoshí"), except that a 了 that ends a sentence stays apart
    ("Zuótiān xià yǔ le.", "Nǐ lái le ma?"). A 过 joins a verb (见过 "jiànguo"), but after a noun,
    a pronoun, an adverb or a verb of wanting it is the verb guò and stays apart (要过春节
    "yào guò Chūnjié"). None of them joins 不 or 得, where they finish a potential complement
    (睡不着 "shuì bu zháo").
    A one-character result or direction of RESULTS joins a one-character verb before it, as the
    rules join two one-character words there (写 + 好 gives "xiěhǎo", 关 + 上 + 了 "guānshàngle"). The
    word before must be first of all a verb (not 树 in 树 上 or 没 in 没 去), and not 是, 有, 请, a
    verb of wanting or a preposition (是 好 人, 请 开 门). A second result after a first stays apart
    (走 出 去).
    Month and weekday names are one word (point 2 of the pinyin style sheet), so 月 joins a month
    number (八 + 月 gives "bāyuè", but 三 + 个 + 月 stays "sān gè yuè" and 几 + 月 "jǐ yuè"), and a
    weekday number joins 星期 or 礼拜 (星期 + 五 gives "xīngqīwǔ") unless a measure word follows it.
    """
    out, pos, joined_result = set(), 0, False
    for k, word in enumerate(words):
        before = words[k - 1] if k else ""
        after = words[k + 1] if k + 1 < len(words) else ""
        result = word in RESULTS and not joined_result and word != before and _takes_result(before, pos_of)
        month = word == "月" and before in MONTH_NUMBERS and not (k > 1 and (_is_number(words[k - 2])
                                                                            or words[k - 2] == "第"))
        weekday = before in ("星期", "礼拜") and word in WEEKDAY_NUMBERS and "m." not in pos_of.get(after, ())
        if _WORD.match(before) and before not in ("不", "得") and (
                word in ("们", "着") or word in SUFFIXES or result or (word == "了" and not ends_sentence(after))
                or (word == "过" and "v." in pos_of.get(before, ()) and before not in _AUXILIARIES)
                or month or weekday):
            out.add(pos)
        joined_result = result
        pos += len(word)
    return out


def _takes_result(verb, pos_of):
    """True when a one-character result after `verb` joins it (写 + 好, 关 + 上), see attached."""
    return len(verb) == 1 and bool(_WORD.match(verb)) and pos_of.get(verb, [])[:1] == ["v."] \
        and verb not in _NO_RESULT and verb not in _AUXILIARIES and verb not in PREPOSITIONS


def _numbers(words, known):
    out, run = [], []
    for word in words + [""]:
        if word and all(ch in NUMERALS or ch == "几" for ch in word):
            run.append(word)
            continue
        joined = "".join(run)
        if run and len(out) > 1 and out[-1] == "点" and _is_decimal(out[:-1], joined, word):
            out += list(joined)
        elif run and out and out[-1] == "第":
            out[-1] += joined
        elif len(run) == 1 and (len(run[0]) == 1 or run[0] in known):
            out += run
        elif "几" in joined and not any(ch in "十百千万" for ch in joined):
            out += run
        elif run:
            out += number_words(joined)
        run = []
        if word:
            out.append(word)
    return out


def _is_decimal(before, digits, after):
    """True when digits after a number and 点 are the digits of a decimal, which are read one by one.

    before: the words before 点, digits: the characters after it, after: the next word. So 三 + 点 +
    一四 is a decimal ("sān diǎn yī sì"), and so are 零点一, 一点五公里, 三点一 at the end of a sentence
    part and 百分之三点一, while 三点一刻 and 九点零五分 are times of day.
    """
    if not before or not all(ch in NUMERALS for ch in before[-1]) or not digits \
            or not all(ch in _DECIMAL_DIGITS for ch in digits) or after in _TIME:
        return False
    return len(digits) > 1 or before[-1] in ("零", "〇") or not _HANZI.match(after[:1]) or after in _UNITS \
            or (len(before) > 1 and before[-2] == "之")


def decimal_digits(words):
    """Indexes of the words that belong to a decimal number: the number before 点 and the digits after it.

    A 一 among them keeps its first tone, because a decimal is read digit by digit (三 点 一 四
    "sān diǎn yī sì", 一 点 五 公里 "yī diǎn wǔ gōnglǐ"). split_words already wrote the digits apart.
    """
    out = set()
    for k, word in enumerate(words):
        if word != "点" or not k:
            continue
        end = k + 1
        while end < len(words) and len(words[end]) == 1 and words[end] in _DECIMAL_DIGITS:
            end += 1
        if _is_decimal(words[:k], "".join(words[k + 1:end]), words[end] if end < len(words) else ""):
            out |= {k - 1} | set(range(k + 1, end))
    return out


def decimal_positions(sentence):
    """Indexes of the sentence characters that are digits of a decimal number, which are read one by one.

    The same test as decimal_digits, but on the characters of a sentence, for the strict checker
    (Task 13). The number before 点 counts only when it is written digit by digit. So 三点一四米
    gives the indexes of 三, 一 and 四, while 三点一刻 (a time of day) gives none.
    """
    out = set()
    for k, ch in enumerate(sentence):
        if ch != "点" or not k or sentence[k - 1] not in NUMERALS:
            continue
        start = k
        while start and sentence[start - 1] in NUMERALS:
            start -= 1
        end = k + 1
        while end < len(sentence) and sentence[end] in _DECIMAL_DIGITS:
            end += 1
        after = next((sentence[end:end + n] for n in (2, 1) if sentence[end:end + n] in _TIME | _UNITS),
                     sentence[end:end + 1])
        if _is_decimal(list(sentence[:start]) + [sentence[start:k]], sentence[k + 1:end], after):
            digits = range(start, k) if all(c in _DECIMAL_DIGITS for c in sentence[start:k]) else range(0)
            out |= set(digits) | set(range(k + 1, end))
    return out


def word_joints(word, fixed):
    """Joints for one word of a sentence (see Plan 3a pinyin_text), so a sentence is spaced like the cards.

    The words come from split_words. fixed: {word: joints} for the words whose spacing is set
    elsewhere. Those are the card headwords (as on the card, so 不客气 gives [" ", ""] "bú kèqi")
    and the four-character words kept whole, which are the idioms (IDIOM_JOINTS) and the joined words.
    - A 儿 ending of a longer word joins the rest, which these rules place.
    - 第 with a number takes a hyphen (第十 "dì-shí"), and so does an approximate number (一两
      "yì-liǎng").
    - Any other word is one joined word, so 英国 gives [""] ("yīngguó").
    """
    if word in fixed:
        return list(fixed[word])
    if len(word) > 2 and word.endswith("儿"):
        return word_joints(word[:-1], fixed) + [""]
    if len(word) > 1 and word[0] == "第" and all(ch in NUMERALS or ch == "几" for ch in word[1:]):
        return ["-"] + [""] * (len(word) - 2)
    if approximate(word):
        return ["-"]
    return [""] * (len(word) - 1)


def head_positions(sentence, hz):
    """Indexes of the sentence characters that belong to the headword (each part, first match, in order)."""
    out, start = [], 0
    for part in (p for p in hz.split("…") if p):
        at = sentence.find(part, start)
        if at < 0:
            return []
        out += range(at, at + len(part))
        start = at + len(part)
    return out


def regroup(sentence, words, hz, cut=None, known=()):
    """The segmenter's words, changed so each part of the headword is one word and a lone 儿 joins the word before it.

    The places where jieba cut the sentence are kept, except that each headword part starts and
    ends a word and nothing cuts through it. So 都市里 cut as 都 + 市里 gives 都市 + 里 for the
    headword 都市, and the headword's pinyin is spaced as on its card. A piece left over from a
    word that the headword cut through is cut again with cut(piece) (jieba in step 8), so jieba's
    勇敢的人 gives 勇敢 + 的 + 人 for the headword 勇敢, and 耸了耸肩 gives 耸 + 了 + 耸肩 for 耸.
    A word of `known` (the card headwords and the public list's words) that holds the whole
    headword part is not cut, and the sentence is written as it is for any other headword. So
    男人 stays "nánrén" for the card 男, 春天 "chūntiān" for 春, and 下雨 "xià yǔ" for 雨, with the
    space its card shows. Then a 儿 that jieba left as its own word joins the word before it
    (小摊 + 儿 gives 小摊儿), so it is read and checked as the 儿 ending.
    """
    cuts, spans, pos = {0, len(sentence)}, set(), 0
    for word in words:
        spans.add((pos, pos + len(word)))
        pos += len(word)
        cuts.add(pos)
    start = 0
    for part in (p for p in hz.split("…") if p):
        at = sentence.find(part, start)
        if at < 0:
            break
        start = at + len(part)
        if any(a <= at and start <= b and sentence[a:b] in known for a, b in spans):
            continue
        cuts = {c for c in cuts if not at < c < start} | {at, start}
        spans.add((at, start))
    points = sorted(cuts)
    out = []
    for a, b in zip(points, points[1:]):
        for word in (cut(sentence[a:b]) if cut and (a, b) not in spans else [sentence[a:b]]):
            if word == "儿" and out and _HANZI.search(out[-1][-1]):
                out[-1] += word
            else:
                out.append(word)
    return out


def syllables(sentence, words, lookup, hz, head_nums, fixes=None):
    """One numbered syllable per sentence character (None for non-Chinese characters).

    words: the segmenter's words, which together spell the sentence. lookup(word) gives one
    numbered syllable per Chinese character of the word. The headword's characters get
    head_nums (the syllables its card shows). fixes: {index: syllable} from the polyphone check
    and potential_readings, applied last. Then 一 and 不 change tone, except that a 一 that ends a
    word of two or more characters keeps its tone (统一 in 统一中国), and so do a 一 after 星期 or 礼拜
    (星期 + 一 + 下午 "xīngqīyī xiàwǔ", when the headword 星期 cuts 星期一) and a 一 of a decimal
    number (decimal_digits, "sān diǎn yī sì"). Every syllable of the headword but its last keeps the
    tone its card shows, so 不得了 stays "bùdéliǎo" in 开心得不得了,
    where 得不得 looks like a doubled verb.
    """
    out = [None] * len(sentence)
    keep, pos, decimal = set(), 0, decimal_digits(words)
    for n, word in enumerate(words):
        found = iter(lookup(word)) if _HANZI.search(word) else iter(())
        for k, ch in enumerate(word):
            if _HANZI.match(ch):
                out[pos + k] = next(found)
            if ch == "一" and n in decimal:
                keep.add(pos + k)
        if (len(word) > 1 and word.endswith("一")) or (word == "一" and n and words[n - 1] in ("星期", "礼拜")):
            keep.add(pos + len(word) - 1)
        pos += len(word)
    head, lasts, end = head_positions(sentence, hz), set(), 0
    for part in (p for p in hz.split("…") if p and head):
        end += len(part)
        lasts.add(head[end - 1])
    for i, syl in zip(head, head_nums):
        out[i] = syl
    for i, syl in (fixes or {}).items():
        out[i] = syl
    idx = [i for i, s in enumerate(out) if s]
    changed = tone_change([sentence[i] for i in idx], [out[i] for i in idx],
                          keep={n for n, i in enumerate(idx) if i in keep})
    for i, syl in zip(idx, changed):
        out[i] = syl
    for i, syl in zip(head, head_nums):
        if i not in lasts:
            out[i] = syl
    return out


def render(sentence, words, sylls, capital_positions=(), joints_of=None, attach=()):
    """Write the sentence pinyin, with the syllables of one word together, words apart and punctuation attached.

    capital_positions: sentence indexes where a word written with a capital starts (names such as
    北京, and the surname and given name of a person). Each part of such a word between spaces gets
    a capital, as on the cards, so 黄河 with the card joints [" "] gives "Huáng Hé".
    joints_of(word): the word's joints (word_joints in the build script); without it, or when
    the joints do not fit the word, all its syllables are joined.
    attach: sentence indexes where a word starts that joins the word before it (attached), so
    他指着前面 gives "tā zhǐzhe qiánmiàn".
    The first letter of the sentence, of each sentence after . ! or ?, and of a quotation that
    follows a colon is capitalised ('Tā shuō: "Nǐ kàn."'). The Chinese dash, two long dashes that jieba
    may cut into two marks, is written as one "-". A percent sign stays with the digits before it, as
    in the sentence ("70%", which jieba cuts into 70 and %).
    """
    pieces, pos = [], 0
    for word in words:
        if _HANZI.search(word):
            nums = [sylls[pos + k] for k, ch in enumerate(word) if sylls[pos + k]]
            joints = joints_of(word) if joints_of else None
            text = card_py(nums, joints if joints is not None and len(joints) == len(nums) - 1 else None)
            if pos in capital_positions:
                text = " ".join(part[:1].upper() + part[1:] for part in text.split(" "))
            if pos in attach and pieces and pieces[-1][0] == "word":
                pieces[-1] = ("word", pieces[-1][1] + ("'" if text[:1] in "aāáǎàoōóǒòeēéěè" else "") + text)
            else:
                pieces.append(("word", text))
        elif word.strip() in _CLOSE:
            pieces.append(("close", _CLOSE[word.strip()]))
        elif word.strip() in _OPEN:
            pieces.append(("open", _OPEN[word.strip()]))
        elif word.strip() in _DASH:
            if not pieces or pieces[-1] != ("dash", "-"):
                pieces.append(("dash", _DASH[word.strip()]))
        elif word.strip() == "%" and pieces and pieces[-1][0] == "word" and pieces[-1][1][-1:].isdigit():
            pieces[-1] = ("word", pieces[-1][1] + "%")
        elif word.strip():
            pieces.append(("word", word.strip()))
        pos += len(word)
    out = ""
    for kind, text in pieces:
        if kind == "close" or out.endswith(("(", ' "')) or out == '"':
            out += text
        else:
            out += (" " if out else "") + text
    return re.sub(r'(^|[.!?]"?\s+|:\s+")("?\(?)([a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü])',
                  lambda m: m.group(1) + m.group(2) + m.group(3).upper(), out)


def name_words(sentence, words, names):
    """The words with each name of several words divided into its words, and where capitals start.

    names: {hz: (words, capitals)} from data/manual/capitals (Plan 3a pinyin_text.name_rows).
    A person's name is written as the textbook rules write it, with the surname apart from the
    given name and a title apart in lower case. So with the row 李老师 (李 老师, Y N), the words
    ["喂", "，", "李老师", "在", "吗", "？"] give ["喂", "，", "李", "老师", "在", "吗", "？"] and the
    capital positions {2}, which render writes "Wèi, Lǐ lǎoshī zài ma?". A name is found wherever
    the words start and end at its words, even when the segmenter already cut it (李 + 老师).
    """
    out = []
    for word in words:
        out += names[word][0] if word in names else [word]
    starts, pos = set(), 0
    for word in out:
        starts.add(pos)
        pos += len(word)
    starts.add(pos)
    capitals = set()
    for hz, (parts, flags) in names.items():
        at = sentence.find(hz)
        while at >= 0:
            offsets = [at + sum(len(p) for p in parts[:k]) for k in range(len(parts) + 1)]
            if all(o in starts for o in offsets):
                capitals |= {o for o, flag in zip(offsets, flags) if flag}
            at = sentence.find(hz, at + 1)
    return out, capitals


def spot_checks(sentence, words, sylls, hz, readings_of, settled, word_readings):
    """Characters to check by hand.

    readings_of(char) gives every numbered reading of a character. settled: the words of two or
    more characters whose reading is certain, which are card headwords with one card and words
    of the public list with one reading (make_lookup in step 8 reads them so). word_readings:
    {word: [numbered readings]} for the other public-list words of two or more characters, which
    have several readings. A character that is not part of the headword is listed when:
    - its word has several readings that differ at this character (来 in 出来, read lai2 or lai5,
      and 着 in 穿着, whose one reading in the list, chuan1 zhuo2, differs from pypinyin's chuan1 zhe5);
    - it is a word of its own, is not in SAFE_ALONE and has several readings (长 in 一个人长大了);
    - its word has two or more characters and neither list has it, unless it is 一, whose tone the
      tone-change rule sets. The characters of SAFE_ALONE are checked there too, because they may
      have another reading inside a word (着 in 睡着 is zháo). pypinyin may have read such a word
      character by character (缝 in jieba's 缝到), and it may have missed a neutral tone, so the
      neutral tone is an option at every character but the first.
    A 儿 that ends a longer word but was not read as the 儿 ending "r5" is also checked (女儿 is
    right as er2, 哪儿 is not).
    Returns [(index, char, chosen syllable, "a/b/c")].
    """
    head = set(head_positions(sentence, hz))
    out, pos = [], 0
    for word in words:
        last = pos + len(word) - 1
        if _WORD.match(word) and word not in settled:
            several = [r.split() for r in word_readings.get(word, [])]
            for k, ch in enumerate(word):
                given = sylls[pos + k]
                if pos + k in head or (k and k == len(word) - 1 and ch == "儿"):
                    continue
                if several:
                    options = [given] + [r[k] for r in several]
                elif ch in SAFE_ALONE and (len(word) == 1 or ch == "一"):
                    continue
                elif len(word) == 1:
                    options = readings_of(ch)
                else:
                    options = [given] + readings_of(ch) + ([given[:-1] + "5"] if k else [])
                if len(set(options)) > 1:
                    out.append((pos + k, ch, given, "/".join(dict.fromkeys([given] + options))))
        if len(word) > 1 and word.endswith("儿") and last not in head and sylls[last] != "r5":
            out.append((last, "儿", sylls[last], "er2/r5"))
        pos += len(word)
    return out


def check_polyphone_answers(inputs, outputs):
    """Match the checker's answers to the spot-check rows by (id, index).

    Each row needs verdict OK or FIX. A FIX needs a numbered syllable such as "zhang3", and an OK
    keeps the given syllable. Returns (problems, [(id, index, char, syllable)]).
    """
    want = {(r["id"], r["index"]): r for r in inputs}
    problems, rows, seen = [], [], {}
    for r in outputs:
        key = ((r.get("id") or "").strip(), (r.get("index") or "").strip())
        seen[key] = seen.get(key, 0) + 1
        if key not in want:
            problems.append(f"{key[0]} at {key[1]}: not in the input")
            continue
        given = want[key]
        verdict = (r.get("verdict") or "").strip()
        syllable = (r.get("syllable") or "").strip().lower()
        if (r.get("char") or "").strip() != given["char"]:
            problems.append(f"{key[0]} at {key[1]}: char differs from the input")
        elif verdict == "OK":
            rows.append((key[0], int(key[1]), given["char"], given["given"]))
        elif verdict == "FIX" and SYLLABLE.match(syllable):
            rows.append((key[0], int(key[1]), given["char"], syllable))
        else:
            problems.append(f"{key[0]} at {key[1]}: verdict {verdict!r} with syllable {syllable!r}")
    problems += [f"{k[0]} at {k[1]}: answered {n} times" for k, n in seen.items() if n > 1 and k in want]
    problems += [f"{k[0]} at {k[1]}: missing" for k in want if k not in seen]
    return problems, rows
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `python -m pytest tests/test_sentpinyin.py -q`
Expected: `31 passed`

- [ ] **Step 7: Commit**

```bash
git add tools/requirements.txt tools/sentpinyin.py tests/test_sentpinyin.py && git commit -F - <<'EOF'
feat: sentence pinyin with card and public-list readings, tone changes, numbers, names, particles and card word spacing

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 11: Sentence pinyin for every card (`tools/08_pinyin.py`)

**Files:**
- Create: `tools/08_pinyin.py`
- Input: `data/manual/four_char_words_vNNN.csv` (Plan 3a Task 7) and `data/manual/capitals_vNNN.csv` (Plan 3a Task 6), besides the sentences, the word list and the public list
- Output: `data/build/sentence_pinyin_vNNN.jsonl`, `data/build/polyphone_batches_vNNN/`, `data/reports/pinyin_vNNN.txt`, and while four-character sentence words need a form, `data/build/four_char_batches_vNNN/`, then `data/claude/four_char_vNNN/` and a new `data/manual/four_char_words_vNNN.csv`

Step 8 writes the draft of the sentence pinyin, which Task 14 corrects against the pinyin style sheet. Every card word is added to jieba's dictionary, so the headword and other HSK words stay whole, and jieba cuts with its dictionary only (`segment`, Task 10). `regroup` makes sure the headword is one word, unless a card word or a public-list word holds it, and then that word stays whole. `split_words` (Task 10) then splits words that neither list has, using every card headword and public-list word as the known words and their parts of speech. 这个, 那个 and 哪个 count as known words too, read as point 1 of the style sheet writes them ("zhège"), except in the sentence of the card 个, whose "gè" must show ("zhè gè").
- **Readings.** `make_lookup` (Task 10) reads a word that is a card headword with exactly one card with the syllables its card shows (Plan 3a `syllables_of_py`), so 喜欢 is xǐhuan, not pypinyin's xǐhuān, and 受不了 keeps the neutral bu of "shòubuliǎo". A public-list word with one reading is read as the list gives it, so 下来 is xiàlai. Other words take pypinyin's reading. A word that ends in 儿 and is a known 儿-ending word (哪儿, 一点儿 and every card whose reading ends in `r5`), or that pypinyin reads with a neutral `er5`, gets the ending `r5`. `potential_readings` gives a potential complement its neutral bu and its 着 zháo (point 5 of the pinyin style sheet).
- **Capitals and names.** A card word takes the capital of its card. Any other word takes capitals only as `data/manual/capitals` gives them, and step 8 stops when the public list writes a word with a capital but the file has no row for it. A row with several words divides a person's name (`name_words`), and every name of the file is added to jieba's dictionary so it stays one word. jieba's name tags are not used for capitals, because jieba gives them to many ordinary words (东西, 城市, 哥哥). The report lists jieba's words, taken before any split, that it tags as names and that neither list has (西班牙, 天安门), and every surname followed by a title (李老师, 张先生), for review in Step 3.
- **Spacing.** The words are spaced with `word_joints` (Task 10). It needs each card's joints, read back from its `py` with Plan 3a `joints_of_py`, and the joints of the four-character words kept whole, which are the words whose form in `data/manual/four_char_words` is idiom or joined. A word with the form words is split into its words by `split_words`. When a four-character sentence word that is not a card has no form, CC-CEDICT idioms included, step 8 writes batch files for the form agents, with CC-CEDICT's idiom mark as a hint, and stops (Step 2). `attached` (Task 10) says which particles and suffixes join the word before them.
- **The check list.** `make_readings_of` takes a character's readings from the public list when it has the character, because pypinyin also knows rare old readings (他 tuó, 是 tí). 〇, the zero of years, has only líng, although pypinyin also gives yuán and xīng, so it does not go on the list. `spot_checks` (Task 10) says which characters go on the list.

- [ ] **Step 1: Write `tools/08_pinyin.py`**

```python
"""Step 8. Pinyin for every example sentence, and the list of characters to check by hand.

Inputs:  data/build/sentences_final_vNNN.jsonl, data/build/wordlist_vNNN.jsonl,
         data/public/hsk_complete_vNNN.json, data/manual/four_char_words_vNNN.csv and
         data/manual/capitals_vNNN.csv (latest), and data/claude/pinyin_fixes_vNNN.csv (latest)
         once the polyphone check has run
Outputs: data/build/sentence_pinyin_vNNN.jsonl  {id, sentence, py}, where sentence is the text the pinyin was
                         made from, so step 10 can tell when the final sentences changed afterwards
         data/build/polyphone_batches_vNNN/batch_001.csv ...  characters not yet checked, 200 rows each
                         (id, index, char, given, options, sentence, word); the folder is empty when all are checked
         data/reports/pinyin_vNNN.txt
Nothing is written while a sentence word needs a row that data/manual/capitals does not have.
When four-character sentence words still need a form, only the batch files for the form agents
(Plan 3a Task 7) are written, to data/build/four_char_batches_vNNN/.
"""
import logging
import re
import sys
from collections import Counter, defaultdict

import jieba
from pypinyin import Style, lazy_pinyin, pinyin

from common import (all_version_paths, latest_version_path, next_version_path, next_versions, read_csv, read_json,
                    read_jsonl, write_new_csv, write_new_jsonl, write_new_text)
from meaning import public_pos
from pinyin_text import (FORM_BATCH, FORM_BATCH_COLUMNS, form_joints, form_rows, joints_of_py, name_rows,
                         syllables_of_py)
from sentpinyin import (POINTING_WORDS, SYLLABLE, attached, make_lookup, name_words, potential_readings,
                        public_word_readings, regroup, render, segment, spot_checks, split_words, syllables,
                        word_joints)
from themes import chunks
from wordlist import public_readings

CHECK_BATCH = 200
NAME_TAGS = {"nr", "ns", "nt", "nrt", "nrfg"}  # jieba's tags for names of people, places and organisations
# Words that stand after a surname as a title ("Lǐ lǎoshī", "Wáng xiānsheng"), and before one ("Xiǎo Wáng").
TITLES = {"老师", "先生", "小姐", "女士", "太太", "夫人", "医生", "大夫", "教授", "博士", "经理", "校长", "师傅",
          "阿姨", "叔叔", "主任", "总"}
ERHUA = {"这儿", "那儿", "哪儿", "一点儿", "一会儿", "有点儿", "一块儿", "玩儿", "好玩儿"}
OPTIONS = dict(style=Style.TONE3, neutral_tone_with_five=True, v_to_u=True)
_HANZI = re.compile(r"[\u3007\u4e00-\u9fff]")  # Chinese characters, with the 〇 of years (二〇〇八年)


def make_readings_of(listed):
    """readings_of(char) gives the numbered readings of a character, for the spot-check list.

    listed: Plan 3a public_readings of the public list. Its lower-case readings of the character
    are used when it has any, so 他 has only ta1. pypinyin also knows rare old readings (他 tuo2,
    是 ti2) that would put nearly every 他 and 是 on the list. A character the list lacks takes
    pypinyin's readings, except 〇, the zero of years, which is only ling2 (pypinyin also gives
    yuan2 and xing1).
    """
    def readings_of(ch):
        if ch == "〇":
            return ["ling2"]
        found = [r["num"] for r in listed.get(ch, []) if r["py"][:1].islower()]
        return found or pinyin(ch, heteronym=True, **OPTIONS)[0]
    return readings_of


def load_fixes():
    found = all_version_paths("data/claude/pinyin_fixes", ".csv")
    fixes = defaultdict(dict)
    for r in (read_csv(found[-1][1]) if found else []):
        fixes[r["id"]][int(r["index"])] = (r["char"], r["syllable"])
    return fixes


def latest_rows(stem):
    found = all_version_paths(stem, ".csv")
    return read_csv(found[-1][1]) if found else []


def main():
    jieba.setLogLevel(logging.WARNING)
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    sentences = read_jsonl(latest_version_path("data/build/sentences_final", ".jsonl"))
    names, problems = name_rows(read_csv(latest_version_path("data/manual/capitals", ".csv")))
    forms, more = form_rows(latest_rows("data/manual/four_char_words"))
    problems += more
    for part in [p for w in words.values() for p in w["hz"].split("…") if p] + list(names):
        jieba.add_word(part)
    cards_of = Counter(w["hz"] for w in words.values())
    complete = read_json(latest_version_path("data/public/hsk_complete", ".json"))
    listed = public_readings(complete)

    def guess(hanzi):
        """pypinyin's reading of a word, one numbered syllable per character."""
        return lazy_pinyin(hanzi, **OPTIONS)

    public_nums, word_readings = public_word_readings(listed, set(cards_of), guess)
    public_nums.update(POINTING_WORDS)  # 这个 "zhège" (point 1 of the style sheet), read like a public-list word
    # A card word is read with the syllables its card shows, so 受不了 keeps the neutral bu of "shòubuliǎo".
    shown = {w["id"]: syllables_of_py(w["py"], w["pyNum"].split()) or w["pyNum"].split() for w in words.values()}
    card_nums = {w["hz"]: " ".join(shown[w["id"]]) for w in words.values()
                 if cards_of[w["hz"]] == 1 and "…" not in w["hz"]}
    lookup = make_lookup(ERHUA | {w["hz"] for w in words.values() if w["key"].endswith("r5")}, card_nums, public_nums,
                         guess)
    settled = {hz for hz in list(card_nums) + list(public_nums) if len(hz) > 1} - set(word_readings)
    idioms = {x["simplified"] for x in complete if any("(idiom)" in m for f in x["forms"] for m in f["meanings"])}
    card_joints = {w["hz"]: joints_of_py(w["py"], w["pyNum"].split()) for w in words.values() if "…" not in w["hz"]}
    known = set(card_joints) | {x["simplified"] for x in complete}
    pos_of = {x["simplified"]: public_pos(x.get("pos", [])) for x in complete}
    for w in words.values():
        pos_of[w["hz"]] = list(dict.fromkeys(pos_of.get(w["hz"], []) + w["pos"]))
    # Four-character words kept whole take their form's joints. Every such word needs a row in
    # data/manual/four_char_words, a CC-CEDICT idiom too, whose mark is only a hint to the form agents.
    fixed = {hz: form_joints(form, parts) for hz, (form, parts) in forms.items() if form != "words"}
    fixed.update(card_joints)
    # A card headword takes the capital of its card. Any other word takes the capitals that
    # data/manual/capitals gives it, and a word that every reading in the public list writes with a
    # capital (美元 "Měiyuán") must have a row there. jieba's name tags are only listed in the report.
    public_capital = {x["simplified"] for x in complete
                      if all(f["transcriptions"]["pinyin"][:1].isupper() for f in x["forms"])}
    card_capital = {}
    for w in words.values():
        card_capital[w["hz"]] = card_capital.get(w["hz"], False) or w["py"][:1].isupper()

    def joints_of(word):
        return word_joints(word, fixed)

    readings_of = make_readings_of(listed)
    fixes = load_fixes()
    rows, checks, stale, uncapped, name_count = [], [], 0, Counter(), Counter()
    undecided = {}
    for s in sentences:
        w, text = words[s["id"]], s["sentence"]
        pairs = segment(text)
        tagged = {word for word, tag in pairs if tag in NAME_TAGS}
        titled = {a + b for (a, a_tag), (b, b_tag) in zip(pairs, pairs[1:])
                  if (a_tag in NAME_TAGS and len(a) == 1 and b in TITLES)
                  or (a in ("小", "老") and b_tag in NAME_TAGS and len(b) == 1)}
        titled |= {word for word, tag in pairs if tag in NAME_TAGS and word[1:] in TITLES}

        def cut(piece):
            """jieba's words for a piece that the headword cut from a longer word, whose name tags count too."""
            found = segment(piece)
            tagged.update(word for word, tag in found if tag in NAME_TAGS)
            return [word for word, _ in found]

        # Point 1 of the style sheet: 这个, 那个 and 哪个 are one word each ("zhège"), except in the
        # sentence of the card 个, whose "gè" must show as on its card ("zhè gè").
        known_here = known if w["hz"] == "个" else known | set(POINTING_WORDS)
        grouped = regroup(text, [word for word, _ in pairs], w["hz"], cut, known_here)
        keep = [p for p in w["hz"].split("…") if p] + list(names)
        tokens = split_words(grouped, known_here, pos_of, keep=keep, forms=forms, cards=card_joints)
        tokens, caps = name_words(text, tokens, {hz: v for hz, v in names.items() if hz not in card_capital})
        for t in grouped + tokens:
            stem = t[:-1] if len(t) > 2 and t.endswith("儿") else t
            if len(stem) == 4 and _HANZI.match(stem) and stem not in card_joints and stem not in forms \
                    and stem not in undecided:
                mark = "idiom" if stem in idioms else ""
                undecided[stem] = [stem, " ".join(lookup(stem)), "", "sentence", text, mark]
        for t in tokens:
            if t in public_capital and t not in card_capital and t not in names:
                uncapped[t] += 1
        for t in sorted({t for t in grouped if t in tagged and t not in known} | titled):
            if t not in names:
                name_count[t] += 1
        mine = {}
        for i, (ch, syl) in fixes.get(s["id"], {}).items():
            if i < len(text) and text[i] == ch:
                mine[i] = syl
            else:
                stale += 1
        sylls = syllables(text, tokens, lookup, w["hz"], shown[w["id"]], {**potential_readings(tokens, pos_of), **mine})
        bad = [x for x in sylls if x is not None and not SYLLABLE.match(x)]
        if bad or "".join(tokens) != text:
            problems.append(f"{s['id']} {text}: unusable pinyin {bad}")
            continue
        pos = 0
        for t in tokens:
            if card_capital.get(t):
                caps.add(pos)
            pos += len(t)
        rows.append({"id": s["id"], "sentence": text,
                     "py": render(text, tokens, sylls, caps, joints_of, attached(tokens, pos_of))})
        checks += [[s["id"], i, ch, given, options, text, w["hz"]]
                   for i, ch, given, options in spot_checks(text, tokens, sylls, w["hz"], readings_of, settled,
                                                            word_readings)
                   if i not in mine]
    problems += [f"{hz} (in {n} sentences): the public list writes it with a capital; add a row to "
                 "data/manual/capitals" for hz, n in sorted(uncapped.items())]
    if problems:
        sys.exit("Stopped, nothing written:\n  " + "\n  ".join(problems[:40]))
    if undecided:
        folder = next_version_path("data/build/four_char_batches", "")
        folder.mkdir()
        batch = list(undecided.values())
        for n in range(0, len(batch), FORM_BATCH):
            write_new_csv(folder / f"batch_{n // FORM_BATCH + 1:03d}.csv", FORM_BATCH_COLUMNS, batch[n:n + FORM_BATCH])
        sys.exit(f"Stopped before writing the pinyin: {len(batch)} four-character sentence words need a form. "
                 f"Batch files for the form agents are in {folder}.")
    paths = next_versions(rows=("data/build/sentence_pinyin", ".jsonl"), check=("data/build/polyphone_batches", ""),
                          report=("data/reports/pinyin", ".txt"))
    write_new_jsonl(paths["rows"], rows)
    paths["check"].mkdir()
    for n, part in enumerate(chunks(checks, CHECK_BATCH), start=1):
        write_new_csv(paths["check"] / f"batch_{n:03d}.csv",
                      ["id", "index", "char", "given", "options", "sentence", "word"], part)
    applied = sum(len(v) for v in fixes.values()) - stale
    lines = ["Pinyin report", "", f"Sentences: {len(rows)}. Fixes applied: {applied}. Fixes that no longer fit: {stale}.",
             f"Characters still to check: {len(checks)} in {-(-len(checks) // CHECK_BATCH)} batches in {paths['check']}",
             "", "Examples:"] + [f"  {r['id']} {r['py']}" for r in rows[:10]]
    names_note = ["", "Words that jieba tags as names, or a surname with a title, that neither list nor",
                  "data/manual/capitals has, so they are in lower case. For each real name of a person, place or",
                  "organisation, add a row to a new data/manual/capitals file (Task 11 Step 3 says how):",
                  "  " + (" ".join(f"{hz} {n}" for hz, n in name_count.most_common()) or "none")]
    write_new_text(paths["report"], "\n".join(lines + names_note) + "\n")
    print("\n".join(lines))
    print(f"Name candidates that neither list nor data/manual/capitals has: {len(name_count)}, "
          f"listed in {paths['report']}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it, and give the four-character sentence words their forms**

Run: `PYTHONIOENCODING=utf-8 python tools/08_pinyin.py`
Expected on the first run, which stops before writing the pinyin:
```
Stopped before writing the pinyin: N four-character sentence words need a form. Batch files for the form agents are in data\build\four_char_batches_v002.
```
On the prototype run with the 4,051 PDF sentences N was 281 (3 batch files), so expect somewhat more with the 992 new sentences. Each row has the word, its pypinyin reading, one sentence that holds it and CC-CEDICT's idiom mark.

Then:
1. Run the form agents of Plan 3a Task 7 Step 4 on the new batch folder, with the same instructions word for word and the same workflow rules. Their answers go to `data/claude/four_char_v002/`.
2. Run: `PYTHONIOENCODING=utf-8 python tools/05b_four_char_merge.py`
   Expected: `N words answered: I idiom, W words, J joined. M rows in data\manual\four_char_words_v002.csv.`, where M is N plus the card rows of `four_char_words_v001.csv`. The prototype's stand-in answers gave 36 idiom, 244 words and 1 joined, and 401 rows.
3. Run `PYTHONIOENCODING=utf-8 python tools/08_pinyin.py` again.

Expected: `Sentences: 5043. Fixes applied: 0. Fixes that no longer fit: 0.`, then the number of characters still to check, 10 example pinyin lines, and a line that counts the name candidates. On the prototype run with the 4,051 PDF sentences the examples were:
```
  w0001 Zhè shì wǒ de shū.
  w0002 Zuótiān xià yǔ le.
  w0003 Wǒ shì yí gè xuésheng.
  w0004 Tā bú shì xuésheng.
  w0005 Nǐ rènshi zhège rén ma?
  w0006 Shū zài zhuōzi shàng.
  w0007 Wǒ bú shì xuésheng.
  w0008 Wǒ yǒu yí gè nǚ'ér.
  w0009 Tā shì wǒmen de lǎoshī.
  w0010 Wǒ néng zuò zài zhèr ma?
```
A card headword inside a sentence is spaced as on its card, for example `Tā zài dǎ diànhuà ne.` for the card 打电话. With the 4,051 PDF sentences alone and the `capitals_v001.csv` of Plan 3a (no name rows yet), that run listed `Characters still to check: 4401 in 23 batches` and `Name candidates that neither list nor data/manual/capitals has: 120`, so expect somewhat more with the 992 new sentences.

If step 8 stops because a word that the public list writes with a capital has no row, copy the latest `data/manual/capitals_vNNN.csv` to the next version and add the named rows, with `where` set to `sentence`. A capital stays Y, as the public list writes it, unless the user asked for lower case in words of that kind (Plan 3a Open decision 5). Then rerun this step. If a sentence written later brings a new four-character word, the first run stops again with a new batch folder, and points 1 to 3 are repeated for it.

- [ ] **Step 3: Give real names their capitals and their words**

Open the latest `data/reports/pinyin_vNNN.txt`. Its last line lists the name candidates, with how often each occurs. They are the words of jieba's cut, taken before any split, that jieba tags as names but that neither list nor `data/manual/capitals` has, and every surname followed by a title (李老师, 张先生, 小王). There were 120 on the prototype run. Many were real names (英国 9, 美国 5, 李老师 4, 小王 4, 上海 3, 西班牙 2, 日本, 天安门) and the rest were not (令人 12, 小狗 4, 爱慕 2), with a surname standing alone (李 8) in between.

Copy the latest `data/manual/capitals_vNNN.csv` to the next version and add one row `<hz>,<words>,<capital>,sentence` for each real name of a person, place, organisation or event, and none for the other words. The textbook rules write a name this way.
- **A name of one word** has an empty `words` and the capital Y, as in `上海,,Y,sentence` ("Shànghǎi") and `小明,,Y,sentence` ("Xiǎomíng", a given name alone).
- **A person's surname and given name** are two words, each with a capital, as in `李明,李 明,Y,sentence` ("Lǐ Míng") and `王建国,王 建国,Y,sentence` ("Wáng Jiànguó"). 小 or 老 before a surname is written the same way, as in `小王,小 王,Y,sentence` ("Xiǎo Wáng").
- **A title after a surname** is its own word in lower case, as in `李老师,李 老师,Y N,sentence` ("Lǐ lǎoshī") and `王先生,王 先生,Y N,sentence` ("Wáng xiānsheng").
- **A name of several words** takes a capital on each word, as in `第一次世界大战,第一 次 世界 大战,Y,sentence` ("Dì-yī Cì Shìjiè Dàzhàn"), which jieba does not tag, so look for such names in the sentences too.
- **A place name** takes a capital on every word, the word for its kind included, as GB/T 16159-2012 6.2.2.1 writes 河北省 "Héběi Shěng". So `福建省,福建 省,Y,sentence` gives "Fújiàn Shěng". A title after a person's name is the only word of a name written in lower case.

Then rerun Step 2 point 3. The names are then written with their capitals and words ("Wèi, Lǐ lǎoshī zài ma?", "Nǐ kěyǐ zuò chuán qù Shànghǎi.") and are no longer listed. On the prototype run, the 43 rows written for the earlier, shorter list changed 50 sentences and left 82 candidates, among them 西班牙, 日本 and 天安门, which need rows too. If the list says `none`, skip this step.

- [ ] **Step 4: Commit**

```bash
git add tools/08_pinyin.py data/claude/four_char_v* data/manual/four_char_words_v*.csv data/manual/capitals_v*.csv && git commit -F - <<'EOF'
feat: sentence pinyin for every card, sentence-word forms, names and the polyphone check list

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 12: The polyphone check (multi-agent workflow and `tools/08b_polyphone_merge.py`)

**Files:**
- Create (by the agents): `data/claude/polyphone_vNNN/batch_KKK_v001.csv` (NNN is the version of the latest `polyphone_batches` folder)
- Create: `tools/08b_polyphone_merge.py`
- Output: `data/claude/pinyin_fixes_vFFF.csv`

The polyphone check runs on the draft, before the correction of Task 14, so the correcting agents start from checked readings. This loop repeats until step 8 reports no characters left to check:
1. Checker agents answer the latest `polyphone_batches` files.
2. Step 8b turns their answers into a new pinyin fixes file.
3. Step 8 is rerun, which applies the fixes and lists only characters that have no fix row yet.

The rows are single-character words with several readings, the characters of public-list words with several readings (出来, or 穿着, whose list reading differs from pypinyin's), every character of a word that neither list has, and 儿 endings. For a character inside a word the options include the neutral tone, because pypinyin may have missed one.

The polyphone checker instructions (this step's code, one fresh agent per batch file):

------------------------------------------------------------
You check the pinyin of Chinese characters that have more than one reading.

Read the input file {input}. It is a UTF-8 CSV with the columns id, index (the character's position in the sentence, counting from 0), char, given (the reading a program chose, in numbered pinyin), options (the character's possible readings), sentence and word (the flashcard's word).

Write the output file {output} as a UTF-8 CSV with exactly this header line:
id,index,char,verdict,syllable
Write one row per input row, in the input order. Copy id, index and char exactly.

Rules:
1. verdict is OK when given is the reading this character has in this sentence. Then leave syllable empty.
2. verdict is FIX otherwise. Then write the correct reading in syllable in numbered pinyin, which is lower-case letters followed by a tone digit from 1 to 5 (5 for the neutral tone), with ü written as ü, for example zhang3, de5 or lü4.
3. For a 儿 at the end of a word, r5 means the 儿 ending that joins the syllable before it (哪儿 nǎr, 一点儿 yìdiǎnr), and er2 means a full syllable (女儿 nǚ'ér, 婴儿 yīng'ér).
4. Judge the reading in this sentence's context, as a teacher would read it aloud. Ignore the tone changes of 一 and 不, which are handled elsewhere.
5. options helps you but does not limit you. When the right reading is not among them, write it anyway. A syllable in the neutral tone, as in 看看 kàn kan, 下来 xià lai or 东西 dōng xi (things), is written with the tone digit 5.

Do not read, create or change any other file. When you have finished, reply with one line: the number of rows, and the counts of OK and FIX.
------------------------------------------------------------

- [ ] **Step 1: Run one checker agent per file in the latest `data/build/polyphone_batches_vNNN/`**

- [ ] **Step 2: Write `tools/08b_polyphone_merge.py`**

```python
"""Step 8b. Turn the polyphone checker's answers into pinyin fixes.

Inputs:  the latest data/build/polyphone_batches_vNNN/ and the answers in data/claude/polyphone_vNNN/
         (for each batch_KKK.csv the latest batch_KKK_vMMM.csv; columns id, index, char, verdict, syllable),
         and the latest data/claude/pinyin_fixes_vFFF.csv if one exists
Output:  data/claude/pinyin_fixes_vFFF.csv (next version; id, index, char, syllable) holding every earlier
         row plus one row per checked character. An OK answer keeps the given syllable, so that
         character counts as checked and is not listed again.
Nothing is written while an answer file is missing or has problems.
"""
import sys
from pathlib import Path

from common import all_version_paths, latest_version_path, next_version_path, read_csv, write_new_csv
from sentpinyin import check_polyphone_answers


def main():
    folder = latest_version_path("data/build/polyphone_batches", "")
    batches = sorted(folder.glob("batch_*.csv"))
    if not batches:
        sys.exit(f"Nothing to merge: {folder} is empty, so every character is checked.")
    answers_dir = Path("data/claude") / folder.name.replace("polyphone_batches", "polyphone")
    problems, new_rows, changed = [], [], 0
    for batch in batches:
        found = all_version_paths(answers_dir / batch.stem, ".csv")
        if not found:
            problems.append(f"{batch.stem}: no answer file")
            continue
        given = read_csv(batch)
        more, rows = check_polyphone_answers(given, read_csv(found[-1][1]))
        problems += [f"{batch.stem}: {p}" for p in more]
        chosen = {(r["id"], int(r["index"])): r["given"] for r in given}
        changed += sum(1 for rid, i, _, syl in rows if chosen[(rid, i)] != syl)
        new_rows += rows
    if problems:
        sys.exit("Stopped, nothing written. Redo these answers:\n  " + "\n  ".join(problems[:40]))
    earlier = all_version_paths("data/claude/pinyin_fixes", ".csv")
    merged = {(r["id"], int(r["index"])): (r["char"], r["syllable"]) for r in
              (read_csv(earlier[-1][1]) if earlier else [])}
    for rid, i, ch, syl in new_rows:
        merged[(rid, i)] = (ch, syl)
    path = next_version_path("data/claude/pinyin_fixes", ".csv")
    write_new_csv(path, ["id", "index", "char", "syllable"],
                  [[rid, i, ch, syl] for (rid, i), (ch, syl) in sorted(merged.items())])
    print(f"{len(new_rows)} characters checked, {changed} readings changed. {len(merged)} rows in {path}. "
          "Now run tools/08_pinyin.py again.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Merge, then rerun step 8**

Run: `PYTHONIOENCODING=utf-8 python tools/08b_polyphone_merge.py`
Expected: `N characters checked, K readings changed. N rows in data\claude\pinyin_fixes_v001.csv. Now run tools/08_pinyin.py again.`
Run: `PYTHONIOENCODING=utf-8 python tools/08_pinyin.py`
Expected: `Fixes applied: N. Fixes that no longer fit: 0.` and `Characters still to check: 0 in 0 batches ...`. If characters remain, go back to Step 1 with the new batch folder.

- [ ] **Step 4: Commit**

```bash
git add tools/08b_polyphone_merge.py data/claude/polyphone_v* data/claude/pinyin_fixes_v* && git commit -F - <<'EOF'
feat: polyphone check merged into sentence pinyin fixes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 13: The strict pinyin checker (`tools/pinyincheck.py`)

**Files:**
- Create: `tools/pinyincheck.py`
- Test: `tests/test_pinyincheck.py`

The draft of step 8 follows rules, and rules cannot cover every sentence, so in Task 14 Claude agents correct every line against the pinyin style sheet (the section "Pinyin style sheet" of `.claude/plans/words-json-schema.md`). An agent's answer can go wrong too, so this checker reads each corrected line before it is used. It accepts a line only when all of these hold:
- **Alignment.** Every Chinese character lines up with exactly one syllable, in order. A 儿 right after a syllable of the same word may be the 儿 ending, a bare "r" ("nǎr"). 〇, the zero of years (二〇〇八年), counts as a Chinese character, and its only reading is líng.
- **Readings.** Each syllable, with its tone, is a reading its character is known to have. The known readings (`known_readings`) are the public list's readings of the character when the list has it as a word of its own, or else those pypinyin lists for it, which are its heteronyms (the several readings of one character), and every reading that a longer word of the public list or a card gives it. So 行 may be xíng or háng, while 在 may not be "zhài" or "zāi", and 他 may not be "tuó", although pypinyin knows that old reading. A neutral tone that the readings lack counts only inside a word ("xuésheng", but not "Tā zai").
- **Tone changes.** 一 and 不 show their tone changes where a rule settles them (points 6 and 8 of the style sheet, `_tone_change_problems`).
  - 不 is "bú" before a fourth tone and "bù" before the other tones.
  - 一 keeps "yī" in a decimal, where no syllable follows it, and after 第, a numeral, 星期 or 礼拜 ("dì-yī gè", "shíyī gè", "xīngqīyī"). Before 百, 千, 万 or 亿 (一千一百), or at the start of a card or list word (千万一定 "qiānwàn yídìng"), a numeral before it settles nothing.
  - Elsewhere 一 is "yí" before a fourth tone and "yì" before the other tones, and it must show one of them when it counts with the character after it. That is a measure word of the card list or the public list (the label m., such as 个, 斤, 家, 天 and 年), 百, 千, 万, 亿 or 刻, or the second character of a word such as 一起, 一样 or 一直 (`_COUNTED`), so "yí gè", "yì nián", "yìqiān" and "yí kè". Nothing is settled before a word that makes 一 an ordinal or a date (`_ORDINAL_AFTER`: 一号, 一日, 一班, 一年级, 一级, 一期, 一季度, 一楼, 一层), before 点 except in 一点儿 and 一点点 (一点 may be one o'clock), and, for the choice between "yí" and "yì", before a neutral tone. Before any other character the checker accepts "yī" too, because 一 may be an ordinal there (一楼 "yī lóu").
  - A neutral "bu" or "yi" passes only in a doubled word ("kàn yi kàn", "hǎo bu hǎo", "xǐ bu xǐhuan"), in a potential complement after a verb (`sentpinyin.potential`, "zhǎo bu dào") and where a card or a public-list word shows it ("duìbuqǐ", "chàbuduō"). A 一 or 不 inside a card of two or more characters may always show the tone its card shows ("yìqǐ").
  - What the checker needs to know about words comes from `word_facts`, which gives the parts of speech of both lists (as step 8 builds them), every card and list word, the measure words, and the tone that each 一 and 不 has in the cards and in the list words with a neutral bu or yi.
- **One word.** 这个, 那个, 哪个, 这些 and 那些 (point 1), 哪些 (a single entry of the public list, so rule 2 of the style sheet's reference order joins it) and month and weekday names (point 2, "bāyuè", "xīngqīwǔ") are one pinyin word. Only the sentences of the cards 个 and 些 may write 这个 or 这些 apart, because their headword must show its card's "gè" or "xiē".
- **Numbers** (`_number_problems`, point 6). In and around each run of numerals the checker knows the joint that point 6 wants. Inside the run it takes the words of `sentpinyin.number_words`, so 11 to 99 and each group of 百, 千, 万 and 亿 are joined ("shí'èr", "yìqiān wǔbǎi"), the digits of a year stand apart ("èr líng líng bā nián") and an approximate pair takes a hyphen ("yì-liǎng"). 第 takes a hyphen ("dì-shí"). A numeral stands apart from a measure word after it ("sān gè", "yìqiān yuán"), unless a card or list word holds both (一些, 一下, 一点儿). A fraction and the digits after the point of a decimal are written syllable by syllable ("sān fēn zhī yī", "sān diǎn yī sì"). `_settled` leaves open the digits of a date or a festival (五一节 "wǔyījié" in the draft), a doubled word (零零落落) and a doubled measure word (一天天), and the inside of a run that is itself a word of the lists (千万). Joints inside the headword are left to the headword check, so the card 百分之 keeps "bǎifēnzhī". Each stretch of wrong joints gives one message, such as "the number 十二点 is written 'shí'èr diǎn' (point 6 of the style sheet), but the line has 'shí èr diǎn'".
- **A final 了** (`_final_le_problems`, point 3). A 了 read "le" before a punctuation mark, at the end of the line or before a particle such as 吗, 吧 or 呢 is a word of its own ("Zuótiān xià yǔ le."), unless a card or list word ends in it (算了).
- **Digits and Latin letters** stand unchanged ("2012", "IT", "70%").
- **Punctuation** maps one to one. `PUNCTUATION` turns each Chinese mark into its Western mark, and the line must have the same marks in the same order.
- **The headword** shows the syllables, tones and word spacing its card shows. Only a 一 or 不 at its end may show its tone change ("bú shì" for the card 不 "bù"), as the validator allows (Task 18).
- **Capitals** stand only at the start of a sentence, at the start of a quotation after a colon, and on a word of a name that the cards or `data/manual/capitals` write with a capital (`names_of`), which are names of people and places, languages, countries and peoples. A sentence that starts after . ! or ? must have its capital. A name must have its capitals, and may have them, only where the line writes it as a name, meaning its first character starts a pinyin word and its last character ends one or the whole name stands inside one word ("Zhōngguórén"). So in 小李明天来。, with the names 小李 and 李明, "Xiǎo Lǐ míngtiān lái." passes and "Xiǎo Lǐ Míngtiān lái." fails, because 明天 is one word there.

It also checks the form of each syllable. A syllable has at most one tone mark, on the vowel the rules name ("hǎo", not "haǒ"), and an apostrophe stands before a syllable inside a word that starts with a, o or e, and nowhere else. No space may stand before a closing mark such as , . ! or ?.

For example, take the card 打电话 "dǎ diànhuà" and its sentence 他在打电话呢。. The line "Tā zài dǎ diànhuà ne." passes. The line "Tā zài dǎ diànhuà." fails with "the 6 characters 他在打电话呢 do not line up with the 5 syllables of 'Tā zài dǎ diànhuà'", "Tā zhài dǎ diànhuà ne." with "'zhài' is not a reading of 在; its readings are zài", and "Tā zài dǎdiànhuà ne." with "the headword 打电话 must be written 'dǎ diànhuà' as on its card, but the line has 'dǎdiànhuà'". Each message is one plain sentence, because a redo agent receives it with the rejected line.

How a line is read. `line_items` cuts the line into words, digits, joints (a hyphen inside a word, as in "yì-liǎng") and punctuation marks. `segmentations` divides each pinyin word into syllables that pypinyin knows, so "xī'ān" gives xī + ān and "zhèr" gives zhè + r. `check_line` then lines the syllables up with the characters between the same two marks, and where a word can be divided in more than one way, it takes the division whose syllables are readings of their characters.

Outside the headword, the words of points 1 and 2, numbers and a final 了, the checker cannot judge word spacing (whether a result joins its verb, "xiěhǎo", or a 了 after a verb joins it, "kànle"), and it cannot choose between two real readings of one character (长 cháng or zhǎng, or 过 guò and the particle guo in "qùguo"). Task 12 checks the readings of characters with several readings, and in Task 14 an independent checker agent reads a sample of lines against the whole style sheet. The validator (Task 18) takes its names from `names_of` too, so a line that the checker accepts for its capitals also passes the validator's headword check (the card 长 in "Wǒ qùguo Chángchéng.", where the card 长城 is a name).

- [ ] **Step 1: Write the failing test `tests/test_pinyincheck.py`**

```python
from pinyincheck import (check_answer, check_line, known_readings, line_items, match_answers, names_of, segmentations,
                         word_facts)

READ = {"他": {"ta1"}, "在": {"zai4"}, "打": {"da3"}, "电": {"dian4"}, "话": {"hua4"}, "呢": {"ne5", "ni2"},
        "我": {"wo3"}, "不": {"bu4", "bu2", "bu5"}, "是": {"shi4"}, "学": {"xue2"}, "生": {"sheng1"},
        "这": {"zhe4", "zhei4"}, "个": {"ge4"}, "人": {"ren2"}, "哪": {"na3", "nei3"}, "儿": {"er2", "r5"},
        "喂": {"wei4"}, "李": {"li3"}, "老": {"lao3"}, "师": {"shi1"}, "吗": {"ma5"}, "来": {"lai2"}, "自": {"zi4"},
        "山": {"shan1"}, "东": {"dong1"}, "省": {"sheng3", "xing3"}, "说": {"shuo1", "shui4"}, "你": {"ni3"},
        "看": {"kan4"}, "今": {"jin1"}, "天": {"tian1"}, "年": {"nian2"}, "月": {"yue4"}, "日": {"ri4"},
        "她": {"ta1"}, "的": {"de5", "di4"}, "女": {"nü3"}, "去": {"qu4"}, "过": {"guo4", "guo5"}, "几": {"ji3"},
        "十": {"shi2"}, "国": {"guo2"}, "家": {"jia1"}, "有": {"you3"}, "一": {"yi1", "yi2", "yi4", "yi5"},
        "点": {"dian3"}, "钱": {"qian2"}, "工": {"gong1"}, "作": {"zuo4"}, "找": {"zhao3"}, "到": {"dao4"},
        "爱": {"ai4"}, "北": {"bei3"}, "京": {"jing1"}, "它": {"ta1"}, "三": {"san1"}, "四": {"si4"}, "很": {"hen3"},
        "好": {"hao3"}, "虽": {"sui1"}, "然": {"ran2"}, "下": {"xia4"}, "雨": {"yu3"}, "但": {"dan4"},
        "了": {"le5", "liao3"}, "第": {"di4"}, "小": {"xiao3"}, "明": {"ming2"}, "现": {"xian4"}, "八": {"ba1"},
        "九": {"jiu3"}, "星": {"xing1"}, "期": {"qi1"}, "五": {"wu3"}, "斤": {"jin1"}, "千": {"qian1"},
        "元": {"yuan2"}, "次": {"ci4"}, "课": {"ke4"}, "从": {"cong2"}, "开": {"kai1"}, "始": {"shi3"}, "二": {"er4"},
        "分": {"fen1", "fen4"}, "之": {"zhi1"}, "〇": {"ling2"}, "差": {"cha4", "cha1"}, "多": {"duo1"}, "昨": {"zuo2"},
        "两": {"liang3"}, "块": {"kuai4"}, "少": {"shao3"}, "们": {"men5"}, "起": {"qi3"}}
NAMES = {"北京": (["北京"], [True]), "李老师": (["李", "老师"], [True, False]), "山东省": (["山东", "省"], [True, True])}
# What the checks of 一, 不, numbers and 了 know about words: a small public list with its parts of speech
# (q is a measure word), one public-list word with a neutral bu, and one card that shows a tone change.
FACTS = word_facts([{"simplified": hz, "pos": tags} for hz, tags in
                    [("找", ["v"]), ("到", ["v"]), ("去", ["v"]), ("是", ["v"]), ("看", ["v"]), ("个", ["q"]),
                     ("年", ["qt", "n"]), ("斤", ["q"]), ("次", ["qv"]), ("点", ["q", "n"]), ("元", ["q", "n"]),
                     ("课", ["n"]), ("月", ["n"]), ("差不多", ["d"])]],
                   {"差不多": [{"py": "chà bu duō", "num": "cha4 bu5 duo1"}]},
                   [{"hz": "一起", "py": "yìqǐ", "pyNum": "yi1 qi3"}])


def card(hz, py, pynum):
    return {"hz": hz, "py": py, "pyNum": pynum}


CALL = card("打电话", "dǎ diànhuà", "da3 dian4 hua4")


def check(sentence, line, head=CALL, names=NAMES):
    return check_line(sentence, line, head, lambda ch: READ.get(ch, set()), names, FACTS)


def test_lines_that_follow_the_style_sheet_pass():
    good = [("他在打电话呢。", "Tā zài dǎ diànhuà ne.", CALL),
            ("我不是学生。", "Wǒ bú shì xuésheng.", card("不", "bù", "bu4")),
            ("这个人在哪儿？", "Zhège rén zài nǎr?", card("这", "zhè", "zhe4")),
            ("喂，李老师在吗？", "Wèi, Lǐ lǎoshī zài ma?", card("老师", "lǎoshī", "lao3 shi1")),
            ("我来自山东省。", "Wǒ láizì Shāndōng Shěng.", card("省", "shěng", "sheng3")),
            ("他说：“你看。”", 'Tā shuō: "Nǐ kàn."', card("说", "shuō", "shuo1")),
            ("今天是2012年8月9日。", "Jīntiān shì 2012 nián 8 yuè 9 rì.", card("今天", "jīntiān", "jin1 tian1")),
            ("它是三点一四。", "Tā shì sān diǎn yī sì.", card("三", "sān", "san1")),
            ("她是我的女儿。", "Tā shì wǒ de nǚ'ér.", card("女儿", "nǚ'ér", "nü3 er2")),
            ("我去过几十个国家。", "Wǒ qùguo jǐshí gè guójiā.", card("几", "jǐ", "ji3")),
            ("我有一点儿钱。", "Wǒ yǒu yìdiǎnr qián.", card("一点儿", "yìdiǎnr", "yi1 dian3 r5")),
            ("这是IT工作。", "Zhè shì IT gōngzuò.", card("工作", "gōngzuò", "gong1 zuo4")),
            ("他找不到家。", "Tā zhǎo bu dào jiā.", card("找", "zhǎo", "zhao3")),
            ("我爱北京。", "Wǒ ài Běijīng.", card("爱", "ài", "ai4")),
            ("虽然下雨了，但是我去。", "Suīrán xià yǔ le, dànshì wǒ qù.", card("虽然…但是…", "suīrán…dànshì…", "sui1 ran2 dan4 shi4"))]
    assert [check(s, line, head) for s, line, head in good] == [[]] * len(good)


def test_each_character_needs_one_syllable():
    assert check("他在打电话呢。", "Tā zài dǎ diànhuà.") == [
        "the 6 characters 他在打电话呢 do not line up with the 5 syllables of 'Tā zài dǎ diànhuà'"]
    assert check("他在打电话呢。", "Tā zài zài dǎ diànhuà ne.") == [
        "the 6 characters 他在打电话呢 do not line up with the 7 syllables of 'Tā zài zài dǎ diànhuà ne'"]
    assert check("我有一点儿钱。", "Wǒ yǒu yìdiǎn r qián.", card("一点儿", "yìdiǎnr", "yi1 dian3 r5")) == [
        "'r' cannot be divided into pinyin syllables"]


def test_each_syllable_is_a_reading_of_its_character():
    assert check("他在打电话呢。", "Tā zhài dǎ diànhuà ne.") == ["'zhài' is not a reading of 在; its readings are zài"]
    assert check("很好。", "Hěn haǒ.", card("很", "hěn", "hen3")) == [
        "'haǒ' needs one tone mark on the right vowel, or none for the neutral tone"]


def test_tones_count_and_rare_readings_do_not():
    listed = {"他": [{"py": "tā", "num": "ta1"}], "是": [{"py": "shì", "num": "shi4"}],
              "在": [{"py": "zài", "num": "zai4"}], "学生": [{"py": "xué sheng", "num": "xue2 sheng5"}]}
    readings = known_readings(listed, [CALL])
    student = card("学生", "xuésheng", "xue2 sheng5")
    assert check_line("他是学生。", "Tā shì xuésheng.", student, readings, NAMES, FACTS) == []
    # pypinyin also knows 他 tuó and 是 tí, but the public list has only tā and shì.
    assert check_line("他是学生。", "Tuó tí xuésheng.", student, readings, NAMES, FACTS) == [
        "'Tuó' is not a reading of 他; its readings are tā", "'tí' is not a reading of 是; its readings are shì"]
    assert check_line("他在打电话呢。", "Tā zāi dǎ diànhuà ne.", CALL, readings, NAMES, FACTS) == [
        "'zāi' is not a reading of 在; its readings are zài"]
    # A neutral tone counts only inside a word ("xuésheng"), not at the start of one.
    assert check_line("他在打电话呢。", "Tā zai dǎ diànhuà ne.", CALL, readings, NAMES, FACTS) == [
        "'zai' is not a reading of 在 at the start of a word; its readings are zài"]


def test_the_tone_changes_of_yi_and_bu():
    go = card("去", "qù", "qu4")
    assert check("我不去。", "Wǒ bú qù.", go) == []
    assert check("我不去。", "Wǒ bù qù.", go) == ["'bù' (不) comes before the fourth tone of 'qù', so it is written 'bú'"]
    assert check("我不好。", "Wǒ bú hǎo.", card("好", "hǎo", "hao3")) == [
        "'bú' (不) is written 'bú' only before a fourth tone, so write 'bù' here"]
    assert check("我一个人去。", "Wǒ yí gè rén qù.", go) == []
    assert check("我一个人去。", "Wǒ yī gè rén qù.", go) == [
        "'yī' (一) counts with 个 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before the "
        "other tones"]
    assert check("我一个人去。", "Wǒ yì gè rén qù.", go) == [
        "'yì' (一) comes before the fourth tone of 'gè', so it is written 'yí'"]
    assert check("我是第一个。", "Wǒ shì dì-yī gè.", card("是", "shì", "shi4")) == []
    # A decimal is read digit by digit, and its 一 keeps the first tone (style sheet point 6).
    assert check("它是三点一四。", "Tā shì sān diǎn yí sì.", card("三", "sān", "san1")) == [
        "'yí' (一) is a digit of a decimal number, which is read digit by digit, so it keeps its first tone 'yī'"]
    # 一 counts before every measure word of the lists and before 百, 千, 万 and 亿, and it keeps "yī"
    # after 第 or a numeral.
    year = card("年", "nián", "nian2")
    assert check("一年有十二个月。", "Yì nián yǒu shí'èr gè yuè.", year) == []
    assert check("一年有十二个月。", "Yī nián yǒu shí'èr gè yuè.", year) == [
        "'Yī' (一) counts with 年 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before the "
        "other tones"]
    assert check("两块钱一斤。", "Liǎng kuài qián yī jīn.", card("两", "liǎng", "liang3")) == [
        "'yī' (一) counts with 斤 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before the "
        "other tones"]
    assert check("我有一千元。", "Wǒ yǒu yīqiān yuán.", card("千", "qiān", "qian1")) == [
        "'yī' (一) counts with 千 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before the "
        "other tones"]
    assert check("我是第一次去。", "Wǒ shì dì-yí cì qù.", card("第", "dì", "di4")) == [
        "'yí' (一) follows 第, so it is part of a number, an ordinal or a weekday and keeps its first tone 'yī'"]
    assert check("我有十一个。", "Wǒ yǒu shíyí gè.", card("有", "yǒu", "you3")) == [
        "'yí' (一) follows 十, so it is part of a number, an ordinal or a weekday and keeps its first tone 'yī'"]
    # A neutral bu or yi only in a doubled word, a potential complement or a word that shows it.
    assert check("我不去。", "Wǒ bu qù.", go) == [
        "'bu' (不) is in the neutral tone, which the style sheet keeps for a doubled word ('kàn yi kàn', "
        "'hǎo bu hǎo'), a potential complement ('zhǎo bu dào') and the words that a card or the public list "
        "writes so ('duìbuqǐ')"]
    assert len(check("我是一个学生。", "Wǒ shì yi gè xuésheng.", card("是", "shì", "shi4"))) == 1
    assert check("你看一看。", "Nǐ kàn yi kàn.", card("看", "kàn", "kan4")) == []
    assert check("他找不到家。", "Tā zhǎo bu dào jiā.", card("到", "dào", "dao4")) == []
    assert check("差不多两块。", "Chàbuduō liǎng kuài.", card("两", "liǎng", "liang3")) == []
    assert check("我们一起去。", "Wǒmen yìqǐ qù.", go) == []


def test_what_points_1_and_2_write_as_one_word():
    person = card("人", "rén", "ren2")
    assert check("这个人很好。", "Zhège rén hěn hǎo.", person) == []
    assert check("这个人很好。", "Zhè gè rén hěn hǎo.", person) == [
        "这个 is written as one word (point 1 of the style sheet), but the line has 'Zhè gè'"]
    # The card 个 keeps its "gè", so its sentence may write 这个 apart.
    assert check("这个人很好。", "Zhè gè rén hěn hǎo.", card("个", "gè", "ge4")) == []
    now = card("现在", "xiànzài", "xian4 zai4")
    assert check("现在是十月。", "Xiànzài shì shíyuè.", now) == []
    assert check("现在是十月。", "Xiànzài shì shí yuè.", now) == [
        "十月 is written as one word (point 2 of the style sheet), but the line has 'shí yuè'"]
    today = card("今天", "jīntiān", "jin1 tian1")
    assert check("今天是八月九日。", "Jīntiān shì bāyuè jiǔ rì.", today) == []
    assert check("今天星期五。", "Jīntiān xīngqī wǔ.", today) == [
        "星期五 is written as one word (point 2 of the style sheet), but the line has 'xīngqī wǔ'"]


def test_the_headword_is_written_as_on_its_card():
    assert check("他在打电话呢。", "Tā zài dǎ diànhuā ne.") == [
        "'huā' is not a reading of 话; its readings are huà",
        "the headword 打电话 must be written 'dǎ diànhuà' as on its card, but the line has 'dǎ diànhuā'"]
    assert check("他在打电话呢。", "Tā zài dǎdiànhuà ne.") == [
        "the headword 打电话 must be written 'dǎ diànhuà' as on its card, but the line has 'dǎdiànhuà'"]
    # Only a 一 or 不 at the end of the headword may show its tone change.
    assert check("我不是学生。", "Wǒ bú shì xuésheng.", card("学生", "xuésheng", "xue2 sheng5")) == []
    assert check("我不是学生。", "Wǒ bú shì xuéshēng.", card("学生", "xuésheng", "xue2 sheng5")) == [
        "the headword 学生 must be written 'xuésheng' as on its card, but the line has 'xuéshēng'"]
    # The message quotes the line as written, apostrophe included.
    assert check("我在哪儿？", "Wǒ zài nǎ'ér?", card("哪儿", "nǎr", "na3 r5")) == [
        "the headword 哪儿 must be written 'nǎr' as on its card, but the line has 'nǎ'ér'"]


def test_capitals_only_where_the_style_sheet_allows_them():
    assert check("他在打电话呢。", "Tā zài dǎ diànhuà Ne.") == [
        "'Ne' (呢) starts with a capital, but the style sheet allows one only at the start of a sentence or of a "
        "quotation after a colon, and on a name that the cards or data/manual/capitals write with a capital"]
    assert check("他在打电话呢。", "tā zài dǎ diànhuà ne.") == ["'tā' (他) needs a capital, because it starts a sentence"]
    assert check("我爱北京。", "Wǒ ài běijīng.", card("爱", "ài", "ai4")) == [
        "'běijīng' (北京) needs a capital, because it starts the name 北京"]
    assert check("喂，李老师在吗？", "Wèi, Lǐ Lǎoshī zài ma?", card("喂", "wèi", "wei4")) == [
        "'Lǎoshī' (老师) starts with a capital, but the style sheet allows one only at the start of a sentence or of "
        "a quotation after a colon, and on a name that the cards or data/manual/capitals write with a capital"]
    assert check("他在打电话呢。", "Tā zài dǎ diànHuà ne.") == ["'diànHuà' has a capital letter inside the word"]
    # A name needs its capitals only where the line writes it as a name. In 小李明天来 the 明 of the
    # name 李明 starts the word 明天, so 明天 stays in lower case.
    names = {**NAMES, "小李": (["小", "李"], [True, True]), "李明": (["李", "明"], [True, True])}
    come = card("来", "lái", "lai2")
    assert check("小李明天来。", "Xiǎo Lǐ míngtiān lái.", come, names) == []
    assert check("小李明天来。", "Xiǎo Lǐ Míngtiān lái.", come, names) == [
        "'Míngtiān' (明天) starts with a capital, but the style sheet allows one only at the start of a sentence or "
        "of a quotation after a colon, and on a name that the cards or data/manual/capitals write with a capital"]
    assert check("李明在北京。", "Lǐ míng zài Běijīng.", card("在", "zài", "zai4"), names) == [
        "'míng' (明) needs a capital, because it starts the name 李明"]


def test_numbers_are_spaced_as_point_6_says():
    now = card("现在", "xiànzài", "xian4 zai4")
    assert check("现在十二点了。", "Xiànzài shí'èr diǎn le.", now) == []
    assert check("现在十二点了。", "Xiànzài shí èr diǎn le.", now) == [
        "the number 十二点 is written 'shí'èr diǎn' (point 6 of the style sheet), but the line has 'shí èr diǎn'"]
    assert check("我有一千元。", "Wǒ yǒu yì qiān yuán.", card("有", "yǒu", "you3")) == [
        "the number 一千元 is written 'yìqiān yuán' (point 6 of the style sheet), but the line has 'yì qiān yuán'"]
    begin = card("开始", "kāishǐ", "kai1 shi3")
    assert check("从第十课开始。", "Cóng dì-shí kè kāishǐ.", begin) == []
    assert check("从第十课开始。", "Cóng dìshí kè kāishǐ.", begin) == [
        "the number 第十 is written 'dì-shí' (point 6 of the style sheet), but the line has 'dìshí'"]
    assert check("从第十课开始。", "Cóng dì shí kè kāishǐ.", begin) == [
        "the number 第十 is written 'dì-shí' (point 6 of the style sheet), but the line has 'dì shí'"]
    less = card("少", "shǎo", "shao3")
    assert check("少了三分之一。", "Shǎole sān fēn zhī yī.", less) == []
    assert check("少了三分之一。", "Shǎole sānfēnzhīyī.", less) == [
        "the number 三分之一 is written 'sān fēn zhī yī' (point 6 of the style sheet), but the line has 'sānfēnzhīyī'"]
    assert check("我是一个学生。", "Wǒ shì yígè xuésheng.", card("是", "shì", "shi4")) == [
        "the number 一个 is written 'yí gè' (point 6 of the style sheet), but the line has 'yígè'"]
    # The digits of a year are read one by one, 〇 included (GB/T 16159-2012 6.1.5.1).
    go = card("去", "qù", "qu4")
    assert check("二〇〇八年我去北京。", "Èr líng líng bā nián wǒ qù Běijīng.", go) == []
    assert check("二〇〇八年我去北京。", "Èrlínglíngbā nián wǒ qù Běijīng.", go) == [
        "the number 二〇〇八年 is written 'Èr líng líng bā nián' (point 6 of the style sheet), but the line has "
        "'Èrlínglíngbā nián'"]


def test_a_final_le_is_a_word_of_its_own():
    rain = card("了", "le", "le5")
    assert check("昨天下雨了。", "Zuótiān xià yǔ le.", rain) == []
    assert check("昨天下雨了。", "Zuótiān xià yǔle.", rain) == [
        "the 了 that ends a sentence or a clause is a word of its own ('xià yǔ le.', point 3 of the style sheet), "
        "but the line has 'yǔle'"]
    assert check("我去了北京。", "Wǒ qùle Běijīng.", card("去", "qù", "qu4")) == []


def test_the_zero_of_years_is_a_chinese_character():
    # 〇 (U+3007) is not in the main block of Chinese characters, but it lines up with "líng" like one.
    go = card("去", "qù", "qu4")
    assert check("我在二〇〇八年去北京。", "Wǒ zài èr líng líng bā nián qù Běijīng.", go) == []
    assert check("我在二〇〇八年去北京。", "Wǒ zài èr 〇 〇 bā nián qù Běijīng.", go) == [
        "the line holds Chinese characters (〇〇); write only pinyin"]
    assert known_readings({}, [])("〇") == {"ling2"}


def test_punctuation_digits_and_latin_letters_stay_as_they_are():
    assert check("他在打电话呢。", "Tā zài dǎ diànhuà ne") == [
        "the sentence has the punctuation . but the line has none"]
    assert check("他在打电话呢。", "Tā zài dǎ diànhuà ne!") == [
        "the sentence has the punctuation . but the line has !"]
    assert check("他在打电话呢。", "Tā zài dǎ diànhuà ne .") == [
        "a space stands before '.', which is written right after the word before it"]
    today = card("今天", "jīntiān", "jin1 tian1")
    assert check("今天是2012年8月9日。", "Jīntiān shì 2013 nián 8 yuè 9 rì.", today) == [
        "'2013' in the line is not in the sentence",
        "the digits or Latin letters '2012' of the sentence are missing or changed in the line"]
    assert check("这是IT工作。", "Zhè shì It gōngzuò.", card("工作", "gōngzuò", "gong1 zuo4")) == [
        "the digits or Latin letters 'IT' of the sentence are missing or changed in the line"]
    assert check("他在打电话呢。", "Tā zài dǎ diànhuà 呢.") == ["the line holds Chinese characters (呢); write only pinyin"]


def test_apostrophes_and_the_er_ending():
    daughter = card("女儿", "nǚ'ér", "nü3 er2")
    assert check("她是我的女儿。", "Tā shì wǒ de nǚér.", daughter) == [
        "an apostrophe is missing before 'ér' in 'nǚér'"]
    assert segmentations("xī'ān") == [(["xī", "ān"], [])]
    assert segmentations("zhèr") == [(["zhè", "r"], [])]
    assert segmentations("Tiān'ānmén")[0] == (["Tiān", "ān", "mén"], [])
    assert line_items('Tā shuō: "Nǐ kàn." yì-liǎng') == [
        ("word", "Tā", True), ("word", "shuō", True), ("mark", ":", False), ("mark", '"', True), ("word", "Nǐ", False),
        ("word", "kàn", True), ("mark", ".", False), ("mark", '"', False), ("word", "yì", True), ("joint", "-", False),
        ("word", "liǎng", False)]


def test_the_characters_must_stay_as_given():
    given = {"id": "w0001", "sentence": "他在打电话呢。"}
    readings = lambda ch: READ.get(ch, set())
    assert check_answer(given, {"sentence": "他在打电话呢。", "py": "Tā zài dǎ diànhuà ne."}, CALL, readings, NAMES,
                        FACTS) == []
    assert check_answer(given, {"sentence": "她在打电话呢。", "py": "Tā zài dǎ diànhuà ne."}, CALL, readings, NAMES,
                        FACTS) == ["the Chinese sentence was changed at character 1, so copy it exactly as given"]
    assert check_answer(given, {"sentence": "他在打电话呢。", "py": " "}, CALL, readings, NAMES, FACTS) == [
        "the pinyin is empty"]


def test_known_readings_and_names():
    readings = known_readings({"银行": [{"py": "yín háng", "num": "yin2 hang2"}], "他": [{"py": "tā", "num": "ta1"}]},
                              [{"hz": "行", "pyNum": "xing2"}, {"hz": "受不了", "py": "shòubuliǎo", "pyNum": "shou4 bu4 liao3"}])
    assert {"xing2", "hang2"} <= readings("行") and {"er2", "r5"} <= readings("儿")
    # The list's own readings of 他 leave out pypinyin's rare tuo2. A character the list lacks takes pypinyin's.
    assert readings("他") == {"ta1"} and {"shi4", "ti2"} <= readings("是")
    assert readings("一") == {"yi1", "yi2", "yi4", "yi5"} and readings("不") == {"bu4", "bu2", "bu5"}
    cards = [{"hz": "中国", "py": "Zhōngguó"}, {"hz": "正月", "py": "zhēngyuè"}]
    table = {"李老师": (["李", "老师"], [True, False]), "美元": (["美元"], [False])}
    assert names_of(table, cards) == {"李老师": (["李", "老师"], [True, False]), "中国": (["中国"], [True])}
    # word_facts: measure words have the label m. (the public list's q), and 月 is left out because
    # month names are one word. A card shows its tone changes, a public-list word its neutral bu.
    assert {"个", "年", "斤", "次", "点", "元"} <= FACTS["measure"] and "月" not in FACTS["measure"]
    assert {"百", "千", "万", "亿"} <= FACTS["counted"] and "v." in FACTS["pos"]["找"]
    assert FACTS["shown"] == {"一": {("一起", 0, "yi4")}, "不": {("差不多", 1, "bu5")}}


def test_match_answers():
    inputs = [{"id": "w1"}, {"id": "w2"}, {"id": "w3"}]
    outputs = [{"id": "w1", "py": "a"}, {"id": "w2", "py": "b"}, {"id": "w2", "py": "c"}, {"id": "w9", "py": "d"}]
    got, problems = match_answers(inputs, outputs)
    assert list(got) == ["w1"] and problems == ["w9: not in the input", "w2: answered 2 times"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_pinyincheck.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'pinyincheck'`

- [ ] **Step 3: Write `tools/pinyincheck.py`**

```python
"""The strict checker for corrected sentence pinyin (Plan 3b Task 13).

Claude batch agents correct the draft pinyin of each example sentence against the pinyin style
sheet (the section "Pinyin style sheet" of .claude/plans/words-json-schema.md). check_line accepts
a corrected line only when it finds no problem. It checks that:
1. every Chinese character lines up with exactly one pinyin syllable, in order, where a 儿 right
   after a syllable of the same word may be the 儿 ending, a bare "r" ("nǎr");
2. each syllable, with its tone, is a known reading of its character (known_readings, which are the
   public list's readings of the character, or pypinyin's when the list lacks it, and every reading
   that a longer word of the public list or a card gives it). A neutral tone that the readings lack
   counts only inside a word ("dōngxi");
3. digits and Latin letters stand unchanged ("2012", "IT");
4. the punctuation maps one to one, where PUNCTUATION turns each Chinese mark into its Western mark;
5. the headword shows the syllables its card shows, tones included, with the card's word spacing
   between them. Only a 一 or 不 at its end may show its tone change ("bú shì" for the card 不 "bù");
6. capitals stand only where the style sheet allows them, which is at the start of a sentence and
   of a quotation after a colon, and on a word of a name that the cards or data/manual/capitals write
   with a capital (people and places, languages, countries and peoples). Such a name where the line
   writes it as a name (_capital_problems), the start of the line and the start of a sentence after
   . ! or ? must have their capital;
7. 一 and 不 show their tone changes where a rule settles them (style sheet points 6 and 8, see
   _tone_change_problems). That is "bú" and "yí" before a fourth tone, "bù" and "yì" before the
   other tones, "yī" in a decimal and after 第, a numeral, 星期 or 礼拜 ("dì-yī", "shíyī"), a tone
   change for a 一 that counts ("yí gè", "yìqiān"), and a neutral "bu" or "yi" only in a doubled word
   ("kàn yi kàn"), in a potential complement ("zhǎo bu dào") and where a card or the public list
   shows it ("duìbuqǐ");
8. the words that points 1 and 2 of the style sheet write as one word are one pinyin word (这个
   "zhège", 那些 "nàxiē", 八月 "bāyuè", 星期五 "xīngqīwǔ");
9. numbers are spaced as point 6 of the style sheet says (_number_problems), with 11 to 99 and each
   group of 百, 千, 万 and 亿 joined ("shí'èr", "yìqiān wǔbǎi"), 第 with a hyphen ("dì-shí"), a numeral
   apart from its measure word ("sān gè"), and a fraction and the digits of a decimal syllable by
   syllable ("sān fēn zhī yī", "sān diǎn yī sì");
10. a 了 that ends a sentence or a clause is a word of its own ("xià yǔ le.", point 3).
It also checks the form of each syllable, which is at most one tone mark, on the vowel the rules
name, and an apostrophe before a syllable inside a word that starts with a, o or e, and nowhere else,
and that no space stands before a closing mark such as , . ! or ?.
Each problem is one plain sentence, which a redo agent receives with the line.
"""
import re
import unicodedata

from pypinyin import Style, pinyin
from pypinyin.pinyin_dict import pinyin_dict

from meaning import public_pos
from pinyin_text import joints_of_py, num_to_marked, syllable_to_num, syllables_of_py
from sentpinyin import NUMERALS, approximate, decimal_positions, number_words, potential

_HANZI = re.compile(r"[\u3007\u4e00-\u9fff]")  # Chinese characters, with the 〇 of years (二〇〇八年)
_TONE_MARKS = re.compile("[\u0304\u0301\u030c\u0300]")
# Each Chinese punctuation mark and the Western mark it becomes in the pinyin (style sheet point 9).
# The Chinese dash of two long dashes becomes one "-" standing between spaces.
PUNCTUATION = {"，": ",", "。": ".", "！": "!", "？": "?", "：": ":", "；": ";", "、": ",", "“": '"', "”": '"',
               "‘": "'", "’": "'", "（": "(", "）": ")", "《": '"', "》": '"', "……": "...", "…": "...",
               "\u2014\u2014": "-", "\u2014": "-", ",": ",", ".": ".", "!": "!", "?": "?", ":": ":", ";": ";",
               '"': '"', "(": "(", ")": ")"}
_WESTERN = set(",.!?:;\"'()")
_CLOSING = (",", ".", "!", "?", ":", ";", ")", "...")  # marks written right after the word before them
# Digits and Latin letters in a sentence, which the pinyin line keeps as they are ("2012", "IT", "3.14", "50%").
_LITERAL = re.compile(r"[A-Za-z0-9]+(?:[.:,][0-9]+)*%?")
_LINE_TOKEN = re.compile(r"(\s+)|(\.\.\.|…)|([A-Za-z0-9]+(?:[.:,][0-9]+)+%?)|([^\W_]+(?:['’][^\W_]+)*%?)|(-)|(.)",
                         re.S)
# The tones a 一 or 不 at the end of a headword may show, as in the validator (Task 18).
_TONES_OF = {("一", "yi1"): {"yi1", "yi2", "yi4", "yi5"}, ("不", "bu4"): {"bu4", "bu2", "bu5"}}
# The only readings of 一 and 不, which are the dictionary tone and the tones of their tone changes (point 8).
_TONE_CHANGES = {"一": {"yi1", "yi2", "yi4", "yi5"}, "不": {"bu4", "bu2", "bu5"}}
# 〇, the zero of years (二〇〇八年), is read only líng, although pypinyin also knows yuán and xīng.
_ONLY_READINGS = {**_TONE_CHANGES, "〇": {"ling2"}}
# Words after which a 一 counts or starts a word such as 一起, so it shows its tone change unless 第
# or another numeral stands before it (一个 "yí gè", 一千 "yìqiān", 一些 "yìxiē", but 第一个 "dì-yī gè"
# and 十一个 "shíyī gè"). word_facts adds every measure word of the two lists (斤, 家, 天, 年).
_COUNTED = set("百千万亿刻个些下起样直定共切般边种位件本张条只次")
# After 一 these start an ordinal or a date rather than a count, so no rule settles its tone:
# 一号 and 一日 "yī hào", "yī rì" (the first day), 一班 (class one), 一年级 "yī niánjí", 一级, 一期,
# 一季度, 一楼 and 一层 (the first floor).
_ORDINAL_AFTER = ("号", "日", "班", "年级", "级", "期", "季度", "楼", "层")
# Particles after which a 了 still ends its sentence ("Nǐ lái le ma?").
_FINAL_PARTICLES = set("吗吧呢啊呀啦嘛")
# A run of numerals, with 几 as in 十几 and 几十.
_NUMBER_RUN = re.compile("[〇零一二两三四五六七八九十百千万亿几]+")
# What points 1 and 2 of the style sheet write as one word: 这个, 那个, 哪个, 这些, 那些 and 哪些, and month
# and weekday names (八月 "bāyuè", 十二月 "shí'èryuè", 星期五 "xīngqīwǔ"), but not 三个月 or 六月份.
_ONE_WORD = [(1, re.compile(r"[这那哪][个些]")),
             (2, re.compile(r"(?<![〇零一二两三四五六七八九十百千万几第])(?:十[一二]|[一二三四五六七八九十])月(?!份)")),
             (2, re.compile(r"(?:星期|礼拜)[一二三四五六日天](?![次个])"))]


def toneless(syllable):
    """A syllable in lower case without its tone mark, with ü kept, so "Lǜ" gives "lü"."""
    bare = _TONE_MARKS.sub("", unicodedata.normalize("NFD", syllable))
    return unicodedata.normalize("NFC", bare).lower()


# Every toneless syllable pypinyin knows that has a vowel, which is what a pinyin word is divided into.
SYLLABLES = {toneless(s) for value in pinyin_dict.values() for s in value.split(",")}
SYLLABLES = {s for s in SYLLABLES if re.fullmatch(r"[a-zü]+", s) and re.search("[aeiouü]", s)}


def known_readings(listed, cards):
    """readings(ch) gives the set of numbered readings a character is known to have, such as {"ta1"}.

    listed: Plan 3a public_readings of the public list. cards: the card rows, with hz, pyNum and py.
    When the public list has the character as a word of its own, its readings there are used, as
    make_readings_of in step 8 does, because pypinyin also knows rare old readings (他 tuo2, 是 ti2).
    Unlike there, the readings of names count too (蒙 meng3 as in 蒙古). A character that the list
    lacks takes pypinyin's readings (heteronyms). Every syllable that a longer word of the public
    list or a card gives the character counts too, in the tones of pyNum and as the card's py shows
    them, so 行 has xing2 and hang2, 的 has di4 from 目的, and 不 has bu5 from 受不了 "shòubuliǎo".
    儿 also has the 儿 ending r5. 一 and 不 have exactly their dictionary tone and the tones of their
    tone changes (yi1 yi2 yi4 yi5, bu4 bu2 bu5), and 〇 has only ling2.
    """
    extra = {}
    pairs = [(hz, r["num"]) for hz, options in listed.items() if len(hz) > 1 for r in options]
    for w in cards:
        hz, nums = w["hz"].replace("…", ""), w["pyNum"].split()
        pairs.append((hz, w["pyNum"]))
        shown = syllables_of_py(w["py"], nums) if w.get("py") else None
        if shown:
            pairs.append((hz, " ".join(shown)))
    for hz, num in pairs:
        nums = num.split()
        if len(nums) == len(hz):
            for ch, syl in zip(hz, nums):
                extra.setdefault(ch, set()).add(syl.lower())
    cache = {}

    def readings(ch):
        if ch not in cache:
            own = {r["num"] for r in listed.get(ch, []) if len(r["num"].split()) == 1}
            found = own or set(pinyin(ch, style=Style.TONE3, heteronym=True, neutral_tone_with_five=True,
                                      v_to_u=True)[0])
            found = {s for s in found | extra.get(ch, set()) if re.fullmatch(r"[a-zü]*[aeiouü][a-zü]*[1-5]", s)}
            cache[ch] = _ONLY_READINGS.get(ch, found | ({"er2", "r5"} if ch == "儿" else set()))
        return cache[ch]
    return readings


def names_of(name_table, cards):
    """{hz: (words, capitals)} for every name that takes a capital in a sentence.

    name_table: Plan 3a pinyin_text.name_rows of data/manual/capitals. cards: the card rows. A card
    whose py starts with a capital (中国 "Zhōngguó", 北京 "Běijīng") is a name of one word with a capital.
    """
    out = {hz: v for hz, v in name_table.items() if any(v[1])}
    for w in cards:
        if w["py"][:1].isupper() and "…" not in w["hz"] and w["hz"] not in name_table:
            out[w["hz"]] = ([w["hz"]], [True])
    return out


def word_facts(complete, listed, cards):
    """What the checks of 一, 不, numbers and 了 need to know about words, as a dict.

    complete: the public list (hsk_complete, Plan 3a). listed: its public_readings. cards: the card rows.
    - "pos": {word: part-of-speech labels} of the public list and the cards, built as step 8 builds
      it, so sentpinyin.potential tells a potential complement (找不到) from a plain 不 (我不去).
    - "known": every card headword and every word of the public list.
    - "measure": the measure words of one character (the label "m.", as 个, 斤, 天 and 年 have it),
      from which a numeral stands apart ("sān gè rén"), except 月, whose month names are one word.
    - "counted": those measure words and _COUNTED, before which a 一 that counts shows its tone change.
    - "shown": {character: {(word, offset, syllable)}} for each 一 and 不 inside a card of two or
      more characters, with the syllable its py shows (一起 "yìqǐ" gives ("一起", 0, "yi4")), and
      inside a word of the public list whose reading has a neutral bu or yi (差不多 cha4 bu5 duo1
      gives ("差不多", 1, "bu5")). Such a 一 or 不 may show that syllable wherever the word stands.
    """
    pos = {x["simplified"]: public_pos(x.get("pos", [])) for x in complete}
    for w in cards:
        pos[w["hz"]] = list(dict.fromkeys(pos.get(w["hz"], []) + list(w.get("pos", []))))
    known = {w["hz"] for w in cards if "…" not in w["hz"]} | {x["simplified"] for x in complete}
    measure = {word for word, labels in pos.items() if len(word) == 1 and "m." in labels} - {"月"}
    shown = {}
    pairs = [(w["hz"], syllables_of_py(w["py"], w["pyNum"].split())) for w in cards
             if len(w["hz"]) > 1 and "…" not in w["hz"]]
    pairs += [(hz, r["num"].split()) for hz, options in listed.items() if len(hz) > 1 for r in options
              if {"bu5", "yi5"} & set(r["num"].split())]
    for hz, sylls in pairs:
        if sylls and len(sylls) == len(hz):
            for k, (ch, syl) in enumerate(zip(hz, sylls)):
                if ch in _TONE_CHANGES:
                    shown.setdefault(ch, set()).add((hz, k, syl))
    return {"pos": pos, "known": known, "measure": measure, "counted": measure | _COUNTED, "shown": shown}


def head_positions(sentence, hz):
    """Indexes of the sentence characters that belong to the headword (each part, first match, in order)."""
    out, start = [], 0
    for part in (p for p in hz.split("…") if p):
        at = sentence.find(part, start)
        if at < 0:
            return []
        out += range(at, at + len(part))
        start = at + len(part)
    return out


def sentence_units(sentence):
    """The sentence as [(kind, text)]: "han" for a Chinese character, "literal" for digits and Latin
    letters, "mark" for a punctuation mark in its Western form and "other" for anything else. Spaces
    are left out."""
    out, i = [], 0
    while i < len(sentence):
        ch, literal = sentence[i], _LITERAL.match(sentence, i)
        if _HANZI.match(ch):
            out.append(("han", ch))
            i += 1
        elif literal:
            out.append(("literal", literal.group()))
            i = literal.end()
        elif sentence[i:i + 2] in PUNCTUATION:
            out.append(("mark", PUNCTUATION[sentence[i:i + 2]]))
            i += 2
        elif ch in PUNCTUATION:
            out.append(("mark", PUNCTUATION[ch]))
            i += 1
        else:
            if not ch.isspace():
                out.append(("other", ch))
            i += 1
    return out


def line_items(line):
    """The pinyin line as [(kind, text, spaced)], where kind is "word", "literal", "joint" (a hyphen
    inside a word, as in "yì-liǎng"), "mark" or "other", and spaced says whether a space stands before
    it. A word holds letters and apostrophes, and a literal holds digits."""
    tokens, spaced = [], True
    for m in _LINE_TOKEN.finditer(unicodedata.normalize("NFC", line)):
        space, dots, number, word, hyphen, other = m.groups()
        if space:
            spaced = True
            continue
        if dots:
            tokens.append(["mark", "...", spaced])
        elif number or (word and re.search(r"\d", word)):
            tokens.append(["literal", number or word, spaced])
        elif word:
            tokens.append(["word", word.replace("’", "'"), spaced])
        elif hyphen:
            tokens.append(["joint", "-", spaced])
        else:
            tokens.append(["mark" if other in _WESTERN else "other", other, spaced])
        spaced = False
    for k, token in enumerate(tokens):
        if token[0] == "joint":
            inside = 0 < k < len(tokens) - 1 and tokens[k - 1][0] == "word" and tokens[k + 1][0] == "word" \
                and not token[2] and not tokens[k + 1][2]
            if not inside:
                token[0] = "mark"
    return [tuple(t) for t in tokens]


def segmentations(word):
    """The ways to divide one pinyin word (letters and apostrophes) into syllables, as [(syllables, problems)].

    A syllable is one that pypinyin knows (SYLLABLES), or a bare "r" after a syllable, which is the
    儿 ending. When some ways follow the apostrophe rule and put each tone mark in its place, only
    those are returned, with empty problems. Otherwise the ways that break a rule are returned, each
    with what it breaks, for example "an apostrophe is missing before 'ér' in 'nǚér'".
    "nǚ'ér" gives [(["nǚ", "ér"], [])] and "zhèr" gives [(["zhè", "r"], [])].
    """
    text, found = unicodedata.normalize("NFC", word), []

    def walk(i, done, problems):
        if len(found) >= 24:
            return
        if i == len(text):
            found.append((done, problems))
            return
        apostrophe = text[i] == "'"
        start = i + 1 if apostrophe else i
        if apostrophe and not done:
            return
        for end in range(start + 1, min(len(text), start + 6) + 1):
            piece = text[start:end]
            if "'" in piece:
                break
            base = toneless(piece)
            if base == "r" and done and not apostrophe:
                walk(end, done + [piece], problems)
            elif base in SYLLABLES:
                more = list(problems)
                if not _marked_well(piece):
                    more.append(f"'{piece}' needs one tone mark on the right vowel, or none for the neutral tone")
                if done and base[0] in "aoe" and not apostrophe:
                    more.append(f"an apostrophe is missing before '{piece}' in '{word}'")
                if apostrophe and base[0] not in "aoe":
                    more.append(f"an apostrophe stands before '{piece}' in '{word}', but only a syllable "
                                "that starts with a, o or e takes one")
                walk(end, done + [piece], more)

    walk(0, [], [])
    clean = [way for way in found if not way[1]]
    return clean or sorted(found, key=lambda way: len(way[1]))


def _marked_well(syllable):
    """True when a syllable has at most one tone mark, on the vowel the rules name ("hǎo", not "haǒ")."""
    low = unicodedata.normalize("NFC", syllable).lower()
    return low == "r" or num_to_marked(syllable_to_num(low)) == low


def _reading_problem(syl, ch, first, readings_of):
    """Why a syllable is not a known reading of its character, or None (check_line point 2).

    first: whether the syllable starts its pinyin word. A neutral tone that the character's readings
    lack counts only inside a word, where the dictionary writes many ("dōngxi", "xuésheng", "kànkan").
    So for 他 (readings ta1) "Tā" passes, while "Tuó" and "Tà" fail.
    """
    num, known = syllable_to_num(syl), readings_of(ch)
    same_letters = any(k[:-1] == num[:-1] for k in known)
    if num in known or (num.endswith("5") and not first and same_letters):
        return None
    where = " at the start of a word" if num.endswith("5") and same_letters else ""
    return f"'{syl}' is not a reading of {ch}{where}; its readings are " + \
        (", ".join(sorted(num_to_marked(k) for k in known)) or "unknown")


def _shown(text, sylls):
    """The syllables of one pinyin word as the line writes them, with the apostrophe before a syllable kept."""
    out, at = [], 0
    for syl in sylls:
        mark = text[at:at + 1] == "'"
        at += mark
        out.append("'" * mark + text[at:at + len(syl)])
        at += len(syl)
    return out


def _written(cells, span):
    """The pinyin of the sentence characters at the indexes `span`, as the line writes it ("nǎ'ér", "zhè gè")."""
    out = ""
    for k, i in enumerate(span):
        _, joint, _, shown = cells[i]
        out += joint + shown if k else shown.lstrip("'")
    return out


def _align(run, words, readings_of):
    """Line up the Chinese characters of one run with the pinyin words between the same marks.

    run: [(sentence index, character)]. words: [(text, joint, item index)]. Returns (cells, problems),
    where cells holds one (syllable, joint before it, item index, the syllable as written) per
    character, or None when the syllables cannot line up with the characters. The joint is "" inside
    a word, and the syllable as written keeps an apostrophe before it ("'ér" in "nǚ'ér").
    """
    ways = [segmentations(text) for text, _, _ in words]
    bad = [f"'{text}' cannot be divided into pinyin syllables" for (text, _, _), w in zip(words, ways) if not w]
    if bad:
        return None, bad
    best = {(0, 0): (0, [])}
    for wi in range(len(words)):
        for (w, c), (cost, path) in [item for item in best.items() if item[0][0] == wi]:
            for sylls, problems in ways[wi]:
                if c + len(sylls) > len(run):
                    continue
                extra, fits = len(problems), True
                for k, syl in enumerate(sylls):
                    ch = run[c + k][1]
                    if toneless(syl) == "r" and k:
                        fits = fits and ch == "儿"
                    elif _reading_problem(syl, ch, k == 0, readings_of):
                        extra += 1
                key, value = (wi + 1, c + len(sylls)), (cost + extra, path + [(sylls, problems)])
                if fits and (key not in best or value[0] < best[key][0]):
                    best[key] = value
    end = best.get((len(words), len(run)))
    if end is None:
        count = sum(len(w[0][0]) - sum(1 for s in w[0][0][1:] if toneless(s) == "r") for w in ways)
        han = "".join(ch for _, ch in run)
        text = " ".join(t for t, _, _ in words)
        return None, [f"the {len(run)} characters {han} do not line up with the {count} syllables of '{text}'"]
    cells, problems = [], []
    for (sylls, more), (text, joint, item) in zip(end[1], words):
        problems += more
        for k, (syl, shown) in enumerate(zip(sylls, _shown(unicodedata.normalize("NFC", text), sylls))):
            cells.append((syl, joint if k == 0 else "", item, shown))
    for (index, ch), (syl, joint, _, _) in zip(run, cells):
        if toneless(syl) == "r" and ch == "儿":
            continue
        wrong = _reading_problem(syl, ch, bool(joint), readings_of)
        if wrong:
            problems.append(wrong)
    return cells, problems


def check_line(sentence, line, head, readings_of, names, facts):
    """Problems of one corrected pinyin line; an empty list means the line is accepted.

    sentence: the Chinese sentence. line: the corrected pinyin. head: the card, a dict with hz, py
    and pyNum. readings_of: known_readings. names: names_of, {hz: (words, capitals)}. facts: word_facts.
    "他在打电话呢。" with "Tā zài dǎ diànhuà ne." and the card 打电话 "dǎ diànhuà" gives [].
    """
    han = _HANZI.findall(line)
    if han:
        return [f"the line holds Chinese characters ({''.join(han)}); write only pinyin"]
    units, items = sentence_units(sentence), line_items(line)
    problems = [f"the line holds '{text}', which is neither pinyin nor a Western punctuation mark"
                for kind, text, _ in items if kind == "other"]
    problems += [f"the sentence holds '{text}', which the checker does not know"
                 for kind, text in units if kind == "other"]
    problems += [f"a space stands before '{text}', which is written right after the word before it"
                 for kind, text, spaced in items[1:] if kind == "mark" and spaced and text in _CLOSING]
    marks = [text for kind, text in units if kind == "mark"]
    line_marks = [text for kind, text, _ in items if kind == "mark"]
    if marks != line_marks:
        return problems + [f"the sentence has the punctuation {' '.join(marks) or 'none'} but the line has "
                           f"{' '.join(line_marks) or 'none'}"]
    cells, literal_items = {}, set()
    chunks_s, chunks_l = [[]], [[]]
    for kind, text in units:
        if kind == "mark":
            chunks_s.append([])
        elif kind in ("han", "literal"):
            chunks_s[-1].append((kind, text, None))
    positions = [k for k, ch in enumerate(sentence) if _HANZI.match(ch)]
    for n, (kind, text, spaced) in enumerate(items):
        if kind == "mark":
            chunks_l.append([])
        elif kind in ("word", "literal"):
            joint = "-" if n and items[n - 1][0] == "joint" else " "
            chunks_l[-1].append((kind, text, joint, n))
    han_at = iter(positions)
    for part_s, part_l in zip(chunks_s, chunks_l):
        literals = [text for kind, text, _ in part_s if kind == "literal"]
        runs, run = [], []
        for kind, text, _ in part_s:
            if kind == "han":
                run.append((next(han_at), text))
            else:
                runs.append(run)
                run = []
        runs.append(run)
        line_literals = [text for kind, text, _, _ in part_l if kind == "literal" or text in literals]
        if line_literals != literals:
            missing = list(literals)
            for text in line_literals:
                if text in missing:
                    missing.remove(text)
                else:
                    problems.append(f"'{text}' in the line is not in the sentence")
            problems += [f"the digits or Latin letters '{text}' of the sentence are missing or changed in the line"
                         for text in missing]
            continue
        groups, group = [], []
        for kind, text, joint, n in part_l:
            if kind == "literal" or text in literals:
                groups.append(group)
                group = []
                literal_items.add(n)
            else:
                group.append((text, joint, n))
        groups.append(group)
        for run, words in zip(runs, groups):
            if not run and not words:
                continue
            if not run or not words:
                what = "".join(ch for _, ch in run) or " ".join(t for t, _, _ in words)
                problems.append(f"'{what}' has no partner, because every Chinese character needs one syllable and "
                                "every syllable one character")
                continue
            got, more = _align(run, words, readings_of)
            problems += more
            if got:
                cells.update({index: cell for (index, _), cell in zip(run, got)})
    problems += _head_problems(sentence, cells, head)
    problems += _tone_change_problems(sentence, cells, head, facts)
    problems += _one_word_problems(sentence, cells, head)
    problems += _number_problems(sentence, cells, head, facts)
    problems += _final_le_problems(sentence, cells, facts)
    problems += _capital_problems(sentence, items, cells, names, literal_items)
    return problems


def _head_problems(sentence, cells, head):
    """The headword must show the syllables and word spacing of its card (check_line point 5)."""
    at = head_positions(sentence, head["hz"])
    nums = head["pyNum"].split()
    shown, joints = syllables_of_py(head["py"], nums), joints_of_py(head["py"], nums)
    if not at:
        return [f"the sentence does not contain the headword {head['hz']}"]
    if shown is None or joints is None or len(at) != len(shown) or any(i not in cells for i in at):
        return []
    parts = [p for p in head["hz"].split("…") if p]
    ends, total = set(), 0
    for part in parts:
        total += len(part)
        ends.add(total - 1)
    wrong = False
    for k, i in enumerate(at):
        syl, joint, _, _ = cells[i]
        have = "r5" if toneless(syl) == "r" else syllable_to_num(syl)
        if have != shown[k] and not (k in ends and have in _TONES_OF.get((sentence[i], nums[k]), ())):
            wrong = True
        if k and k - 1 not in ends and joints[k - 1] != joint:
            wrong = True
    if not wrong:
        return []
    starts = [0] + [end + 1 for end in sorted(ends)][:-1]
    written = "…".join(_written(cells, at[a:b + 1]) for a, b in zip(starts, sorted(ends)))
    return [f"the headword {head['hz']} must be written '{head['py']}' as on its card, but the line has '{written}'"]


def _tone_change_problems(sentence, cells, head, facts):
    """The tone changes of 一 and 不 where a rule settles them (check_line point 7, style sheet points 6 and 8).

    A 一 or 不 inside a card or public-list word may show the syllable that word shows (facts["shown"],
    "duìbuqǐ", "yìqǐ"). Otherwise:
    - a neutral "bu" or "yi" stands only in a doubled word ("kàn yi kàn", "hǎo bu hǎo", "xǐ bu
      xǐhuan") and, for 不, in a potential complement (sentpinyin.potential, "zhǎo bu dào");
    - 不 is "bú" before a fourth tone and "bù" before the other tones;
    - 一 keeps "yī" in a decimal ("sān diǎn yī sì") and after 第, a numeral, 星期 or 礼拜 ("dì-yī",
      "shíyī gè", "xīngqīyī"), unless 百, 千, 万 or 亿 follows it or it starts a word of the lists (千万
      一定 "qiānwàn yídìng");
    - elsewhere 一 is "yí" before a fourth tone and "yì" before the other tones, it keeps "yī" where no
      syllable follows it, and it shows its tone change when it starts a word before a measure word
      or another word of facts["counted"] ("yí gè", "yì nián", "yìqiān"). Before a neutral tone the
      choice between "yí" and "yì" is open, and nothing is settled before an ordinal or a date
      (_ORDINAL_AFTER, 一号 "yī hào") or before 点, which may be a time of day ("yī diǎn"), except in
      一点儿 and 一点点. Before any other character "yī" may stand too (一楼 "yī lóu").
    A 一 or 不 inside the headword keeps the tone its card shows (受不了 "shòubuliǎo").
    So "Wǒ bù qù.", "Wǒ bu qù.", "Wǒ yī gè rén qù.", "yī tiān" and "dì-yí cì" fail, while "Wǒ bú qù.",
    "Wǒ yí gè rén qù.", "yì tiān" and "dì-yī cì" pass.
    """
    at, ends, total = head_positions(sentence, head["hz"]), set(), 0
    for part in (p for p in head["hz"].split("…") if p):
        total += len(part)
        ends.add(total - 1)
    inner = {i for k, i in enumerate(at) if k not in ends}
    decimal, problems = decimal_positions(sentence), []
    for i in sorted(cells):
        ch, (syl, joint, _, _) = sentence[i], cells[i]
        if ch not in _TONE_CHANGES or i in inner:
            continue
        num, nxt = syllable_to_num(syl), cells.get(i + 1)
        tone = num[-1]
        after = syllable_to_num(nxt[0])[-1] if nxt and toneless(nxt[0]) != "r" else ""
        if _shown_here(sentence, i, num, facts["shown"]):
            continue
        kept = _keeps_yi(sentence, i, facts["known"]) if ch == "一" else ""
        if tone == "5":
            if not (_doubled(sentence, i) or (ch == "不" and _potential_at(sentence, i, facts["pos"]))):
                problems.append(f"'{syl}' ({ch}) is in the neutral tone, which the style sheet keeps for a doubled "
                                "word ('kàn yi kàn', 'hǎo bu hǎo'), a potential complement ('zhǎo bu dào') and the "
                                "words that a card or the public list writes so ('duìbuqǐ')")
            continue
        if ch == "不":
            if tone == "4" and after == "4":
                problems.append(f"'{syl}' (不) comes before the fourth tone of '{nxt[0]}', so it is written 'bú'")
            elif tone == "2" and after not in ("4", "5"):
                problems.append(f"'{syl}' (不) is written 'bú' only before a fourth tone, so write 'bù' here")
        elif i in decimal:
            if tone != "1":
                problems.append(f"'{syl}' (一) is a digit of a decimal number, which is read digit by digit, so it "
                                "keeps its first tone 'yī'")
        elif kept:
            if tone != "1":
                problems.append(f"'{syl}' (一) follows {kept}, so it is part of a number, an ordinal or a weekday and "
                                "keeps its first tone 'yī'")
        elif tone == "4" and after == "4":
            problems.append(f"'{syl}' (一) comes before the fourth tone of '{nxt[0]}', so it is written 'yí'")
        elif tone == "2" and after in ("1", "2", "3"):
            problems.append(f"'{syl}' (一) comes before '{nxt[0]}', which is not a fourth tone, so it is written 'yì'")
        elif tone in ("2", "4") and not after:
            problems.append(f"'{syl}' (一) has no syllable after it, so it keeps its first tone 'yī'")
        elif tone == "1" and joint and _counts(sentence, i, facts["counted"]) \
                and not (i and sentence[i - 1] in NUMERALS | {"第"}):
            problems.append(f"'{syl}' (一) counts with {sentence[i + 1]} here, so it shows its tone change, 'yí' "
                            "before a fourth tone and 'yì' before the other tones")
    return problems


def _shown_here(sentence, i, num, shown):
    """True when the 一 or 不 at index i stands inside a word of facts["shown"] that shows the syllable num."""
    return any(sentence[i - k:i - k + len(word)] == word and syl == num
               for word, k, syl in shown.get(sentence[i], ()) if i >= k)


def _doubled(sentence, i):
    """True when the 一 or 不 at index i stands between two copies of a word (看一看, 好不好, 喜不喜欢, 喜欢不喜欢)."""
    one = sentence[i - 1:i]
    return bool(one and _HANZI.match(one) and sentence[i + 1:i + 2] == one) or \
        (i >= 2 and bool(_HANZI.match(sentence[i - 2])) and sentence[i - 2:i] == sentence[i + 1:i + 3])


def _potential_at(sentence, i, pos):
    """True when the 不 at index i is the middle of a potential complement (找不到, 听不懂, 忍受不了)."""
    verbs = [sentence[j:i] for j in (i - 1, i - 2) if j >= 0]
    results = [sentence[i + 1:i + 1 + n] for n in (1, 2) if i + n < len(sentence)]
    return any(potential(verb, result, pos) for verb in verbs for result in results)


def _keeps_yi(sentence, i, known):
    """The word before the 一 at index i when that 一 is part of a number, an ordinal or a weekday, so it
    keeps "yī" (第 in 第一, 十 in 十一个, 星期 in 星期一), else ""."""
    if sentence[max(i - 2, 0):i] in ("星期", "礼拜"):
        return sentence[i - 2:i]
    if sentence[i - 1:i] == "第":
        return "第"
    if not i or sentence[i - 1] not in NUMERALS or sentence[i + 1:i + 2] in ("百", "千", "万", "亿"):
        return ""
    if any(sentence[i:i + n] in known and not _NUMBER_RUN.fullmatch(sentence[i:i + n]) for n in (2, 3, 4)):
        return ""
    return sentence[i - 1]


def _counts(sentence, i, counted):
    """True when the 一 at index i counts with the word after it (一个, 一天, 一千), see _tone_change_problems."""
    rest = sentence[i + 1:]
    if rest[:1] not in counted or rest.startswith(_ORDINAL_AFTER):
        return False
    return rest[:1] != "点" or rest[1:2] in ("儿", "点")


def _one_word_problems(sentence, cells, head):
    """What points 1 and 2 of the style sheet write as one word must be one pinyin word (check_line point 8).

    Only the sentence of the card 个 or 些 may write 这个 or 这些 apart, because there the headword
    must show its card's "gè" ("zhè gè"). So "Zhè gè rén hěn hǎo." fails for the card 人.
    """
    problems = []
    for point, pattern in _ONE_WORD:
        for m in pattern.finditer(sentence):
            span = list(range(m.start(), m.end()))
            if (point == 1 and head["hz"] in ("个", "些")) or any(i not in cells for i in span) \
                    or len({cells[i][2] for i in span}) == 1:
                continue
            problems.append(f"{m.group()} is written as one word (point {point} of the style sheet), but the line "
                            f"has '{_written(cells, span)}'")
    return problems


def _joint(cells, j):
    """The joint that the line writes between the sentence characters j - 1 and j ("" inside a word, else " " or "-")."""
    return "" if cells[j][2] == cells[j - 1][2] else cells[j][1]


def _number_problems(sentence, cells, head, facts):
    """Word breaks in and around numbers, as point 6 of the style sheet sets them (check_line point 9).

    For each run of numerals (_NUMBER_RUN) the checker knows the joint that point 6 wants between
    two characters:
    - inside the run, the joints of sentpinyin.number_words, so 十二 is "shí'èr", 一千五百 "yìqiān
      wǔbǎi" and 二〇〇八 "èr líng líng bā", with a hyphen in an approximate number ("yì-liǎng"). A run
      that is itself a word of the lists (千万, 万一) or that has two digits next to each other in a
      longer number word (五六十) is not checked inside;
    - a hyphen between 第 and the run ("dì-shí");
    - a space between the run and a measure word after it ("sān gè", "yìqiān yuán"), unless a word
      of the lists holds both (一些, 一下, 一点儿);
    - a space between the syllables of a fraction ("sān fēn zhī yī", "bǎi fēn zhī shí");
    - a space before 点 and between the digits after it in a decimal ("sān diǎn yī sì").
    Joints between two characters of the headword are left to the headword check, so the card 百分之
    keeps its "bǎifēnzhī". So "shí èr diǎn", "yì qiān yuán", "dìshí kè", "dì shí kè", "sānfēnzhīyī"
    and "yígè" fail. Each stretch of wrong joints gives one message.
    """
    head_at, known = set(head_positions(sentence, head["hz"])), facts["known"]
    decimal, want = decimal_positions(sentence), {}
    for m in _NUMBER_RUN.finditer(sentence):
        a, b, run = m.start(), m.end(), m.group()
        if sentence[a - 1:a] == "第":
            want[a] = "-"
        year = sentence[b:b + 1] == "年"
        if a in decimal and sentence[a - 1:a] == "点":
            want.update({j: " " for j in range(a, b)})
        elif len(run) > 1 and run not in known and _settled(run, year):
            words = number_words(run)
            if not any(len(w) > 2 and re.search("[〇零一二两三四五六七八九]{2}", w) for w in words):
                j = a
                for n, word in enumerate(words):
                    if n:
                        want[j] = " "
                    want.update({j + k: "-" if approximate(word) else "" for k in range(1, len(word))})
                    j += len(word)
        if sentence[b:b + 2] == "分之":
            want.update({b: " ", b + 1: " "})
            if _NUMBER_RUN.match(sentence, b + 2):
                want[b + 2] = " "
        elif sentence[b:b + 1] == "点" and b + 1 in decimal:
            want[b] = " "
        elif sentence[b:b + 1] in facts["measure"] and (len(run) == 1 or _settled(run, year)) \
                and sentence[b + 1:b + 2] != sentence[b] and not _held(sentence, b, known):
            want[b] = " "
    wrong = sorted(j for j, joint in want.items() if j - 1 in cells and j in cells
                   and not (j - 1 in head_at and j in head_at) and _joint(cells, j) != joint)
    problems, done = [], set()
    for j in wrong:
        if j in done:
            continue
        start, end = j - 1, j
        while start in want and start - 1 in cells:
            start -= 1
        while end + 1 in want and end + 1 in cells:
            end += 1
        done |= set(range(start + 1, end + 1))
        span = list(range(start, end + 1))
        expected = ""
        for k, i in enumerate(span):
            bare = cells[i][3].lstrip("'")
            joint = want.get(i, _joint(cells, i)) if k else ""
            if k and joint == "" and toneless(bare)[:1] in ("a", "o", "e"):
                bare = "'" + bare
            expected += joint + bare
        problems.append(f"the number {sentence[start:end + 1]} is written '{expected}' (point 6 of the style "
                        f"sheet), but the line has '{_written(cells, span)}'")
    return problems


def _held(sentence, j, known):
    """True when a word of the lists holds both the characters j - 1 and j (一些, 一下, 一点儿, 十分)."""
    return any(sentence[s:e] in known for s in range(max(j - 3, 0), j) for e in range(j + 1, j + 4))


def _settled(run, year):
    """True when point 6 settles the word breaks inside a run of numerals that is not a word of the lists.

    It does for a number with 十, 百, 千, 万 or 亿 (十二, 一千五百) that holds no character twice in a row,
    for the digits of a year (二〇〇八年, read one by one) and for an approximate number (一两). It does
    not for other digits, which may name a date or a festival (五一节), for a doubled word (零零落落,
    千千万万) or for 几 without 十, 百, 千 or 万.
    """
    if not re.search("[十百千万亿]", run):
        return year or approximate(run)
    return not re.search(r"(.)\1", run)


def _final_le_problems(sentence, cells, facts):
    """A 了 that ends a sentence or a clause is a word of its own (check_line point 10, style sheet point 3).

    Such a 了 is read "le" and stands before a punctuation mark, at the end or before a particle such
    as 吗 ("Zuótiān xià yǔ le.", "Nǐ lái le ma?"). A word of the lists that ends in it keeps it (算了
    "suànle"). So "Zuótiān xià yǔle." fails, while "Wǒ mǎile hěn duō dōngxi." passes.
    """
    problems = []
    for i in sorted(cells):
        if sentence[i] != "了" or i - 1 not in cells or syllable_to_num(cells[i][0]) != "le5" \
                or cells[i][2] != cells[i - 1][2]:
            continue
        rest = sentence[i + 1:i + 2]
        if (rest and not (rest in PUNCTUATION or rest in _FINAL_PARTICLES)) \
                or any(sentence[s:i + 1] in facts["known"] for s in range(max(i - 3, 0), i)):
            continue
        span = [k for k in sorted(cells) if cells[k][2] == cells[i][2]]
        problems.append(f"the 了 that ends a sentence or a clause is a word of its own ('xià yǔ le.', point 3 of "
                        f"the style sheet), but the line has '{_written(cells, span)}'")
    return problems


def _capital_problems(sentence, items, cells, names, literal_items):
    """Capitals only where the style sheet allows them, and where it needs them (check_line point 6).

    literal_items: the items that are Latin letters of the sentence ("IT"), which keep their own capitals.
    A name needs its capitals, and may have them, only where the line writes it as a name, that is,
    where its first character starts a pinyin word and its last character ends one or the whole name
    stands inside one word ("Zhōngguórén"). So in 小李明天来。 with the names 小李 and 李明, "Xiǎo Lǐ
    míngtiān lái." passes and "Xiǎo Lǐ Míngtiān lái." fails, because 明天 is one word there.
    """
    must, may = {}, set()
    for hz, (parts, flags) in names.items():
        at = sentence.find(hz)
        while at >= 0:
            end = at + len(hz) - 1
            starts = at in cells and (at - 1 not in cells or cells[at - 1][2] != cells[at][2])
            ends = end in cells and (end + 1 not in cells or cells[end + 1][2] != cells[end][2])
            inside = at in cells and end in cells and cells[at][2] == cells[end][2]
            offset = at
            for part, flag in zip(parts, flags):
                if flag and starts and (ends or inside):
                    must.setdefault(offset, hz)
                    may |= set(range(offset, offset + len(part)))
                offset += len(part)
            at = sentence.find(hz, at + 1)
    first_char = {}  # the first sentence character that each pinyin word of the line stands for
    for index in sorted(cells):
        first_char.setdefault(cells[index][2], index)
    problems, state, before = [], "start", None
    for n, (kind, text, spaced) in enumerate(items):
        if kind == "mark":
            if text in ".!?":
                state = "start"
            elif text == "...":
                state = "may"
            elif text == ":":
                state = "colon"
            elif text in "\"'":
                if state == "colon" or (state == "start" and spaced):
                    state = "start"
                elif state == "start" and before in (".", "!", "?"):
                    state = "may"
            elif text not in "()":
                state = "none"
            before = text
            continue
        before = None
        if kind == "joint":
            continue
        if kind != "word" or n in literal_items:
            state = "none"
            continue
        joined = n and items[n - 1][0] == "joint"
        index = first_char.get(n)
        if index is None:
            state = "none"
            continue
        chars = "".join(sentence[i] for i in sorted(cells) if cells[i][2] == n)
        upper = any(ch.isupper() for ch in text[1:])
        if upper:
            problems.append(f"'{text}' has a capital letter inside the word")
        if joined:
            if text[:1].isupper():
                problems.append(f"'{text}' after a hyphen starts with a capital, which only a word can have")
            continue
        capital = text[:1].isupper()
        needed = state == "start" or index in must
        allowed = needed or state in ("may", "colon") or index in may
        if capital and not allowed:
            problems.append(f"'{text}' ({chars}) starts with a capital, but the style sheet allows one only at the "
                            "start of a sentence or of a quotation after a colon, and on a name that the cards or "
                            "data/manual/capitals write with a capital")
        elif needed and not capital:
            why = "starts a sentence" if state == "start" else f"starts the name {must[index]}"
            problems.append(f"'{text}' ({chars}) needs a capital, because it {why}")
        state = "none"
    return problems


def check_answer(given, answer, head, readings_of, names, facts):
    """Problems of one agent's answer row, whose characters must stay as given and whose line must pass check_line.

    given: the batch row (id, sentence, ...). answer: the answer row (id, sentence, py, note).
    """
    written = (answer.get("sentence") or "").strip()
    if written != given["sentence"]:
        changed = next((k for k, (a, b) in enumerate(zip(written, given["sentence"])) if a != b),
                       min(len(written), len(given["sentence"])))
        return [f"the Chinese sentence was changed at character {changed + 1}, so copy it exactly as given"]
    line = (answer.get("py") or "").strip()
    if not line:
        return ["the pinyin is empty"]
    return check_line(given["sentence"], line, head, readings_of, names, facts)


def match_answers(inputs, outputs):
    """The answer row for each input id, and the problems, which are an answer for an id that is not in
    the input and two answers for one id. An input id without an answer is simply absent."""
    want = {r["id"] for r in inputs}
    got, problems, seen = {}, [], {}
    for r in outputs:
        rid = (r.get("id") or "").strip()
        seen[rid] = seen.get(rid, 0) + 1
        if rid not in want:
            problems.append(f"{rid}: not in the input")
        else:
            got[rid] = r
    problems += [f"{rid}: answered {n} times" for rid, n in seen.items() if n > 1 and rid in want]
    return {rid: r for rid, r in got.items() if seen[rid] == 1}, problems
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_pinyincheck.py -q`
Expected: `16 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/pinyincheck.py tests/test_pinyincheck.py && git commit -F - <<'EOF'
feat: strict checker for corrected sentence pinyin

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 14: Claude corrects the sentence pinyin (multi-agent workflow, `tools/08c_pinyin_batches.py`, `tools/08d_pinyin_merge.py` and `tools/08e_pinyin_review_apply.py`)

**Files:**
- Create: `tools/08c_pinyin_batches.py`, `tools/08d_pinyin_merge.py`, `tools/08e_pinyin_review_apply.py`
- Create (by the agents): `data/claude/pinyin_vBBB/batch_KKK_v001.csv`, and `batch_KKK_v002.csv` and `batch_KKK_v003.csv` for redo files, where BBB is the version of the batch folder; `data/claude/pinyin_review_vCCC/batch_001_v001.csv`, where CCC is the version of the review folder
- Output: `data/build/pinyin_batches_vBBB/`, `data/build/sentence_pinyin_checked_vCCC.jsonl`, `data/build/pinyin_review_vCCC/`, `data/reports/pinyin_check_vCCC.txt`, `data/build/sentence_pinyin_final_vFFF.jsonl`, `data/reports/pinyin_review_vFFF.txt`

The draft of step 8 (Task 11), after the polyphone check (Task 12), is where this task starts. The draft follows most of the style sheet, but not all of it. On the prototype run, 26 of the 4,051 PDF sentences read the particle 过 after a verb as guò, 27 times in all ("qùguò", where point 3 wants "qùguo"), and single sentences read 着 as zhuó in 穿着, 得 as dé after a verb, 框 as kuāng in 门框, and 点儿 as "diǎn'ér". One more wrote a neutral yi in 两份，一份 ("liǎng fèn, yi fèn", w3470), because Plan 3a `tone_change` sees the two 份 as a doubled word once the comma is left out. (Before the seventh revision, described in the facts at the top, 220 more wrote 这个, 那个 or 哪个 as two words and 4 split a month or weekday name. Task 10 now writes them as one word.) This plan stops trying to make the rules perfect. Instead, Claude agents correct every line, the strict checker of Task 13 accepts or rejects each answer, and a rejected line goes back to a redo.

The flow has five parts.
1. **Batches.** Step 8c writes batch files of 100 sentences. Each row has the sentence, its headword, the headword's card pinyin, the names in the sentence with the words that take a capital, and the draft. Only sentences whose text or draft changed since the latest final file go into batches, so once step 8e has written a final file, a later change sends only those sentences to the agents again. Before that, step 8c would send every sentence again, so step 8 is not run again between Step 2 and Step 8 of this task (the names from the agents' notes wait for Step 9).
2. **Correcting agents.** One fresh agent per batch file writes the corrected lines, with the correcting instructions below.
3. **Strict check and redo.** Step 8d checks every answer with the checker of Task 13. A rejected line goes into a redo file together with the rejected line and the checker's messages, and a fresh redo agent answers it. After two failed redos the line keeps the draft, and the report lists it for the user. When no line waits for a redo, step 8d writes the checked pinyin and a random sample of 150 accepted lines.
4. **Independent checker.** A fresh agent that corrected none of the lines reads the sample against the style sheet, with the checker instructions below.
5. **Review.** Step 8e applies the checker's fixes, each of which must pass the strict checker as well. If more than 5% of the sample needed a fix (8 or more of 150 lines), it stops and the user decides, because that many fixes means the correcting agents misread part of the style sheet. Otherwise it writes the final sentence pinyin, which step 10 (Task 17) reads.

This step follows the workflow rules at the top of this plan with one change to rules 3 and 4. A redo agent answers only the rejected lines of a batch, and after two redos a line keeps its draft instead of stopping the work.

The correcting instructions (one fresh agent per batch file, with `{input}` = `data/build/pinyin_batches_vBBB/batch_KKK.csv` and `{output}` = `data/claude/pinyin_vBBB/batch_KKK_v001.csv`):

------------------------------------------------------------
You correct the pinyin of Chinese example sentences for a beginner's flashcards, following a written style sheet.

First read the section "Pinyin style sheet" of the file .claude/plans/words-json-schema.md, and follow it exactly. Then read the input file {input}. It is a UTF-8 CSV with the columns id, sentence (the Chinese sentence), word (the flashcard's word, which the sentence contains), card_py (the word's pinyin on its card), names (the names in the sentence that take a capital, and which of their words do, or empty when there are none) and draft (pinyin that a program wrote, which follows most of the style sheet but not all of it).

Write the output file {output} as a UTF-8 CSV with exactly this header line:
id,sentence,py,note
Write one row per input row, in the input order. Copy id and sentence exactly, character for character. Quote any field that contains a comma or a double quote, and double any double quote inside it.

Rules for py:
1. py is the pinyin of the whole sentence, with tone marks, word spacing, capitals and punctuation as the style sheet says. Start from draft, and change what the style sheet or the reading needs.
2. Never change, add or drop a Chinese character in sentence, and never write a Chinese character in py. Every Chinese character has exactly one syllable in py, in order. A 儿 right after a syllable of the same word may be written as the 儿 ending, a bare r joined to that syllable (nǎr).
3. Each syllable is the reading the character has in this sentence, as a teacher would read it aloud (长大 zhǎngdà, 穿着 chuānzhe, 跑得快 pǎo de kuài, 去过 qùguo with the neutral particle 过, 穿过 chuānguò).
4. Write word exactly as card_py shows it, with the same syllables, tones and word spacing, even where the style sheet would write it otherwise (for 打电话 always "dǎ diànhuà"). Only a 一 or 不 at the end of word may show its tone change ("bú shì" for the card 不 "bù"), and word takes a capital only where a sentence starts or where names gives it one. For a pattern word such as 虽然…但是… (card_py "suīrán…dànshì…"), write each half where it stands in the sentence and do not write the … marks ("Suīrán xià yǔ le, dànshì wǒ qù.").
5. Digits and Latin letters stay exactly as in the sentence (2012, IT, 70%). Each Chinese punctuation mark becomes its Western mark, with the same marks in the same order. So 。 becomes ".", ， and 、 become ",", ？ ！ ： and ； become "?", "!", ":" and ";", “ and ” become a double quote, …… becomes "...", and the Chinese dash of two long dashes becomes one hyphen with a space on each side.
6. Capitals stand at the start of each sentence and of a quotation after a colon, and on the words that names gives a capital, and nowhere else. If a word looks like the name of a person, place, language, country or people but names does not list it, write it in lower case and say so in note.
7. In note, write any doubt about a reading or a name in a few words. Otherwise leave it empty.

A script checks every row. It rejects a row whose characters changed, whose syllables do not line up one to one with the characters (〇 in a year is a character too, read líng), whose syllable with its tone is not a reading of its character, whose 一 or 不 does not show the tone change a rule settles (bú and yí before a fourth tone, bù and yì before other tones, yī in a decimal and after 第 or a numeral as in dì-yī and shíyī, yí gè, yì nián, yìqiān), whose neutral bu or yi stands outside a doubled word (kàn yi kàn), a potential complement (zhǎo bu dào) or a word that a card or the public word list writes so (duìbuqǐ), whose 这个, 那个, 哪个, 这些, 那些, 哪些 or month or weekday name is not one word, whose numbers are spaced otherwise than point 6 (shí'èr diǎn, yìqiān yuán, dì-shí kè, sān fēn zhī yī, yí gè), whose 了 at the end of a sentence or clause is joined to the word before it, whose word differs from card_py, whose digits, Latin letters or punctuation differ from the sentence, or whose capitals stand where rule 6 does not allow them or are missing where it needs them. A rejected row comes back to a fresh agent with the script's message.

Do not read, create or change any other file. When you have finished, reply with one line that gives the number of rows written.
------------------------------------------------------------

The extra paragraph for a redo agent (append it to the correcting instructions, with `{input}` = the redo file `data/build/pinyin_batches_vBBB/batch_KKK_redo_vMMM.csv` and `{output}` = `data/claude/pinyin_vBBB/batch_KKK_vMMM.csv`, the same MMM):

------------------------------------------------------------
The script rejected an earlier answer for each row of this file. The input has two more columns. earlier is the rejected line, and problem gives the script's messages, separated by " | ". Write a new py for each row that avoids these problems and follows all the rules above.
------------------------------------------------------------

The checker instructions (one fresh agent that wrote none of the lines, with `{input}` = `data/build/pinyin_review_vCCC/batch_001.csv` and `{output}` = `data/claude/pinyin_review_vCCC/batch_001_v001.csv`):

------------------------------------------------------------
You are an independent checker. You did not write any of these lines. You check sentence pinyin against a written style sheet.

First read the section "Pinyin style sheet" of the file .claude/plans/words-json-schema.md. Then read the input file {input}. It is a UTF-8 CSV with the columns id, sentence (the Chinese sentence), word (the flashcard's word), card_py (its pinyin on the card), names (the names in the sentence that take a capital) and py (the corrected pinyin to check).

Write the output file {output} as a UTF-8 CSV with exactly this header line:
id,verdict,py,point,note
Write one row per input row, in the input order. Copy id exactly. Quote any field that contains a comma or a double quote, and double any double quote inside it.

1. verdict is OK when py follows every point of the style sheet and each syllable is the reading its character has in this sentence. Then leave py, point and note empty.
2. Otherwise verdict is FIX. Then write the whole corrected line in py. It keeps every Chinese character's place, writes word exactly as card_py shows it (only a 一 or 不 at its end may show its tone change), keeps digits and Latin letters as in the sentence, turns each Chinese punctuation mark into its Western mark, and has capitals only where the style sheet and names allow them. Write the number of the style-sheet point that py broke in point (0 for a wrong reading), and the problem in a few words in note.
3. Be strict about readings, tones, word spacing and capitals. Do not mark FIX where the style sheet leaves the choice open.

Do not read, create or change any other file. When you have finished, reply with one line that gives the number of rows and the counts of OK and FIX.
------------------------------------------------------------

The extra paragraph for a redo of the independent checker (append it to the checker instructions, with the same `{input}` and with `{output}` = `data/claude/pinyin_review_vCCC/batch_001_v002.csv`, or the next free version for a later redo). Step 8e stops with the line `Stopped, nothing written. Redo the checker's answer (Task 14 Step 6):` and then prints one problem line per rejected row, such as `w0183: the FIX line 'Wǒ qùguo yi cì Běijīng.' fails the strict checker: ...`. Those printed problem lines fill the placeholder, one per line:

------------------------------------------------------------
A script rejected an earlier answer to this file for these problems:
{the problem lines that step 8e printed after "Redo the checker's answer (Task 14 Step 6):"}
Write a complete new answer file with one row for every input row, avoiding these problems. A FIX line must differ from the given py and must pass the script's checks, which the part "How the sheet is applied" of the style sheet lists.
------------------------------------------------------------

- [ ] **Step 1: Write `tools/08c_pinyin_batches.py`**

```python
"""Step 8c. Batch files for the agents that correct the sentence pinyin against the pinyin style sheet.

Inputs:  the latest data/build/sentence_pinyin_vNNN.jsonl (the draft of step 8, whose polyphone_batches_vNNN
         folder must be empty), data/build/wordlist_vNNN.jsonl and data/manual/capitals_vNNN.csv (latest),
         and the latest data/build/sentence_pinyin_final_vFFF.jsonl once one exists
Output:  data/build/pinyin_batches_vBBB/batch_001.csv ... with 100 rows each and the columns id, sentence,
         word (the headword), card_py (the headword's card pinyin), names (the names in the sentence and
         which of their words take a capital) and draft (the pinyin of step 8)
Only sentences whose text or draft differs from the latest final file go into batches, so after a
sentence changes, only that sentence goes to the agents again.
"""
import sys
from pathlib import Path

from common import (all_version_paths, latest_version_path, next_version_path, read_csv, read_jsonl,
                    write_new_csv)
from pinyin_text import name_rows
from pinyincheck import names_of
from themes import chunks

BATCH = 100
COLUMNS = ["id", "sentence", "word", "card_py", "names", "draft"]


def names_note(sentence, names):
    """The names in a sentence and which of their words take a capital, in words for the agents.

    With the names 北京 and 李老师 (李 with a capital, 老师 without), "李老师在北京。" gives
    "李老师 (李 capital, 老师 lower case); 北京 (capital)". A sentence without names gives "".
    Names that overlap are read from the left, and the longer one wins, so with the names 小李 and
    李明, "小李明天来。" gives only "小李 (小 capital, 李 capital)", because 明天 is a word there.
    """
    found, taken = [], set()
    hits = [(at, hz) for hz in names if hz in sentence for at in range(len(sentence)) if sentence.startswith(hz, at)]
    for at, hz in sorted(hits, key=lambda hit: (hit[0], -len(hit[1]))):
        span = set(range(at, at + len(hz)))
        if not span & taken and hz not in (h for _, h in found):
            taken |= span
            found.append((at, hz))
    notes = []
    for _, hz in found:
        parts, flags = names[hz]
        if len(parts) == 1:
            notes.append(f"{hz} (capital)")
        else:
            notes.append(f"{hz} (" + ", ".join(f"{p} {'capital' if f else 'lower case'}" for p, f in zip(parts, flags))
                         + ")")
    return "; ".join(notes)


def main():
    draft_path = latest_version_path("data/build/sentence_pinyin", ".jsonl")
    version = draft_path.stem.rsplit("_", 1)[1]
    if list(Path(f"data/build/polyphone_batches_{version}").glob("batch_*.csv")):
        sys.exit("Stopped. The latest pinyin run still lists characters to check (Task 12).")
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    table, problems = name_rows(read_csv(latest_version_path("data/manual/capitals", ".csv")))
    if problems:
        sys.exit("Stopped, nothing written. data/manual/capitals has problems:\n  " + "\n  ".join(problems))
    names = names_of(table, words.values())
    drafts = read_jsonl(draft_path)
    found = all_version_paths("data/build/sentence_pinyin_final", ".jsonl")
    done = {r["id"]: (r["sentence"], r["draft"]) for r in (read_jsonl(found[-1][1]) if found else [])}
    todo = [r for r in drafts if done.get(r["id"]) != (r["sentence"], r["py"])]
    if not todo:
        sys.exit(f"Nothing to do. Every draft line of {draft_path} is already corrected in {found[-1][1]}.")
    folder = next_version_path("data/build/pinyin_batches", "")
    folder.mkdir()
    parts = list(chunks(todo, BATCH))
    for n, part in enumerate(parts, start=1):
        write_new_csv(folder / f"batch_{n:03d}.csv", COLUMNS,
                      [[r["id"], r["sentence"], words[r["id"]]["hz"], words[r["id"]]["py"],
                        names_note(r["sentence"], names), r["py"]] for r in part])
    print(f"{len(todo)} of {len(drafts)} sentences in {len(parts)} batch files in {folder}, "
          f"from the draft {draft_path}.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Write the batch files**

Run: `PYTHONIOENCODING=utf-8 python tools/08c_pinyin_batches.py`
Expected: `5043 of 5043 sentences in 51 batch files in data\build\pinyin_batches_v001, from the draft data\build\sentence_pinyin_vNNN.jsonl.`, where vNNN is the latest draft. On the prototype run with the 4,051 PDF sentences it wrote 41 batch files. If it stops with `The latest pinyin run still lists characters to check`, finish Task 12 first.

- [ ] **Step 3: Run one correcting agent per batch file**

Use the correcting instructions word for word, with the file paths filled in, at most 8 agents at a time. Then confirm the answer files exist:
Run: `ls data/claude/pinyin_v001 | wc -l`
Expected: the number of batch files from Step 2 (51).

- [ ] **Step 4: Write `tools/08d_pinyin_merge.py`**

```python
"""Step 8d. Check the corrected sentence pinyin with the strict checker, send failing lines back, and write the result.

Inputs:  the latest data/build/pinyin_batches_vBBB/ (the batch_KKK.csv files of step 8c and the
         batch_KKK_redo_vMMM.csv files this step writes), the agents' answers in data/claude/pinyin_vBBB/
         (batch_KKK_v001.csv answers the batch, v002 and v003 answer the redo files; columns id, sentence,
         py, note), data/build/wordlist_vNNN.jsonl, data/public/hsk_complete_vNNN.json and
         data/manual/capitals_vNNN.csv (latest), and the latest data/build/sentence_pinyin_final_vFFF.jsonl
         if one exists
Outputs: while some lines fail and may still be redone, only data/build/pinyin_batches_vBBB/batch_KKK_redo_vMMM.csv
         (the batch columns plus earlier, the rejected line, and problem, the checker's messages)
         once no line waits for a redo:
         data/build/sentence_pinyin_checked_vCCC.jsonl  {id, sentence, py, draft, source} for every sentence,
                         where source is claude for an accepted line and draft for a line that failed its
                         answer and both redos, so it keeps the draft of step 8 (the report says whether
                         that draft passes the strict checker)
         data/build/pinyin_review_vCCC/batch_001.csv  150 random accepted lines for the independent checker
                         (id, sentence, word, card_py, names, py)
         data/reports/pinyin_check_vCCC.txt
Nothing is written while an answer file is missing. Sentences that step 8c did not batch keep their
line from the latest final file.
"""
import random
import sys
from pathlib import Path

from common import (all_version_paths, latest_version_path, next_versions, read_csv, read_json, read_jsonl,
                    write_new_csv, write_new_jsonl, write_new_text)
from pinyin_text import name_rows
from pinyincheck import check_answer, check_line, known_readings, match_answers, names_of, word_facts
from wordlist import public_readings

REDOS = 2
SAMPLE = 150
COLUMNS = ["id", "sentence", "word", "card_py", "names", "draft"]


def main():
    folder = latest_version_path("data/build/pinyin_batches", "")
    answers_dir = Path("data/claude") / folder.name.replace("pinyin_batches", "pinyin")
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    complete = read_json(latest_version_path("data/public/hsk_complete", ".json"))
    listed = public_readings(complete)
    readings = known_readings(listed, words.values())
    facts = word_facts(complete, listed, words.values())
    names = names_of(name_rows(read_csv(latest_version_path("data/manual/capitals", ".csv")))[0], words.values())
    problems, redo, done, kept, notes, known_wrong = [], {}, {}, [], [], 0
    tries = {1: 0, 2: 0, 3: 0}
    for batch in sorted(folder.glob("batch_???.csv")):
        given = read_csv(batch)
        rounds = dict(all_version_paths(answers_dir / batch.stem, ".csv"))
        sent = {1: given}
        for v in range(2, REDOS + 2):
            path = folder / f"{batch.stem}_redo_v{v:03d}.csv"
            if path.exists():
                sent[v] = read_csv(path)
        missing = [v for v in sent if v not in rounds]
        if missing:
            problems.append(f"{batch.stem}: no answer file batch_{batch.stem[6:]}_v{missing[0]:03d}.csv")
            continue
        answers = {}
        for v, rows in sent.items():
            answers[v], more = match_answers(rows, read_csv(rounds[v]))
            notes += [f"{batch.stem} v{v:03d}: {p}" for p in more]
        for row in given:
            rid = row["id"]
            last = max(v for v, rows in sent.items() if any(r["id"] == rid for r in rows))
            answer = answers[last].get(rid)
            found = ["there is no single answer row for this line"] if answer is None else \
                check_answer(row, answer, words[rid], readings, names, facts)
            if ((answer or {}).get("note") or "").strip():
                notes.append(f"{rid}: {answer['note'].strip()}")
            if not found:
                done[rid] = {"id": rid, "sentence": row["sentence"], "py": answer["py"].strip(), "draft": row["draft"],
                             "source": "claude"}
                tries[last] += 1
            elif last <= REDOS:
                redo.setdefault(batch.stem, []).append(
                    [row[c] for c in COLUMNS] + [(answer or {}).get("py", ""), " | ".join(found)])
            else:
                done[rid] = {"id": rid, "sentence": row["sentence"], "py": row["draft"], "draft": row["draft"],
                             "source": "draft"}
                wrong = check_line(row["sentence"], row["draft"], words[rid], readings, names, facts)
                known_wrong += bool(wrong)
                kept.append(f"{rid} {row['sentence']} | draft {row['draft']} | last answer: {' | '.join(found)}"
                            + (f" | the draft fails the strict checker too: {' | '.join(wrong)}" if wrong else ""))
    if problems:
        sys.exit("Stopped, nothing written. Run the agents for these files first:\n  " + "\n  ".join(problems))
    if redo:
        written = []
        for stem, rows in redo.items():
            version = max(dict(all_version_paths(answers_dir / stem, ".csv"))) + 1
            path = folder / f"{stem}_redo_v{version:03d}.csv"
            write_new_csv(path, COLUMNS + ["earlier", "problem"], rows)
            written.append(str(path))
        count = sum(len(rows) for rows in redo.values())
        sys.exit(f"Stopped, only redo files written. {count} lines failed the strict checker and go to a redo agent "
                 "(Task 14 Step 5), then run this step again:\n  " + "\n  ".join(written))
    earlier = all_version_paths("data/build/sentence_pinyin_final", ".jsonl")
    rows = {r["id"]: r for r in (read_jsonl(earlier[-1][1]) if earlier else [])}
    rows.update(done)
    accepted = sorted(rid for rid, r in done.items() if r["source"] == "claude")
    sample = sorted(random.Random(17).sample(accepted, min(SAMPLE, len(accepted))))
    paths = next_versions(rows=("data/build/sentence_pinyin_checked", ".jsonl"),
                          review=("data/build/pinyin_review", ""), report=("data/reports/pinyin_check", ".txt"))
    write_new_jsonl(paths["rows"], [rows[rid] for rid in sorted(rows)])
    paths["review"].mkdir()
    by_id = {r["id"]: r for batch in sorted(folder.glob("batch_???.csv")) for r in read_csv(batch)}
    write_new_csv(paths["review"] / "batch_001.csv", COLUMNS[:5] + ["py"],
                  [[by_id[rid][c] for c in COLUMNS[:5]] + [done[rid]["py"]] for rid in sample])
    lines = ["Pinyin check report", "",
             f"Batches: {folder}. Lines checked: {len(done)}. Sentences in all: {len(rows)}.",
             f"Accepted at the first answer: {tries[1]}. After one redo: {tries[2]}. After two redos: {tries[3]}.",
             f"Kept as the draft after two failed redos: {len(kept)}. Drafts among them that fail the strict "
             f"checker too, so they are known to be wrong: {known_wrong}.",
             f"Sample for the independent checker: {len(sample)} lines in {paths['review']}", "",
             "Lines kept as the draft, with the checker's messages (show them to the user):"]
    lines += [f"  {line}" for line in kept] or ["  none"]
    lines += ["", "Notes from the agents (names that may need a row in data/manual/capitals, doubts):"]
    lines += [f"  {line}" for line in notes] or ["  none"]
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines[:6]))
    print(f"Report: {paths['report']}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Check the answers, and run the redo agents until no line waits**

Run: `PYTHONIOENCODING=utf-8 python tools/08d_pinyin_merge.py`
While lines fail, it stops with `Stopped, only redo files written. N lines failed the strict checker and go to a redo agent (Task 14 Step 5), then run this step again:` and lists files such as `data\build\pinyin_batches_v001\batch_001_redo_v002.csv`. For each listed file, start a fresh agent with the correcting instructions plus the redo paragraph, with `{output}` = `data/claude/pinyin_v001/batch_001_v002.csv` (the version in the redo file's name). Then run this step again. A line can be redone twice, so there are at most two such rounds.

When no line waits for a redo, it prints the start of the report, for example (the prototype run with stand-in answers, which left out 2 rows and gave 12 wrong lines on purpose):
```
Pinyin check report

Batches: data\build\pinyin_batches_v001. Lines checked: 4051. Sentences in all: 4051.
Accepted at the first answer: 4035. After one redo: 13. After two redos: 0.
Kept as the draft after two failed redos: 3. Drafts among them that fail the strict checker too, so they are known to be wrong: 1.
Sample for the independent checker: 150 lines in data\build\pinyin_review_v001
```
Open `data/reports/pinyin_check_vCCC.txt`. It lists every line kept as the draft with the checker's messages, and says for each one whether the draft itself fails the checker. These lines go into the final report (Task 20). The report also lists the agents' notes. Do not act on the notes that name a missing name yet, because a new run of step 8 now would make step 8c send every sentence again. Step 9 handles them after Step 8.

- [ ] **Step 6: Run the independent checker agent**

Start one fresh agent that corrected none of the lines, with the checker instructions and the paths filled in. If step 8e (Step 8) stops with `Redo the checker's answer (Task 14 Step 6):`, start another fresh agent that corrected none of the lines, with the same instructions plus the redo paragraph for the independent checker above, filled with the problem lines that step 8e printed, and let it write `batch_001_v002.csv`. Then run Step 8 again.

- [ ] **Step 7: Write `tools/08e_pinyin_review_apply.py`**

```python
"""Step 8e. Apply the independent checker's verdicts on the sample and write the final sentence pinyin.

Inputs:  the latest data/build/sentence_pinyin_checked_vCCC.jsonl and data/build/pinyin_review_vCCC/, the
         checker's answers in data/claude/pinyin_review_vCCC/ (for each batch_KKK.csv the latest
         batch_KKK_vMMM.csv; columns id, verdict, py, point, note), and the word list, the public list and
         data/manual/capitals as in step 8d
Outputs: data/build/sentence_pinyin_final_vFFF.jsonl {id, sentence, py, draft, source}, where a line the
         checker fixed has the source review, and data/reports/pinyin_review_vFFF.txt
Nothing is written when an answer is missing or malformed or a FIX line fails the strict checker (then a
fresh checker agent redoes the sample), or when more than 5% of the sample needed a fix (then the user
decides what happens next).
"""
import sys
from pathlib import Path

from common import (all_version_paths, latest_version_path, next_versions, read_csv, read_json, read_jsonl,
                    write_new_jsonl, write_new_text)
from pinyin_text import name_rows
from pinyincheck import check_line, known_readings, match_answers, names_of, word_facts
from wordlist import public_readings

MAX_SHARE = 0.05


def main():
    checked_path = latest_version_path("data/build/sentence_pinyin_checked", ".jsonl")
    version = checked_path.stem.rsplit("_", 1)[1]
    rows = {r["id"]: r for r in read_jsonl(checked_path)}
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    complete = read_json(latest_version_path("data/public/hsk_complete", ".json"))
    listed = public_readings(complete)
    readings = known_readings(listed, words.values())
    facts = word_facts(complete, listed, words.values())
    names = names_of(name_rows(read_csv(latest_version_path("data/manual/capitals", ".csv")))[0], words.values())
    answers_dir = Path("data/claude") / f"pinyin_review_{version}"
    problems, fixes, sample = [], {}, []
    for batch in sorted(Path(f"data/build/pinyin_review_{version}").glob("batch_*.csv")):
        given = read_csv(batch)
        sample += [r["id"] for r in given]
        found = all_version_paths(answers_dir / batch.stem, ".csv")
        if not found:
            problems.append(f"{batch.stem}: no answer file")
            continue
        got, more = match_answers(given, read_csv(found[-1][1]))
        problems += [f"{batch.stem}: {p}" for p in more]
        for r in given:
            answer = got.get(r["id"])
            verdict = ((answer or {}).get("verdict") or "").strip()
            line = ((answer or {}).get("py") or "").strip()
            if answer is None:
                problems.append(f"{r['id']}: missing")
            elif verdict == "FIX":
                wrong = check_line(r["sentence"], line, words[r["id"]], readings, names, facts)
                if wrong or line == r["py"]:
                    why = "fails the strict checker: " + " | ".join(wrong) if wrong else "is the line as given"
                    problems.append(f"{r['id']}: the FIX line {line!r} {why}")
                else:
                    fixes[r["id"]] = (line, (answer.get("point") or "").strip(), (answer.get("note") or "").strip())
            elif verdict != "OK":
                problems.append(f"{r['id']}: verdict {verdict!r} is not OK or FIX")
    if problems:
        sys.exit("Stopped, nothing written. Redo the checker's answer (Task 14 Step 6):\n  "
                 + "\n  ".join(problems[:40]))
    share = len(fixes) / len(sample) if sample else 0.0
    if share > MAX_SHARE:
        sys.exit(f"Stopped, nothing written. The independent checker fixed {len(fixes)} of {len(sample)} sampled lines "
                 f"({share:.1%}), more than {MAX_SHARE:.0%}. Show the fixes to the user and ask how to proceed.")
    for rid, (line, _, _) in fixes.items():
        rows[rid] = {**rows[rid], "py": line, "source": "review"}
    paths = next_versions(rows=("data/build/sentence_pinyin_final", ".jsonl"),
                          report=("data/reports/pinyin_review", ".txt"))
    write_new_jsonl(paths["rows"], [rows[rid] for rid in sorted(rows)])
    lines = ["Pinyin review report", "", f"Sample: {len(sample)} lines. Fixed by the independent checker: {len(fixes)} "
             f"({share:.1%}).", f"Final sentence pinyin: {paths['rows']}", ""]
    lines += [f"  {rid} point {point or '?'}: {rows[rid]['py']} ({note})"
              for rid, (_, point, note) in sorted(fixes.items())]
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
```

- [ ] **Step 8: Apply the review and write the final sentence pinyin**

Run: `PYTHONIOENCODING=utf-8 python tools/08e_pinyin_review_apply.py`
Expected: `Pinyin review report`, `Sample: 150 lines. Fixed by the independent checker: K (P%).` with P at most 5% and one decimal (the prototype's 3 stand-in fixes gave `3 (2.0%)`), the line `Final sentence pinyin: data\build\sentence_pinyin_final_v001.jsonl`, and one line per fix with its style-sheet point. If it stops with `Redo the checker's answer (Task 14 Step 6):`, go back to Step 6 with the problem lines it printed. If it stops on the 5% share, it prints the share with one decimal, for example `fixed 8 of 150 sampled lines (5.3%), more than 5%`. Then show the user the fixes from the checker's answer file and ask how to proceed. A likely answer is to add an example for the misread point to the correcting instructions and to run this task again on the batches. In a later round with only a few lines, a single fix is already more than 5%, so step 8e stops then too, and the user looks at that fix.

- [ ] **Step 9: Add the names from the agents' notes**

Now that step 8e has written a final file, open the latest `data/reports/pinyin_check_vCCC.txt` again. For each note that names a real name of a person, place, organisation or event that `data/manual/capitals` lacks, add a row to a new version of that file, as Task 11 Step 3 says. If there is none, skip this step. Otherwise rerun step 8 (Task 11 Step 2, and Task 12 if characters are listed), then this task from Step 2. Step 8c now sends only the sentences whose draft changed.
Expected: `N of 5043 sentences in B batch files in data\build\pinyin_batches_v002, ...`, where N is the number of sentences that hold the new names. On the prototype run, a row `黄土高原,黄土 高原,Y,sentence` added after step 8e gave `1 of 4051 sentences in 1 batch files`. The same row added before step 8e had written a final file gave `4051 of 4051`, which is why the names wait until now.

- [ ] **Step 10: Commit**

```bash
git add tools/08c_pinyin_batches.py tools/08d_pinyin_merge.py tools/08e_pinyin_review_apply.py data/claude/pinyin_v* data/claude/pinyin_review_v* data/manual/capitals_v*.csv && git commit -F - <<'EOF'
feat: Claude corrects the sentence pinyin against the style sheet, with a strict checker and a review sample

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 15: Install edge-tts, and audio names and checks (`tools/ttsaudio.py`)

**Files:**
- Create: `tools/ttsaudio.py`
- Test: `tests/test_ttsaudio.py`

edge-tts is a Python tool that sends text to Microsoft's online neural voices and saves the speech as MP3. The voice is `zh-CN-XiaoxiaoNeural`, words are read at rate `-10%` and sentences at `-15%`. A file's name is the word ID plus the first 8 hexadecimal digits of the SHA-1 hash of "voice|rate|text". So changed text gets a new file, and nothing is ever overwritten.

- [ ] **Step 1: Install edge-tts and check its call**

Run: `python -m pip install "edge-tts>=6.1"`
Then run: `python -c "import edge_tts, inspect; print(inspect.signature(edge_tts.Communicate.__init__)); print(hasattr(edge_tts.Communicate, 'save_sync'))"`
Expected: a signature that contains `text` and `voice` and a keyword `rate='+0%'`, then `True`.

- [ ] **Step 2: Write the failing test `tests/test_ttsaudio.py`**

```python
from ttsaudio import audio_map, audio_path, jobs, mp3_problem, needs_standin, spoken, standins_from


def test_spoken():
    assert spoken("虽然…但是…") == "虽然，但是"
    assert spoken("爱") == "爱"


def test_audio_path_changes_with_text_rate_and_voice():
    a = audio_path("w", "w0001", "爱", "-10%")
    assert a.startswith("w/w0001_") and a.endswith(".mp3") and len(a) == len("w/w0001_12345678.mp3")
    assert a == audio_path("w", "w0001", "爱", "-10%")
    assert a != audio_path("w", "w0001", "爱", "-15%")
    assert a != audio_path("w", "w0001", "爱你", "-10%")
    assert a != audio_path("w", "w0001", "爱", "-10%", voice="zh-CN-YunxiNeural")


def test_mp3_problem():
    assert mp3_problem(b"ID3" + b"\0" * 6000, "w") is None
    assert mp3_problem(b"\xff\xf3" + b"\0" * 12000, "s") is None
    assert mp3_problem(b"<html>" + b"\0" * 6000, "w") == "not an MP3 file"
    assert mp3_problem(b"ID3" + b"\0" * 100, "w") == "about 0.0 s long, outside 0.3 to 6.0 s"


def test_needs_standin_and_jobs():
    words = [{"id": "w1", "hz": "行", "pyNum": "hang2"}, {"id": "w2", "hz": "爱", "pyNum": "ai4"},
             {"id": "w3", "hz": "银行", "pyNum": "yin2 hang2"}]
    default = {"行": "xing2", "爱": "ai4"}
    assert [w["id"] for w in needs_standin(words, lambda hz: default.get(hz, ""))] == ["w1"]
    standins = standins_from([{"hz": "行", "pynum": "hang2", "speak": "杭"}])
    assert standins == {("行", "hang2"): "杭"}
    made = jobs(words[:1], {"w1": "我去银行。"}, standins)
    assert [(j["kind"], j["text"], j["rate"]) for j in made] == [("w", "杭", "-10%"), ("s", "我去银行。", "-15%")]
    assert made[0]["path"] == audio_path("w", "w1", "杭", "-10%")
    assert audio_map(made) == {"w1": {"w": made[0]["path"], "s": made[1]["path"]}}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `python -m pytest tests/test_ttsaudio.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'ttsaudio'`

- [ ] **Step 4: Write `tools/ttsaudio.py`**

```python
"""Names, texts and checks for the MP3 files made with Microsoft's neural voice through edge-tts.

A file's name is the word ID plus a short hash of the voice, the speed and the text, for
example "w/w0001_3fa2b1c9.mp3". Changed text gives a new name, so an old file is never
overwritten, and a finished file can be skipped when the script is run again.
"""
import hashlib

VOICE = "zh-CN-XiaoxiaoNeural"
WORD_RATE, SENTENCE_RATE = "-10%", "-15%"
BYTES_PER_SECOND = 6000  # edge-tts sends 24 kHz mono MP3 at 48 kilobits per second
SECONDS = {"w": (0.3, 6.0), "s": (0.8, 20.0)}


def spoken(hz):
    """The text read aloud for a headword, where a pattern word's halves become a short list.

    "虽然…但是…" gives "虽然，但是"; "爱" stays "爱".
    """
    return "，".join(p for p in hz.split("…") if p)


def audio_path(kind, wid, text, rate, voice=VOICE):
    """The path relative to docs/audio/ for kind "w" (word) or "s" (sentence), a word ID and a text."""
    digest = hashlib.sha1(f"{voice}|{rate}|{text}".encode("utf-8")).hexdigest()[:8]
    return f"{kind}/{wid}_{digest}.mp3"


def mp3_problem(data, kind):
    """Why these bytes are not a usable MP3 of the expected length, or None.

    An MP3 starts with an ID3 tag or an MPEG frame header (0xFF then three set bits). The length
    in seconds is estimated from the size, and a word must last 0.3 to 6 s and a sentence 0.8 to 20 s.
    """
    if len(data) < 4 or not (data[:3] == b"ID3" or (data[0] == 0xFF and data[1] & 0xE0 == 0xE0)):
        return "not an MP3 file"
    seconds = len(data) / BYTES_PER_SECOND
    low, high = SECONDS[kind]
    if not low <= seconds <= high:
        return f"about {seconds:.1f} s long, outside {low} to {high} s"
    return None


def needs_standin(words, default_reading):
    """Single-character words whose card reading is not the character's default reading.

    default_reading(hz) gives the numbered reading a speech engine is likely to use. For these
    words a same-sound stand-in character is read instead, for example 杭 for 行 háng.
    """
    return [w for w in words if len(w["hz"]) == 1 and default_reading(w["hz"]) != w["pyNum"]]


def jobs(words, sentences, standins):
    """Every file to make: {"id", "kind", "text", "rate", "path"}.

    standins maps (hz, pyNum) to the text to read instead of the headword.
    sentences maps id to the final sentence text.
    """
    out = []
    for w in words:
        text = standins.get((w["hz"], w["pyNum"]), spoken(w["hz"]))
        out.append({"id": w["id"], "kind": "w", "text": text, "rate": WORD_RATE,
                    "path": audio_path("w", w["id"], text, WORD_RATE)})
        sentence = sentences[w["id"]]
        out.append({"id": w["id"], "kind": "s", "text": sentence, "rate": SENTENCE_RATE,
                    "path": audio_path("s", w["id"], sentence, SENTENCE_RATE)})
    return out


def standins_from(rows):
    """{(hz, pynum): speak} from the rows of data/manual/tts_standins_vNNN.csv (columns hz, pynum, speak)."""
    return {(r["hz"], r["pynum"]): r["speak"] for r in rows}


def audio_map(made):
    """{id: {"w": path, "s": path}} from the list that jobs() returns.

    Step 9 writes this map, and step 10 builds it again from the final texts to check that the
    audio was made from the same texts.
    """
    out = {}
    for job in made:
        out.setdefault(job["id"], {})[job["kind"]] = job["path"]
    return out
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `python -m pytest tests/test_ttsaudio.py -q`
Expected: `4 passed`

- [ ] **Step 6: Commit**

```bash
git add tools/ttsaudio.py tests/test_ttsaudio.py && git commit -F - <<'EOF'
feat: audio file names, spoken text and MP3 checks

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 16: Make the audio (`tools/09_generate_audio.py`)

**Files:**
- Create: `tools/09_generate_audio.py`, `data/manual/tts_standins_v001.csv`
- Output: `docs/audio/w/*.mp3`, `docs/audio/s/*.mp3`, `data/build/audio_map_vNNN.json`, `data/reports/audio_vNNN.txt`

The run works as follows:
- **Order and pace.** The script makes files one at a time with a 0.3-second pause and up to 4 tries per file (waiting 2, 4, 8 and 16 seconds).
- **Safe writing.** Each file is written as `<name>.mp3.part` (ignored by git) and renamed only after the MP3 check passes. A finished file is therefore never replaced.
- **Resuming.** It can be stopped at any time. A rerun checks the finished files and makes only the missing ones, which matters if the university network blocks the service part-way.
- **Size and time.** There are 10,086 files (a word file and a sentence file for each of the 5,043 cards). At roughly 0.5 to 1 second each, a full run takes about 1.5 to 3 hours.

- [ ] **Step 1: Write `tools/09_generate_audio.py`**

```python
"""Step 9. Make the MP3 files with Microsoft's neural Chinese voice through edge-tts.

Inputs:  data/build/wordlist_vNNN.jsonl and data/build/sentences_final_vNNN.jsonl (latest),
         data/manual/tts_standins_vNNN.csv (latest; hz, pynum, speak)
Outputs: docs/audio/w/<id>_<hash>.mp3 and docs/audio/s/<id>_<hash>.mp3,
         data/build/audio_map_vNNN.json ({id: {"w": path, "s": path}}) once every file is present,
         data/reports/audio_vNNN.txt
Run with --suggest-standins first. It lists the single-character words whose card reading differs
from the character's default reading, with same-sound characters to read instead, in
data/build/tts_standins_suggested_vNNN.csv.
The script can be stopped and rerun. Finished files are checked and kept, and missing ones are made.
A file is first written as <name>.mp3.part and renamed only after it passes the MP3 check.
"""
import argparse
import os
import sys
import time
from pathlib import Path

import edge_tts
from pypinyin import Style, lazy_pinyin, pinyin

from common import (all_version_paths, latest_version_path, next_version_path, next_versions, read_csv, read_jsonl,
                    write_new_csv, write_new_json, write_new_text)
from sentences import char_levels
from ttsaudio import VOICE, audio_map, jobs, mp3_problem, needs_standin, standins_from

ROOT = Path("docs/audio")
PAUSE, TRIES = 0.3, 4
OPTIONS = dict(style=Style.TONE3, neutral_tone_with_five=True, v_to_u=True)


def default_reading(hz):
    return lazy_pinyin(hz, **OPTIONS)[0]


def only_reading(ch):
    found = set(pinyin(ch, heteronym=True, **OPTIONS)[0])
    return found.pop() if len(found) == 1 else None


def suggest(words):
    targets = needs_standin(words, default_reading)
    levels = char_levels(words)
    pool = sorted(levels, key=lambda ch: (levels[ch], ch))
    rows = []
    for w in targets:
        options = [ch for ch in pool if ch != w["hz"] and only_reading(ch) == w["pyNum"]][:3]
        rows.append([w["hz"], w["pyNum"], w["py"], default_reading(w["hz"]), " ".join(options),
                     options[0] if options else ""])
    path = next_version_path("data/build/tts_standins_suggested", ".csv")
    write_new_csv(path, ["hz", "pynum", "py", "default", "options", "speak"], rows, excel=True)
    print(f"{len(rows)} words need a stand-in. Suggestions: {path}")


def make(job):
    """Make one file if it is missing. Returns None when the file is ready, else why it is not."""
    final = ROOT / job["path"]
    if final.exists():
        return mp3_problem(final.read_bytes(), job["kind"])
    part = final.with_name(final.name + ".part")
    error = None
    for attempt in range(TRIES):
        try:
            edge_tts.Communicate(job["text"], VOICE, rate=job["rate"]).save_sync(str(part))
            error = None
            break
        except Exception as e:  # the service can refuse or drop a request; wait and try again
            error = f"{type(e).__name__}: {e}"
            time.sleep(2 ** (attempt + 1))
    time.sleep(PAUSE)
    if error:
        return error
    problem = mp3_problem(part.read_bytes(), job["kind"])
    if problem:
        part.unlink()
        return problem
    os.rename(part, final)
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--suggest-standins", action="store_true")
    args = parser.parse_args()
    words = read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))
    if args.suggest_standins:
        suggest(words)
        return
    sentences = {r["id"]: r["sentence"] for r in read_jsonl(latest_version_path("data/build/sentences_final", ".jsonl"))}
    found = all_version_paths("data/manual/tts_standins", ".csv")
    standins = standins_from(read_csv(found[-1][1])) if found else {}
    missing = [w for w in needs_standin(words, default_reading) if (w["hz"], w["pyNum"]) not in standins]
    if missing:
        sys.exit("Stopped. These words need a row in data/manual/tts_standins_vNNN.csv: "
                 + " ".join(f"{w['hz']} {w['pyNum']}" for w in missing))
    todo = jobs(words, sentences, standins)
    for kind in ("w", "s"):
        (ROOT / kind).mkdir(parents=True, exist_ok=True)
    failures = []
    for n, job in enumerate(todo, start=1):
        problem = make(job)
        if problem:
            failures.append(f"{job['path']} ({job['text']}): {problem}")
        if n % 200 == 0:
            print(f"{n}/{len(todo)} files, {len(failures)} failed so far", flush=True)
    lines = ["Audio report", "", f"Voice {VOICE}. Files: {len(todo)}. Failed: {len(failures)}.", ""] + failures[:200]
    if failures:
        path = next_version_path("data/reports/audio", ".txt")
        write_new_text(path, "\n".join(lines) + "\n")
        sys.exit(f"{len(failures)} files failed, listed in {path}. Run the script again to retry them.")
    audio = audio_map(todo)
    standin_list = [f"  {w['id']} {w['hz']} {w['py']}: docs/audio/{audio[w['id']]['w']}"
                    for w in words if (w["hz"], w["pyNum"]) in standins]
    lines += ["Word files read with a stand-in character (for the listening check):"] + standin_list
    paths = next_versions(map=("data/build/audio_map", ".json"), report=("data/reports/audio", ".txt"))
    write_new_json(paths["map"], audio)
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines[:4]))
    print(f"Audio map: {paths['map']}. Report: {paths['report']}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: List the words that need a stand-in**

Run: `PYTHONIOENCODING=utf-8 python tools/09_generate_audio.py --suggest-standins`
Expected: `N words need a stand-in. Suggestions: data\build\tts_standins_suggested_v001.csv`. The file lists each single-character card whose reading differs from pypinyin's default reading, with up to three characters that have only that reading.

- [ ] **Step 3: Write `data/manual/tts_standins_v001.csv`**

Open the suggestions file and write one row per suggested word, with the columns `hz,pynum,speak`. The rows follow these rules:
- **speak** is a single common character from the `options` column that has exactly the card's sound and tone, for example `行,hang2,杭`. Pick the most familiar option, not necessarily the first.
- **When the options column is empty,** write the headword itself in speak, which keeps the engine's own reading. Put that word on the listening-check list in Task 20.
- **Check each chosen character** against its pinyin in the public list (`data/public/hsk_complete_v001.json`) before writing the row.

The file header is exactly `hz,pynum,speak`.

- [ ] **Step 4: Make the audio**

Run: `PYTHONIOENCODING=utf-8 python tools/09_generate_audio.py`
Expected: progress lines every 200 files, then `Voice zh-CN-XiaoxiaoNeural. Files: 10086. Failed: 0.` and the audio map path. If it prints a failure count, run the same command again. If failures persist on the university network, run it from a home network. If a finished file is reported as not an MP3, delete that one file (a broken output of this script) and rerun.

- [ ] **Step 5: Listen to five files**

Run: `ls docs/audio/w | head -3; ls docs/audio/s | head -2`
Open two word files and one sentence file in the default player (Git Bash: `start "" "docs/audio/w/<name>.mp3"`). Each word should play once, clearly and slightly slowly, and the sentence should match its text.

- [ ] **Step 6: Commit the script, the stand-ins and the audio**

```bash
git add tools/09_generate_audio.py data/manual/tts_standins_v001.csv docs/audio && git commit -F - <<'EOF'
feat: word and sentence audio with the Xiaoxiao neural voice

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 17: Assemble the words file (`tools/wordsjson.py` and `tools/10_build_words_json.py`)

**Files:**
- Create: `tools/wordsjson.py`, `tools/10_build_words_json.py`
- Test: `tests/test_wordsjson_validate.py` (its validation tests are added in Task 18)
- Input: the final sentence pinyin of Task 14 (`data/build/sentence_pinyin_final_vFFF.jsonl`), besides the word list, curriculum, themes, sentences, the draft of step 8 and the audio map
- Output: `docs/data/words_v001.json`

- [ ] **Step 1: Write the failing test `tests/test_wordsjson_validate.py`**

```python
from wordsjson import LICENSE, build, stale

ROWS = [("w0001", "爱", "ài", "ai4", "ai", "love"), ("w0002", "八", "bā", "ba1", "ba", "eight"),
        ("w0003", "爸爸", "bàba", "ba4 ba5", "baba", "father"), ("w0004", "杯子", "bēizi", "bei1 zi5", "beizi", "cup"),
        ("w0005", "北京", "Běijīng", "bei3 jing1", "beijing", "Beijing")]


def sample():
    words = [{"id": i, "hz": hz, "py": py, "pyNum": num, "pyBase": base, "syl": len(num.split()), "lv": 1,
              "pos": ["n."], "en": en, "enShort": en, "freq": 1} for i, hz, py, num, base, en in ROWS]
    curriculum = [{"id": w["id"], "theme": "t01", "ord": k, "noDistract": []} for k, w in enumerate(words, start=1)]
    themes = [{"id": "t01", "order": 1, "name": "Family & People", "count": 5}]
    sentences = [{"id": w["id"], "sentence": f"我说{w['hz']}。", "en": "I say it.", "src": "claude"} for w in words]
    pinyin = {w["id"]: f"Wǒ shuō {w['py']}." for w in words}
    audio = {w["id"]: {"w": f"w/{w['id']}_0123abcd.mp3", "s": f"s/{w['id']}_4567cdef.mp3"} for w in words}
    return build("v001", "2026-10-05", words, curriculum, themes, sentences, pinyin, audio)


def test_build_matches_the_schema_example_shape():
    data = sample()
    assert list(data) == ["version", "generated", "license", "themes", "words"] and data["license"] == LICENSE
    first = data["words"][0]
    assert list(first) == ["id", "hz", "py", "pyNum", "pyBase", "syl", "lv", "pos", "en", "enShort", "theme", "ord",
                           "au", "noDistract", "ex"]
    assert first["ex"] == {"hz": "我说爱。", "py": "Wǒ shuō ài.", "en": "I say it.", "au": "s/w0001_4567cdef.mp3",
                           "src": "claude"}


def test_stale_names_pinyin_and_audio_made_from_other_text():
    sentences = [{"id": "w0001", "sentence": "我爱你。"}, {"id": "w0002", "sentence": "八个人。"}]
    pinyin_rows = [{"id": "w0001", "sentence": "我爱你。", "py": "Wǒ ài nǐ."},
                   {"id": "w0002", "sentence": "八本书。", "py": "Bā běn shū."}]
    expected = {"w0001": {"w": "w/w0001_0123abcd.mp3", "s": "s/w0001_4567cdef.mp3"},
                "w0002": {"w": "w/w0002_0123abcd.mp3", "s": "s/w0002_89abcdef.mp3"}}
    audio = {"w0001": expected["w0001"], "w0002": {"w": "w/w0002_0123abcd.mp3", "s": "s/w0002_00000000.mp3"}}
    assert stale(sentences, pinyin_rows, audio, expected) == [
        "w0002: the pinyin was made from '八本书。' but the final sentence is '八个人。'",
        "w0002: the audio map has s/w0002_00000000.mp3 where the final texts give s/w0002_89abcdef.mp3"]
    assert stale(sentences, pinyin_rows[:1], {"w0001": audio["w0001"]}, {"w0001": expected["w0001"]}) == []
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_wordsjson_validate.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'wordsjson'`

- [ ] **Step 3: Write `tools/wordsjson.py`**

```python
"""Assemble the app's word data file, exactly in the shape of .claude/plans/words-json-schema.md."""

LICENSE = ("Meanings adapted from CC-CEDICT (CC BY-SA 4.0) via drkameleon/complete-hsk-vocabulary (MIT). "
           "Example sentences: see ATTRIBUTION.md.")
WORD_FIELDS = ("id", "hz", "py", "pyNum", "pyBase", "syl", "lv", "pos", "en", "enShort")


def build(version, generated, words, curriculum, themes, sentences, pinyin, audio):
    """The whole data file as a dict.

    version: "v001". generated: "2026-10-05". words: word-list rows. curriculum: rows with
    id, theme, ord and noDistract. themes: [{id, order, name, count}]. sentences: rows with
    id, sentence, en and src. pinyin: {id: sentence pinyin}. audio: {id: {"w": path, "s": path}}.
    Words are listed in curriculum order.
    """
    place = {r["id"]: r for r in curriculum}
    said = {r["id"]: r for r in sentences}
    out = []
    for w in sorted(words, key=lambda w: place[w["id"]]["ord"]):
        c, s = place[w["id"]], said[w["id"]]
        entry = {k: w[k] for k in WORD_FIELDS}
        entry.update({"theme": c["theme"], "ord": c["ord"], "au": audio[w["id"]]["w"], "noDistract": c["noDistract"],
                      "ex": {"hz": s["sentence"], "py": pinyin[w["id"]], "en": s["en"], "au": audio[w["id"]]["s"],
                             "src": s["src"]}})
        out.append(entry)
    return {"version": version, "generated": generated, "license": LICENSE,
            "themes": [{k: t[k] for k in ("id", "order", "name", "count")} for t in themes], "words": out}


def stale(sentences, pinyin_rows, audio, expected):
    """Words whose sentence pinyin or audio was made from other text than the final sentences.

    sentences: rows with id and sentence (the final text from step 7). pinyin_rows: step 8's rows
    {id, sentence, py}, where sentence is the text the pinyin was made from. audio: step 9's map
    {id: {"w": path, "s": path}}. expected: the same map built again from the final texts
    (ttsaudio.audio_map), so a path differs when its text changed. For example, if step 7c
    corrected the sentence of w0002 after step 8 ran, both lines for w0002 are returned.
    Returns a list of problems; an empty list means everything matches.
    """
    final = {r["id"]: r["sentence"] for r in sentences}
    problems = [f"{r['id']}: the pinyin was made from {r['sentence']!r} but the final sentence is "
                f"{final.get(r['id'])!r}" for r in pinyin_rows if r["sentence"] != final.get(r["id"])]
    for wid, paths in expected.items():
        for kind in ("w", "s"):
            have = audio.get(wid, {}).get(kind)
            if have != paths[kind]:
                problems.append(f"{wid}: the audio map has {have} where the final texts give {paths[kind]}")
    return problems
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_wordsjson_validate.py -q`
Expected: `2 passed`

- [ ] **Step 5: Write `tools/10_build_words_json.py`**

```python
"""Step 10. Write the app's word data file.

Inputs (the latest of each): data/build/wordlist_vNNN.jsonl, curriculum_vNNN.jsonl, themes_vNNN.json,
         sentences_final_vNNN.jsonl, sentence_pinyin_final_vFFF.jsonl (the style-sheet pinyin of steps 8c
         to 8e), sentence_pinyin_vNNN.jsonl (the draft of step 8, whose polyphone_batches_vNNN folder must
         be empty), audio_map_vNNN.json and data/manual/tts_standins_vNNN.csv
Output:  docs/data/words_vNNN.json, compact UTF-8 JSON in the shape of .claude/plans/words-json-schema.md
Nothing is written when a word is missing from an input, when the corrected pinyin was made from an older
draft than the latest one of step 8, or when the sentence pinyin or the audio was made from other text than
the final sentences (for example after step 7c or 7d changed a sentence). Then the message names the words,
and the named steps must be run again.
"""
import json
import sys
from datetime import date
from pathlib import Path

from common import all_version_paths, latest_version_path, next_version_path, read_csv, read_json, read_jsonl, \
    write_new_text
from ttsaudio import audio_map, jobs, standins_from
from wordsjson import build, stale


def main():
    draft_path = latest_version_path("data/build/sentence_pinyin", ".jsonl")
    version = draft_path.stem.rsplit("_", 1)[1]
    if list(Path(f"data/build/polyphone_batches_{version}").glob("batch_*.csv")):
        sys.exit("Stopped. The latest pinyin run still lists characters to check (Plan 3b Task 12).")
    pinyin_path = latest_version_path("data/build/sentence_pinyin_final", ".jsonl")
    drafts = {r["id"]: r["py"] for r in read_jsonl(draft_path)}
    words = read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))
    curriculum = read_jsonl(latest_version_path("data/build/curriculum", ".jsonl"))
    themes = read_json(latest_version_path("data/build/themes", ".json"))
    sentences = read_jsonl(latest_version_path("data/build/sentences_final", ".jsonl"))
    pinyin_rows = read_jsonl(pinyin_path)
    pinyin = {r["id"]: r["py"] for r in pinyin_rows}
    older = [r["id"] for r in pinyin_rows if drafts.get(r["id"]) != r["draft"]]
    if older:
        sys.exit(f"Stopped, nothing written. The pinyin of {len(older)} sentences in {pinyin_path} was corrected from "
                 f"an older draft than {draft_path}, for example {older[:5]}. Run Task 14 again, whose step 8c "
                 "batches only those sentences.")
    audio = read_json(latest_version_path("data/build/audio_map", ".json"))
    ids = {w["id"] for w in words}
    gaps = {name: sorted(ids - set(have))[:5] for name, have in
            (("curriculum", {r["id"] for r in curriculum}), ("sentences", {r["id"] for r in sentences}),
             ("pinyin", set(pinyin)), ("audio", set(audio)))}
    gaps = {name: missing for name, missing in gaps.items() if missing}
    if gaps:
        sys.exit(f"Stopped, nothing written. Words missing from: {gaps}")
    found = all_version_paths("data/manual/tts_standins", ".csv")
    standins = standins_from(read_csv(found[-1][1])) if found else {}
    expected = audio_map(jobs(words, {r["id"]: r["sentence"] for r in sentences}, standins))
    problems = stale(sentences, pinyin_rows, audio, expected)
    if problems:
        sys.exit(f"Stopped, nothing written. {len(problems)} pinyin or audio entries were made from other text "
                 "than the final sentences. Run tools/08_pinyin.py (and Task 12 if it lists characters), Task 14, "
                 "then tools/09_generate_audio.py, then this step again:\n  " + "\n  ".join(problems[:20]))
    path = next_version_path("docs/data/words", ".json")
    data = build(path.stem.rsplit("_", 1)[1], date.today().isoformat(), words, curriculum, themes, sentences,
                 pinyin, audio)
    write_new_text(path, json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{len(data['words'])} words in {len(data['themes'])} themes -> {path} "
          f"({path.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Run it**

Run: `PYTHONIOENCODING=utf-8 python tools/10_build_words_json.py`
Expected: `5043 words in N themes -> docs\data\words_v001.json (about 2 MB)`. N is the theme count from Task 3.
If it stops with `pinyin or audio entries were made from other text than the final sentences`, a sentence changed after step 8 or step 9 ran. Run Task 11 Step 2 (and Task 12 if characters are listed), Task 14 from Step 2, which sends only the changed sentences to the agents, then Task 16 Step 4, which makes only the changed files, then this step again. If it stops because the pinyin was corrected from an older draft, step 8 ran again after Task 14, so run Task 14 from Step 2 and then this step again.

- [ ] **Step 7: Commit**

```bash
git add tools/wordsjson.py tools/10_build_words_json.py tests/test_wordsjson_validate.py docs/data/words_v001.json && git commit -F - <<'EOF'
feat: write the app's words file

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 18: Validation (`tools/validate.py` and `tools/11_validate.py`)

**Files:**
- Create: `tools/validate.py`, `tools/11_validate.py`
- Modify: `tests/test_wordsjson_validate.py` (append the validation tests)
- Input: also the latest `data/manual/capitals_vNNN.csv`, whose names may give a headword a capital in its sentence
- Output: `data/reports/validate_vNNN.txt`

The checks, and where each comes from:
- **From the schema file.** Every field is present with the right form:
  - `py` agrees with `pyBase`, and `pyBase` and `syl` agree with `pyNum`;
  - a headword of more than one character that ends in 儿 never has a `pyNum` ending in `er5`, because a neutral 儿 ending is the item `r5` (纽扣儿 is "niu3 kou4 r5", while 女儿 "nü3 er2" keeps its full syllable);
  - `py` is in the schema's word spacing (Plan 3a `pinyin_text.py_problems`). It holds only letters, spaces, hyphens and apostrophes (and "…" in a pattern word), with no two of them in a row and none at an end. Its syllables spell `pyNum` with the same tones once the 一 and 不 tone changes are removed, so "bú kèqi" fits bu4 ke4 qi5 but "bù kèqí" does not. An apostrophe stands before each syllable inside a word that starts with a, o or e, and nowhere else;
  - `pos` uses only the listed labels;
  - `en` has at most 3 senses and 80 characters, and `enShort` at most 30, and neither holds a Chinese character (a leftover CC-CEDICT cross-reference such as "abbr. for 哈萨克斯坦");
  - neither `en` nor `enShort` starts with a PDF part-of-speech label and a full stop, such as the separable-verb label in "sv. dance" (Plan 3a `meaning.LEFTOVER_LABEL`);
  - theme ids run `t01`, `t02`... in order, with correct counts;
  - `ord` runs 1 to N once each;
  - the audio paths look like `w/<id>_<hash>.mp3` and `s/<id>_<hash>.mp3`;
  - `ex.src` is `pdf` or `claude`;
  - `noDistract` names only existing other words;
  - the sentence contains the headword written out, never ～;
  - the sentence pinyin `ex.py` holds no Chinese character, 〇 (the zero of years) included, so a draft that kept "èr 〇 〇 bā nián" fails;
  - the sentence pinyin `ex.py` shows the headword exactly as its card's `py` (`head_py_problem`). Only a 一 or 不 at the end of the headword may show another tone, because it follows the next word (the card 不 "bù" is "bú" in "Tā bú shì xuésheng."), while one inside the headword keeps the tone its card shows (受不了 "shòubuliǎo", never "shòubùliǎo"). A capital may start a sentence or a word of a name (`name_starts`, so the card 省 may show "Shěng" in "Wǒ láizì Shāndōng Shěng.", as point 7 of the style sheet capitalises every word of a place name). The names are those of the strict checker (Task 13 `names_of`), which are the rows of `data/manual/capitals` and every card whose `py` starts with a capital, so the card 长 may show "Cháng" in "Wǒ qùguo Chángchéng." because the card 长城 is "Chángchéng", and the validator does not reject a capital on the headword that the checker accepted. An 儿 that follows the headword in `ex.hz` adds its "r" (这 in 这儿 "zhèr"). The headword may be a word of its own or stand inside a longer word, as long as it starts and ends at syllable edges there (`_BEFORE` and `_AFTER`). That covers a card word or public-list word that holds it (男 in "nánrén", 春 in "Chūntiān"), a joined particle, suffix or result (看 and 着 in "kànzhe", 驾驶 in "jiàshǐyuán", 写 in "xiěhǎo") and a number word (百 in "liǎngbǎi", 几 in "jǐshí"), while 户 "hù" is not shown by "zhù". A quotation after a colon starts a sentence too. It is checked once the card's own pinyin passes. The old step 8 failed it in 136 sentences (东西 "Dōngxi" inside a sentence, 学生 "xuéshēng"), and the step 8 of the third cross-review in 2 (受不了 "shòubùliǎo" and 不得了 "budéliǎo"). The check before the fifth cross-review, which wanted the headword as a whole word, fails 73 sentences of the new step 8, each with the headword inside a longer word.
- **From the spec's Verification list.**
  - about 5,000 cards (4,800 to 5,300);
  - unique IDs;
  - no empty fields and no □ (a leftover undecoded glyph);
  - every audio file exists and is a valid MP3 of a sensible length;
  - theme sizes from 40 to 350, for every theme including the Starter Kit, whose widened rule gives it 40 words;
  - HSK levels never go down within a theme;
  - the file is under 4 MB.
- **From this plan's task.** Every word has at least 3 usable wrong choices from its own theme in both choice quizzes (`distract.usable_choices`).

- [ ] **Step 1: Append the failing validation tests to `tests/test_wordsjson_validate.py`**

Add these lines at the end of the file:

```python


import copy

from validate import check_order, check_themes, check_word, validate


def test_validate_passes_a_good_file():
    results = validate(sample(), lambda path, kind: None, word_range=(5, 5), min_theme=5, max_theme=10)
    assert results == {"top": [], "word count": [], "themes": [], "fields": [], "order": [], "links": [],
                       "distractors": [], "audio": []}


def test_validate_reports_bad_fields_and_missing_audio():
    data = sample()
    bad = copy.deepcopy(data["words"][0])
    bad.update({"py": "ai4", "en": "a; b; c; d", "enShort": "abbr. for 哈萨克斯坦", "ex": {**bad["ex"], "hz": "我～你。"}})
    problems = check_word(bad, {"t01"})
    assert "w0001: py 'ai4' does not match pyBase 'ai'" in problems
    assert "w0001: en 'a; b; c; d' is empty, over 80 characters or over 3 senses" in problems
    assert "w0001: enShort 'abbr. for 哈萨克斯坦' contains Chinese characters" in problems
    assert "w0001: ex.hz '我～你。' does not contain the headword written out" in problems
    labelled = {**data["words"][1], "en": "sv. dance", "enShort": "/vm. number of times"}
    assert check_word(labelled, {"t01"}) == ["w0002: en 'sv. dance' starts with a part-of-speech label",
                                             "w0002: enShort '/vm. number of times' starts with a part-of-speech label"]
    results = validate(data, lambda path, kind: "missing" if path.startswith("s/") else None,
                       word_range=(5, 5), min_theme=5, max_theme=10)
    assert results["audio"][0] == "w0001: s/w0001_4567cdef.mp3: missing"


def test_check_order_catches_a_level_going_down():
    words = sample()["words"]
    words[0]["lv"] = 2
    assert check_order(words, ["t01"]) == ["w0002: level goes down from 2 to 1 inside t01"]


def test_the_starter_kit_needs_40_words_like_every_theme():
    data = sample()
    data["themes"][0]["name"] = "Starter Kit"
    assert check_themes(data["themes"], data["words"], 40, 350) == [
        "theme t01 Starter Kit: 5 words, outside 40 to 350"]


def test_check_word_checks_the_card_pinyin_spacing():
    w = sample()["words"][0]
    kept = {**w, "hz": "不客气", "py": "bú kèqi", "pyNum": "bu4 ke4 qi5", "pyBase": "bukeqi", "syl": 3,
            "ex": {**w["ex"], "hz": "他说不客气。", "py": "Tā shuō bú kèqi."}}
    idiom = {**kept, "hz": "拔苗助长", "py": "bámiáo-zhùzhǎng", "pyNum": "ba2 miao2 zhu4 zhang3",
             "pyBase": "bamiaozhuzhang", "syl": 4,
             "ex": {**w["ex"], "hz": "拔苗助长不好。", "py": "Bámiáo-zhùzhǎng bù hǎo."}}
    cute = {**kept, "hz": "可爱", "py": "kě'ài", "pyNum": "ke3 ai4", "pyBase": "keai", "syl": 2,
            "ex": {**w["ex"], "hz": "她很可爱。", "py": "Tā hěn kě'ài."}}
    assert [check_word(x, {"t01"}) for x in (kept, idiom, cute)] == [[], [], []]
    assert check_word({**kept, "py": "bù kèqí"}, {"t01"}) == ["w0001: syllable 3 of py is qi2 but pyNum has qi5"]
    assert check_word({**cute, "py": "kěài"}, {"t01"}) == ["w0001: an apostrophe is missing before syllable 2 'ài'"]
    assert check_word({**kept, "py": "bú_kèqi"}, {"t01"}) == [
        "w0001: py 'bú_kèqi' holds '_'; only letters, spaces, hyphens and apostrophes are allowed",
        "w0001: py 'bú_kèqi' does not match pyBase 'bukeqi'"]


def test_check_word_wants_a_neutral_er_ending_as_r5():
    w = sample()["words"][0]
    button = {**w, "hz": "纽扣儿", "py": "niǔkòur", "pyNum": "niu3 kou4 r5", "pyBase": "niukour", "syl": 2,
              "ex": {**w["ex"], "hz": "我的纽扣儿掉了。", "py": "Wǒ de niǔkòur diào le."}}
    daughter = {**button, "hz": "女儿", "py": "nǚ'ér", "pyNum": "nü3 er2", "pyBase": "nüer", "syl": 2,
                "ex": {**w["ex"], "hz": "她是我的女儿。", "py": "Tā shì wǒ de nǚ'ér."}}
    assert [check_word(x, {"t01"}) for x in (button, daughter)] == [[], []]
    old = {**button, "py": "niǔkòu'er", "pyNum": "niu3 kou4 er5", "pyBase": "niukouer", "syl": 3}
    assert check_word(old, {"t01"}) == ["w0001: pyNum 'niu3 kou4 er5' ends in er5, but a neutral 儿 ending is r5"]


def test_check_word_wants_the_headword_as_on_its_card():
    w = sample()["words"][0]
    thing = {**w, "hz": "东西", "py": "dōngxi", "pyNum": "dong1 xi5", "pyBase": "dongxi", "syl": 2,
             "ex": {**w["ex"], "hz": "我买了很多东西。", "py": "Wǒ mǎile hěn duō dōngxi."}}
    no = {**thing, "hz": "不", "py": "bù", "pyNum": "bu4", "pyBase": "bu", "syl": 1,
          "ex": {**w["ex"], "hz": "他不是学生。", "py": "Tā bú shì xuésheng."}}
    here = {**thing, "hz": "这", "py": "zhè", "pyNum": "zhe4", "pyBase": "zhe", "syl": 1,
            "ex": {**w["ex"], "hz": "我能坐在这儿吗？", "py": "Wǒ néng zuò zài zhèr ma?"}}
    first = {**thing, "ex": {**w["ex"], "hz": "东西在这儿。", "py": "Dōngxi zài zhèr."}}
    pattern = {**thing, "hz": "虽然…但是…", "py": "suīrán…dànshì…", "pyNum": "sui1 ran2 dan4 shi4",
               "pyBase": "suirandanshi", "syl": 4,
               "ex": {**w["ex"], "hz": "虽然下雨了，但是我去。", "py": "Suīrán xià yǔ le, dànshì wǒ qù."}}
    assert [check_word(x, {"t01"}) for x in (thing, no, here, first, pattern)] == [[], [], [], [], []]
    named = {**thing, "ex": {**thing["ex"], "py": "Wǒ mǎile hěn duō Dōngxi."}}
    east_west = {**thing, "ex": {**thing["ex"], "py": "Wǒ mǎile hěn duō dōngxī."}}
    assert check_word(named, {"t01"}) == [
        "w0001: ex.py 'Wǒ mǎile hěn duō Dōngxi.' does not show 'dōngxi' as on the card"]
    assert check_word(east_west, {"t01"}) == [
        "w0001: ex.py 'Wǒ mǎile hěn duō dōngxī.' does not show 'dōngxi' as on the card"]


def test_check_word_accepts_numbers_and_quotations():
    w = sample()["words"][0]
    thousand = {**w, "hz": "千", "py": "qiān", "pyNum": "qian1", "pyBase": "qian", "syl": 1,
                "ex": {**w["ex"], "hz": "这个手机一千元。", "py": "Zhè gè shǒujī yìqiān yuán."}}
    you = {**w, "hz": "你", "py": "nǐ", "pyNum": "ni3", "pyBase": "ni", "syl": 1,
           "ex": {**w["ex"], "hz": "他说：“你看。”", "py": 'Tā shuō: "Nǐ kàn."'}}
    assert [check_word(x, {"t01"}) for x in (thousand, you)] == [[], []]
    love = {**w, "ex": {**w["ex"], "hz": "我很爱你。", "py": "Wǒ hěn tài nǐ."}}
    assert check_word(love, {"t01"}) == ["w0001: ex.py 'Wǒ hěn tài nǐ.' does not show 'ài' as on the card"]
    some = {**w, "hz": "几", "py": "jǐ", "pyNum": "ji3", "pyBase": "ji", "syl": 1,
            "ex": {**w["ex"], "hz": "我去过几十个国家。", "py": "Wǒ qùguo jǐshí gè guójiā."}}
    assert check_word(some, {"t01"}) == []


def test_check_word_accepts_joined_particles_and_keeps_inner_tones():
    w = sample()["words"][0]
    point = {**w, "hz": "指", "py": "zhǐ", "pyNum": "zhi3", "pyBase": "zhi", "syl": 1,
             "ex": {**w["ex"], "hz": "他指着前面。", "py": "Tā zhǐzhe qiánmiàn."}}
    aspect = {**point, "hz": "着", "py": "zhe", "pyNum": "zhe5", "pyBase": "zhe",
              "ex": {**w["ex"], "hz": "他看着我。", "py": "Tā kànzhe wǒ."}}
    bear = {**w, "hz": "受不了", "py": "shòubuliǎo", "pyNum": "shou4 bu4 liao3", "pyBase": "shoubuliao", "syl": 3,
            "ex": {**w["ex"], "hz": "真让人受不了。", "py": "Zhēn ràng rén shòubuliǎo."}}
    drive = {**point, "hz": "驾驶", "py": "jiàshǐ", "pyNum": "jia4 shi3", "pyBase": "jiashi", "syl": 2,
             "ex": {**w["ex"], "hz": "驾驶员要小心。", "py": "Jiàshǐyuán yào xiǎoxīn."}}
    assert [check_word(x, {"t01"}) for x in (point, aspect, bear, drive)] == [[], [], [], []]
    full = {**bear, "ex": {**bear["ex"], "py": "Zhēn ràng rén shòubùliǎo."}}
    assert check_word(full, {"t01"}) == [
        "w0001: ex.py 'Zhēn ràng rén shòubùliǎo.' does not show 'shòubuliǎo' as on the card"]


def test_check_word_accepts_the_headword_inside_a_longer_word_at_syllable_edges():
    w = sample()["words"][0]
    man = {**w, "hz": "男", "py": "nán", "pyNum": "nan2", "pyBase": "nan", "syl": 1,
           "ex": {**w["ex"], "hz": "我不认识那个男人。", "py": "Wǒ bú rènshi nà gè nánrén."}}
    spring = {**man, "hz": "春", "py": "chūn", "pyNum": "chun1", "pyBase": "chun",
              "ex": {**w["ex"], "hz": "春天是一年的开始。", "py": "Chūntiān shì yì nián de kāishǐ."}}
    good = {**man, "hz": "好", "py": "hǎo", "pyNum": "hao3", "pyBase": "hao",
            "ex": {**w["ex"], "hz": "他把写好的信放进了信封里。", "py": "Tā bǎ xiěhǎo de xìn fàngjìnle xìnfēng lǐ."}}
    assert [check_word(x, {"t01"}) for x in (man, spring, good)] == [[], [], []]
    door = {**man, "hz": "户", "py": "hù", "pyNum": "hu4", "pyBase": "hu",
            "ex": {**w["ex"], "hz": "这户人家住在这儿。", "py": "Zhè zhù rénjiā zhù zài zhèr."}}
    assert check_word(door, {"t01"}) == [
        "w0001: ex.py 'Zhè zhù rénjiā zhù zài zhèr.' does not show 'hù' as on the card"]


def test_check_word_accepts_a_headword_that_starts_a_word_of_a_name():
    w = sample()["words"][0]
    province = {**w, "hz": "省", "py": "shěng", "pyNum": "sheng3", "pyBase": "sheng", "syl": 1,
                "ex": {**w["ex"], "hz": "我来自山东省。", "py": "Wǒ láizì Shāndōng Shěng."}}
    names = {"山东省": (["山东", "省"], [True, True]), "李老师": (["李", "老师"], [True, False])}
    assert check_word(province, {"t01"}, names) == []
    assert check_word(province, {"t01"}) == [
        "w0001: ex.py 'Wǒ láizì Shāndōng Shěng.' does not show 'shěng' as on the card"]
    whole = {**province, "ex": {**w["ex"], "hz": "全省都下雨了。", "py": "Quán Shěng dōu xià yǔ le."}}
    assert check_word(whole, {"t01"}, names) == [
        "w0001: ex.py 'Quán Shěng dōu xià yǔ le.' does not show 'shěng' as on the card"]
    teacher = {**province, "hz": "老师", "py": "lǎoshī", "pyNum": "lao3 shi1", "pyBase": "laoshi", "syl": 2,
               "ex": {**w["ex"], "hz": "李老师在吗？", "py": "Lǐ Lǎoshī zài ma?"}}
    assert check_word(teacher, {"t01"}, names) == [
        "w0001: ex.py 'Lǐ Lǎoshī zài ma?' does not show 'lǎoshī' as on the card"]


def test_the_validator_knows_the_card_names_that_the_checker_knows():
    # The strict checker (Task 13) takes its names from pinyincheck.names_of, which adds every card whose
    # py starts with a capital, and validate adds them too. So with the card 长城 "Chángchéng", the card
    # 长 may show "Cháng" in "Wǒ qùguo Chángchéng.", which the checker accepts.
    data = sample()
    first, second = data["words"][0], data["words"][1]
    long = {**first, "hz": "长", "py": "cháng", "pyNum": "chang2", "pyBase": "chang", "syl": 1,
            "ex": {**first["ex"], "hz": "我去过长城。", "py": "Wǒ qùguo Chángchéng."}}
    wall = {**second, "hz": "长城", "py": "Chángchéng", "pyNum": "chang2 cheng2", "pyBase": "changcheng", "syl": 2,
            "ex": {**second["ex"], "hz": "长城很长。", "py": "Chángchéng hěn cháng."}}
    data["words"][0], data["words"][1] = long, wall
    results = validate(data, lambda path, kind: None, word_range=(5, 5), min_theme=5, max_theme=10)
    assert results["fields"] == []
    assert check_word(long, {"t01"}) == ["w0001: ex.py 'Wǒ qùguo Chángchéng.' does not show 'cháng' as on the card"]


def test_ex_py_holds_no_chinese_character():
    # 〇 (U+3007), the zero of years, is a Chinese character too, so a draft that kept it fails.
    w = sample()["words"][0]
    year = {**w, "hz": "年", "py": "nián", "pyNum": "nian2", "pyBase": "nian", "syl": 1,
            "ex": {**w["ex"], "hz": "我在二〇〇八年去过北京。", "py": "Wǒ zài èr 〇 〇 bā nián qùguo Běijīng."}}
    assert check_word(year, {"t01"}) == [
        "w0001: ex.py 'Wǒ zài èr 〇 〇 bā nián qùguo Běijīng.' contains Chinese characters"]
    fixed = {**year, "ex": {**year["ex"], "py": "Wǒ zài èr líng líng bā nián qùguo Běijīng."}}
    assert check_word(fixed, {"t01"}) == []
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_wordsjson_validate.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'validate'`

- [ ] **Step 3: Write `tools/validate.py`**

```python
"""Final checks on the app's word data file.

Covers every rule in .claude/plans/words-json-schema.md and the data checks in the spec's
Verification list. Each check returns a list of problems; an empty list means it passed.
"""
import itertools
import re
import unicodedata
from collections import Counter

from distract import usable_choices
from meaning import LEFTOVER_LABEL
from pdfbody import contains_head
from pinyin_norm import toneless
from pinyin_text import card_py, joints_of_py, py_base, py_problems, syllable_count, syllables_of_py
from pinyincheck import names_of

POS_LABELS = {"n.", "v.", "adj.", "adv.", "m.", "pron.", "prep.", "conj.", "part.", "num.", "int."}
_HANZI = re.compile(r"[\u3007\u4e00-\u9fff]")  # Chinese characters, with the 〇 of years (二〇〇八年)
_WORD_ID = re.compile(r"^w\d{4}$")
_PYNUM = re.compile(r"^[a-zü]+[1-5]( [a-zü]+[1-5])*$")
_HZ = re.compile(r"^[\u4e00-\u9fff]+$|^([\u4e00-\u9fff]+…)+$")
_AUDIO = {"w": re.compile(r"^w/w\d{4}_[0-9a-f]{8}\.mp3$"), "s": re.compile(r"^s/w\d{4}_[0-9a-f]{8}\.mp3$")}
_WORD_KEYS = {"id", "hz", "py", "pyNum", "pyBase", "syl", "lv", "pos", "en", "enShort", "theme", "ord", "au",
              "noDistract", "ex"}
_EX_KEYS = {"hz", "py", "en", "au", "src"}


# The tones a 一 or 不 may show in a sentence, where the tone changes follow the next word.
_TONES_OF = {("一", "yi1"): ["yi1", "yi2", "yi4", "yi5"], ("不", "bu4"): ["bu4", "bu2", "bu5"]}
# Where render (Plan 3b sentpinyin) starts a sentence, so a capital may stand there. A quotation
# after a colon also starts one ('shuō: "Nǐ kàn."').
_SENTENCE_START = r'(?:^|[.!?]"?\s+|:\s+")"?\(?'
# The headword's syllables may stand as a word of their own or inside a longer word, as long as
# they start and end at syllable edges there. A longer word holds them in a known word (男人
# "nánrén" for the card 男), with a joined particle, suffix or result ("kànzhe", "jiàshǐyuán",
# "xiěhǎo") and in a number word ("liǎngbǎi" for 百). Inside a word a syllable starts after a
# vowel, n, ng or r, and one that starts with a, o or e starts after an apostrophe ("kě'ài"). It
# ends before a consonant or an apostrophe, and before n, g or r only when a vowel follows them,
# because then they start the next syllable ("nánrén"). So 户 "hù" is not shown by "zhù".
_VOWELS = "aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ"
_WORD_START = r"(?<![^\W\d_])(?<!')"
_BEFORE = rf"(?:{_WORD_START}|(?<=[{_VOWELS}nr])|(?<=ng))"
_BEFORE_AOE = rf"(?:{_WORD_START}|(?<='))"
_AFTER = rf"(?:(?![^\W\d_])|(?=[bcdfhjklmpqstwxyz'])|(?=[gnr][{_VOWELS}]))"


def head_forms(hz, py, pynum):
    """Every way the card pinyin of a headword (or of one half of a pattern word) may appear in a sentence.

    The card's own py, and the same with another tone on a 一 or 不 that ends the headword, because
    its tone follows the next word, so the card 不 "bù" appears as "bú" in "Wǒ bú shì xuésheng." and
    the card 一 "yī" as "yí" in "yí gè". A 一 or 不 inside the headword keeps the tone its card
    shows, so the card 受不了 "shòubuliǎo" never appears as "shòubùliǎo".
    """
    nums = pynum.split()
    joints, shown = joints_of_py(py, nums), syllables_of_py(py, nums)
    if joints is None or shown is None or len(nums) != len(hz):
        return {py}
    options = [[s] for s in shown[:-1]] + [_TONES_OF.get((hz[-1], shown[-1]), [shown[-1]])]
    return {py} | {card_py(list(c), joints, py[:1].isupper()) for c in itertools.product(*options)}


def name_starts(sentence, names):
    """Indexes of the sentence characters where a word of a name starts that takes a capital.

    names: {hz: (words, capitals)} as Plan 3b pinyincheck.names_of gives them, which are the names of
    data/manual/capitals (Plan 3a pinyin_text.name_rows) and every card whose py starts with a
    capital. So with the row 山东省 (山东 省, Y), 我来自山东省。 gives {3, 5}, and there the card 省 may
    show "Shěng" ("Wǒ láizì Shāndōng Shěng."), because the style sheet capitalises every word of a
    place name. With the card 长城 "Chángchéng", 我去过长城。 gives {3}, so the card 长 may show "Cháng".
    """
    out = set()
    for hz, (parts, flags) in (names or {}).items():
        at = sentence.find(hz)
        while at >= 0:
            offset = at
            for part, flag in zip(parts, flags):
                if flag:
                    out.add(offset)
                offset += len(part)
            at = sentence.find(hz, at + 1)
    return out


def head_py_problem(w, names=None):
    """Why ex.py does not show the headword as on its card, or None.

    ex.py must hold the card's py exactly, except that the tone of a final 一 or 不 may differ
    (head_forms), a word may take a capital where a sentence starts or where a word of a name of
    a card or data/manual/capitals starts (names, see name_starts), and an 儿 ending that
    follows the headword in ex.hz adds its "r" (这 "zhè" in 这儿 "zhèr"). It may stand as a word
    of its own or inside a longer word at syllable edges (_BEFORE and _AFTER), such as a known
    word ("nánrén" for 男, "Chūntiān" for 春), a joined particle ("kànzhe" for 看 and for 着) or a
    number word ("yìqiān" for 千, "jǐshí" for 几). So for 东西 "dōngxi", "Wǒ mǎile hěn duō
    dōngxi." passes, while "... hěn duō Dōngxi." and "... hěn duō dōngxī." do not, and for 户 "hù"
    "zhù" does not. A pattern word is checked half by half.
    """
    sentence = unicodedata.normalize("NFC", w["ex"]["py"])
    halves = [h for h in w["hz"].split("…") if h]
    pys = [p for p in unicodedata.normalize("NFC", w["py"]).split("…") if p]
    nums, k, found = w["pyNum"].split(), 0, 0
    named = name_starts(w["ex"]["hz"], names)
    if len(halves) != len(pys):
        return f"py {w['py']!r} does not have one part per part of hz"
    for half, half_py in zip(halves, pys):
        forms = head_forms(half, half_py, " ".join(nums[k:k + len(half)]))
        k += len(half)
        found = w["ex"]["hz"].find(half, found)
        if half + "儿" in w["ex"]["hz"] and not half.endswith("儿"):
            forms |= {f + "r" for f in forms}
        before = {f: _BEFORE_AOE if f[:1].lower() in "aāáǎàoōóǒòeēéěè" else _BEFORE for f in forms}
        inside = any(re.search(before[f] + re.escape(f) + _AFTER, sentence) for f in forms)
        first = any(re.search(_SENTENCE_START + re.escape(f[:1].upper() + f[1:]) + _AFTER, sentence) for f in forms)
        name = found in named and any(re.search(before[f] + re.escape(f[:1].upper() + f[1:]) + _AFTER, sentence)
                                      for f in forms)
        found += len(half)
        if not (inside or first or name):
            return f"ex.py {w['ex']['py']!r} does not show {half_py!r} as on the card"
    return None


def check_top(data):
    problems = []
    if not re.fullmatch(r"v\d{3}", str(data.get("version", ""))):
        problems.append(f"version {data.get('version')!r} is not like v001")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(data.get("generated", ""))):
        problems.append(f"generated {data.get('generated')!r} is not a date like 2026-10-05")
    if not data.get("license"):
        problems.append("license is empty")
    if not isinstance(data.get("themes"), list) or not isinstance(data.get("words"), list):
        problems.append("themes and words must both be lists")
    return problems


def check_themes(themes, words, min_size, max_size):
    """Theme ids t01, t02... in order, order 1..k, names, counts that match, and sizes in range.

    Every theme counts, the Starter Kit included, whose widened rule gives it 40 words.
    """
    problems = []
    counts = Counter(w["theme"] for w in words)
    for k, t in enumerate(themes, start=1):
        if t.get("id") != f"t{k:02d}" or t.get("order") != k:
            problems.append(f"theme {k}: id {t.get('id')!r} and order {t.get('order')!r} should be t{k:02d} and {k}")
        if not t.get("name"):
            problems.append(f"theme {t.get('id')}: no name")
        if t.get("count") != counts.get(t.get("id"), 0):
            problems.append(f"theme {t.get('id')}: count {t.get('count')} but {counts.get(t.get('id'), 0)} words")
        size = counts.get(t.get("id"), 0)
        if not min_size <= size <= max_size:
            problems.append(f"theme {t.get('id')} {t.get('name')}: {size} words, outside {min_size} to {max_size}")
    return problems


def check_word(w, theme_ids, names=None):
    """Every field of one word, against the schema. names: see head_py_problem."""
    wid = w.get("id")
    if set(w) != _WORD_KEYS:
        return [f"{wid}: fields {sorted(set(w) ^ _WORD_KEYS)} are missing or extra"]
    p = []
    if not _WORD_ID.match(wid):
        p.append("id is not like w0001")
    if not _HZ.match(w["hz"]):
        p.append(f"hz {w['hz']!r} is not Chinese characters")
    nums = w["pyNum"].split()
    if not _PYNUM.match(w["pyNum"]):
        p.append(f"pyNum {w['pyNum']!r} is not numbered pinyin")
    else:
        if w["pyBase"] != py_base(nums) or w["syl"] != syllable_count(nums):
            p.append("pyBase or syl does not match pyNum")
        if len(w["hz"]) > 1 and w["hz"].endswith("儿") and nums[-1] == "er5":
            p.append(f"pyNum {w['pyNum']!r} ends in er5, but a neutral 儿 ending is r5")
        p += py_problems(w["hz"], w["py"], w["pyNum"])
    if not w["py"] or re.search(r"\d", w["py"]) or toneless(w["py"].replace("…", "")) != w["pyBase"]:
        p.append(f"py {w['py']!r} does not match pyBase {w['pyBase']!r}")
    card_pinyin_ok = not p
    if w["lv"] not in range(1, 7):
        p.append(f"lv {w['lv']!r} is not 1 to 6")
    if not isinstance(w["pos"], list) or not set(w["pos"]) <= POS_LABELS:
        p.append(f"pos {w['pos']!r} has an unknown label")
    if not w["en"] or len(w["en"]) > 80 or len(w["en"].split(";")) > 3:
        p.append(f"en {w['en']!r} is empty, over 80 characters or over 3 senses")
    if not w["enShort"] or len(w["enShort"]) > 30:
        p.append(f"enShort {w['enShort']!r} is empty or over 30 characters")
    p += [f"{k} {w[k]!r} contains Chinese characters" for k in ("en", "enShort") if _HANZI.search(w[k])]
    p += [f"{k} {w[k]!r} starts with a part-of-speech label" for k in ("en", "enShort") if LEFTOVER_LABEL.match(w[k])]
    if w["theme"] not in theme_ids:
        p.append(f"theme {w['theme']!r} is not a theme id")
    if not isinstance(w["ord"], int):
        p.append("ord is not a whole number")
    if not _AUDIO["w"].match(w["au"]) or not w["au"].startswith(f"w/{wid}_"):
        p.append(f"au {w['au']!r} is not w/{wid}_<hash>.mp3")
    ex = w["ex"]
    if set(ex) != _EX_KEYS:
        p.append(f"ex fields {sorted(set(ex) ^ _EX_KEYS)} are missing or extra")
    else:
        if not ex["hz"] or "～" in ex["hz"] or "~" in ex["hz"] or not contains_head(ex["hz"], w["hz"]):
            p.append(f"ex.hz {ex['hz']!r} does not contain the headword written out")
        head = head_py_problem(w, names) if ex["py"] and card_pinyin_ok else None
        if not ex["py"] or not ex["en"]:
            p.append("ex.py or ex.en is empty")
        elif _HANZI.search(ex["py"]):
            p.append(f"ex.py {ex['py']!r} contains Chinese characters")
        elif head:
            p.append(head)
        if not _AUDIO["s"].match(ex["au"]) or not ex["au"].startswith(f"s/{wid}_"):
            p.append(f"ex.au {ex['au']!r} is not s/{wid}_<hash>.mp3")
        if ex["src"] not in ("pdf", "claude"):
            p.append(f"ex.src {ex['src']!r} is not pdf or claude")
    return [f"{wid}: {x}" for x in p]


def check_order(words, theme_ids):
    """ord runs 1..N once each; in ord order themes follow theme order, each theme is one block,
    and the HSK level never goes down inside a theme."""
    problems = []
    ords = sorted(w["ord"] for w in words if isinstance(w["ord"], int))
    if ords != list(range(1, len(words) + 1)):
        problems.append("ord is not 1 to N with each number once")
        return problems
    rank = {t: k for k, t in enumerate(theme_ids)}
    seq = sorted(words, key=lambda w: w["ord"])
    for a, b in zip(seq, seq[1:]):
        if rank[b["theme"]] < rank[a["theme"]]:
            problems.append(f"{b['id']}: theme {b['theme']} comes after {a['theme']} in ord order")
        elif a["theme"] == b["theme"] and b["lv"] < a["lv"]:
            problems.append(f"{b['id']}: level goes down from {a['lv']} to {b['lv']} inside {a['theme']}")
    return problems


def check_links(words):
    """Unique ids and headword-reading pairs; noDistract ids exist and never include the word itself."""
    problems = []
    ids = Counter(w["id"] for w in words)
    problems += [f"{i}: id used {n} times" for i, n in ids.items() if n > 1]
    pairs = Counter((w["hz"], w["pyNum"]) for w in words)
    problems += [f"{hz} {py}: two cards" for (hz, py), n in pairs.items() if n > 1]
    for w in words:
        bad = [x for x in w["noDistract"] if x not in ids or x == w["id"]]
        if bad:
            problems.append(f"{w['id']}: noDistract has unknown or own ids {bad}")
    return problems


def check_distractors(words, needed=3):
    """Each word has at least `needed` usable wrong choices from its own theme in both choice quizzes."""
    by_theme = {}
    for w in words:
        by_theme.setdefault(w["theme"], []).append(w)
    problems = []
    for w in words:
        for quiz in ("listen", "pinyin"):
            n = len(usable_choices(w, by_theme[w["theme"]], quiz))
            if n < needed:
                problems.append(f"{w['id']} {w['hz']}: only {n} usable wrong choices for the {quiz} quiz")
    return problems


def check_audio(words, file_problem):
    """file_problem(path, kind) says what is wrong with one audio file, or None."""
    problems = []
    for w in words:
        for path, kind in ((w["au"], "w"), (w["ex"]["au"], "s")):
            found = file_problem(path, kind)
            if found:
                problems.append(f"{w['id']}: {path}: {found}")
    return problems


def validate(data, file_problem, word_range=(4800, 5300), min_theme=40, max_theme=350, names=None):
    """Every check on the whole data file. Returns {check name: problems}.

    names: the names of data/manual/capitals (Plan 3a pinyin_text.name_rows), whose words may give a
    headword a capital in its sentence. The capitalised cards are added to them with pinyincheck.names_of,
    so the validator knows the same names as the strict checker of the sentence pinyin (Task 13).
    """
    top = check_top(data)
    if top:
        return {"top": top}
    words, themes = data["words"], data["themes"]
    names = names_of(names or {}, words)
    theme_ids = [t["id"] for t in themes]
    fields = [p for w in words for p in check_word(w, set(theme_ids), names)]
    results = {"top": [], "word count": [] if word_range[0] <= len(words) <= word_range[1]
               else [f"{len(words)} words, expected {word_range[0]} to {word_range[1]}"],
               "themes": check_themes(themes, words, min_theme, max_theme), "fields": fields}
    if fields:
        return results
    results.update({"order": check_order(words, theme_ids), "links": check_links(words),
                    "distractors": check_distractors(words), "audio": check_audio(words, file_problem)})
    return results
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_wordsjson_validate.py -q`
Expected: `15 passed`

- [ ] **Step 5: Write `tools/11_validate.py`**

```python
"""Step 11. Final checks on the latest docs/data/words_vNNN.json and every audio file it names.

Input:  also the latest data/manual/capitals_vNNN.csv, whose names, with the capitalised cards that validate adds
        (pinyincheck.names_of, as in steps 8c to 8e), may give a headword a capital in its sentence
Output: data/reports/validate_vNNN.txt. The script ends with an error when any check fails.
"""
import sys
from pathlib import Path

from common import latest_version_path, next_version_path, read_csv, read_json, write_new_text
from pinyin_text import name_rows
from ttsaudio import mp3_problem
from validate import validate

MAX_BYTES = 4 * 1024 * 1024


def file_problem(path, kind):
    p = Path("docs/audio") / path
    if not p.exists():
        return "missing"
    return mp3_problem(p.read_bytes(), kind)


def main():
    path = latest_version_path("docs/data/words", ".json")
    data = read_json(path)
    names, _ = name_rows(read_csv(latest_version_path("data/manual/capitals", ".csv")))
    results = validate(data, file_problem, names=names)
    size = path.stat().st_size
    results["file size"] = [] if size < MAX_BYTES else [f"{path} is {size} bytes, not under 4 MB"]
    results["scrambled codes"] = ["the file contains □, an undecoded glyph"] if "□" in path.read_text(
        encoding="utf-8") else []
    results["version"] = [] if data.get("version") == path.stem.rsplit("_", 1)[1] else [
        f"version {data.get('version')!r} does not match the file name {path.name}"]
    failed = {name: found for name, found in results.items() if found}
    lines = [f"Validation of {path}", "", f"Words: {len(data.get('words', []))}. Themes: {len(data.get('themes', []))}. "
             f"Size: {size / 1e6:.2f} MB.", ""]
    for name, found in results.items():
        lines.append(f"{name}: {'passed' if not found else f'{len(found)} problems'}")
        lines += [f"  {x}" for x in found[:30]]
    report = next_version_path("data/reports/validate", ".txt")
    write_new_text(report, "\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"Report: {report}")
    if failed:
        sys.exit(f"Validation failed: {', '.join(failed)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Run it**

Run: `PYTHONIOENCODING=utf-8 python tools/11_validate.py`
Expected: every check line says `passed`, with `Words: 5043.` and the size about 2 MB.
- **A `distractors` problem** means a theme is too small or too uniform for some word. Report it to the user, because the fix is a theme change (a new reviewed copy, then Tasks 3 and 15 again).
- **An `audio` problem** means rerunning Task 16 Step 4.

- [ ] **Step 7: Commit**

```bash
git add tools/validate.py tools/11_validate.py tests/test_wordsjson_validate.py && git commit -F - <<'EOF'
feat: final validation of the words file and audio

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 19: Credits (`ATTRIBUTION.md`)

**Files:**
- Create: `ATTRIBUTION.md`
- Modify: `README.md`

- [ ] **Step 1: Write `ATTRIBUTION.md`**

```markdown
# Attribution

The flashcards combine the sources below. Each is credited here with its licence.

## Word list and meanings

- **complete-hsk-vocabulary** by drkameleon (Yanis Zafirópulos), https://github.com/drkameleon/complete-hsk-vocabulary, commit 7ac65bf1a6387d35f1ade478906172a19311c7f9. MIT License, Copyright (c) 2026 Yanis Zafirópulos. It supplies the HSK 2.0 word list, pinyin, levels, frequency ranks and part-of-speech tags.
- **CC-CEDICT**, https://cc-cedict.org/, the Chinese-English dictionary whose meanings the list above includes. It is licensed under the Creative Commons Attribution-ShareAlike 4.0 International licence (https://creativecommons.org/licenses/by-sa/4.0/). The English meanings in `docs/data/words_vNNN.json` that do not come from the PDFs are adapted from it (shortened and cleaned), and those adapted meanings are shared under the same licence.

## Example sentences and headword glosses

- Sentences marked `"src": "pdf"`, and the English glosses of the words that have them, come from the HSK vocabulary PDFs published by m.sayninhao.com. They are republished here with this credit, and their rights stay with their owners.
- Sentences marked `"src": "claude"`, and every English translation of a sentence, were written for this app by Claude (Anthropic).

## Audio

- Every MP3 file was made with Microsoft's neural text-to-speech voice zh-CN-XiaoxiaoNeural, reached through the open-source tool edge-tts (https://github.com/rany2/edge-tts). Its package metadata declares the LGPL-3.0 licence, and its repository also holds a GPL-3.0 licence text. edge-tts was only used to make the files and is not part of the app.

## Stroke-order animation

- **Hanzi Writer**, https://github.com/chanind/hanzi-writer, released under the MIT license.
- **hanzi-writer-data**, https://github.com/chanind/hanzi-writer-data, the character stroke data used by Hanzi Writer. It comes from the Make Me a Hanzi project, which derived it from fonts by Arphic Technology, and it is licensed under the Arphic Public License.
```

- [ ] **Step 2: Update the README's last line**

In `README.md`, replace the line
`Work in progress. Data sources and licences will be listed in ATTRIBUTION.md once the word list is built.`
with
`Work in progress. Data sources and licences are listed in [ATTRIBUTION.md](ATTRIBUTION.md).`

- [ ] **Step 3: Commit**

```bash
git add ATTRIBUTION.md README.md && git commit -F - <<'EOF'
docs: credits and licences for words, sentences, audio and strokes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 20: Final check and report to the user

- [ ] **Step 1: Run the full test suite**

Run: `python -m pytest tests -q`
Expected: `215 passed`. That is the 131 after Plan 3a plus 4 + 3 + 11 + 31 + 16 + 4 + 15 from this plan (Tasks 1, 2, 4, 10, 13, 15, and 17 with 18). Without the PDFs, 5 of them are skipped (`210 passed, 5 skipped`).

- [ ] **Step 2: Run validation once more**

Run: `PYTHONIOENCODING=utf-8 python tools/11_validate.py`
Expected: every check `passed`.

- [ ] **Step 3: Report in plain language**

Give the user these results, each taken from a report file:
- the number of cards and themes, and the themes that were split into parts;
- how many sentences come from the PDFs and how many were written;
- the checker's fix shares and the spot-check result;
- how many polyphone characters were checked and changed;
- the four-character sentence words by form, from the latest `data/manual/four_char_words_vNNN.csv` (the rows with `where` set to `sentence`), and the name rows added in Task 11 Step 3. Say that the user can change any of them, as in Open decision 2;
- the pinyin style sheet's nine fixed choices (the section near the top of this plan), and how the correction went, from the latest `data/reports/pinyin_check_vNNN.txt` and `data/reports/pinyin_review_vNNN.txt`: how many lines were accepted at the first answer and after one or two redos, every line kept as the draft with the checker's messages, the agents' notes on names, and the independent checker's fix share and fixes;
- the audio file count;
- the words file's size;
- the validation result.

Then offer the listening check. It lists the words read with a stand-in character, and any single-character word kept with the engine's reading, from the latest `data/reports/audio_vNNN.txt`. The user can play a few of those files to confirm the readings.

---

## Self-review

| Spec or task requirement | Where |
|---|---|
| The user's theme review applied; themes over 350 words split by level into parts | Task 2, Task 3 (`themes.curriculum` and `split_by_level` from Plan 3a) |
| A corrected review copy or an edited theme list is used whatever its version number | Task 3 (each input at its own latest version, named in the report) |
| Curriculum order: theme order, then level, then frequency | Task 3 (`ord`), checked in Task 18 (`check_order`) |
| noDistract lists | Task 1, Task 3 |
| Sentence from the PDF: fill ～ and ~, pattern words by halves, repaired wrapped headwords, reject undecodable or unsuitable sentences, prefer short sentences with easy words | Plan 3a Tasks 2 and 6, and this plan's Tasks 4 and 5 |
| New sentences for words without one: 6 to 15 characters, easy vocabulary, contains the headword exactly, written by Claude in batches | Task 6 (instructions), Task 4 (`written_problems`), Task 7 (merge and redo) |
| English translations of every sentence by Claude in batches | Task 6 (translation agents for PDF sentences; writing agents translate their own) |
| Independent check of a sample of written sentences and translations | Task 8 |
| The user's spot-check of 50 translations as a checkpoint | Task 9 (`sentences.spotcheck_problems` checks that all 50 rows are present once and answered; a corrected copy under the next number is used) |
| Sentence pinyin with pypinyin (install step) and jieba (installed in Plan 3a Task 7), headword forced, only 一 and 不 tone changes, polyphone spot-check list | Task 10, Task 11, Task 12 |
| Every other card word in a sentence is read with the syllables its card shows (喜欢 xǐhuan, not xǐhuān, and 受不了 "shòubuliǎo"), and every other public-list word with one reading as the list gives it (下来 xiàlai) | Task 10 (`make_lookup`, `public_word_readings`), Task 11 (`syllables_of_py` from Plan 3a) |
| Sentence pinyin in the same word spacing as the cards, with the headword as on its card, a card word or public-list word that holds the headword kept whole (男人 "nánrén"), long words split into known words, short words that neither list has split only where the rules put a space (一个 "yí gè", while 西班牙, 企业家, 发动机, 歌唱家, 面孔 and 有点 stay whole), and a lone 儿 joined | Task 10 (`split_words`, `_apart`, `word_joints`, `regroup`), Task 11 (`joints_of`, `regroup` with `known`) |
| jieba cuts the sentences without guessing unknown words, as in Plan 3a, and a piece that the headword cuts from a longer word is cut again (勇敢的人 "yǒnggǎn de rén") | Task 10 (`segment`, `regroup`), Task 11 |
| 们, the aspect particles 着, 了 and 过 and the suffixes 子, 者, 员, 性 and 化 join the word before them, and a 了 or a particle such as 吧 that ends a sentence stays apart (GB/T 16159-2012 6.1.2.1, 6.1.2.2 and 5.5) | Task 10 (`attached`, `render`, `_sentence_end`), Task 18 (`_BEFORE` and `_AFTER`) |
| A one-character verb and a one-character result or direction are joined ("xiěhǎo", "guānshàng", GB/T 16159-2012 6.1.2.4) | Task 10 (`attached`, `RESULTS`), Task 18 (`_AFTER`) |
| A potential complement is three words with a neutral bu and 着 zháo ("shuì bu zháo"), a result 来 or 去, jieba's 不了 and 不过 after a verb and public-list words such as 买不起 included, as point 5 of the style sheet sets it | Task 10 (`potential`, `potential_readings`, `POTENTIAL_BU`, `split_words`), the style sheet |
| Four-character sentence words in the three forms of the textbook rules, from `data/manual/four_char_words`, with a stop that sends a word without a form to the form agents | Task 10 (`split_words` with forms), Task 11 (Steps 1 and 2), Open decision 2, Plan 3a Task 7 |
| Numbers as the textbook rules write them (11 to 99 joined, groups of 百 千 万 亿 apart, 十几 and 几十 joined, 零 apart, a numeral apart from its measure word, 零 and 两 among the numerals, a fraction syllable by syllable, "sān fēn zhī yī") | Task 10 (`number_words`, `split_words`, `_fraction`), Plan 3a Task 1 (`tone_change` numerals), Plan 3a Task 7 (form instruction 3), Task 18 (`_BEFORE` and `_AFTER`, so a numeral headword may stand inside a number word) |
| Capitals in sentences come from the cards and `data/manual/capitals`, never from jieba's name tags, and the names jieba finds, before any split, are reviewed. A person's name is written with the surname apart from the given name, each with a capital, and a title apart in lower case, and every word of a place name takes a capital ("Fújiàn Shěng") | Task 10 (`name_words`), Task 11 (Steps 1 and 3), Plan 3a Tasks 1 and 6 |
| A quotation after a colon starts with a capital | Task 10 (`render`), Task 18 (`_SENTENCE_START`) |
| The sentence pinyin shows the headword exactly as on its card, with another tone only on a 一 or 不 at its end, as a word of its own or inside a longer word at syllable edges | Task 10 (`syllables`), Task 18 (`head_forms` and `head_py_problem` in `check_word`) |
| The spot-check list uses the public list's readings and covers single-character words, public-list words with several readings, every character of a word that neither list has (with the neutral tone as an option, 着 and 不 included) and 儿 endings | Task 10 (`spot_checks`), Task 11 (`make_readings_of`), Task 12 (checker rule 5) |
| Card `py` checked against the spacing rules and against `pyNum` with the 一 and 不 tone changes removed | Task 18 (`check_word` with Plan 3a `py_problems`) |
| A neutral 儿 ending is `r5` in `pyNum` on every card (纽扣儿 "niu3 kou4 r5"), as in the sentences | Task 18 (`check_word`), Plan 3a Task 1 (`join_erhua`), Task 11 (sentence rule) |
| Audio with edge-tts (install step), zh-CN-XiaoxiaoNeural, words at -10% and sentences at -15% | Task 15, Task 16 |
| Audio names from word ID plus a hash of voice, rate and text; resumable; rate-limited with retries | Task 15 (`audio_path`), Task 16 (`make`) |
| Same-sound stand-ins for single characters whose default reading is wrong | Task 15 (`needs_standin`), Task 16 Steps 2 and 3 |
| The words JSON file exactly per the schema file | Task 17, checked in Task 18 |
| Sentence pinyin and audio always match the final sentence text, even when a sentence changes after steps 8 or 9 | Task 11 (`sentence` stored in each pinyin row), Task 15 (`audio_map`, `standins_from`), Task 17 (`wordsjson.stale`, checked in `10_build_words_json.py`) |
| No part-of-speech label left at the start of `en` or `enShort` | Task 18 (`check_word` with Plan 3a `meaning.LEFTOVER_LABEL`) |
| Validation: every schema rule, audio present and valid MP3, theme sizes, ord complete, 3 usable wrong choices per word per quiz type, file under 4 MB | Task 18 |
| No Chinese characters in `en` or `enShort` | Task 18 (`check_word`), with the clean-up itself in Plan 3a Task 3 |
| The Starter Kit (40 words under the widened rule) checked against the 40-word minimum like every theme, with no exemption | Task 3 (`06c_themes_finalize.py`), Task 18 (`check_themes`) |
| Same sound judged from `py`, as in the app, because `pyNum` holds dictionary tones | Task 1 (`distract.sound`) |
| ATTRIBUTION.md (drkameleon MIT, CC-CEDICT CC BY-SA 4.0, m.sayninhao.com sentences, Microsoft voice via edge-tts, Hanzi Writer data) | Task 19 |
| Claude-written steps run as multi-agent workflows with exact batch instructions | Tasks 6, 8, 12 and 14, plus the workflow rules at the top |
| The pinyin style sheet (in the schema file) governs `ex.py`; the rule-based pinyin of step 8 is a draft, and Claude batch agents correct every line against the style sheet with exact instructions, without changing a character | Task 14 (correcting instructions, `08c_pinyin_batches.py`), the style-sheet section at the top |
| A strict checker accepts a corrected line only when every character lines up with one syllable (儿 may be the r ending), each syllable with its tone is a known reading (the public list's readings of the character, or pypinyin's when the list lacks it, and the readings of longer list words and cards), digits and Latin letters are unchanged, punctuation maps one to one, the headword shows its card's syllables and spacing, and capitals stand only where the style sheet allows them; 38 correct and 59 wrong hand-made lines prove it | Task 13 (`pinyincheck.py`, `tests/test_pinyincheck.py`), Facts (sixth, seventh and eighth revisions) |
| The checker also enforces the 一 and 不 tone changes where a rule settles them (points 6 and 8), with 一 counting before every measure word of the lists and before 百, 千, 万 and 亿, "yī" after 第 or a numeral, and a neutral bu or yi only in a doubled word, a potential complement or a word that shows it, and points 1 and 2 as one word. It allows and requires a name's capitals only where the line writes it as a name | Task 13 (`word_facts`, `_tone_change_problems`, `decimal_positions` from Task 10, `_one_word_problems`, `_capital_problems`) |
| The checker enforces the spacing of numbers as point 6 sets it (11 to 99 and groups of 百 千 万 亿 joined, the digits of a year apart, 第 with a hyphen, a numeral apart from its measure word, a fraction and a decimal syllable by syllable) and a final 了 as a word of its own (point 3) | Task 13 (`_number_problems`, `_settled`, `_final_le_problems`, with `number_words` from Task 10) |
| 〇, the zero of years (二〇〇八年), counts as a Chinese character everywhere. It is as easy as 零 in a written sentence, it is read líng in the draft and on the check list, the checker lines it up, and it is never left in `ex.py` | Task 4 (`_HANZI`, `char_levels`), Task 10 (`_HANZI`, `_WORD`), Task 11 (`_HANZI`, `make_readings_of`), Task 13 (`_HANZI`, `_ONLY_READINGS`), Task 18 (`check_word`) |
| The validator knows the same names as the checker, so a capital on the headword that the checker accepts passes validation ("Wǒ qùguo Chángchéng." for the card 长) | Task 13 (`names_of`), Task 18 (`validate`) |
| The correcting instructions say that a pattern word's "…" marks are not written, and a redo of the independent checker has its own paragraph, filled from the problem lines that step 8e prints | Task 14 (rule 4, Steps 6 and 8) |
| The draft writes 这个, 那个 and 哪个 as one word, a month or weekday name as one word, and a percent sign with its number | Task 10 (`POINTING_WORDS`, `attached`, `render`), Task 11 (`known_here`) |
| A rejected line goes to a redo with the checker's message, and after two failed redos it keeps the draft and is listed for the user, with a note when the draft itself fails the checker | Task 14 (`08d_pinyin_merge.py`, Step 5), Task 20 |
| Names from the agents' notes are added only after step 8e has written a final file, so step 8c then sends only the changed sentences | Task 14 (Steps 5 and 9) |
| An independent checker agent reads a random sample of 150 corrected lines against the style sheet, and more than 5% fixes stops the work for the user (the share printed with one decimal) | Task 14 (Steps 6 to 8, `08e_pinyin_review_apply.py`) |
| Draft faults that touch the checker are fixed, so a decimal 一 keeps its tone, 几十 and 十几 stay one number word, the Chinese dash is one mark, and the validator accepts a place name's capitals | Task 10 (`_is_decimal`, `decimal_digits`, `_pieces`, `render`), Task 18 (`name_starts`), Plan 3a Task 7 (form rule 3) |
| The words file takes the style-sheet pinyin, and only when it was corrected from the latest draft | Task 17 (`10_build_words_json.py`) |
| Outputs never overwritten; relative paths; nothing private in docs/ | Every script writes through `common.next_versions`, `next_version_path` and the `write_new_*` writers. Audio uses hashed names and `.part` then rename. `docs/` receives only audio and the words file. |

Deliberately left to other plans:
- The app's quiz-choice code (`distractors.js`, Plan 2) must pick wrong choices from the same theme under the same rules as `distract.usable_choices`: no noDistract words, no same sound in the listening quiz, and no same pinyin in the pinyin quiz. The validator here only proves that at least 3 such choices exist.
- How the app finds the newest `docs/data/words_vNNN.json`, and showing these credits inside the app (Plan 4).
- Pushing `docs/` to GitHub Pages (Plan 5).

## Known open items for execution (added 2026-09-28 after the last cross-review)

The last execution-based review found these points. They make the strict pinyin checker stricter or fix small edge cases. Fix each one test-first when Task 13 and Task 18 are carried out:
1. The zero 〇 (U+3007, as in 二〇〇八年) is outside every `_HANZI` range. Add it in pinyincheck.py, sentpinyin.py, 08_pinyin.py and validate.py.
2. The checker and the validator must use the same names. The validator must also accept card names whose py starts with a capital, as `names_of` does.
3. The checker must enforce the 一 and 不 tone changes as the style sheet writes them. This covers card words with a printed tone change (一会儿 yíhuìr), 一 before a verb or a two-character measure word, 一 after 第 or a numeral keeping yī, a decimal 一 keeping yī, and a neutral bu required in a potential complement (point 5).
4. The checker must reject rare readings that step 8 already avoids (reuse make_readings_of), and check the tones of non-headword syllables against the known readings.
5. The checker must check the rule-checkable spacing: 这个/那个/哪个 joined, month names joined, number words per point 6, a sentence-final 了 apart, and name words split per the capitals file.
6. Task 14 Step 5 (adding a missing name) must not resend all sentences. Write an interim final file first, or let 08c compare against the corrected batches.
