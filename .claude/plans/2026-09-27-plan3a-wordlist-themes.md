# Plan 3a: Word List and Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the card word list (every PDF word plus every public HSK 2.0 word the PDFs lack, each once, with a permanent ID, pinyin in textbook word spacing that follows the pinyin style sheet, level, part of speech and English meaning), sort every word into the 30 themes, and stop at the user's checkpoint, where the user reviews the theme spreadsheet in Excel.

**Architecture:** Small tested Python modules hold the logic (`pinyin_text.py`, `pdfbody.py`, `meaning.py`, `wordids.py`, `wordlist.py`, `themes.py`), and thin numbered scripts chain them (`05_build_wordlist.py`, `06_themes_prepare.py`, `06b_themes_merge.py`), continuing Plan 1's numbering. Headwords come from the decoded PDF glyphs, and each PDF entry's reading comes from matching its printed pinyin against the public list's readings of that headword. The card pinyin's word spacing comes from the textbook pinyin printed in the HSK 1 to 4 PDFs where it fits the card. Otherwise a four-character headword takes the form that Claude form agents give it (idiom, words or joined), and any other headword is divided by the jieba word segmenter. The theme sorting is done by Claude batch agents plus an independent second-opinion agent in a multi-agent workflow, and a merge script checks their files before writing the review spreadsheet.

**Tech Stack:** Python 3.10 with the standard library, pytest 9 and jieba 0.42 (a Chinese word segmenter, installed in Task 7), the Plan 1 modules `common.py`, `pinyin_norm.py` and `decode.py`, git 2.54, and Claude subagents for the theme batches and the four-character forms.

**Spec:** `.claude/specs/2026-09-27-hsk-flashcards-design.md`. **Data contract:** `.claude/plans/words-json-schema.md`. **Continues:** `.claude/plans/2026-09-27-plan1-repo-and-pdf-decode.md` and `.claude/plans/2026-09-27-plan1-outcome.md`. **Next:** `.claude/plans/2026-09-27-plan3b-sentences-audio.md`.

---

## The pinyin style sheet the user fixed (2026-09-28)

The section "Pinyin style sheet" of `.claude/plans/words-json-schema.md` now governs card `py` and sentence `ex.py`. Where it leaves a case open, the PDFs' print decides first, then the rule that a single entry of the card list or the public lists is written joined, then GB/T 16159-2012. Its fixed choices are these:
1. 这个, 那个 and 哪个 are "zhège", "nàge" and "nǎge", and 这些 and 那些 "zhèxiē" and "nàxiē". Before any other measure word 这, 那 and 哪 stand apart ("zhè běn shū").
2. Month and weekday names are one word ("bāyuè", "xīngqīyī"), and a day number stands apart ("bāyuè jiǔ rì").
3. 了, 着 and 过 right after a verb join it ("kànle", "kànzhe", "kànguo"), and a 了 that ends a sentence or clause stands apart.
4. A verb and a one-syllable result or direction are one word ("xiěhǎo", "shōudào", "liúxià"), and a two-syllable complement stands apart ("zǒu jìnlai").
5. A potential complement is three words with a neutral bu ("zhǎo bu dào", "mǎi bu qǐ"), except a card, which keeps its printed or listed form ("duìbuqǐ", "shòubuliǎo", "láibují", "kànbuqǐ").
6. Numbers follow GB/T 16159-2012 6.1.5 ("sānshísān", "yìqiān wǔbǎi", "jǐshí", "yì-liǎng", "dì-shí", "sān gè rén", "sān fēn zhī yī" in a sentence, the card "bǎifēnzhī", and a decimal digit by digit, "sān diǎn yī sì").
7. A surname and a given name are two words with capitals ("Lǐ Míng"), a title stands apart in lower case ("Lǐ lǎoshī"), every word of a place name takes a capital ("Fújiàn Shěng"), names of languages, countries and peoples take a capital ("Hànyǔ", "Zhōngguó"), and common nouns are in lower case ("xīngqīrì", "měiyuán", "xīfāng").
8. The tone changes of 一 and 不 are written as spoken ("yí gè", "bú shì", "yìqǐ"), and neutral tones as the dictionary gives them ("dōngxi", "xiàlai").
9. A sentence and a quotation after a colon start with a capital, and Chinese punctuation becomes Western punctuation.

In this plan, card `py` already followed points 5, 6 and 8, and Task 1 now has a test for each of points 5 to 8. Point 7 changes one card, 正月 "zhēngyuè" (see the facts below).

## Facts verified before writing this plan (2026-09-27, revised 2026-09-28)

Every number below was measured on the real files, by running this plan's own code (extracted from this file) in a scratch copy of the project. Claude's theme answers were replaced there by stand-in files, only to exercise the scripts. On 2026-09-28 the plan was revised for three user decisions (a wider Starter Kit, card pinyin in textbook word spacing, and no size exemption for the Starter Kit), and every step up to Task 11 was run again. Numbers that the revision did not touch came out the same.

- **Environment.** Windows 11 with Git Bash, Python 3.10.6, git 2.54.0. The project suite passes, and `python -m pytest tests -q` gives `69 passed` (checked again on 2026-09-28). jieba was not installed; `python -m pip install "jieba>=0.42"` installed jieba 0.42.1 on 2026-09-28.
- **Inputs used.** `data/extract/pdf_entries_v002.jsonl` (5,309 entries), `data/decode/cidmap_v004.csv` (2,664 codes, all decoded), `data/decode/entry_match_v004.csv`, `data/public/hsk2_old_exclusive_v001.json` (4,991 words) and `data/public/hsk_complete_v001.json` (11,470 words). Every one of the 4,991 old-list words is also in the complete list with an `old-N` level tag, and no simplified headword repeats in either list. A headword that HSK 2.0 lists twice appears once in the complete list with two `old-N` tags instead. There are 7 such headwords: 得 长 等 对 过 还 只.
- **How an entry's text is laid out.** `tokens[0]` is the headword, `tokens[1]` is the pinyin plus part of speech and first English gloss, and then Chinese sentence text and Latin text alternate. A Latin token after the first is either part of a sentence or the gloss of a further sense.
  - Of the 1,609 Latin tokens after the first, 875 are only spaces, 221 are digits, 60 are punctuation (including the 9 ASCII `~` marks) and 406 start with a part-of-speech label.
  - 47 contain letters without a label. Among them are variant pinyin (`nàr`, `zhèr`), glosses without a label (` entrust `), upper-case abbreviations inside sentences (`IT`, `DNA`, `JPEG`, `CEO`) and cut-off pinyin tails (`lián`, `tóu`, ` yán zhī `).
  - HSK 6 glosses are sometimes split by a Chinese-font `；` token between English pieces.
- **The word list (prototype run).**
  - 4,063 cards come from the PDFs, 977 from words only in the public list, and 3 from second readings (below), so the union is **5,043 cards**.
  - By level (the lowest level either source gives) that is HSK1 156, HSK2 161, HSK3 321, HSK4 652, HSK5 1,250 and HSK6 2,503.
  - The 977 public-only words are HSK1 2, HSK2 6, HSK3 15, HSK4 71, HSK5 878 and HSK6 5. They include 弹, 当 and 当地, so the HSK 4 entry 677 gap needs no guess.
  - 8 headwords get two cards because the PDFs give two readings: 倒 只 扒 数 背 过 还 重.
  - **Second readings.** Of the 7 headwords with two `old-N` tags, 等 and 对 have one reading in the list (the PDFs give both senses), and the PDFs give both readings of 过 还 只. 3 readings are left with no card: 长 zhǎng (the PDFs only have 长 cháng, HSK2 #158 and HSK3 #333) and 得 dé and 得 děi (the PDFs only have 得 de, HSK2 #168 and HSK4 #686). HSK4 #686 prints the dé sense "v. get; obtain; win; earn" under de. With `second_readings_v001.csv` (Task 6) all 3 become cards at HSK 2, so 得 has three cards and 长 two (Open decision 3).
  - 27 PDF cards get a lower level from the public list than from the PDFs.
- **Readings.** 190 of the 4,991 public words have more than one distinct reading. Among the 977 public-only words, **29** have more than one (8 of them differ in more than tone). The 29 need a chosen reading, given in `data/manual/public_readings_v001.csv` (Task 6).
- **PDF entries that need a hand-written fix: 41 rows.**
  - 32 entries match no public reading of their headword:
    - the pattern words 虽然…但是… (3 files), 因为…所以… (3) and 不但…而且… (2);
    - words missing from both lists: 踢足球 (3), 一下 (3), 黄河 (2), 百分之, 弹钢琴, 柑橘, 涮火锅, 素食主义, 通货膨胀, 烟花爆竹;
    - cut or misspelled pinyin: 窗帘, 水龙头, 湖泊, 开拓, 泄露 and 嗯;
    - the wrapped headwords 致力于, 拔苗助长 and 总而言之.
  - 8 more are 那（那儿） and 这（这儿） in four files, whose variant pinyin would otherwise be read as an English gloss.
  - 1 more is 得 HSK4 #686, whose "get; obtain" sense belongs to the reading dé.
- **Sentences (measured now, used in Plan 3b).**
  - With the rules in Plan 3b, **4,051 cards have a usable PDF sentence**, and **992 need a newly written one**.
  - The 992 are the 977 public-only words, the 3 second readings, and 12 PDF words whose sentences are all unusable: 谢谢 对不起 不客气 行 关怀 柑橘 意志 拜托 回避 当心 吹牛 滔滔不绝.
  - Of the 4,051 chosen PDF sentences, 3,895 use no character above the word's level (at least HSK 2).
- **Starter Kit.** The first rule picked 34 words, below the spec's minimum theme size of 40. On 2026-09-28 the user widened it with 和 太 还 就 没有 一点儿. 还 has two cards, and only 还 hái (still) is taken, not 还 huán (to return). The widened rule picks exactly **40 words**: 的 了 我 是 你 在 不 有 他 这 和 我们 都 很 她 没有 那 什么 没 吗 太 呢 怎么 谁 几 多少 哪 怎么样 哪儿 一点儿 就 要 也 还 吧 它 大家 为什么 每 您. That meets the minimum, so no theme is exempt from it any more.
- **Card pinyin word spacing (measured 2026-09-28).** The user chose textbook word spacing for `py` (the 汉语拼音正词法 rules). The HSK 1 to 4 PDFs print it ("bú kèqi", "dǎ diànhuà", "dì-yī", "nǚ’ér", "yìdiǎnr", "gōnggòngqìchē"), while the HSK 5 and 6 PDFs print one syllable per space ("ài hù").
  - 1,193 cards have an entry in the HSK 1 to 4 PDFs. For 1,182 of them the printed pinyin fits the card reading and gives `py`. The other 11 differ only in a neutral tone (后面 prints "hòumiàn" while the card reading is hou4 mian5; also 小姐 还是 关系 照顾 太阳 起来 值得 要是 味道 活泼), so jieba gives their spacing, which joins them the same way.
  - 受不了 is the one card whose tones change. The PDF prints "shòubuliǎo" with a neutral bu, and the old joined output was "shòubùliǎo".
  - 120 four-character headwords do not take their spacing from the PDFs. 76 of them are idioms by CC-CEDICT's "(idiom)" mark (不可思议, 拔苗助长). The other 44 are 43 that jieba keeps whole without that mark and 素食主义, which jieba splits. Since the fourth cross-review (below) all 120 take one of the three forms of the textbook rules from `data/manual/four_char_words` (Open decision 4), and CC-CEDICT's mark is only a hint to the form agents.
  - The other 3,741 cards take their spacing from jieba. jieba keeps nearly every headword whole and splits only 系领带 "xì lǐngdài" and 涮火锅 "shuàn huǒguō" among them. On its own it would also split five two-character headwords (报到 人道 和气 要不 分之) into single characters, so a headword of one or two characters is always one word.
  - Before the third cross-review, 13 cards had a space in `py`, 120 a hyphen (the 119 four-character headwords written AB-CD and 第一 "dì-yī") and 41 an apostrophe (女儿 "nǚ'ér", 可爱 "kě'ài", 轻而易举 "qīng'ér-yìjǔ"). 138 cards had a different `py` from the old rule, which joined every syllable, and `py_problems` (Task 1) found no problem in any card. These counts were measured after the two fixes below.
  - **The 儿 ending of 纽扣儿 (fixed 2026-09-28).** The public list writes the 儿 ending as "r" (一点儿 "yī diǎn r", numbered yi1 dian3 r5) in every word but 纽扣儿, which it writes "niǔ kòu er", as HSK6 #1398 also prints it. So that card used to have `py` "niǔkòu'er", `pyNum` "niu3 kou4 er5" and `syl` 3, against the schema's rule that the 儿 ending is the item "r5" and is not counted in `syl`. With `join_erhua` (Task 1), used by `public_readings` (Task 5), it has `py` "niǔkòur", `pyNum` "niu3 kou4 r5", `pyBase` "niukour" and `syl` 2, and keeps its ID w5042. Now 13 cards end in `r5`, and no headword of more than one character that ends in 儿 has a `pyNum` ending in `er5`.
  - **Capitals (fixed 2026-09-28).** The capital of `py` used to come from the public list's reading even where the spacing came from the PDFs. HSK 4 prints 互联网 "hùliánwǎng" (#776), 礼拜天 "lǐbàitiān" (#876) and 京剧 "jīngjù" (#828) in lower case, while the list writes them with a capital, so the cards read "Hùliánwǎng", "Lǐbàitiān" and "Jīngjù". Now the capital follows the print wherever the spacing does (`printed_pinyin`, Task 1), and 20 cards have a capital instead of 23. 8 follow the HSK 1 to 4 PDFs (中国 北京 汉语 中文 黄河 亚洲 长城 长江). The other 12 take their capital from the public list, because the HSK 5 and 6 PDFs print every word in lower case, even 欧洲 "ōu zhōu" (Open decision 5).
  - The two fixes changed exactly 4 cards (纽扣儿 互联网 礼拜天 京剧), and no ID and no other count. After them the test suite gave `121 passed, 5 skipped` (the 5 skipped tests need the PDFs), and steps 5 and 6 printed exactly the output shown in Tasks 7 and 9.
  - **Files for the user's answers (added 2026-09-28, after a cross-review).** Open decision 5 is carried out by a hand-written file that step 5 reads (Task 6), so an answer only means saving a new version of a file. `data/manual/capitals_v001.csv` has 23 rows, the 12 cards whose capital comes from the public list and 11 sentence words that the public list writes with a capital, all with a capital.
- **The three forms of four-character words, and names (third cross-review, 2026-09-28).** The textbook rules (汉语拼音正词法) write a four-character word in one of three forms. An idiom is two joined pairs with a hyphen, a compound of two words is written as two words (通货膨胀 "tōnghuò péngzhàng"), and a single word that cannot be divided is joined (二氧化碳 "èryǎnghuàtàn"). The earlier version wrote AB-CD for every four-character headword that jieba keeps whole, so 通货膨胀 was "tōnghuò-péngzhàng" and 二氧化碳 "èryǎng-huàtàn". The Y or N file of that version is replaced by `data/manual/four_char_words`, whose `form` column is idiom, words or joined. Claude form agents fill it (Task 7), a CC-CEDICT idiom mark was the default until the fourth cross-review (below), and the user reviews it at the checkpoint.
  - Step 5 was run on the real data in a scratch copy with the code in this file. The first run stopped before writing the word list with `44 four-character headwords need a form` and wrote one batch file of 44 rows. The agents' answers were replaced by stand-in answers, only to exercise the scripts (39 idiom, 3 words, 2 joined). Step 5b wrote `four_char_words_v001.csv` with 44 rows, and the second run of step 5 printed the report in Task 7 Step 6.
  - With those answers exactly 4 cards changed `py`: 二氧化碳 "èryǎnghuàtàn" and 断断续续 "duànduànxùxù" (joined), and 烟花爆竹 "yānhuā bàozhú" and 通货膨胀 "tōnghuò péngzhàng" (two words). No ID changed. 15 cards have a space in `py`, 116 a hyphen and 41 an apostrophe, and `py_problems` finds no problem in any card.
  - `data/manual/capitals` gained a `words` column for the names of people, because the rules write the surname apart from the given name, each with a capital, and a title apart in lower case (王建国 "Wáng Jiànguó", 李老师 "Lǐ lǎoshī"). No card is such a name, so the 23 rows have an empty `words`, and step 5 gave the same capitals as before (20 cards).
  - The suite gave `125 passed, 5 skipped` (the 5 skipped tests need the PDFs), because `test_pinyin_text.py` now has 20 tests.
- **Idioms that cannot be divided, and doubled words (fourth cross-review, 2026-09-28).** The national standard GB/T 16159-2012 was checked today in its published text (pinyin.info/rules/GBT16159-2012.html). Its section 6.1.12.1 hyphenates a four-character idiom only when it divides into two pairs of syllables (风平浪静 "fēngpíng-làngjìng", 水到渠成 "shuǐdào-qúchéng"). An idiom that does not divide is joined, and the standard's own examples are 层出不穷 "céngchūbùqióng", 不亦乐乎 "bùyìlèhū", 总而言之 "zǒng'éryánzhī", 爱莫能助 "àimònéngzhù" and 一衣带水 "yīyīdàishuǐ". Its section 5.4 joins a doubled AABB word as well (来来往往 "láilaiwǎngwǎng", 清清楚楚 "qīngqīngchǔchǔ"). The earlier version wrote every CC-CEDICT idiom as two hyphenated pairs without asking the form agents, and their instructions had no joined case for an idiom, so 层出不穷 was "céngchū-bùqióng", 兢兢业业 "jīngjīng-yèyè", and the stand-in answer for 总而言之 gave "zǒng'ér-yánzhī".
  - Now every four-character headword without printed spacing goes to the form agents, with CC-CEDICT's mark in a new `mark` column as a hint only, and the instructions (Task 7 Step 4) have the joined case for such idioms and for AABB words.
  - Step 5 was run again in a fresh scratch copy with the code in this file. It stopped with `120 four-character headwords need a form` and wrote 2 batch files (100 and 20 rows). The stand-in answers kept 43 of the 44 earlier ones, gave joined to the 44th, 总而言之, and to the CC-CEDICT idioms 层出不穷 and 兢兢业业, and gave idiom to the other 74 CC-CEDICT idioms (112 idiom, 3 words, 5 joined). Step 5b wrote 120 rows.
  - Exactly 3 cards changed `py`, which are w4662 总而言之 "zǒng'éryánzhī", w4759 层出不穷 "céngchūbùqióng" and w4868 兢兢业业 "jīngjīngyèyè". No ID changed. 15 cards have a space in `py`, 113 a hyphen and 41 an apostrophe, and `py_problems` finds no problem in any card.
  - `syllables_of_py` (Task 1) is new. It gives the syllables that a card's `py` shows, with its tone changes, so 受不了 "shòubuliǎo" gives shou4 bu5 liao3. Plan 3b reads card words in its sentences with it. The suite still gives `125 passed, 5 skipped`, because the new checks are assertions inside existing tests.
- **The pinyin style sheet (sixth revision, 2026-09-28).** The user fixed a pinyin style sheet (see the section above). This plan was checked against its points 5 to 8 in a fresh scratch copy of the project, with the code of this file, jieba 0.42.1 and the stand-in form answers of the facts above (112 idiom, 3 words, 5 joined).
  - **Point 5.** 18 cards have three characters with 不 or 得 in the middle (对不起, 受不了, 来不及, 来得及, 看不起 and 13 more). jieba keeps all 18 whole, so each is one word, and those that come from the public list keep its neutral bu ("kànbuqǐ", "rěnbuzhù"). `headword_joints` (Task 1) now keeps such a headword whole even where jieba would cut it, so no card depends on jieba's dictionary for this.
  - **Points 6 and 8.** No card changed. 百分之 keeps the HSK 4 print "bǎifēnzhī", 第一 "dì-yī", and every 一 and 不 shows the tone change as spoken ("yìqǐ", "yíxià", "búyàojǐn", "wéiyī").
  - **Point 7.** Point 7 writes common nouns in lower case, as in "xīngqīrì" and "měiyuán". `capitals_v001.csv` (Task 6) therefore sets 正月 and five sentence words (星期天, 星期日, 美元, 英镑, 西方) to N. Reading points 2 and 7 together, the month name 正月 (the first lunar month) is a common noun like "bāyuè". The rest of Open decision 5, which point 7 does not settle, stays with the user.
  - Step 5 then changed exactly one card, w4804 正月, from "Zhēngyuè" to "zhēngyuè", and no ID. Its report line reads `Cards written with a capital: 19 (8 as the HSK 1 to 4 PDFs print them, 11 as data/manual/capitals sets them). In lower case although the public list has a capital: 4`, where the old file gave 20, 12 and 3. Every other line of the report was the same.
  - The form agents' rule 3 (Task 7 Step 4) now also says that 十几 and 几十 are one word, as point 6 says.
  - `test_pinyin_text.py` has 21 tests, and the suite gives `126 passed, 5 skipped` (the 5 skipped tests need the PDFs). A copy of `headword_joints` without the new rule fails the new test.
- **Fractions in the form instructions (fifth cross-review, 2026-09-28).** GB/T 16159-2012 6.1.5.1 writes every syllable of a fraction apart (二分之一 "èr fèn zhī yī"), so rule 3 of the form agents' instructions (Task 7 Step 4) now gives 三 分 之 一 instead of 三 分之 一. `form_rows` and `check_form_answers` accept that answer, because its words spell the headword. No code of this plan changed, and the suite still gives `125 passed, 5 skipped`.
- **Meanings.** All 5,043 cards get an English meaning, and none holds a Chinese character.
  - Before the clean-up rules of Task 3 were tightened, 10 cards had Chinese characters in `en` (哈 "abbr. for 哈萨克斯坦, Kazakhstan", 高速 "expressway (abbr. for 路)", 甲, 乙, 盆, 雷, 铜, 虽然, 纪录, 与其), 当 read "(onom.) dong; ding dong (bell); to be", and 血 and 尾巴 ended in "colloquial pr.". With the rules now in Tasks 3, 5 and 6, 15 cards change meaning, for example 当 "to be; to act as; manage", 高速 "high speed; expressway" and 纪录 "to record; record (written account); note-taker" (taken from 记录, because CC-CEDICT only calls 纪录 a variant of it).
  - 哈 and 露 were read as the names Hā (Kazakhstan) and Lù (a surname). They now use the lower-case readings.
  - **Meaning repairs measured in a second review (2026-09-27).** Before them, 16 PDF cards started their meaning with the separable-verb label "sv." (跳舞 "sv. dance", 聊天, 毕业, 报名 and 12 more) and 次 with "/vm.". 42 PDF cards had words run together, misspellings or junk text in every copy of their gloss (for example 过问 "take aninterest in", 反倒 "instead:fjdk", 受到 "recieve"), and 7 more (您, 多, 着, 正在, 忘记, 没有, 只 zhī) had a run-together word in one copy only. 13 cards had a colon between two senses or at the end of a gloss (空隙 "interval:interspace", 攒 "save:"), 13 lacked the space after a comma (饭店 "restaurant,eatery", 啊 "surprise,exclamation") and 3 started with a stray mark (当然 ". of course", 停顿 "? pause", 演绎 "? deductive"). 踢 (HSK2) showed "(slang) butch (in a lesbian relationship)", 通货 "(old) exchange of goods" and 姥姥 "(coll.) mother's mother". 8 public-only words showed CC-CEDICT senses other than the one HSK teaches, for example 露 "dew; syrup; nectar" and 系 "to connect; to relate to; to tie up".
  - With the rules in Task 3, the reading rows of Task 6 and the 42 rows of `gloss_fixes_v001.csv`, no meaning starts with a label, holds a colon or a slang, old or colloquial label, and none starts with a stray mark. 露 reads "dew; to show; to reveal", 系 "department; system; to relate to", 踢 "to kick; to play (e.g. soccer)" and 过问 "concern oneself with; take an interest in".
  - 277 card meanings still hold a word that CC-CEDICT never uses. All were read, and all are real English words (noonday, kinsfolk, jiaozi). Step 5 lists them for review.
  - 52 quiz meanings (`enShort`) are cut with "…" to fit 30 characters, and 103 cards have no part-of-speech label, because neither source gives one.
- **Git ignore rules.** `.gitignore` ignores `data/public/`, `data/extract/`, `data/decode/`, `data/build/` and `data/reports/`. The new folders `data/ids/`, `data/manual/`, `data/review/` and `data/claude/` are tracked.

## Open decisions for the user

1. **Starter Kit size (decided 2026-09-28).** The user widened the Starter Kit rule with 和 太 还 就 没有 一点儿, so it gives exactly 40 words, the spec's minimum theme size. The earlier exemption of the Starter Kit from that minimum is removed here and in Plan 3b. A consequence for the review is that moving one word out of theme 1 makes step 6c (Plan 3b) stop until another word is moved in.
2. **Readings of the 29 public-only words with several readings.** `data/manual/public_readings_v001.csv` picks one reading for each, namely the one HSK teaches, such as 没 méi, 弹 tán and 当 dāng. The user sees them in the review sheet and can ask for a second card, for example 当 dàng.
3. **Second readings of 长 and 得.** HSK 2.0 lists 长 and 得 twice each, but the PDFs give only 长 cháng and 得 de. `data/manual/second_readings_v001.csv` makes cards for 长 zhǎng (to grow), 得 dé (to get) and 得 děi (must), all at HSK 2. The public list does not say which of dé and děi is the second HSK 2 entry of 得, so the user decides which of the three readings count. Setting `card` to `N` in a new `second_readings_v002.csv` leaves a reading out.
4. **The form of each four-character word (the rule follows the user's choice, the words are reviewed at the checkpoint).** On 2026-09-28 the user chose the textbook rules (汉语拼音正词法), which write a four-character word in one of three forms:
   - **idiom**, an idiom (成语) or fixed saying that divides into two pairs, written as two joined pairs with a hyphen (拔苗助长 "bámiáo-zhùzhǎng");
   - **words**, a compound of two or more words, written as those words (通货膨胀 "tōnghuò péngzhàng", 市场经济 "shìchǎng jīngjì");
   - **joined**, a single word that cannot be divided, an idiom that does not divide into two pairs, or a doubled AABB word, written joined (二氧化碳 "èryǎnghuàtàn", 总而言之 "zǒng'éryánzhī", 断断续续 "duànduànxùxù").

   Which form a word takes is a judgement for each word. Every four-character headword whose spacing the PDFs do not print gets a row in `data/manual/four_char_words` from Claude form agents (Task 7), which follow written instructions. CC-CEDICT's "(idiom)" mark is shown to them only as a hint, because the standard joins an idiom that does not divide into two pairs. There were 120 such cards on the prototype run, among them the 76 that CC-CEDICT marks, 二氧化碳, 通货膨胀, 烟花爆竹, 素食主义 and 39 idioms that CC-CEDICT does not mark (迄今为止, 讨价还价). At the checkpoint (Task 12) the user sees every row and can change any form or word division. The change goes in a new version of the file, and step 5 is run again. Plan 3b's step 8 uses the same file and the same agents for the four-character words of the example sentences. A change touches only `py` and the sentence pinyin, never an ID, because the IDs are keyed by `pyNum`.
5. **Capitals that the style sheet does not settle.** Where the HSK 1 to 4 PDFs print a word, its capital follows the print. For 12 other cards the public list writes a capital, because the HSK 5 and 6 PDFs print every word in lower case. Point 7 of the pinyin style sheet settles two of them. 欧洲 Ōuzhōu is a place name and keeps its capital, and 正月 (the first lunar month) is a month name, a common noun like "bāyuè", so it is "zhēngyuè". Point 7 does not say whether a festival, an organisation, a unit or a word for a group of people is a name, so the other 10 stay the user's decision. They are the festivals 除夕 Chúxī, 元旦 Yuándàn, 国庆节 Guóqìngjié, 元宵节 Yuánxiāojié, 端午节 Duānwǔjié and 重阳节 Chóngyángjié, the organisation 国务院 Guówùyuàn, the unit 摄氏度 Shèshìdù (degrees Celsius), and 华裔 Huáyì and 华侨 Huáqiáo (people of Chinese descent abroad). Step 5 lists them, and the user says at the checkpoint which of them should be in lower case. The answer is carried out by editing a file. `data/manual/capitals_v001.csv` (Task 6) has one row per card whose capital does not follow the PDFs' print, with `capital` Y or N. The 10 open rows are Y now, as the public list writes them. Save a copy as `capitals_v002.csv` with N for each word the user wants in lower case. The same file holds 11 words of Plan 3b's example sentences that are not cards but that the public list writes with a capital. By point 7, 星期天, 星期日, 美元, 英镑 and 西方 are N, and 中华 and 英语 are Y. The festival 春节, the organisation 联合国, the event 奥运会 and the religion 道教 are Y until the user decides with the cards. Step 8 of Plan 3b follows the file for them. Its `words` column gives the words of a person's name, which the textbook rules write with the surname apart from the given name, each with a capital, and a title apart in lower case (王建国 "Wáng Jiànguó", 李老师 "Lǐ lǎoshī"). Plan 3b adds such rows for the names in the example sentences. Step 5 stops and names a card that the public list writes with a capital but that has no row, and a row for a card whose capital follows the print.

## File map

| File | Responsibility |
|---|---|
| `tools/pinyin_text.py` | Tone-marked, numbered and toneless pinyin, the 一 and 不 tone changes, textbook word spacing (from the PDFs' printed pinyin, the form of a four-character word, or jieba), capitals for names, the check that a card's `py` fits its `pyNum`, and reading and checking the four-character forms and the capitals file |
| `tools/requirements.txt` | Gains jieba (Task 7) |
| `tools/pdfbody.py` | Split a PDF entry into senses and sentences, fill ～, check the headword is present |
| `tools/meaning.py` | Part-of-speech labels, gloss clean-up, CC-CEDICT clean-up (including register labels such as slang), `en` and `enShort`, and gloss words CC-CEDICT never uses |
| `tools/wordids.py` | Permanent word IDs that later builds only append to |
| `tools/wordlist.py` | Group PDF entries into cards, add public-only words and second readings, apply hand-written meanings and gloss fixes, levels, English |
| `tools/themes.py` | The 30 themes, the Starter Kit rule, batch files, answer checks, theme parts, curriculum order |
| `tools/05_build_wordlist.py` | Step 5. Write `data/build/wordlist_vNNN.jsonl` and the IDs file, or the form agents' batch files while four-character headwords still need a form |
| `tools/05b_four_char_merge.py` | Step 5b. Check the form agents' answers and write the next `data/manual/four_char_words_vNNN.csv` (also used by Plan 3b's step 8) |
| `tools/06_themes_prepare.py` | Step 6: write the batch files for the theme agents |
| `tools/06b_themes_merge.py` | Step 6b: check the agents' answers and write the review spreadsheet |
| `data/manual/pdf_fixes_v001.csv` | Hand-written fixes for 41 PDF entries |
| `data/manual/public_readings_v001.csv` | Chosen readings for 29 public-only words, with the part of speech and meaning for 8 of them |
| `data/manual/second_readings_v001.csv` | Decisions on 3 readings that HSK 2.0 lists separately but no card has (长 zhǎng, 得 dé, 得 děi) |
| `data/manual/gloss_fixes_v001.csv` | Hand-repaired meanings for 42 PDF cards whose gloss has words run together, misspellings or junk text |
| `data/manual/four_char_words_vNNN.csv` | The form (idiom, words or joined) of each four-character word, and the division of a "words" word. Step 5b writes it from the form agents' answers, and the user reviews it (Open decision 4) |
| `data/claude/four_char_vNNN/` | The form agents' answer files (committed) |
| `data/manual/capitals_v001.csv` | Whether each card whose capital does not follow the PDFs' print, and each sentence word the public list writes with a capital, has a capital, and the words of a person's name (Open decision 5) |
| `data/ids/word_ids_vNNN.csv` | The frozen IDs (written by step 5, committed) |
| `data/claude/themes_vNNN/` | The theme agents' answer files (committed) |
| `data/review/themes_review_vNNN.csv`, `theme_list_vNNN.csv` | The spreadsheets for the user's review |
| `tests/test_pinyin_text.py`, `test_pdfbody.py`, `test_meaning.py`, `test_wordids.py`, `test_wordlist.py`, `test_themes.py` | pytest |

Terms used below:
- **Numbered pinyin** writes each syllable's tone as a digit, for example `ping2 guo3`. Tone 5 is the neutral (light) tone, and the 儿 ending is the syllable `r5`.
- **Tone-marked pinyin** puts accents on the vowels, for example `píngguǒ`.
- **Textbook word spacing** (the 汉语拼音正词法 rules) writes the syllables of one word together and puts a space between words, for example `bú kèqi` for 不客气 (不 + 客气). A four-character idiom that divides into two pairs is written as two joined pairs with a hyphen (`bámiáo-zhùzhǎng`), one that does not is joined (`zǒng'éryánzhī`), and inside a word an apostrophe goes before a syllable that starts with a, o or e (`xī'ān`).
- **The form of a four-character word** is one of idiom (`bámiáo-zhùzhǎng`), words (`tōnghuò péngzhàng`) and joined (`èryǎnghuàtàn`), as the textbook rules write it.
- **A form agent** is a Claude subagent that decides the form of the four-character words in one batch file (Task 7).
- **jieba** is a Python library that cuts Chinese text into words, for example 素食主义 into 素食 and 主义.
- **A reading** is one pronunciation of a headword.
- **A batch agent** is a Claude subagent that handles one input file and writes one answer file.

---

### Task 1: Pinyin formats and textbook word spacing (`tools/pinyin_text.py`)

**Files:**
- Create: `tools/pinyin_text.py`
- Test: `tests/test_pinyin_text.py`

The card pinyin `py` uses textbook word spacing. The module describes where words meet with "joints", one per gap between two syllables. There are four kinds. `""` joins two syllables of one word, `" "` starts a new word, `"-"` joins the halves of an idiom (and 第 to its number, as the PDFs print 第一 "dì-yī"), and `"…"` separates the halves of a pattern word such as 虽然…但是…. The joints come from one of two places, tried in this order.
- **The PDFs' printed pinyin (`pdf_pinyin`).** The HSK 1 to 4 PDFs print textbook pinyin. It is used when its syllables spell the card reading and its tones match once the 一 and 不 tone changes are removed. For example, HSK1 #7 prints " bú kèqi You’re welcome. ". Its syllables bú, kè, qi match bu4 ke4 qi5 (bú is the changed tone of 不), so the card keeps the printed syllables and the joints `[" ", ""]`, and `card_py` writes "bú kèqi". `printed_pinyin` tries each of a card's PDF texts in turn and also reports whether the print starts with a capital, so the capital follows the print as well. HSK4 #776 prints 互联网 as "hùliánwǎng", so the card is "hùliánwǎng", although the public list writes "Hù lián wǎng".
- **The form of a four-character headword (`form_joints`).** A four-character headword is written in the form that `data/manual/four_char_words` gives it (Task 7), so 拔苗助长 with the form idiom gives "bámiáo-zhùzhǎng", 通货膨胀 with the form words and the words 通货 膨胀 gives "tōnghuò péngzhàng", and 二氧化碳 with the form joined gives "èryǎnghuàtàn". `form_rows` reads the file, and `check_form_answers` checks the form agents' answers.
- **jieba (`headword_joints`).** Any other headword is cut into words by jieba, and each word's syllables are joined. 系领带 is cut into 系 + 领带, giving "xì lǐngdài". A headword of one or two characters is always one word, because jieba would cut five two-character headwords (报到, 人道, 和气, 要不, 分之) into single characters.

A headword of three characters with 不 or 得 in the middle (看不起, 来得及) is always one word, because point 5 of the pinyin style sheet keeps a card that is a potential complement in its printed or listed form. `card_py` then adds an apostrophe inside a word before a syllable that starts with a, o or e (女儿 "nǚ'ér"), joins the 儿 ending to the syllable before it (一点儿 "yìdiǎnr"), and capitalises each word of a name (北京 "Běijīng"). `capitalise` can also capitalise only some words, because the rules write a surname and a given name each with a capital and a title in lower case (李老师 "Lǐ lǎoshī"). `name_rows` reads `data/manual/capitals`, whose `words` column gives the words of such a name. The 儿 ending is the item `r5` in numbered pinyin. The public list writes it as "r" everywhere except in 纽扣儿 "niǔ kòu er", so `join_erhua` turns a final neutral `er5` of a longer headword that ends in 儿 into `r5` (纽扣儿 "niǔkòur", numbered niu3 kou4 r5). `py_problems` is the check Plan 3b's validator runs on every card. It finds characters other than letters, spaces, hyphens and apostrophes, syllables that differ from `pyNum` once the 一 and 不 tone changes are removed, and missing or misplaced apostrophes. `syllables_of_py` reads back the syllables that a card's `py` shows, tone changes included (受不了 "shòubuliǎo" gives shou4 bu5 liao3), and Plan 3b reads card words in its sentences with it. The last test, `test_card_pinyin_follows_the_style_sheet`, shows the card side of points 5 to 8 of the style sheet with real cards (看不起 "kànbuqǐ", 百分之 "bǎifēnzhī", "Fújiàn Shěng", "Wáng xiānsheng", 正月 "zhēngyuè", "yìqǐ", "búshì").

- [ ] **Step 1: Write the failing test `tests/test_pinyin_text.py`**

```python
from pinyin_text import (IDIOM_JOINTS, capitalise, card_py, check_form_answers, form_joints, form_rows,
                         headword_joints, join_erhua, joints_of_py, marked_to_num, name_rows, num_to_marked, pdf_pinyin,
                         printed_pinyin, py_base, py_problems, syllable_count, syllables_of_py, tone_change)


def test_marked_to_num():
    assert marked_to_num("Běi jīng") == "bei3 jing1"
    assert marked_to_num("gàn huó r") == "gan4 huo2 r5"
    assert marked_to_num("lǜ") == "lü4"
    assert marked_to_num("cè lu:è") == "ce4 lüe4"
    assert marked_to_num("duì bu qǐ") == "dui4 bu5 qi3"


def test_num_to_marked_places_the_tone_mark():
    assert [num_to_marked(s) for s in ["guo3", "liu2", "gui4", "zhou1", "lüe4", "er2", "ma5"]] == \
        ["guǒ", "liú", "guì", "zhōu", "lüè", "ér", "ma"]


def test_tone_change_of_bu_and_yi():
    assert tone_change("不客气", ["bu4", "ke4", "qi5"]) == ["bu2", "ke4", "qi5"]
    assert tone_change("一下", ["yi1", "xia4"]) == ["yi2", "xia4"]
    assert tone_change("一起", ["yi1", "qi3"]) == ["yi4", "qi3"]
    assert tone_change("一模一样", ["yi1", "mu2", "yi1", "yang4"]) == ["yi4", "mu2", "yi2", "yang4"]


def test_tone_change_leaves_these_alone():
    assert tone_change("统一", ["tong3", "yi1"]) == ["tong3", "yi1"]
    assert tone_change("第一", ["di4", "yi1"]) == ["di4", "yi1"]
    assert tone_change("一月", ["yi1", "yue4"]) == ["yi1", "yue4"]
    assert tone_change("对不起", ["dui4", "bu5", "qi3"]) == ["dui4", "bu5", "qi3"]
    assert tone_change("统一中国", ["tong3", "yi1", "zhong1", "guo2"], keep={1}) == \
        ["tong3", "yi1", "zhong1", "guo2"]
    assert tone_change("二零一二", ["er4", "ling2", "yi1", "er4"]) == ["er4", "ling2", "yi1", "er4"]


def test_reduplication_makes_yi_and_bu_neutral():
    assert tone_change("看一看", ["kan4", "yi1", "kan4"]) == ["kan4", "yi5", "kan4"]
    assert tone_change("好不好", ["hao3", "bu4", "hao3"]) == ["hao3", "bu5", "hao3"]


def test_card_py_word_spacing():
    assert card_py(["bu2", "ke4", "qi5"], [" ", ""]) == "bú kèqi"
    assert card_py(["ba2", "miao2", "zhu4", "zhang3"], IDIOM_JOINTS) == "bámiáo-zhùzhǎng"
    assert card_py(["yi4", "dian3", "r5"], ["", ""]) == "yìdiǎnr"
    assert card_py(["gan4", "huo2", "r5"]) == "gànhuór"
    assert card_py(["sui1", "ran2", "dan4", "shi4"], ["", "…", ""]) == "suīrán…dànshì…"


def test_card_py_apostrophes_and_capitals():
    assert card_py(["xi1", "an1"]) == "xī'ān"
    assert card_py(["nü3", "er2"]) == "nǚ'ér"
    assert card_py(["bu2", "dan4", "er2", "qie3"], ["", "…", ""]) == "búdàn…érqiě…"
    assert card_py(["bei3", "jing1"], capital=True) == "Běijīng"
    assert card_py(["huang2", "he2"], [" "], capital=True) == "Huáng Hé"
    assert card_py(["li3", "lao3", "shi1"], [" ", ""], capital=[True, False]) == "Lǐ lǎoshī"
    assert capitalise("wáng jiànguó", True) == "Wáng Jiànguó"
    assert capitalise("xiǎo wáng", [True, True]) == "Xiǎo Wáng"


def test_pdf_pinyin_reads_the_textbook_spacing():
    assert pdf_pinyin(" bú kèqi You’re welcome. ", "不客气", ["bu4", "ke4", "qi5"]) == (["bu2", "ke4", "qi5"], [" ", ""])
    assert pdf_pinyin(" dǎ diànhuà make a phone call ", "打电话", ["da3", "dian4", "hua4"])[1] == [" ", ""]
    assert pdf_pinyin(" nǚ’ér n. daughter ", "女儿", ["nü3", "er2"]) == (["nü3", "er2"], [""])
    assert pdf_pinyin(" yìdiǎnr nm. a little ", "一点儿", ["yi1", "dian3", "r5"]) == (["yi4", "dian3", "r5"], ["", ""])
    assert pdf_pinyin(" dì-yī num. first ", "第一", ["di4", "yi1"]) == (["di4", "yi1"], ["-"])
    assert pdf_pinyin(" shòubuliǎo can’t bear ", "受不了", ["shou4", "bu4", "liao3"])[0] == ["shou4", "bu5", "liao3"]
    assert pdf_pinyin("yīnwèi…suǒyǐ… conj. on account of", "因为…所以…", ["yin1", "wei4", "suo3", "yi3"]) == \
        (["yin1", "wei4", "suo3", "yi3"], ["", "…", ""])
    assert pdf_pinyin(" àiv. love ", "爱", ["ai4"]) == (["ai4"], [])


def test_pdf_pinyin_rejects_other_readings():
    assert pdf_pinyin(" chuāng curtain ", "窗帘", ["chuang1", "lian2"]) is None
    assert pdf_pinyin(" zhǎng v. grow ", "长", ["chang2"]) is None
    assert pdf_pinyin(" yǐxià once ", "一下", ["yi1", "xia4"]) is None
    assert pdf_pinyin(" hǎo adj. good ", "好", ["hao4"]) is None


def test_printed_pinyin_takes_the_capital_as_printed():
    net = ["hu4", "lian2", "wang3"]
    assert printed_pinyin([" hùliánwǎng n. the Internet "], "互联网", net) == (net, ["", ""], False)
    assert card_py(net, ["", ""], False) == "hùliánwǎng"
    assert printed_pinyin([" Běi n. north ", " Běijīng n. Beijing "], "北京", ["bei3", "jing1"]) == \
        (["bei3", "jing1"], [""], True)
    assert printed_pinyin([" zhǎng v. grow "], "长", ["chang2"]) is None


def test_join_erhua():
    assert join_erhua("纽扣儿", ["niu3", "kou4", "er5"]) == ["niu3", "kou4", "r5"]
    assert card_py(join_erhua("纽扣儿", ["niu3", "kou4", "er5"])) == "niǔkòur"
    assert join_erhua("女儿", ["nü3", "er2"]) == ["nü3", "er2"]
    assert join_erhua("儿", ["er2"]) == ["er2"]
    assert join_erhua("一点儿", ["yi1", "dian3", "r5"]) == ["yi1", "dian3", "r5"]


def test_headword_joints():
    whole = lambda hz: [hz]
    cut = {"系领带": ["系", "领带"], "素食主义": ["素食", "主义"], "报到": ["报", "到"]}.get
    assert headword_joints("拔苗助长", whole, ("idiom", [])) == IDIOM_JOINTS
    assert headword_joints("二氧化碳", whole, ("joined", [])) == ["", "", ""]
    assert headword_joints("通货膨胀", whole, ("words", ["通货", "膨胀"])) == ["", " ", ""]
    assert headword_joints("素食主义", cut) == ["", " ", ""]
    assert headword_joints("系领带", cut) == [" ", ""]
    assert headword_joints("报到", cut) == [""]
    assert headword_joints("干活儿", whole) == ["", ""]
    assert headword_joints("一大早儿", whole) == ["", "", ""]
    assert headword_joints("虽然…但是…", whole) == ["", "…", ""]


def test_form_joints():
    assert form_joints("idiom", []) == IDIOM_JOINTS
    assert form_joints("joined", []) == ["", "", ""]
    assert form_joints("words", ["叹", "一", "口", "气"]) == [" ", " ", " "]
    assert card_py(["tong1", "huo4", "peng2", "zhang4"], form_joints("words", ["通货", "膨胀"])) == "tōnghuò péngzhàng"


def test_form_rows():
    rows = [{"hz": "二氧化碳", "form": "joined", "words": ""}, {"hz": "通货膨胀", "form": " Words ", "words": "通货 膨胀"},
            {"hz": "市场经济", "form": "words", "words": "市场 经"}, {"hz": "迄今为止", "form": "maybe", "words": ""},
            {"hz": "拔苗助长", "form": "idiom", "words": "拔苗 助长"}, {"hz": "二氧化碳", "form": "idiom", "words": ""}]
    assert form_rows(rows) == ({"二氧化碳": ("joined", []), "通货膨胀": ("words", ["通货", "膨胀"])}, [
        "市场经济: words '市场 经' do not fit the form words",
        "迄今为止: form 'maybe' is not idiom, words or joined, or hz is not four characters",
        "拔苗助长: words '拔苗 助长' do not fit the form idiom", "二氧化碳: listed twice"])


def test_check_form_answers():
    batch = [{"hz": "通货膨胀"}, {"hz": "二氧化碳"}]
    good = [{"hz": "通货膨胀", "form": "words", "words": "通货 膨胀"}, {"hz": "二氧化碳", "form": "joined", "words": ""}]
    assert check_form_answers(batch, good) == ([], [["通货膨胀", "words", "通货 膨胀"], ["二氧化碳", "joined", ""]])
    problems, rows = check_form_answers(batch, [good[0], good[0], {"hz": "烟花爆竹", "form": "words", "words": "烟花 爆竹"}])
    assert problems == ["烟花爆竹: not in the input", "通货膨胀: answered 2 times", "二氧化碳: missing"]


def test_name_rows():
    rows = [{"hz": "欧洲", "words": "", "capital": "Y"}, {"hz": "李老师", "words": "李 老师", "capital": "y n"},
            {"hz": "王建国", "words": "王 建国", "capital": "Y"}, {"hz": "除夕", "words": "", "capital": "N"},
            {"hz": "李华", "words": "李 华", "capital": "Y N N"}, {"hz": "小王", "words": "小 李", "capital": "Y"},
            {"hz": "欧洲", "words": "", "capital": "Y"}]
    assert name_rows(rows) == ({"欧洲": (["欧洲"], [True]), "李老师": (["李", "老师"], [True, False]),
                                "王建国": (["王", "建国"], [True, True]), "除夕": (["除夕"], [False])}, [
        "李华: capital is 'Y N N', not one Y or N, or one per word", "小王: words '小 李' do not spell it",
        "欧洲: listed twice"])


def test_joints_of_py():
    assert joints_of_py("bú kèqi", ["bu4", "ke4", "qi5"]) == [" ", ""]
    assert joints_of_py("bámiáo-zhùzhǎng", ["ba2", "miao2", "zhu4", "zhang3"]) == IDIOM_JOINTS
    assert joints_of_py("xī'ān", ["xi1", "an1"]) == [""]
    assert joints_of_py("kèqi", ["ke4"]) is None
    assert syllables_of_py("shòubuliǎo", ["shou4", "bu4", "liao3"]) == ["shou4", "bu5", "liao3"]
    assert syllables_of_py("Běijīng", ["bei3", "jing1"]) == ["bei3", "jing1"]
    assert syllables_of_py("kèqi", ["ke4"]) is None


def test_py_problems_accepts_textbook_pinyin():
    good = [("不客气", "bú kèqi", "bu4 ke4 qi5"), ("拔苗助长", "bámiáo-zhùzhǎng", "ba2 miao2 zhu4 zhang3"),
            ("一点儿", "yìdiǎnr", "yi1 dian3 r5"), ("女儿", "nǚ'ér", "nü3 er2"), ("北京", "Běijīng", "bei3 jing1"),
            ("受不了", "shòubuliǎo", "shou4 bu4 liao3"), ("第一", "dì-yī", "di4 yi1"), ("打电话", "dǎ diànhuà", "da3 dian4 hua4"),
            ("虽然…但是…", "suīrán…dànshì…", "sui1 ran2 dan4 shi4"), ("黄河", "Huáng Hé", "huang2 he2")]
    assert [py_problems(*row) for row in good] == [[]] * len(good)


def test_py_problems_finds_each_kind():
    assert py_problems("爱", "ài.", "ai4") == ["py 'ài.' holds '.'; only letters, spaces, hyphens and apostrophes are allowed"]
    assert py_problems("不客气", "bú  kèqi", "bu4 ke4 qi5") == \
        ["py 'bú  kèqi' has a space, hyphen or apostrophe at an end or two in a row"]
    assert py_problems("苹果", "pínguǒ", "ping2 guo3") == ["py 'pínguǒ' does not spell pyNum 'ping2 guo3'"]
    assert py_problems("一下", "yǐxià", "yi1 xia4") == ["syllable 1 of py is yi3 but pyNum has yi1"]
    assert py_problems("西安", "xīān", "xi1 an1") == ["an apostrophe is missing before syllable 2 'ān'"]
    assert py_problems("爱人", "ài'rén", "ai4 ren2") == ["an apostrophe stands before syllable 2 'rén'"]


def test_base_and_syllable_count():
    assert py_base(["nü3", "er2"]) == "nüer"
    assert py_base(["gan4", "huo2", "r5"]) == "ganhuor"
    assert syllable_count(["gan4", "huo2", "r5"]) == 2


def test_card_pinyin_follows_the_style_sheet():
    # Point 5: a card that is a potential complement keeps the joined form the PDFs print or the
    # public list gives, with its neutral bu, even where jieba would cut it.
    cut = {"看不起": ["看", "不起"], "来得及": ["来得", "及"]}.get
    assert headword_joints("看不起", cut) == ["", ""] and headword_joints("来得及", cut) == ["", ""]
    assert card_py(tone_change("看不起", ["kan4", "bu5", "qi3"]), headword_joints("看不起", cut)) == "kànbuqǐ"
    assert pdf_pinyin(" láibují v. haven't enough time ", "来不及", ["lai2", "bu5", "ji2"]) == \
        (["lai2", "bu5", "ji2"], ["", ""])
    # Point 6: numbers. HSK 4 prints 百分之 "bǎifēnzhī", 第一 keeps its hyphen, 一 keeps its tone after
    # a numeral, and an approximate number takes a hyphen.
    assert pdf_pinyin(" bǎifēnzhī percent ", "百分之", ["bai3", "fen1", "zhi1"]) == (["bai3", "fen1", "zhi1"], ["", ""])
    assert card_py(tone_change("十一", ["shi2", "yi1"])) == "shíyī"
    assert card_py(tone_change("一两", ["yi1", "liang3"]), ["-"]) == "yì-liǎng"
    # Point 7: every part of a place name takes a capital, a title stays in lower case, and a month
    # name is a common noun in lower case (a row with N in data/manual/capitals, as for 正月).
    assert card_py(["fu2", "jian4", "sheng3"], ["", " "], capital=True) == "Fújiàn Shěng"
    assert card_py(["wang2", "xian1", "sheng5"], [" ", ""], capital=[True, False]) == "Wáng xiānsheng"
    months, _ = name_rows([{"hz": "正月", "words": "", "capital": "N"}])
    assert card_py(["zheng1", "yue4"], capital=months["正月"][1]) == "zhēngyuè"
    # Point 8: the tone changes of 一 and 不 as they are spoken, and neutral tones as in the dictionary.
    spoken = [("一起", ["yi1", "qi3"]), ("一下", ["yi1", "xia4"]), ("不是", ["bu4", "shi4"]), ("唯一", ["wei2", "yi1"]),
              ("不客气", ["bu4", "ke4", "qi5"])]
    assert [card_py(tone_change(hz, nums)) for hz, nums in spoken] == ["yìqǐ", "yíxià", "búshì", "wéiyī", "búkèqi"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_pinyin_text.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'pinyin_text'`

- [ ] **Step 3: Write `tools/pinyin_text.py`**

```python
"""Pinyin formats for the cards: tone-marked with textbook word spacing, numbered and toneless.

Numbered pinyin writes the tone as a digit after each syllable, one syllable per
space, as in "ping2 guo3". Tone 5 is the neutral (light) tone, and the 儿 ending is the
syllable "r5", as in "gan4 huo2 r5" for 干活儿.

The card pinyin `py` follows the textbook word-spacing rules (汉语拼音正词法). The syllables of
one word are written together, words are separated by spaces, and a four-character idiom that
divides into two pairs is written as two joined pairs with a hyphen, as in 不客气 "bú kèqi",
拔苗助长 "bámiáo-zhùzhǎng" and 一点儿 "yìdiǎnr". Inside a word, a syllable that starts with a, o
or e gets an apostrophe (西安 "xī'ān"). Where the words meet is described by "joints", one per gap between two
syllables. "" joins two syllables of one word, " " starts a new word, "-" joins the halves of
an idiom (or 第 and its number), and "…" separates the halves of a pattern word such as 虽然…但是….

A four-character word takes one of three forms (FORMS), as the textbook rules write it. An idiom
that divides into two pairs is two joined pairs with a hyphen (拔苗助长 "bámiáo-zhùzhǎng"), a
compound of several words is written as those words ("words", 通货膨胀 "tōnghuò péngzhàng"), and a
single word that cannot be divided is written joined (二氧化碳 "èryǎnghuàtàn"), as are an idiom
that does not divide into two pairs (总而言之 "zǒng'éryánzhī") and a doubled word (断断续续).
data/manual/four_char_words says which form each such word takes, and data/manual/capitals says
which words are names with capitals.
"""
import re
import unicodedata

from pinyin_norm import toneless

_MARKS = {"a": "āáǎà", "e": "ēéěè", "i": "īíǐì", "o": "ōóǒò", "u": "ūúǔù", "ü": "ǖǘǚǜ"}
_TONE_OF = {ch: (base, n + 1) for base, row in _MARKS.items() for n, ch in enumerate(row)}
_NUMERALS = set("〇零一二两三四五六七八九十百千万亿第")
_AOE = "aāáǎàoōóǒòeēéěè"
# Characters that may stand between two syllables in printed pinyin. The PDFs write the
# apostrophe as ’.
_SEPARATORS = " -'’…"
IDIOM_JOINTS = ["", "-", ""]
FORMS = ("idiom", "words", "joined")
FORM_COLUMNS = ["hz", "form", "words"]
# The columns of the batch files for the form agents (Plan 3a Task 7). They hold the word, its
# numbered pinyin, an English meaning for a card, card or sentence, for a sentence word one
# sentence that holds it, and "idiom" in mark when CC-CEDICT marks the word "(idiom)", which is
# only a hint to the agents.
FORM_BATCH_COLUMNS = ["hz", "pinyin", "en", "where", "sentence", "mark"]
FORM_BATCH = 100


def syllable_to_num(syl):
    """One tone-marked syllable in numbered form, so "Běi" gives "bei3", "lǜ" gives "lü4" and "r" gives "r5"."""
    syl = unicodedata.normalize("NFC", syl.replace("u:", "ü").replace("U:", "Ü")).lower()
    tone, out = 5, []
    for ch in syl:
        if ch in _TONE_OF:
            base, tone = _TONE_OF[ch]
            out.append(base)
        else:
            out.append(ch)
    return "".join(out) + str(tone)


def marked_to_num(py):
    """A tone-marked reading with one syllable per space to numbered pinyin.

    "Běi jīng" gives "bei3 jing1", and "gàn huó r" gives "gan4 huo2 r5".
    """
    return " ".join(syllable_to_num(s) for s in py.split())


def join_erhua(hz, nums):
    """The numbered syllables with a neutral 儿 ending written as "r5", which joins the syllable before it.

    The public list writes the 儿 ending as "r" (一点儿 "yī diǎn r", numbered yi1 dian3 r5), except
    for 纽扣儿, which it writes "niǔ kòu er", numbered niu3 kou4 er5. So a final "er5" of a headword
    of more than one character that ends in 儿 becomes "r5", and ["niu3", "kou4", "er5"] gives
    ["niu3", "kou4", "r5"], which card_py writes "niǔkòur". A 儿 with its own tone stays a syllable
    (女儿 nü3 er2, 婴儿 ying1 er2).
    """
    if len(hz) > 1 and hz.endswith("儿") and nums and nums[-1] == "er5":
        return list(nums[:-1]) + ["r5"]
    return list(nums)


def num_to_marked(syl):
    """One numbered syllable in tone-marked form, so "lü4" gives "lǜ", "guo3" gives "guǒ" and "ma5" gives "ma".

    The mark goes on a or e if there is one, on the o of "ou", and otherwise on the last vowel.
    """
    base, tone = syl[:-1], int(syl[-1])
    if tone == 5:
        return base
    if "a" in base:
        i = base.index("a")
    elif "e" in base:
        i = base.index("e")
    elif "ou" in base:
        i = base.index("o")
    else:
        i = max(base.rfind(v) for v in "iouü")
    return base[:i] + _MARKS[base[i]][tone - 1] + base[i + 1:]


def tone_change(hz, nums, keep=()):
    """Apply the tone changes of 一 and 不 that textbooks write, and no others.

    hz: the characters, one per syllable (a 儿 ending counts as its own character, like "r5").
    nums: the numbered syllables, in dictionary tones. keep: positions of 一 that end a
    word inside a sentence (统一 in 统一中国), which keep yi1.
    Between two copies of one character, 一 and 不 lose their tone, so 看一看 gives kan4 yi5 kan4
    and 好不好 gives hao3 bu5 hao3. Otherwise these rules apply.
    不 (bu4) becomes bu2 before a fourth tone, so 不客气 bu4 ke4 qi5 gives bu2 ke4 qi5.
    一 (yi1) becomes yi2 before a fourth tone and yi4 before a first, second or third tone:
    一下 gives yi2 xia4 and 一起 gives yi4 qi3. 一 keeps yi1 at the end (统一), after a
    numeral or 第 (十一, 第一), before 月 (一月) and before a neutral tone.
    """
    out = list(nums)
    for i, (ch, syl) in enumerate(zip(hz, nums)):
        if i + 1 >= len(nums) or syl not in ("bu4", "yi1") or ch not in "不一":
            continue
        if 0 < i and hz[i - 1] == hz[i + 1]:
            out[i] = syl[:-1] + "5"
            continue
        nxt = nums[i + 1][-1]
        if ch == "不":
            if nxt == "4":
                out[i] = "bu2"
        elif not (i in keep or (i > 0 and hz[i - 1] in _NUMERALS) or hz[i + 1] == "月" or nxt == "5"):
            out[i] = "yi2" if nxt == "4" else "yi4"
    return out


def reading_mismatches(chars, shown, nums):
    """Positions where the shown syllables differ from the dictionary syllables `nums`, once the
    tone changes of 一 and 不 are removed.

    A shown yi2, yi4 or yi5 of 一 counts as its dictionary yi1, and a shown bu2 or bu5 of 不 as its
    dictionary bu4. So 不客气 shown as bu2 ke4 qi5 matches bu4 ke4 qi5, and 受不了 shown as
    shou4 bu5 liao3 matches shou4 bu4 liao3, while 一下 shown as yi3 xia4 differs at position 0.
    """
    out = []
    for i, (ch, s, n) in enumerate(zip(chars, shown, nums)):
        changed = (ch == "一" and n == "yi1" and s in ("yi2", "yi4", "yi5")) or \
                  (ch == "不" and n == "bu4" and s in ("bu2", "bu5"))
        if s != n and not changed:
            out.append(i)
    return out


def card_py(nums, joints=None, capital=False):
    """Tone-marked card pinyin in textbook word spacing.

    nums: numbered syllables, with the 一 and 不 tone changes already applied. An "r5" (the 儿
    ending) always joins the syllable before it.
    joints: one item per gap between two syllables (see the module notes); None joins them all.
    A pattern word's "…" joints also get a final "…".
    Inside a word, a syllable starting with a, o or e gets an apostrophe.
    capital: True capitalises each word, for names such as 北京 "Běijīng" and 黄河 "Huáng Hé". A list
    with one True or False per word capitalises only some words (capitalise).
    ["bu2", "ke4", "qi5"] with joints [" ", ""] gives "bú kèqi", ["xi1", "an1"] gives "xī'ān",
    ["ba2", "miao2", "zhu4", "zhang3"] with IDIOM_JOINTS gives "bámiáo-zhùzhǎng", and
    ["sui1", "ran2", "dan4", "shi4"] with ["", "…", ""] gives "suīrán…dànshì…".
    """
    joints = list(joints) if joints is not None else [""] * (len(nums) - 1)
    text = ""
    for k, syl in enumerate(nums):
        if k and syl == "r5":
            text += "r"
            continue
        marked = num_to_marked(syl)
        joint = joints[k - 1] if k else ""
        if k and not joint and marked[0] in _AOE:
            joint = "'"
        text += joint + marked
    if "…" in joints:
        text += "…"
    return capitalise(text, capital)


def capitalise(text, capital):
    """text with a capital at the start of some of its words (the parts between spaces).

    capital: True for every word, False for none, or one True or False per word. The textbook
    rules write a surname and a given name each with a capital and a title in lower case, so
    "lǐ lǎoshī" with [True, False] gives "Lǐ lǎoshī", and "wáng jiànguó" with True gives
    "Wáng Jiànguó".
    """
    words = text.split(" ")
    flags = list(capital) if isinstance(capital, (list, tuple)) else [bool(capital)] * len(words)
    if len(flags) != len(words):
        raise ValueError(f"{text!r}: {len(words)} words but {len(flags)} capital flags")
    return " ".join(w[:1].upper() + w[1:] if flag else w for w, flag in zip(words, flags))


def joints_from_sizes(sizes, between=" "):
    """Joints for words of the given sizes in syllables, so [1, 2] gives [" ", ""] (不 + 客气)."""
    out = []
    for n, size in enumerate(sizes):
        if n:
            out.append(between)
        out += [""] * (size - 1)
    return out


def _spell(text, nums):
    """Find the syllables of `nums` in tone-marked text, in order, ignoring tones and capitals.

    Returns ([(separators before the syllable, the syllable as written)], end), where end is the
    position after the last syllable, or None when the letters do not spell nums. Separators are
    spaces, hyphens, apostrophes and "…". An "r5" must follow its syllable directly as "r".
    The PDFs' Latin letter "ɑ" counts as "a". So "bú kèqi You’re" with bu4 ke4 qi5 gives
    ([("", "bú"), (" ", "kè"), ("", "qi")], 7).
    """
    t = unicodedata.normalize("NFC", text).replace("ɑ", "a")
    i, out = 0, []
    for syl in nums:
        sep = ""
        while i < len(t) and t[i] in _SEPARATORS:
            sep += t[i]
            i += 1
        start = i
        for letter in syl[:-1]:
            if i >= len(t) or toneless(t[i]) != letter:
                return None
            i += 1
        if syl == "r5" and sep:
            return None
        out.append((sep, t[start:i]))
    return out, i


def _joint(sep):
    """The joint that printed separators stand for: "…", "-" or " " when present, else ""."""
    return next((j for j in ("…", "-", " ") if j in sep), "")


def _pattern_gaps(hz):
    """Gap positions between the halves of a pattern word, so 虽然…但是… gives {1}."""
    gaps, n = set(), 0
    for part in [p for p in hz.split("…") if p][:-1]:
        n += len(part)
        gaps.add(n - 1)
    return gaps


def pdf_pinyin(text, hz, nums):
    """The textbook pinyin printed at the start of a PDF entry's Latin text, when it fits the card.

    The HSK 1 to 4 PDFs print word-spaced textbook pinyin ("bú kèqi", "dǎ diànhuà", "dì-yī",
    "nǚ’ér"). text: the entry's Latin text. hz: the headword. nums: the card reading in
    dictionary tones. The printed syllables must spell nums, with the same tones once the
    tone changes of 一 and 不 are removed, and a pattern word's "…" must sit between its halves.
    Returns (the printed syllables in numbered form, joints) or None.
    " bú kèqi You’re welcome. " with 不客气 and bu4 ke4 qi5 gives (["bu2", "ke4", "qi5"], [" ", ""]).
    """
    found = _spell(text.lstrip(), nums)
    if found is None or found[0][0][0]:
        return None
    shown = [syllable_to_num(s) for _, s in found[0]]
    joints = [_joint(sep) for sep, _ in found[0][1:]]
    if reading_mismatches(hz.replace("…", ""), shown, nums):
        return None
    if {k for k, j in enumerate(joints) if j == "…"} != _pattern_gaps(hz):
        return None
    return shown, joints


def printed_pinyin(texts, hz, nums):
    """The printed pinyin of the first of a card's HSK 1 to 4 PDF texts that fits the card (pdf_pinyin).

    Returns (the printed syllables in numbered form, joints, capital) or None. capital says whether
    the print starts with a capital letter, so the capital of `py` follows the print, as its spacing
    does. The public list writes 互联网 "Hù lián wǎng", but HSK4 #776 prints " hùliánwǎng n. the
    Internet ", which gives capital False, while " Běijīng n. Beijing " gives capital True.
    """
    for text in texts:
        found = pdf_pinyin(text, hz, nums)
        if found:
            return found[0], found[1], text.lstrip()[:1].isupper()
    return None


def headword_joints(hz, cut, form=None):
    """Joints for a headword whose textbook pinyin the PDFs do not print.

    cut(text) gives the words the jieba segmenter finds in text. A pattern word joins each half
    and puts "…" between the halves. A 儿 ending of a longer headword joins the rest, which these
    rules place. A headword of one or two characters is one word, and so is a headword of three
    characters with 不 or 得 in the middle, because point 5 of the pinyin style sheet keeps a card
    that is a potential complement in the joined form the PDFs print or the public list gives
    (看不起 "kànbuqǐ", 来得及), even where jieba would cut it. A four-character headword with
    a form, a pair (form, words) as form_rows gives it, is written in that form (form_joints).
    Step 5 takes every form from data/manual/four_char_words. Otherwise each word that cut finds
    is one pinyin word, so 系领带 cut as 系 + 领带 gives [" ", ""] ("xì lǐngdài").
    """
    if "…" in hz:
        return joints_from_sizes([len(p) for p in hz.split("…") if p], "…")
    if len(hz) > 2 and hz.endswith("儿"):
        return headword_joints(hz[:-1], cut, form) + [""]
    if len(hz) <= 2 or (len(hz) == 3 and hz[1] in "不得"):
        return [""] * (len(hz) - 1)
    if len(hz) == 4 and form:
        return form_joints(*form)
    return joints_from_sizes([len(w) for w in cut(hz)])


def form_joints(form, words):
    """Joints for a four-character word in one of the three FORMS.

    idiom gives IDIOM_JOINTS (拔苗助长 "bámiáo-zhùzhǎng") and joined gives ["", "", ""] (二氧化碳
    "èryǎnghuàtàn"). words puts a space between the listed words, so ["通货", "膨胀"] gives
    ["", " ", ""] ("tōnghuò péngzhàng") and ["叹", "一", "口", "气"] gives [" ", " ", " "].
    """
    if form == "idiom":
        return list(IDIOM_JOINTS)
    if form == "words":
        return joints_from_sizes([len(w) for w in words])
    return ["", "", ""]


def joints_of_py(py, nums):
    """The joints of a card's py, so "bú kèqi" with bu4 ke4 qi5 gives [" ", ""]. None if py does not spell nums."""
    py = unicodedata.normalize("NFC", py)
    found = _spell(py, nums)
    if found is None or py[found[1]:].strip("…"):
        return None
    return [_joint(sep) for sep, _ in found[0][1:]]


def syllables_of_py(py, nums):
    """The numbered syllables that a card's py shows, with its 一 and 不 tone changes.

    So "shòubuliǎo" with shou4 bu4 liao3 gives ["shou4", "bu5", "liao3"], and "bú kèqi" with
    bu4 ke4 qi5 gives ["bu2", "ke4", "qi5"]. None if py does not spell nums.
    """
    py = unicodedata.normalize("NFC", py)
    found = _spell(py, nums)
    if found is None or py[found[1]:].strip("…"):
        return None
    return [syllable_to_num(s) for _, s in found[0]]


def py_problems(hz, py, pynum):
    """Why a card's py does not fit its pyNum and the spacing rules; an empty list means it fits.

    It checks four things. py holds only letters, spaces, hyphens and apostrophes (and "…" in a
    pattern word). No space, hyphen or apostrophe stands at either end or two in a row. Its
    syllables spell pyNum with the same tones once the tone changes of 一 and 不 are removed. An
    apostrophe stands exactly before each syllable inside a word that starts with a, o or e.
    ("不客气", "bú kèqi", "bu4 ke4 qi5") and ("拔苗助长", "bámiáo-zhùzhǎng", "ba2 miao2 zhu4 zhang3")
    give [], while ("西安", "xīān", "xi1 an1") gives ["an apostrophe is missing before syllable 2 'ān'"].
    """
    py, nums, chars = unicodedata.normalize("NFC", py), pynum.split(), hz.replace("…", "")
    odd = sorted({ch for ch in py if not (ch.isalpha() or ch in " -'" or (ch == "…" and "…" in hz))})
    if odd:
        return [f"py {py!r} holds {''.join(odd)!r}; only letters, spaces, hyphens and apostrophes are allowed"]
    if re.search(r"^[ \-']|[ \-']$|[ \-'…]{2}", py.rstrip("…")):
        return [f"py {py!r} has a space, hyphen or apostrophe at an end or two in a row"]
    found = _spell(py, nums)
    if found is None or py[found[1]:].strip("…"):
        return [f"py {py!r} does not spell pyNum {pynum!r}"]
    shown = [syllable_to_num(s) for _, s in found[0]]
    problems = [f"syllable {k + 1} of py is {shown[k]} but pyNum has {nums[k]}"
                for k in reading_mismatches(chars, shown, nums)]
    for k, (sep, written) in enumerate(found[0]):
        if not k or nums[k] == "r5":
            continue
        inside = _joint(sep) == ""
        if inside and written[:1].lower() in _AOE and "'" not in sep:
            problems.append(f"an apostrophe is missing before syllable {k + 1} {written!r}")
        elif "'" in sep and not (inside and written[:1].lower() in _AOE):
            problems.append(f"an apostrophe stands before syllable {k + 1} {written!r}")
    return problems


def py_base(nums):
    """Toneless pinyin in lower case with no spaces and ü kept, so ["ping2", "guo3"] gives "pingguo"."""
    return "".join(("r" if s == "r5" else s[:-1]) for s in nums)


def syllable_count(nums):
    """Number of syllables, not counting a 儿 ending, so ["gan4", "huo2", "r5"] gives 2."""
    return sum(1 for s in nums if s != "r5")


def form_rows(rows):
    """{hz: (form, words)} from the rows of data/manual/four_char_words, and the problems found.

    Each row has hz (four characters), form (one of FORMS) and words. For the form "words", words
    lists the words that spell hz, separated by spaces, and for the other forms it is empty. So
    {"hz": "通货膨胀", "form": "words", "words": "通货 膨胀"} gives {"通货膨胀": ("words", ["通货", "膨胀"])}.
    A form that is not one of FORMS, words that do not spell hz or are given for another form,
    and a headword listed twice are problems.
    """
    out, problems = {}, []
    for r in rows:
        hz, form = (r.get("hz") or "").strip(), (r.get("form") or "").strip().lower()
        words = (r.get("words") or "").split()
        if len(hz) != 4 or form not in FORMS:
            problems.append(f"{hz}: form {r.get('form')!r} is not idiom, words or joined, or hz is not four characters")
        elif (form == "words") != bool(words) or (words and ("".join(words) != hz or len(words) < 2)):
            problems.append(f"{hz}: words {r.get('words')!r} do not fit the form {form}")
        elif hz in out:
            problems.append(f"{hz}: listed twice")
        else:
            out[hz] = (form, words)
    return out, problems


def check_form_answers(inputs, outputs):
    """Match a form agent's answers (columns FORM_COLUMNS) to its batch rows by hz.

    Each input hz needs exactly one answer that form_rows accepts. Returns (problems, rows), where
    rows holds the accepted answers as [hz, form, words], in the input order.
    """
    want = [(r.get("hz") or "").strip() for r in inputs]
    got, problems, seen = {}, [], {}
    for r in outputs:
        hz = (r.get("hz") or "").strip()
        seen[hz] = seen.get(hz, 0) + 1
        if hz not in want:
            problems.append(f"{hz}: not in the input")
            continue
        found, more = form_rows([r])
        problems += more
        got.update(found)
    problems += [f"{hz}: answered {n} times" for hz, n in seen.items() if n > 1 and hz in want]
    problems += [f"{hz}: missing" for hz in want if hz not in seen]
    return problems, [[hz, got[hz][0], " ".join(got[hz][1])] for hz in want if hz in got]


def name_rows(rows):
    """{hz: (words, capitals)} from the rows of data/manual/capitals, and the problems found.

    Each row has hz, words and capital. words is empty for a name of one word (欧洲). For a
    person's name it lists the words that spell hz, separated by spaces, because the textbook
    rules write the surname apart from the given name and a title apart from the name (王建国
    "王 建国", 李老师 "李 老师"). capital is one Y or N for all the words, or one per word. So
    {"hz": "李老师", "words": "李 老师", "capital": "Y N"} gives {"李老师": (["李", "老师"], [True, False])},
    which is written "Lǐ lǎoshī". A value other than Y or N, a number of values that does not fit
    the words, words that do not spell hz and a headword listed twice are problems.
    """
    out, problems = {}, []
    for r in rows:
        hz = (r.get("hz") or "").strip()
        words = (r.get("words") or "").split() or [hz]
        values = (r.get("capital") or "").upper().split()
        if len(values) == 1:
            values = values * len(words)
        if not values or any(v not in ("Y", "N") for v in values) or len(values) != len(words):
            problems.append(f"{hz}: capital is {r.get('capital')!r}, not one Y or N, or one per word")
        elif "".join(words) != hz:
            problems.append(f"{hz}: words {r.get('words')!r} do not spell it")
        elif hz in out:
            problems.append(f"{hz}: listed twice")
        else:
            out[hz] = (words, [v == "Y" for v in values])
    return out, problems
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_pinyin_text.py -q`
Expected: `21 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/pinyin_text.py tests/test_pinyin_text.py && git commit -F - <<'EOF'
feat: card pinyin formats, textbook word spacing and the 一 and 不 tone changes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 2: Senses and sentences of a PDF entry (`tools/pdfbody.py`)

**Files:**
- Create: `tools/pdfbody.py`
- Test: `tests/test_pdfbody.py`

A sense is one meaning of an entry, made of its English gloss and the sentences printed after it. HSK1 #1 爱 has two senses, "love" with 妈妈，我～你。 and "like doing sth." with 我～吃米饭。.

- [ ] **Step 1: Write the failing test `tests/test_pdfbody.py`**

```python
from pdfbody import (contains_head, fill_placeholder, inline_text, is_inline, sentence_candidates, sentences_of,
                     split_senses)

FWD = {1: "妈", 2: "我", 3: "～", 4: "你", 5: "。", 6: "吃", 7: "米", 8: "饭", 12: "好", 13: "，"}


def test_split_senses_on_glosses_but_not_on_inline_text():
    tokens = [["c", [835, 99, 836]], ["l", " àiv. love "], ["c", [1, 1, 13, 2, 3, 4, 5]],
              ["l", "v. like doing sth. "], ["c", [2, 3, 6]], ["l", " 10 "], ["c", [7, 8, 5]]]
    assert split_senses(tokens, FWD) == [("àiv. love", "妈妈，我～你。"), ("v. like doing sth.", "我～吃10米饭。")]


def test_ascii_tilde_and_acronyms_stay_in_the_sentence():
    tokens = [["c", [99]], ["l", " xiǎo adj. small "], ["c", [2]], ["l", "~"], ["c", [5]],
              ["l", " DNA "], ["c", [12, 5]]]
    assert split_senses(tokens, FWD) == [("xiǎo adj. small", "我～。DNA好。")]


def test_is_inline_and_inline_text():
    assert is_inline("  ") and is_inline(" 300 ") and is_inline("?") and is_inline(" CEO ")
    assert not is_inline("ok; please ") and not is_inline("nàr") and not is_inline(" entrust ")
    assert inline_text(" 10 ") == "10" and inline_text("~") == "～" and inline_text("?") == "？"
    assert inline_text(" 3.5 ") == "3.5" and inline_text("'") == ""


def test_sentences_of_drops_fragments_and_leading_semicolons():
    assert sentences_of("～个人是我的同学。我能坐在～儿吗？") == ["～个人是我的同学。", "我能坐在～儿吗？"]
    assert sentences_of("；；游客挨了宰，") == []
    assert sentences_of("；这个版本的字典已售完了。") == ["这个版本的字典已售完了。"]
    assert sentences_of("他说：“好！”") == ["他说：“好！”"]


def test_sentence_candidates_add_the_joined_form():
    assert sentence_candidates("哇！这些照片真漂亮！") == ["哇！", "这些照片真漂亮！", "哇！这些照片真漂亮！"]
    assert sentence_candidates("我～吃米饭。") == ["我～吃米饭。"]


def test_fill_placeholder():
    assert fill_placeholder("妈妈，我～你。", "爱") == "妈妈，我爱你。"
    assert fill_placeholder("我能坐在～儿吗？", "这") == "我能坐在这儿吗？"
    assert fill_placeholder("～下雨了，～我们还是想去看电影。", "虽然…但是…") == "虽然下雨了，但是我们还是想去看电影。"
    assert fill_placeholder("～下雨了。", "虽然…但是…") is None


def test_contains_head():
    assert contains_head("虽然下雨了，但是我们还是去了。", "虽然…但是…")
    assert not contains_head("但是下雨了，虽然我们还是去了。", "虽然…但是…")
    assert contains_head("我爱你。", "爱") and not contains_head("我喜欢你。", "爱")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_pdfbody.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'pdfbody'`

- [ ] **Step 3: Write `tools/pdfbody.py`**

```python
"""Split a decoded PDF entry into its senses, each an English gloss with its example sentences.

An entry's tokens alternate between Chinese glyph codes ("c") and Latin text ("l").
tokens[0] is the headword and tokens[1] its pinyin, part of speech and first gloss.
After that, Chinese tokens are sentences, and a Latin token is either part of a
sentence (spaces, digits, punctuation, an upper-case abbreviation such as DNA,
or the ASCII ~ that stands for the headword) or the gloss of the next sense.
For example, HSK1 #1 爱 gives
[("àiv. love", "妈妈，我～你。"), ("v. like doing sth.", "我～吃米饭。")].
"""
import re

from decode import decode_cids

PLACEHOLDER = "～"
_DIGITS_PUNCT = re.compile(r"[\s\d.,:;%/+\-!?'\"“”#~\u2014]+")
_ACRONYM = re.compile(r"\s*[A-Z][A-Z0-9]+\s*")
_HALF_TO_FULL = {",": "，", "!": "！", "?": "？", ":": "：", ";": "；", "~": PLACEHOLDER}
_ENDS = "。！？"


def is_inline(text):
    """True when a Latin token belongs inside a sentence rather than starting a new gloss."""
    return not text.strip() or bool(_DIGITS_PUNCT.fullmatch(text)) or bool(_ACRONYM.fullmatch(text))


def inline_text(text):
    """Latin text inside a sentence, in the form a Chinese sentence uses.

    Spaces and stray apostrophes are dropped, half-width punctuation becomes full-width,
    ASCII ~ becomes ～, and a full stop becomes 。 unless it sits between digits (3.5).
    " 10 " gives "10", "~" gives "～", "?" gives "？".
    """
    t = text.strip().replace("'", "")
    t = "".join(_HALF_TO_FULL.get(ch, ch) for ch in t)
    return re.sub(r"(?<!\d)\.|\.(?!\d)", "。", t)


def split_senses(tokens, fwd):
    """[(gloss, body_text)] for one entry, where body_text joins everything up to the next gloss."""
    senses = []
    for kind, value in tokens[1:]:
        if kind == "l" and (not senses or not is_inline(value)):
            senses.append([value.strip(), ""])
        elif kind == "l":
            senses[-1][1] += inline_text(value)
        else:
            senses[-1][1] += decode_cids(value, fwd)
    return [(g, b) for g, b in senses]


def sentences_of(body):
    """Cut a sense's body text into sentences that end in 。, ！ or ？ (a closing ” stays attached).

    Leading ；, commas and spaces are removed, and pieces without a proper ending are dropped.
    So "；；游客挨了宰，" gives [], and "～个人是我的同学。我能坐在～儿吗？" gives two sentences.
    """
    out = []
    for m in re.finditer(r"[^。！？]*[。！？]+”?", body):
        s = m.group(0).lstrip("；;，, ")
        if s and s[0] not in _ENDS:
            out.append(s)
    return out


def sentence_candidates(body):
    """The sentences of a sense, plus all of them joined when there are several.

    The joined form keeps short exclamations usable, so "哇！这些照片真漂亮！" gives
    ["哇！", "这些照片真漂亮！", "哇！这些照片真漂亮！"].
    """
    found = sentences_of(body)
    return found + ["".join(found)] if len(found) > 1 else found


def fill_placeholder(sentence, hz):
    """Write the headword where the sentence has ～, or None if it cannot be done.

    A pattern word such as 虽然…但是… fills each ～ with its own half, in order, so
    "～下雨了，～我们还是想去看电影。" gives "虽然下雨了，但是我们还是想去看电影。".
    It needs exactly one ～ per half. An ordinary word fills every ～.
    """
    parts = [p for p in hz.split("…") if p]
    count = sentence.count(PLACEHOLDER)
    if len(parts) == 1:
        return sentence.replace(PLACEHOLDER, parts[0])
    if count != len(parts):
        return None
    for p in parts:
        sentence = sentence.replace(PLACEHOLDER, p, 1)
    return sentence


def contains_head(sentence, hz):
    """True when every part of the headword appears in the sentence, in order."""
    pos = 0
    for part in (p for p in hz.split("…") if p):
        pos = sentence.find(part, pos)
        if pos < 0:
            return False
        pos += len(part)
    return True
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_pdfbody.py -q`
Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/pdfbody.py tests/test_pdfbody.py && git commit -F - <<'EOF'
feat: split PDF entries into senses and sentences

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 3: Parts of speech and English meanings (`tools/meaning.py`)

**Files:**
- Create: `tools/meaning.py`
- Test: `tests/test_meaning.py`

CC-CEDICT is the free Chinese-English dictionary whose meanings the public list carries. The PDFs print labels such as `n.`, `nm.` (a measure word), `sa.` (a structural particle) and `sv.` (a separable verb, a verb-object word such as 跳舞 whose two parts can be split, as in 跳一个舞), and these are mapped to the schema's labels.

The PDF glosses need some repair, because the PDF text layer sometimes loses a space ("withrespect"), joins two senses with a colon ("interval:interspace"), leaves out the space after a comma ("restaurant,eatery") or starts with a stray mark ("? pause", ". of course"). Four rules here handle the cases that a program can fix safely:
- a colon between two senses in a PDF gloss becomes "; " (only in PDF glosses, because CC-CEDICT uses colons inside one sense, as in "classifier for cloth: bolt");
- a comma directly between two letters gets a space after it;
- a "." or "?" at the start of a gloss is removed;
- two senses that are equal once spaces are ignored count as one, and the copy with more spaces is kept. The HSK 1 to 4 files repeat each word, and often only one copy lost a space, so 您 has both "used to address someone withrespect" and "used to address someone with respect", and the second is kept.

A word that stays run together or misspelled in every copy ("take aninterest in") is fixed by hand in Task 6. `unknown_words` finds such words, because CC-CEDICT never uses them, and step 5 lists every candidate for review (Task 7).

CC-CEDICT also marks some senses with a register label in brackets. A sense marked `(slang)`, `(Internet slang)`, `(old)`, `(archaic)` or `(vulgar)` is left out, because a beginner's card should not teach it (踢 "to kick" also lists "(slang) butch (in a lesbian relationship)"). A sense marked `(literary)`, `(dialect)`, `(classical)` or `(Tw)` (Taiwan usage) goes after the other senses. The label `(coll.)` (colloquial, meaning everyday speech) is removed from the start of a sense, so 姥姥 reads "mother's mother", not "(coll.) mother's mother".

- [ ] **Step 1: Write the failing test `tests/test_meaning.py`**

```python
from meaning import (LEFTOVER_LABEL, cedict_senses, clean_gloss, en_short, fit_en, public_pos, senses_of, split_pos,
                     unknown_words, vocabulary)


def test_split_pos():
    assert split_pos("v. like doing sth. ") == (["v."], "like doing sth.")
    assert split_pos("nm.copy; issue") == (["m."], "copy; issue")
    assert split_pos(" adj theyoungest ") == (["adj."], "theyoungest")
    assert split_pos("'sa. expressing emphasis ") == (["part."], "expressing emphasis")
    assert split_pos(" protect; care; cherish ") == ([], "protect; care; cherish")
    assert split_pos("part") == ([], "part")
    assert split_pos(" n. & v. plan ") == (["n.", "v."], "plan")


def test_split_pos_separable_verbs_and_a_leading_slash():
    assert split_pos(" sv. dance ") == (["v."], "dance")
    assert split_pos("sv.give your name; enroll ") == (["v."], "give your name; enroll")
    assert split_pos("/vm. number of times") == (["m."], "number of times")


def test_split_pos_turns_a_colon_between_senses_into_a_semicolon():
    assert split_pos(" on the contrary; instead:fjdk ") == ([], "on the contrary; instead; fjdk")
    assert split_pos(" gamble; gambling: ") == ([], "gamble; gambling")


def test_leftover_label():
    assert LEFTOVER_LABEL.match("sv. dance") and LEFTOVER_LABEL.match("/vm. number of times")
    assert not LEFTOVER_LABEL.match("dance") and not LEFTOVER_LABEL.match("Mr.; sir")


def test_public_pos():
    assert public_pos(["v", "vn", "b"]) == ["v."]
    assert public_pos(["r", "c"]) == ["pron.", "conj."]
    assert public_pos(["i"]) == []


def test_clean_gloss_and_senses():
    assert clean_gloss(" copy; issue (used for counting books 'and other bound items)") == \
        "copy; issue (used for counting books and other bound items)"
    assert clean_gloss("though;but; however ") == "though; but; however"
    assert clean_gloss("restaurant,eatery; (large) hotel") == "restaurant, eatery; (large) hotel"
    assert clean_gloss("classifier for cloth: bolt") == "classifier for cloth: bolt"
    assert clean_gloss("? pause") == "pause" and clean_gloss(". of course; naturally") == "of course; naturally"
    assert senses_of(["love", "like; Love"]) == ["love", "like"]


def test_senses_that_differ_only_in_spaces_count_once():
    assert senses_of(["you (used to address someone withrespect)", "you (used to address someone with respect)"]) == \
        ["you (used to address someone with respect)"]
    assert senses_of(["have nothing; can't compare with others", "have nothing; can't compare withothers"]) == \
        ["have nothing", "can't compare with others"]


def test_unknown_words():
    vocab = vocabulary(["to take", "an interest in sth", "honor; center"])
    assert unknown_words("take aninterest in", vocab) == ["aninterest"]
    assert unknown_words("takes an interest", vocab) == []
    assert unknown_words("honour; centre", vocab) == []


def test_fit_en_keeps_three_senses_and_80_characters():
    assert fit_en(["a", "b", "c", "d"]) == "a; b; c"
    assert fit_en(["copy", "x" * 74]) == "copy; " + "x" * 74
    assert fit_en(["copy", "x" * 75]) == "copy"
    assert len(fit_en(["x" * 50, "y" * 40])) <= 80


def test_en_short():
    assert en_short(["to love", "to like"]) == "to love"
    assert en_short(["issue (used for counting books and other bound items)"]) == "issue"
    assert en_short(["a very long meaning that has no brackets at all here"]) == "a very long meaning that has…"
    assert en_short([]) == ""


def test_cedict_senses():
    assert cedict_senses(["surname Wang", "king; ruler", "CL:個|个[ge4]"]) == ["king", "ruler"]
    assert cedict_senses(["seems as if; rather like; Taiwan pr. [shi4 shi5]"]) == ["seems as if", "rather like"]
    assert cedict_senses(["to see off", "see 送[song4]"]) == ["to see off"]


def test_cedict_senses_drop_sound_notes_and_chinese_characters():
    assert cedict_senses(["to be", "to act as", "(onom.) dong"]) == ["to be", "to act as"]
    assert cedict_senses(["blood", "colloquial pr. [xie3]"]) == ["blood"]
    assert cedict_senses(["abbr. for 哈萨克斯坦[Ha1 sa4 ke4 si1 tan3], Kazakhstan"]) == []
    assert cedict_senses(["(interj.) ha!", "(onom. for laughter)"]) == ["(interj.) ha!", "(onom. for laughter)"]
    assert cedict_senses(["high speed", "expressway (abbr. for 高速公路[gao1 su4 gong1 lu4])"]) == \
        ["high speed", "expressway"]
    assert cedict_senses(["first of the ten Heavenly Stems 十天干[shi2 tian1 gan1]", "armor"]) == \
        ["first of the ten Heavenly Stems", "armor"]
    assert cedict_senses(["basin", "unit of volume equal to 12 斗[dou3] and 8 升[sheng1]"]) == ["basin"]
    assert cedict_senses(["copper (chemistry)", "see also 紅銅|红铜[hong2 tong2]"]) == ["copper (chemistry)"]
    assert cedict_senses(["variant of 記錄|记录[ji4 lu4] (but in Taiwan, not for the verb sense)"]) == []


def test_cedict_senses_register_labels():
    assert cedict_senses(["to kick", "to play (e.g. soccer)", "(slang) butch (in a lesbian relationship)"]) == \
        ["to kick", "to play (e.g. soccer)"]
    assert cedict_senses(["(coll.) mother's mother", "maternal grandmother"]) == \
        ["mother's mother", "maternal grandmother"]
    assert cedict_senses(["currency", "(old) exchange of goods"]) == ["currency"]
    assert cedict_senses(["(literary) to be deficient in", "to owe"]) == ["to owe", "(literary) to be deficient in"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_meaning.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'meaning'`

- [ ] **Step 3: Write `tools/meaning.py`**

```python
"""Part-of-speech labels and English meanings for the cards.

The card shows `en` (at most 3 senses and 80 characters) and the quiz choices show
`enShort` (at most 30 characters). A sense is one piece of a meaning list separated
by ";". For example the PDF glosses "love" and "like doing sth." give
en "love; like doing sth." and enShort "love".
"""
import re

# The PDFs print these labels after the pinyin ("àiv. love", "běn nm.copy", "pàngadj fat", "tiàowǔ sv. dance").
# sv. marks a separable verb, a verb-object word such as 跳舞 whose parts can be split (跳一个舞).
_PDF_POS = {"n": "n.", "v": "v.", "adj": "adj.", "adv": "adv.", "pron": "pron.", "num": "num.",
            "prep": "prep.", "conj": "conj.", "int": "int.", "part": "part.", "nm": "m.", "mw": "m.",
            "m": "m.", "vm": "m.", "aux": "v.", "sv": "v.", "sa": "part.", "mp": "part."}
# A label with a full stop counts anywhere. Without one, only labels that are not also English
# words count ("adj theyoungest", "v transfer"), so the gloss "part" of 局部 stays a gloss.
# A stray apostrophe or slash may come first ("'sa. expressing emphasis", "/vm. number of times").
_POS_AT_START = re.compile(r"\s*[/']?\s*(?:(num|adj|adv|pron|prep|conj|part|int|aux|mw|nm|mp|vm|sa|sv|v|n|m)\."
                           r"|(num|adj|adv|pron|prep|conj|aux|v|n)(?=\s))\s*(?:&\s*)?")
# A meaning that still starts with a PDF label and a full stop, such as "sv. dance". Plan 3b's
# validator rejects any en or enShort that matches.
LEFTOVER_LABEL = re.compile(r"^\W*(?:" + "|".join(sorted(_PDF_POS, key=len, reverse=True)) + r")\.")
# A colon in a PDF gloss that is not between two digits separates two senses ("interval:interspace").
_COLON = re.compile(r"(?<!\d):|:(?!\d)")

# The public list's tags (the ICTCLAS tag set used by the jieba segmenter) mapped to card labels.
# Tags not listed here (b, g, i, l, k, x and others) give no label.
_PUBLIC_POS = {"n": "n.", "nr": "n.", "ns": "n.", "nt": "n.", "nz": "n.", "t": "n.", "tg": "n.", "s": "n.",
               "f": "n.", "v": "v.", "vn": "v.", "vd": "v.", "a": "adj.", "an": "adj.", "ad": "adj.",
               "z": "adj.", "d": "adv.", "r": "pron.", "m": "num.", "mq": "num.", "q": "m.", "qv": "m.",
               "qt": "m.", "p": "prep.", "c": "conj.", "cc": "conj.", "u": "part.", "y": "part.",
               "e": "int.", "o": "int."}

# CC-CEDICT notes that are not meanings. At the start of a sense: classifiers, surnames, sounds
# ("(onom.) dong"), cross-references ("see also \u7ea2\u94dc") and abbreviations. Anywhere in a sense: variants
# ("variant of \u8bb0\u5f55") and pronunciation notes ("colloquial pr.", "Taiwan pr.").
_CEDICT_DROP = re.compile(r"^(CL:|surname\b|old variant|see (also\b|[\u4e00-\u9fff])|also written|abbr\. for"
                          r"|used in [\u4e00-\u9fff]|erhua variant|Japanese\b|Kangxi radical|radical in Chinese"
                          r"|\(onom\.\))|variant of\b|\bpr\.")
# CC-CEDICT register labels at the start of a sense. Senses marked with the first set are left out,
# senses marked with the second set go after the other senses, and "(coll.)" (colloquial) is removed.
_REGISTER_DROP = re.compile(r"^\((slang|Internet slang|old|archaic|vulgar)\)")
_REGISTER_LAST = re.compile(r"^\((literary|dialect|classical|Tw)\)")
_COLLOQUIAL = re.compile(r"^\(coll\.\)\s*")
_HANZI = re.compile(r"[\u4e00-\u9fff]")
_WORD = re.compile(r"[A-Za-z]+")
# Word endings removed before looking a word up, and British spellings tried in their American form
# (CC-CEDICT writes "honor" and "center"; the PDFs often write "honour" and "centre").
_ENDINGS = ("s", "es", "ed", "d", "ing", "ly")
_SPELLINGS = (("our", "or"), ("tre", "ter"), ("yse", "yze"), ("ise", "ize"))
EN_MAX, SHORT_MAX, SENSES_MAX = 80, 30, 3


def clean_gloss(text):
    """Tidy one gloss: single spaces, "; " between senses, a space after a comma between two letters,
    no stray quotes or edge punctuation, and no stray "." or "?" at the start.

    " copy; issue (used for counting books 'and other bound items)" gives
    "copy; issue (used for counting books and other bound items)", "restaurant,eatery" gives
    "restaurant, eatery", and "? pause" gives "pause".
    """
    t = text.replace("；", ";").replace("’", "'").replace(" '", " ")
    t = re.sub(r"(?<=[A-Za-z]),(?=[A-Za-z])", ", ", t)
    t = re.sub(r"\s*;\s*", "; ", t)
    return re.sub(r"\s+", " ", t).strip(" ;,'").lstrip(".? ")


def split_pos(text):
    """Leading PDF part-of-speech labels and the gloss after them.

    "v. like doing sth." gives (["v."], "like doing sth."), "nm.copy; issue" gives (["m."], "copy; issue"),
    "sv. dance" gives (["v."], "dance"), and "protect; care" gives ([], "protect; care").
    A colon between two senses becomes "; ", so "instead:fjdk" gives "instead; fjdk".
    """
    labels = []
    while True:
        m = _POS_AT_START.match(text)
        if not m:
            break
        label = _PDF_POS[m.group(1) or m.group(2)]
        if label not in labels:
            labels.append(label)
        text = text[m.end():]
    return labels, clean_gloss(_COLON.sub(";", text))


def public_pos(tags):
    """Card labels from the public list's tags, in order and without repeats, so ["v", "vn", "b"] gives ["v."]."""
    out = []
    for t in tags:
        label = _PUBLIC_POS.get(t)
        if label and label not in out:
            out.append(label)
    return out[:SENSES_MAX]


def senses_of(glosses):
    """Every distinct sense of a list of glosses, in order, so ["love", "like; love"] gives ["love", "like"].

    Two senses are the same when they match with case and spaces ignored, because a PDF copy of a
    gloss sometimes lost a space. The copy with more spaces is kept, in the place of the first copy,
    so ["can't compare withothers", "can't compare with others"] gives ["can't compare with others"].
    """
    out, where = [], {}
    for g in glosses:
        for part in clean_gloss(g).split(";"):
            part = part.strip()
            if not part:
                continue
            key = re.sub(r"\s+", "", part.lower())
            if key not in where:
                where[key] = len(out)
                out.append(part)
            elif part.count(" ") > out[where[key]].count(" "):
                out[where[key]] = part
    return out


def vocabulary(meanings):
    """The lower-case English words used in a list of meanings, so ["to take"] gives {"to", "take"}."""
    return {w.lower() for m in meanings for w in _WORD.findall(m)}


def unknown_words(text, vocab):
    """Words of `text` that `vocab` lacks, in order and without repeats.

    A word also counts as known when it is in vocab after removing a common ending (s, es, ed, d, ing,
    ly) or in its American spelling ("honour" as "honor", "centre" as "center"). Step 5 uses this to
    list PDF glosses with words run together, misspellings or junk text. With a vocabulary built
    from "to take" and "an interest in sth", "take aninterest in" gives ["aninterest"].
    """
    out = []
    for word in _WORD.findall(text):
        low = word.lower()
        forms = {low} | {low[:-len(e)] for e in _ENDINGS if low.endswith(e)}
        forms |= {f[:-len(old)] + new for f in list(forms) for old, new in _SPELLINGS if f.endswith(old)}
        if not forms & vocab and word not in out:
            out.append(word)
    return out


def _shorten(sense, limit):
    """Fit one sense into `limit` characters by dropping brackets, then cutting at a comma, then at a space."""
    if len(sense) <= limit:
        return sense
    s = re.sub(r"\s*\([^)]*\)", "", sense).strip()
    if len(s) <= limit:
        return s
    s = s.split(",")[0].strip()
    if len(s) <= limit:
        return s
    return s[:limit - 1].rsplit(" ", 1)[0].rstrip(" ,;") + "…"


def fit_en(senses):
    """The card meaning, which is up to 3 senses joined by "; " in at most 80 characters."""
    out = []
    for s in senses:
        s = _shorten(s, EN_MAX)
        if len(out) == SENSES_MAX or len("; ".join(out + [s])) > EN_MAX:
            break
        out.append(s)
    return "; ".join(out)


def en_short(senses):
    """The quiz-choice meaning, which is the first sense cut to at most 30 characters."""
    return _shorten(senses[0], SHORT_MAX) if senses else ""


def cedict_senses(meanings):
    """Usable senses from the public list's CC-CEDICT meanings, with no Chinese characters left.

    Pinyin in square brackets is removed, the notes matched by _CEDICT_DROP are dropped, and
    "traditional|simplified" pairs keep the simplified form. Then a bracket that holds Chinese
    characters and a Chinese word at the end of a sense are removed, and a sense that still
    holds Chinese characters is dropped. So "expressway (abbr. for 高速公路)" gives "expressway",
    "first of the ten Heavenly Stems 十天干" gives "first of the ten Heavenly Stems", and
    "unit of volume equal to 12 斗 and 8 升" is dropped.
    ["surname Wang", "king; ruler", "CL:個|个[ge4]"] gives ["king", "ruler"].
    Register labels are handled as in the notes above _REGISTER_DROP: ["to kick", "(slang) butch"]
    gives ["to kick"], ["(literary) to be deficient in", "to owe"] gives ["to owe", "(literary) to be
    deficient in"], and "(coll.) mother's mother" gives "mother's mother".
    The result can be empty; the caller then looks elsewhere (wordlist.english).
    """
    kept, later = [], []
    for m in meanings:
        for part in m.split(";"):
            part = re.sub(r"\[[^\]]*\]", "", part).strip()
            if not part or _CEDICT_DROP.search(part) or _REGISTER_DROP.match(part):
                continue
            part = _COLLOQUIAL.sub("", part)
            part = re.sub(r"\S+\|(\S+)", r"\1", part).replace("(bound form)", "")
            part = re.sub(r"\s*\([^)]*[一-鿿][^)]*\)", "", part).strip()
            part = re.sub(r"\s+[一-鿿]+$", "", part).strip()
            if part and not _HANZI.search(part):
                (later if _REGISTER_LAST.match(part) else kept).append(part)
    return senses_of(kept + later)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_meaning.py -q`
Expected: `13 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/meaning.py tests/test_meaning.py && git commit -F - <<'EOF'
feat: part-of-speech labels and English meanings

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 4: Permanent word IDs (`tools/wordids.py`)

**Files:**
- Create: `tools/wordids.py`
- Test: `tests/test_wordids.py`

- [ ] **Step 1: Write the failing test `tests/test_wordids.py`**

```python
from wordids import assign_ids


def test_first_build_numbers_in_order():
    ids, new = assign_ids([("爱", "ai4"), ("八", "ba1")], [])
    assert ids == {("爱", "ai4"): "w0001", ("八", "ba1"): "w0002"}
    assert new == [{"id": "w0001", "hz": "爱", "pynum": "ai4"}, {"id": "w0002", "hz": "八", "pynum": "ba1"}]


def test_later_build_keeps_ids_and_only_appends():
    frozen = [{"id": "w0001", "hz": "爱", "pynum": "ai4"}, {"id": "w0002", "hz": "长", "pynum": "chang2"}]
    ids, new = assign_ids([("长", "zhang3"), ("爱", "ai4")], frozen)
    assert ids == {("长", "zhang3"): "w0003", ("爱", "ai4"): "w0001"}
    assert new == [{"id": "w0003", "hz": "长", "pynum": "zhang3"}]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_wordids.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'wordids'`

- [ ] **Step 3: Write `tools/wordids.py`**

```python
"""Permanent word IDs.

Every card keeps its ID ("w0001") for ever, because the app stores progress by ID.
The IDs live in data/ids/word_ids_vNNN.csv (id, hz, pynum), which is committed to git.
A later build reuses every ID in the latest file and only appends new ones; an ID is
never reused, even when its word leaves the list. The key is the headword plus its
numbered reading in dictionary tones, so 长 chang2 and 长 zhang3 have different IDs.
"""


def assign_ids(keys, frozen):
    """IDs for `keys`, a list of (hz, pynum) in the order new IDs should be handed out.

    frozen: rows {"id", "hz", "pynum"} from the latest IDs file (empty on the first build).
    Returns (ids, new_rows), where ids maps every key to its ID and new_rows are the rows to append.
    With frozen [{"id": "w0001", "hz": "爱", "pynum": "ai4"}] and keys [("八", "ba1"), ("爱", "ai4")],
    爱 keeps w0001 and 八 gets w0002.
    """
    known = {(r["hz"], r["pynum"]): r["id"] for r in frozen}
    top = max((int(r["id"][1:]) for r in frozen), default=0)
    ids, new_rows = {}, []
    for key in keys:
        if key not in known:
            top += 1
            known[key] = f"w{top:04d}"
            new_rows.append({"id": known[key], "hz": key[0], "pynum": key[1]})
        ids[key] = known[key]
    return ids, new_rows
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_wordids.py -q`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/wordids.py tests/test_wordids.py && git commit -F - <<'EOF'
feat: permanent word IDs that later builds only append to

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 5: Cards from both sources (`tools/wordlist.py`)

**Files:**
- Create: `tools/wordlist.py`
- Test: `tests/test_wordlist.py`

The rules, with the Plan 1 outcome issue each one handles:
- **Headwords come from the decoded glyphs** (`decode.match_head` drops the bracketed variant of 那（那儿） and 这（这儿）), never from the pinyin match. This handles the 15 "contradicted" entries.
- **The reading** is the public reading of that headword whose pinyin starts the PDF's Latin text and ends at a word boundary (`decode._boundary`, so " èng hum " does not match èn). Exact tones are tried before ignoring tones, and the PDF's erhua spelling " er" and its Latin letter "ɑ" are also tried.
- **An entry with no matching reading** needs a row in `data/manual/pdf_fixes_v001.csv` (Task 6) with the headword, reading, part of speech and gloss. This covers pattern words, missing words, cut pinyin and wrapped headwords.
- **Entries with the same headword and reading become one card.** Their glosses and sentences are pooled, which merges multi-sense entries such as 称 chēng (call) and 称 chēng (weigh). The HSK 1 to 4 files repeat lower levels, so a card's PDF level is the lowest file it appears in.
- **Printed textbook pinyin.** A card keeps the Latin text of its entries in the HSK 1 to 4 PDFs (`latin`), because those PDFs print the word spacing that step 5 uses for `py` (Task 1 `pdf_pinyin`). The HSK 5 and 6 PDFs print one syllable per space, so their text is not kept.
- **Public-only words** are the public HSK 2.0 words whose headword is in no PDF entry. A public-only word with several readings takes the one in `data/manual/public_readings_v001.csv`. When a reading is written both with a capital (a name, such as 露 Lù "surname Lu") and in lower case (露 lù "dew"), the lower-case one is used. A row of that file can also give the card's part of speech and meaning. This is needed because CC-CEDICT pools the senses of every form of a reading, so the first three senses of 露 lù are "dew; syrup; nectar", while the sense HSK teaches is "to reveal".
- **Gloss fixes.** A PDF gloss whose words run together, is misspelled or holds junk text in every copy gets a row in `data/manual/gloss_fixes_v001.csv` (Task 6), keyed by headword and reading, which replaces the card's PDF glosses. For example 过问 "take aninterest in" becomes "take an interest in". Step 5 stops if a row names a card that does not exist.
- **Second readings.** The public list counts some headwords twice in HSK 2.0, once per reading. The complete list shows this as two `old-N` level tags (长 has `old-2` twice, for cháng and zhǎng). A lower-case reading of such a headword that no card has yet needs a row in `data/manual/second_readings_v001.csv`, where `Y` makes it a card and `N` leaves it out. The row also gives the card's part of speech and meaning. This gives 长 zhǎng its own card, although the PDFs only have 长 cháng.
- **English meanings.** A card uses its PDF glosses, else the cleaned CC-CEDICT meanings of its reading. When CC-CEDICT only says "variant of" another word (纪录 is "variant of 记录"), the meanings of that word are used. The meanings of a sound-only form ("(onom.) dong" for 当 dāng) come after the reading's other meanings.

- [ ] **Step 1: Write the failing test `tests/test_wordlist.py`**

```python
from wordlist import (apply_gloss_fixes, english, level_of, match_reading, pdf_words, public_only_words,
                      public_readings, second_readings)


def W(hz, forms, level=None, tags=()):
    w = {"simplified": hz, "forms": [{"transcriptions": {"pinyin": py}, "meanings": m} for py, m in forms],
         "level": list(tags)}
    if level:
        w["hsk"] = level
    return w


COMPLETE = [W("长", [("cháng", ["long"]), ("zhǎng", ["to grow"])], tags=["new-2", "old-2", "old-2"]),
            W("爱", [("ài", ["to love"])], tags=["old-1"]),
            W("干活儿", [("gàn huó r", ["to work"])]), W("嗯", [("ēn", ["hm"]), ("èn", ["hm"])]),
            W("窗帘", [("chuāng lián", ["window curtains"])]),
            W("都", [("Dū", ["surname Du"]), ("dōu", ["all"]), ("dū", ["capital"])]),
            W("当", [("dāng", ["(onom.) dong", "ding dong (bell)"]), ("dāng", ["to be", "to act as"])]),
            W("得", [("dé", ["to obtain"]), ("de", ["structural particle"]), ("děi", ["to have to"])],
              tags=["old-2", "old-2"]),
            W("纪录", [("jì lù", ["variant of 記錄|记录[ji4 lu4]"])]), W("记录", [("jì lù", ["to record"])]),
            W("纽扣儿", [("niǔ kòu er", ["button"])]), W("女儿", [("nǚ ér", ["daughter"])])]
R = public_readings(COMPLETE)


def test_public_readings_number_each_reading():
    assert [r["num"] for r in R["长"]] == ["chang2", "zhang3"]
    assert R["干活儿"][0]["num"] == "gan4 huo2 r5"
    assert R["纽扣儿"][0]["num"] == "niu3 kou4 r5" and R["纽扣儿"][0]["py"] == "niǔ kòu er"
    assert R["女儿"][0]["num"] == "nü3 er2"
    assert R["当"][0]["meanings"] == ["to be", "to act as", "(onom.) dong", "ding dong (bell)"]


def test_match_reading_picks_the_pdf_reading_and_returns_the_rest():
    reading, rest = match_reading(" zhǎng v. grow ", R["长"])
    assert reading["num"] == "zhang3" and rest == " v. grow "
    assert match_reading(" gàn huó er  work", R["干活儿"])[0]["num"] == "gan4 huo2 r5"
    assert match_reading(" dū n. capital ", R["都"])[0]["py"] == "dū"
    assert match_reading(" èng hum ", R["嗯"]) is None
    assert match_reading(" chuāng curtain ", R["窗帘"]) is None


FWD = {1: "长", 2: "我", 3: "大", 4: "了", 5: "。", 6: "窗", 7: "帘"}


def entry(file, n, head, latin, body):
    return {"file": file, "n": n, "head": head, "latin": latin,
            "tokens": [["c", head], ["l", latin], ["c", body]], "skipped": []}


def test_pdf_words_groups_by_headword_and_reading():
    entries = [entry(2, 5, [1], " zhǎng v. grow ", [2, 1, 3, 4, 5]),
               entry(3, 5, [1], " zhǎng v. grow ", [2, 1, 3, 4, 5]),
               entry(5, 9, [6, 7], " chuāng curtain ", [6, 7, 5])]
    fixes = {(5, 9): {"hz": "", "pynum": "chuang1 lian2", "pos": "n.", "gloss": "curtain", "sentence": ""}}
    words, problems = pdf_words(entries, FWD, R, fixes)
    assert problems == []
    grow = words[("长", "zhang3")]
    assert grow["files"] == [2, 3] and grow["pos"] == ["v."] and grow["glosses"] == ["grow"]
    assert grow["sents"] == [("我长大了。", "HSK2 #5")]
    assert grow["latin"] == [" zhǎng v. grow ", " zhǎng v. grow "]
    assert words[("窗帘", "chuang1 lian2")]["glosses"] == ["curtain"]
    assert words[("窗帘", "chuang1 lian2")]["latin"] == []


def test_pdf_words_reports_entries_without_a_reading():
    words, problems = pdf_words([entry(5, 9, [6, 7], " chuāng curtain ", [6, 7, 5])], FWD, R, {})
    assert words == {} and problems[0].startswith("HSK5 #9 窗帘")


def test_public_only_words_need_a_chosen_reading_when_there_are_several():
    old = [W("长", [("cháng", ["long"]), ("zhǎng", ["to grow"])], 2), W("爱", [("ài", ["to love"])], 1),
           W("都", [("Dū", ["surname Du"]), ("dōu", ["all"])], 1)]
    words, problems = public_only_words(old, {"爱"}, R, {})
    assert problems == ["长: readings cháng / zhǎng; choose one", "都: readings Dū / dōu / dū; choose one"]
    words, problems = public_only_words(old, {"爱"}, R, {"长": {"pynum": "chang2"}, "都": {"pynum": "dou1"}})
    assert set(words) == {("长", "chang2"), ("都", "dou1")} and problems == []


def test_public_only_words_prefer_the_lower_case_reading():
    lu = W("露", [("Lù", ["surname Lu"]), ("lòu", ["to show"]), ("lù", ["dew"])], 5)
    words, problems = public_only_words([lu], set(), public_readings([lu]), {"露": {"pynum": "lu4"}})
    assert problems == [] and words[("露", "lu4")]["meanings"] == ["dew"]
    assert words[("露", "lu4")]["capital"] is False


def test_public_only_words_take_pos_and_gloss_from_the_reading_row():
    lu = W("露", [("lù", ["dew", "syrup", "nectar", "to show", "to reveal"])], 5)
    row = {"pynum": "lu4", "pos": "n. v.", "gloss": "dew; to show; to reveal"}
    words, problems = public_only_words([lu], set(), public_readings([lu]), {"露": row})
    assert problems == [] and words[("露", "lu4")]["pos"] == ["n.", "v."]
    assert english(words[("露", "lu4")], {}) == ["dew", "to show", "to reveal"]
    words, problems = public_only_words([lu], set(), public_readings([lu]), {"露": {"pynum": "lou4"}})
    assert words == {} and problems == ["露: chosen reading lou4 is not one of its readings"]


def test_apply_gloss_fixes():
    words = {("过问", "guo4 wen4"): {"glosses": ["concern oneself with; take aninterest in"]}}
    fixes = {("过问", "guo4 wen4"): "concern oneself with; take an interest in", ("好", "hao3"): "good"}
    assert apply_gloss_fixes(words, fixes) == ["好 hao3: a gloss fix for a card that does not exist"]
    assert words[("过问", "guo4 wen4")]["glosses"] == ["concern oneself with; take an interest in"]


def test_second_readings_need_a_decision():
    cards = {("长", "chang2"), ("得", "de5"), ("爱", "ai4")}
    words, problems = second_readings(COMPLETE, R, cards, {})
    assert words == {} and problems == [
        "长 zhǎng: a second HSK 2.0 entry with no card; add a row with card Y or N",
        "得 dé: a second HSK 2.0 entry with no card; add a row with card Y or N",
        "得 děi: a second HSK 2.0 entry with no card; add a row with card Y or N"]
    decided = {("长", "zhang3"): {"card": "Y", "pos": "v. n.", "gloss": ""}, ("得", "de2"): {"card": "N"},
               ("得", "dei3"): {"card": "y", "pos": "v.", "gloss": "must; to have to"}}
    words, problems = second_readings(COMPLETE, R, cards, decided)
    assert problems == [] and set(words) == {("长", "zhang3"), ("得", "dei3")}
    assert words[("长", "zhang3")]["pos"] == ["v.", "n."] and english(words[("长", "zhang3")], R) == ["to grow"]
    assert english(words[("得", "dei3")], R) == ["must", "to have to"]


def test_level_and_english():
    w = {"hz": "长", "num": "zhang3", "files": [3, 4], "glosses": []}
    assert level_of(w, {"长": 2}) == 2 and level_of(w, {}) == 3
    assert english(w, R) == ["to grow"]
    assert english({**w, "glosses": ["grow; develop"]}, R) == ["grow", "develop"]
    assert english({"hz": "纪录", "num": "ji4 lu4", "files": [], "glosses": []}, R) == ["to record"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_wordlist.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'wordlist'`

- [ ] **Step 3: Write `tools/wordlist.py`**

```python
"""Build the card word list from both sources.

The cards teach every word in the PDFs plus every word of the public HSK 2.0 list
(data/public/hsk2_old_exclusive_vNNN.json) whose characters the PDFs lack. Each
card is one word with one pronunciation, at the lowest HSK level either source gives.
A PDF headword comes from its decoded glyph codes. Its pronunciation is the public
reading that its PDF pinyin matches, so the entry "zhǎng v. grow" for 长 gives the
reading zhǎng, not cháng.
"""
import re
import unicodedata

from decode import _boundary, decode_cids, match_head
from meaning import cedict_senses, senses_of, split_pos
from pdfbody import sentence_candidates, split_senses
from pinyin_norm import norm, toneless
from pinyin_text import join_erhua, marked_to_num

NO_FREQUENCY = 1000000  # the public list's value for "frequency unknown"; smaller numbers are more common
# The HSK 1 to 4 PDFs print textbook pinyin with word spacing ("bú kèqi"); the HSK 5 and 6 PDFs
# print one syllable per space ("ài hù"), so only the first four are a source of word spacing.
TEXTBOOK_FILES = (1, 2, 3, 4)
_ERHUA = re.compile(r"(?<=[^\W\d_]) er(?=\W|$)")  # the PDFs spell the 儿 ending " er", the public list "r"


def public_readings(complete):
    """{hz: [{"py", "num", "meanings"}]} with one item per distinct reading, in the list's order.

    Forms with the same pinyin are merged, so their meanings are kept together. The meanings of a
    form that only names a sound (its first meaning starts with "(onom.)") go last, so 当 dāng gives
    ["to be", "to act as", ..., "(onom.) dong", "ding dong (bell)"].
    "num" is the numbered reading, for example "chang2" for 长 cháng. A neutral 儿 ending is
    numbered "r5" (join_erhua), so 纽扣儿 "niǔ kòu er" gives "niu3 kou4 r5", like 一点儿 "yi1 dian3 r5".
    "py" stays as the list writes it, because match_reading compares it with the PDF's pinyin.
    """
    out = {}
    for w in complete:
        readings, sounds = [], {}
        for form in w["forms"]:
            py = form["transcriptions"]["pinyin"]
            same = next((r for r in readings if r["py"] == py), None)
            if same is None:
                num = " ".join(join_erhua(w["simplified"], marked_to_num(py).split()))
                same = {"py": py, "num": num, "meanings": []}
                readings.append(same)
            if form["meanings"] and form["meanings"][0].startswith("(onom.)"):
                sounds.setdefault(py, []).extend(form["meanings"])
            else:
                same["meanings"] += form["meanings"]
        for r in readings:
            r["meanings"] += sounds.get(r["py"], [])
        out[w["simplified"]] = readings
    return out


def _rest_after(text, keep, length):
    """The part of `text` after its first `length` letters as counted by `keep` (norm or toneless)."""
    kept, i = 0, 0
    while i < len(text) and kept < length:
        kept += len(keep(text[i]))
        i += 1
    while i < len(text) and unicodedata.combining(text[i]):
        i += 1
    return text[i:]


def match_reading(latin, readings):
    """The reading whose pinyin starts the PDF's Latin text, and the text after that pinyin.

    The pinyin must end at a word boundary (decode._boundary), so " èng hum " does not
    match èn. Exact tones are tried before ignoring tones, and the longest match wins; a
    lower-case reading beats a capitalised name with the same letters. The PDF's erhua
    spelling " er" and its Latin letter "ɑ" are also tried as "r" and "a".
    With readings cháng and zhǎng, " zhǎng v. grow " gives (the zhǎng reading, " v. grow ").
    Returns None when no reading matches.
    """
    text = unicodedata.normalize("NFC", latin).replace("ɑ", "a")
    for t in (text, _ERHUA.sub("r", text)):
        for keep in (norm, toneless):
            whole = keep(t)
            hits = [r for r in readings if keep(r["py"]) and whole.startswith(keep(r["py"]))
                    and _boundary(t, keep, len(keep(r["py"]))) is not None]
            if hits:
                best = max(hits, key=lambda r: (len(keep(r["py"])), r["py"][:1].islower()))
                return best, _rest_after(t, keep, len(keep(best["py"])))
    return None


def entry_ref(e):
    return f"HSK{e['file']} #{e['n']}"


def pdf_words(entries, fwd, readings, fixes):
    """Group the PDF entries into words, one per headword and reading.

    fixes: {(file, n): row} from data/manual/pdf_fixes_vNNN.csv. A non-empty field of a
    fix row replaces what the entry gives: hz (the headword), pynum (the numbered reading;
    a capital first letter marks a name), pos (labels separated by spaces), gloss (the whole
    English meaning) and sentence (one repaired example sentence, already written out).
    An entry whose headword has a single public reading that its cut or misspelled PDF pinyin
    does not match uses that reading when its fix row gives a gloss.
    Returns (words, problems). words maps (hz, numbered reading) to
    {"hz", "num", "capital", "files", "glosses", "pos", "sents", "refs", "latin"}, where "sents" holds
    (sentence, ref) pairs that may still contain ～, and "latin" holds the Latin text of the word's
    entries in the HSK 1 to 4 PDFs, whose printed pinyin gives the card's word spacing (step 5).
    problems lists entries that need a fix row.
    """
    words, problems = {}, []
    for e in entries:
        fix = fixes.get((e["file"], e["n"]), {})
        hz = fix.get("hz") or decode_cids(match_head(e["head"]), fwd)
        senses = split_senses(e["tokens"], fwd)
        options = readings.get(hz, [])
        if fix.get("pynum"):
            num, capital, rest = fix["pynum"].lower(), fix["pynum"][0].isupper(), None
        else:
            found = match_reading(e["latin"], options)
            if found is None and len({norm(r["py"]) for r in options}) == 1 and fix.get("gloss"):
                found = (options[0], None)
            if found is None:
                problems.append(f"{entry_ref(e)} {hz} {e['latin'].strip()[:40]}: no reading, needs pynum and gloss")
                continue
            reading, rest = found
            num, capital = reading["num"], reading["py"][:1].isupper()
        labels, glosses = [], []
        first = [(rest or "", body) for _, body in senses[:1]]
        for text, _body in first + [(g, b) for g, b in senses[1:]]:
            got_labels, gloss = split_pos(text)
            labels += [x for x in got_labels if x not in labels]
            if gloss:
                glosses.append(gloss)
        if fix.get("gloss"):
            glosses = [fix["gloss"]]
        if fix.get("pos"):
            labels = fix["pos"].split()
        if fix.get("sentence"):
            sents = [(fix["sentence"], entry_ref(e))]
        else:
            sents = [(s, entry_ref(e)) for _, body in senses for s in sentence_candidates(body)]
        w = words.setdefault((hz, num), {"hz": hz, "num": num, "capital": capital, "files": [],
                                         "glosses": [], "pos": [], "sents": [], "refs": [], "latin": []})
        w["files"].append(e["file"])
        if e["file"] in TEXTBOOK_FILES:
            w["latin"].append(e["latin"])
        w["glosses"] += [g for g in glosses if g not in w["glosses"]]
        w["pos"] += [x for x in labels if x not in w["pos"]]
        w["sents"] += [s for s in sents if s[0] not in {x[0] for x in w["sents"]}]
        w["refs"].append(entry_ref(e))
    return words, problems


def _list_word(hz, reading):
    """A card that comes only from the public list, so it has no PDF files, glosses or sentences."""
    return {"hz": hz, "num": reading["num"], "capital": reading["py"][:1].isupper(), "files": [], "glosses": [],
            "pos": [], "sents": [], "refs": [], "latin": [], "meanings": reading["meanings"]}


def _with_row(word, row):
    """Apply a hand-written row's pos (labels separated by spaces) and gloss to a card, when they are given.

    The gloss then comes before the CC-CEDICT meanings in `english`, and the pos before the list's tags.
    """
    if (row.get("pos") or "").strip():
        word["pos"] = row["pos"].split()
    if (row.get("gloss") or "").strip():
        word["glosses"] = [row["gloss"].strip()]
    return word


def public_only_words(old, pdf_hz, readings, chosen):
    """Words of the public HSK 2.0 list whose characters the PDFs lack.

    chosen: {hz: row} from data/manual/public_readings_vNNN.csv, where a row has pynum and may
    have pos and gloss. A word with one reading uses it. A word with several different readings
    needs a row, and the row's numbered reading picks one. Either way a lower-case reading beats a
    capitalised name with the same numbered reading, so 露 lu4 is lù "dew", not Lù "surname Lu".
    A row's pos and gloss, when given, become the card's part of speech and meaning, because
    CC-CEDICT pools the senses of all forms of a reading (露 lù starts "dew; syrup; nectar").
    Returns (words, problems) in the same shape as pdf_words, with "files" empty, no sentences,
    and the reading's CC-CEDICT "meanings".
    """
    words, problems = {}, []
    for w in old:
        hz = w["simplified"]
        if hz in pdf_hz:
            continue
        options, row = readings[hz], chosen.get(hz, {})
        if row:
            want = [r for r in options if r["num"] == row["pynum"].strip().lower()]
            if not want:
                problems.append(f"{hz}: chosen reading {row['pynum']} is not one of its readings")
                continue
        elif len({norm(r["py"]) for r in options}) > 1:
            problems.append(f"{hz}: readings {' / '.join(r['py'] for r in options)}; choose one")
            continue
        else:
            want = options
        reading = next((r for r in want if r["py"][:1].islower()), want[0])
        words[(hz, reading["num"])] = _with_row(_list_word(hz, reading), row)
    return words, problems


def second_readings(complete, readings, card_keys, decided):
    """Cards for readings that the public list counts as a separate HSK 2.0 entry but no card has.

    The complete list tags a headword with two "old-N" levels when HSK 2.0 lists it twice
    (长 has "old-2" twice, for cháng and zhǎng). Each lower-case reading of such a headword
    that no key in `card_keys` (a set of (hz, pynum)) uses needs a decision in `decided`,
    {(hz, pynum): row}, from data/manual/second_readings_vNNN.csv. The row's card is "Y" (make a
    card) or "N" (leave it out); its pos (labels separated by spaces) and gloss, when given, become
    the card's part of speech and meaning, because the list's tags describe the headword as a whole.
    With only 长 chang2 among the cards, 长 zhang3 needs a row.
    Returns (words, problems) in the shape of public_only_words.
    """
    have = {}
    for hz, num in card_keys:
        have.setdefault(hz, set()).add(num)
    words, problems = {}, []
    for w in complete:
        hz = w["simplified"]
        if sum(1 for tag in w.get("level", []) if tag.startswith("old-")) < 2:
            continue
        for r in readings[hz]:
            if not r["py"][:1].islower() or r["num"] in have.get(hz, set()) or (hz, r["num"]) in words:
                continue
            row = decided.get((hz, r["num"]), {})
            choice = (row.get("card") or "").strip().upper()
            if choice == "Y":
                words[(hz, r["num"])] = _with_row(_list_word(hz, r), row)
            elif choice != "N":
                problems.append(f"{hz} {r['py']}: a second HSK 2.0 entry with no card; add a row with card Y or N")
    return words, problems


def apply_gloss_fixes(words, fixes):
    """Replace the glosses of the cards named in `fixes`, {(hz, pynum): gloss}, from data/manual/gloss_fixes_vNNN.csv.

    This repairs PDF glosses whose words run together, are misspelled or hold junk text in every
    copy, so 过问 "concern oneself with; take aninterest in" becomes "... take an interest in".
    `words` is changed in place. Returns a problem for each row that names no card.
    """
    problems = []
    for (hz, num), gloss in fixes.items():
        if (hz, num) in words:
            words[(hz, num)]["glosses"] = [gloss]
        else:
            problems.append(f"{hz} {num}: a gloss fix for a card that does not exist")
    return problems


def level_of(word, old_level):
    """The lowest HSK level in either source, which is the lowest PDF file it is in or the public list's level."""
    levels = list(word["files"])
    if word["hz"] in old_level:
        levels.append(old_level[word["hz"]])
    return min(levels)


def english(word, readings):
    """The word's senses, which are its PDF glosses or else the cleaned CC-CEDICT meanings of its reading.

    When CC-CEDICT only calls the word a variant of another word, that word's meanings are used,
    so 纪录 ("variant of 记录") gets the meanings of 记录. The result is empty when nothing usable is found.
    """
    senses = senses_of(word["glosses"])
    if senses:
        return senses
    meanings = word.get("meanings")
    if meanings is None:
        meanings = next((r["meanings"] for r in readings.get(word["hz"], []) if r["num"] == word["num"]), [])
    senses = cedict_senses(meanings)
    for m in meanings:
        if senses:
            break
        target = re.search(r"variant of (?:\S+\|)?([一-鿿]+)", m)
        if target:
            same = [r for r in readings.get(target.group(1), []) if r["num"] == word["num"]]
            senses = cedict_senses(same[0]["meanings"]) if same else []
    return senses
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_wordlist.py -q`
Expected: `10 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/wordlist.py tests/test_wordlist.py && git commit -F - <<'EOF'
feat: cards from PDF entries and public-only words

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 6: Hand-written fixes and reading choices

**Files:**
- Create: `data/manual/pdf_fixes_v001.csv`, `data/manual/public_readings_v001.csv`, `data/manual/second_readings_v001.csv`, `data/manual/gloss_fixes_v001.csv`, `data/manual/capitals_v001.csv`

These are hand-written inputs, so they live in `data/manual/` and are committed. A later correction goes in a new file with the next version number (`pdf_fixes_v002.csv`), because step 5 reads the latest version.

One more file holds the user's answer to Open decision 5 (Step 5), so that the answer only means saving a new version of a file. The forms of four-character words (Open decision 4) are not written here. Claude form agents give them in Task 7, and step 5b writes them to `data/manual/four_char_words_v001.csv`.

Each row of `pdf_fixes_v001.csv` handles one entry named in the Plan 1 outcome file:
- **The pattern words** 虽然…但是…, 因为…所以… and 不但…而且… get a headword with "…" between the halves, so step 7 in Plan 3b fills each ～ with its own half.
- **The wrapped headwords** 致力于, 拔苗助长 and 总而言之 get the full headword and their sentence as it should read. Without the fix, stray text from the wrapped line (于, 助长, 言之) sits inside the sentence.
- **The cut pinyin** of 窗帘 and 水龙头, and the PDF spellings of 湖泊 (hú bó), 开拓 (kāi tà), 泄露 (xiè lòu) and 嗯 (èng), get the standard reading from the public list.
- **那 and 这** keep their decoded headword and matched reading and get a clean gloss.
- **The words missing from both lists** get their reading, part of speech and gloss.
- **得 in HSK4 #686** is printed as "de" with a second sense "v. get; obtain; win; earn", but that sense is the reading dé. The fix row keeps only the particle meaning and its sentence, and 得 dé gets its own card from `second_readings_v001.csv` (Step 3).

- [ ] **Step 1: Write `data/manual/pdf_fixes_v001.csv`**

```csv
file,n,hz,pynum,pos,gloss,sentence,why
1,69,,,,that; there,,variant pinyin nàr is read as a gloss
2,69,,,,that; there,,variant pinyin nàr is read as a gloss
3,69,,,,that; there,,variant pinyin nàr is read as a gloss
4,69,,,,that; there,,variant pinyin nàr is read as a gloss
1,142,,,,this; here,,variant pinyin zhèr is read as a gloss
2,142,,,,this; here,,variant pinyin zhèr is read as a gloss
3,142,,,,this; here,,variant pinyin zhèr is read as a gloss
4,142,,,,this; here,,variant pinyin zhèr is read as a gloss
2,250,虽然…但是…,sui1 ran2 dan4 shi4,conj.,"although …, (still) …",,pattern word missing from both lists
3,250,虽然…但是…,sui1 ran2 dan4 shi4,conj.,"although …, (still) …",,pattern word missing from both lists
4,250,虽然…但是…,sui1 ran2 dan4 shi4,conj.,"although …, (still) …",,pattern word missing from both lists
2,281,因为…所以…,yin1 wei4 suo3 yi3,conj.,"because …, so …",,pattern word missing from both lists
3,281,因为…所以…,yin1 wei4 suo3 yi3,conj.,"because …, so …",,pattern word missing from both lists
4,281,因为…所以…,yin1 wei4 suo3 yi3,conj.,"because …, so …",,pattern word missing from both lists
3,326,不但…而且…,bu4 dan4 er2 qie3,conj.,not only … but also …,,pattern word missing from both lists
4,326,不但…而且…,bu4 dan4 er2 qie3,conj.,not only … but also …,,pattern word missing from both lists
2,252,,ti1 zu2 qiu2,v.,play soccer,,missing from both lists
3,252,,ti1 zu2 qiu2,v.,play soccer,,missing from both lists
4,252,,ti1 zu2 qiu2,v.,play soccer,,missing from both lists
2,277,,yi1 xia4,m.,once; in a short while,,missing from both lists (only 一下儿 is listed)
3,277,,yi1 xia4,m.,once; in a short while,,missing from both lists (only 一下儿 is listed)
4,277,,yi1 xia4,m.,once; in a short while,,missing from both lists (only 一下儿 is listed)
3,408,,Huang2 he2,n.,the Yellow River,,missing from both lists
4,408,,Huang2 he2,n.,the Yellow River,,missing from both lists
4,606,,bai3 fen1 zhi1,num.,percent,,missing from both lists
4,1024,,tan2 gang1 qin2,v.,play the piano,,missing from both lists
5,173,,chuang1 lian2,n.,curtain,,PDF pinyin cut to chuāng
5,350,,gan1 ju2,n.,oranges and tangerines; citrus fruit,,missing from both lists
6,27,拔苗助长,ba2 miao2 zhu4 zhang3,,spoil things by being too eager; help shoots grow by pulling them,拔苗助长的教育方式不可取。,headword wrapped onto the sentence line
6,544,,en4,int.,hum (showing agreement),,PDF pinyin èng is not a listed reading
6,859,,hu2 po1,n.,lake,,PDF pinyin hú bó differs from the list
6,1126,,kai1 tuo4,v.,open up; exploit,,PDF pinyin kāi tà differs from the list
6,1792,,shuan4 huo3 guo1,v.,eat hot pot; shabu-shabu,,missing from both lists
6,1796,,shui3 long2 tou2,n.,faucet; tap,,PDF pinyin cut to shuǐ lóng
6,1815,,su4 shi2 zhu3 yi4,n.,vegetarianism,,missing from both lists
6,1897,,tong1 huo4 peng2 zhang4,n.,inflation,,missing from both lists
6,2091,,xie4 lu4,v.,disclose; reveal,,PDF pinyin xiè lòu differs from the list
6,2185,,yan1 hua1 bao4 zhu2,n.,fireworks,,missing from both lists
6,2479,致力于,zhi4 li4 yu2,v.,devote oneself to,经济学家一直致力于为他们的观点寻找证据。,headword wrapped onto the sentence line
6,2593,总而言之,zong3 er2 yan2 zhi1,conj.,all in all; in a word,总而言之，这本书是我读过的最好的一本。,headword wrapped onto the sentence line
4,686,,,part.,marker of complement,你走得太快了。,the second sense get; obtain is the reading dé
```

- [ ] **Step 2: Write `data/manual/public_readings_v001.csv`**

Each word here has several readings in the public list and appears in no PDF. The chosen reading is the one the HSK word list teaches. When the list writes the chosen reading both as a name with a capital and in lower case (哈 Hā and hā, 露 Lù and lù), step 5 uses the lower-case one.

`pos` and `gloss` are optional. When given, they become the card's part-of-speech labels (separated by spaces) and meaning, in place of the list's tags and the CC-CEDICT meanings. They are filled for the 8 words whose first three CC-CEDICT senses miss the meaning HSK teaches, because CC-CEDICT pools the senses of every form of a reading:
- 露 lù starts "dew; syrup; nectar", while HSK teaches "to reveal";
- 系 xì starts "to connect; to relate to; to tie up", while HSK teaches "department";
- 当 dāng starts "to be; to act as; manage", while HSK teaches "to act as; when";
- 抢 qiǎng starts "to fight over; to rush; to scramble", while HSK teaches "to grab; to rob";
- 哈 hā starts "(interj.) ha!; (onom. for laughter)", and its list tags give it the label v.;
- 片 piàn, 匹 pǐ and 正 zhèng lack their measure-word or "just (doing)" sense among the first three.

```csv
hz,pynum,pos,gloss,why
没,mei2,,,méi (not) is the HSK 1 word; mò (sink) is not
女人,nü3 ren2,,,woman
刷,shua1,,,to brush (刷牙)
弹,tan2,,,to play a string instrument (弹钢琴)
当,dang1,v. prep.,to act as; to be; when,to act as; when
精神,jing1 shen2,,,spirit; mind
狮子,shi1 zi5,,,lion
哈,ha1,int.,ha! (laughter or surprise),ha (laughter)
横,heng2,,,horizontal
结实,jie1 shi5,,,sturdy; strong
尽量,jin3 liang4,,,as much as possible
卷,juan3,,,to roll up
露,lu4,n. v.,dew; to show; to reveal,dew; to reveal (lù; lòu is the colloquial reading)
摸,mo1,,,to touch
匹,pi3,m.,measure word for horses; measure word for cloth (a bolt),measure word for horses and cloth
片,pian4,m. n.,"slice; flake; measure word for flat, thin things",slice; measure word for flat pieces
浅,qian3,,,shallow; light (colour)
抢,qiang3,v.,to grab; to rob; to snatch,to grab; to rob
切,qie1,,,to cut
圈,quan1,,,circle; ring
土地,tu3 di4,,,land; soil
吐,tu3,,,to spit
歪,wai1,,,crooked
系,xi4,n. v.,department; system; to relate to,department; to relate to
吓,xia4,,,to frighten
乙,yi3,,,second (after 甲)
晕,yun1,,,dizzy
涨,zhang3,,,to rise (prices and water)
正,zheng4,adj. adv.,straight; upright; just (doing sth),straight; just (doing)
```

- [ ] **Step 3: Write `data/manual/second_readings_v001.csv`**

Seven headwords carry two `old-N` tags in the complete list: 得 长 等 对 过 还 只. For 等 and 对 both entries share one reading, and for 过 还 只 the PDFs already give both readings. That leaves three lower-case readings with no card. `card` is `Y` to make a card and `N` to leave the reading out. All three are `Y` here, and the user confirms them at the checkpoint (Open decision 3).

`pos` and `gloss` are written by hand, because the public list's part-of-speech tags describe the headword as a whole (for 长 they fit cháng, "long"), and CC-CEDICT lists "chief; head; elder" before "to grow" for zhǎng.

```csv
hz,pynum,card,pos,gloss,why
长,zhang3,Y,v. n.,to grow; chief; head,长大 zhǎngdà; the PDFs only have 长 cháng
得,de2,Y,v.,to get; to obtain; to win,得到 dédào; HSK4 #686 prints this sense under de
得,dei3,Y,v.,must; to have to,the modal verb as in 我得走了
```

- [ ] **Step 4: Write `data/manual/gloss_fixes_v001.csv`**

Each row replaces the PDF glosses of one card, named by its headword and its numbered reading in dictionary tones (the card's `pyNum`). The rows repair the PDF glosses that Task 3's rules cannot. These are words run together in every copy of the entry ("aninterest"), misspellings ("recieve", "senence") and junk text ("instead:fjdk", "grave; tabut; tomb"). They were found by listing every gloss word that CC-CEDICT never uses (the check step 5 repeats in Task 7) and reading each one. 团结 is added although "unit" is an English word, because the PDF means "unite". 报名 also puts its short senses first.

```csv
hz,pynum,gloss,why
了,le5,used at the end of a sentence to indicate change in status; used after a verb to indicate that the action is in the past and has been completed,misspelled senence
洗,xi3,wash; develop and print (a picture),misspelled develope
报名,bao4 ming2,"sign up; enroll; give your name, age, etc. in order to participate in an activity or organization",toparticipate run together; short senses first
吃惊,chi1 jing1,feel afraid suddenly; be startled; be shocked; be astonished; be taken aback,beshocked run together
从来,cong2 lai2,right from the beginning; always; at all times; all along,alltimes run together
符合,fu2 he2,correspond with; accord with; conform to,misspelled comform
受到,shou4 dao4,accept; receive,misspelled recieve
之,zhi1,"auxiliary word, used to form a grammatical structure",misspelled gramatical
称呼,cheng1 hu5,call; form of address,misspelled sddress
幅,fu2,"measure word for cloth, silk, woollen fabric, paintings",misspelled measures word and paitings
干脆,gan1 cui4,simply; straightforward,misspelled straighforward
广大,guang3 da4,vast; numerous,misspelled mumerous
过期,guo4 qi1,be overdue; expire,misspelled ecpire
饱经沧桑,bao3 jing1 cang1 sang1,have experienced many changes and vicissitudes in human life,vicissitudesin run together
裁员,cai2 yuan2,cut down the number of persons employed,personsemployed run together
充实,chong1 shi2,substantial; fulfilling; enrich,misspelled fullfilling
搭档,da1 dang4,cooperate; work together; partner,worktogether run together
栋,dong4,measure word for buildings,misspelled measures word and buildigns
动荡,dong4 dang4,turbulent; unrest,misspelled turbulentl
兑现,dui4 xian4,cash; pay cash; fulfil,misspelled fullfill
反倒,fan3 dao4,on the contrary; instead,junk text fjdk
分红,fen1 hong2,share out bonus; receive dividends,misspelled dividents
坟墓,fen2 mu4,grave; tomb,junk text tabut
港湾,gang3 wan1,dock and harbour,junk text ecronic
过问,guo4 wen4,concern oneself with; take an interest in,aninterest run together
国务院,guo2 wu4 yuan4,the State Council,misspelled Sate
号召,hao4 zhao4,call; appeal,misspelled appea
继往开来,ji4 wang3 kai1 lai2,carry on the cause of one's predecessors and forge ahead into the future,forgeahead run together
基因,ji1 yin1,gene,misspelled gen
借鉴,jie4 jian4,use for reference; draw on the experience of,theexperience run together
联络,lian2 luo4,get in touch with; contact; connect with,misspelled onnect
勉强,mian3 qiang3,force to do sth.; manage with an effort; reluctantly,aneffort run together
名额,ming2 e2,the number of people assigned or allowed,assignedor run together
纽扣儿,niu3 kou4 r5,button; fastener,misspelled astener
评估,ping2 gu1,assess; evaluate,misspelled evaluat
俗话,su2 hua4,saying; folk saying,folksaying run together
团结,tuan2 jie2,unite; cohesive,unit should be unite
眼色,yan3 se4,meaningful glance; hint given with the eyes,givenwith run together
意料,yi4 liao4,expectation; surprise; expect; anticipate,misspelled expection
庸俗,yong1 su2,vulgar; philistine,misspelled philistin
折磨,zhe2 mo2,torment; cause physical or mental suffering,ormental run together
争议,zheng1 yi4,dispute; controversy,misspelled controver
```

- [ ] **Step 5: Write `data/manual/capitals_v001.csv`**

This file carries out point 7 of the pinyin style sheet and Open decision 5. `capital` is Y or N. The 12 card rows are the cards whose capital comes from the public list, because the PDFs do not print them in the HSK 1 to 4 files. The 11 sentence rows are words of Plan 3b's example sentences that are not cards but that every reading in the public list writes with a capital. Point 7 writes common nouns in lower case ("xīngqīrì", "měiyuán", "xīfāng"), so 星期天, 星期日, 美元, 英镑 and 西方 are N, and so is the month name 正月 ("zhēngyuè", like "bāyuè" in point 2). The place name 欧洲, the language 英语 and 中华 (China) are Y. The other rows are Y, as the public list writes them, until the user answers Open decision 5. A card whose capital follows the HSK 1 to 4 PDFs' print (北京, 汉语) has no row, and step 5 stops if one is added.

`words` is empty for a name of one word, as in every row here. For a person's name it lists the words, separated by spaces, and `capital` then gives one Y or N per word, because the textbook rules write the surname apart from the given name, each with a capital, and a title apart in lower case. A row `王建国,王 建国,Y Y,sentence` gives "Wáng Jiànguó", and `李老师,李 老师,Y N,sentence` gives "Lǐ lǎoshī". Plan 3b Task 11 adds such rows for the names in the example sentences.

```csv
hz,words,capital,where
除夕,,Y,card
元旦,,Y,card
国庆节,,Y,card
华裔,,Y,card
欧洲,,Y,card
国务院,,Y,card
摄氏度,,Y,card
元宵节,,Y,card
正月,,N,card
华侨,,Y,card
端午节,,Y,card
重阳节,,Y,card
中华,,Y,sentence
奥运会,,Y,sentence
星期天,,N,sentence
星期日,,N,sentence
春节,,Y,sentence
美元,,N,sentence
联合国,,Y,sentence
英语,,Y,sentence
英镑,,N,sentence
西方,,N,sentence
道教,,Y,sentence
```

- [ ] **Step 6: Commit**

```bash
git add data/manual/pdf_fixes_v001.csv data/manual/public_readings_v001.csv data/manual/second_readings_v001.csv data/manual/gloss_fixes_v001.csv data/manual/capitals_v001.csv && git commit -F - <<'EOF'
data: hand-written fixes for 41 PDF entries, 29 reading choices, 3 second readings, 42 glosses, and the capitals decisions

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 7: Build the word list (`tools/05_build_wordlist.py`)

**Files:**
- Modify: `tools/requirements.txt`
- Create: `tools/05_build_wordlist.py`, `tools/05b_four_char_merge.py`
- Create (by the form agents): `data/claude/four_char_v001/batch_001_v001.csv`
- Input: the manual files of Task 6, including `capitals_v001.csv`
- Output: `data/build/four_char_batches_v001/`, `data/manual/four_char_words_v001.csv`, `data/build/wordlist_v001.jsonl`, `data/reports/wordlist_v001.txt`, `data/ids/word_ids_v001.csv`

Each output line is one card:
- `id`, `hz`, `py`, `pyNum`, `pyBase`, `syl`, `lv`, `pos`, `en`, `enShort` are the schema fields.
- `freq` is the public list's frequency rank.
- `src` is `pdf` or `list`.
- `key` is the reading in dictionary tones, which the IDs use. It equals `pyNum`.
- `refs` names the PDF entries, for example `HSK1 #1`.
- `sents` lists the PDF sentence candidates, which may still contain ～.

Only `py` carries the 一 and 不 tone changes that textbooks print. `pyNum`, `pyBase` and `syl` come from the dictionary tones, as the schema file says. So 不客气 has `py` "bú kèqi" and `pyNum` "bu4 ke4 qi5". The app (Plan 2) relies on this, because it reads `pyNum` as the dictionary tones and never offers "bù kèqi" as a wrong choice, since that is the dictionary pronunciation. The 儿 ending is its own `r5` syllable in `pyNum` but is not counted in `syl`, so 一点儿 has `pyNum` "yi1 dian3 r5" and `syl` 2.

`py` is written in textbook word spacing (Task 1). `card_pinyin` first tries the card's printed pinyin from the HSK 1 to 4 PDFs, whose syllables, tones and capital it then uses as printed. Otherwise it applies the 一 and 不 tone changes itself. A four-character headword is written in its form, and any other headword gets its word division from jieba (`cut`, which uses only jieba's own dictionary). Two files carry what the user reviews (Open decisions 4 and 5):
- `data/manual/four_char_words` gives the form of each four-character headword. The form agents see CC-CEDICT's "(idiom)" mark (in any meaning of the word in the public list) only as a hint;
- `data/manual/capitals` (Task 6) says whether a card without a fitting print has a capital.

The forms come from Claude form agents. On the first run, step 5 finds the four-character headwords that have no form yet, writes them to batch files in `data/build/four_char_batches_v001/`, and stops without writing the word list. The agents answer the batch (Step 4), step 5b checks their answers and writes `data/manual/four_char_words_v001.csv` (Steps 5 and 6), and step 5 is run again. Step 5 also stops before writing anything when a card needs a row that `capitals` lacks, or when `capitals` names a card whose capital follows the print. The report counts where each card's spacing came from and lists these groups for review:
- HSK 1 to 4 cards whose printed pinyin does not fit the card reading;
- four-character headwords whose form `four_char_words` gives, by form;
- headwords that jieba splits into several words;
- cards written with a capital, split into those whose capital follows the HSK 1 to 4 PDFs' print and those whose capital `capitals` sets, and the cards in lower case although the public list has a capital.

- [ ] **Step 1: Install jieba and check the call this step uses**

Add the line `jieba>=0.42` at the end of `tools/requirements.txt`, so that it reads:
```text
pypdf>=6.0
fonttools>=4.43
matplotlib>=3.8
pytest>=8
jieba>=0.42
```
Run: `python -m pip install "jieba>=0.42"`
Then run:
```bash
PYTHONIOENCODING=utf-8 python -c "
import jieba, logging
jieba.setLogLevel(logging.WARNING)
print([jieba.lcut(t, HMM=False) for t in ['素食主义', '拔苗助长', '系领带', '不客气']])"
```
Expected: `[['素食', '主义'], ['拔苗助长'], ['系', '领带'], ['不', '客气']]` (checked with jieba 0.42.1). If the call fails or cuts these words differently, stop and report it before writing the script, because the facts above depend on these cuts.

- [ ] **Step 2: Write `tools/05_build_wordlist.py`**

```python
"""Step 5. Build the card word list: headwords, readings, levels, IDs, parts of speech and meanings.

Inputs:  data/public/hsk2_old_exclusive_vNNN.json, data/public/hsk_complete_vNNN.json,
         data/extract/pdf_entries_vNNN.jsonl, data/decode/cidmap_vNNN.csv,
         data/manual/pdf_fixes_vNNN.csv, data/manual/public_readings_vNNN.csv,
         data/manual/second_readings_vNNN.csv, data/manual/gloss_fixes_vNNN.csv,
         data/manual/capitals_vNNN.csv, data/manual/four_char_words_vNNN.csv once it exists,
         data/ids/word_ids_vNNN.csv once it exists
Outputs: data/build/wordlist_vNNN.jsonl (one card per line), data/reports/wordlist_vNNN.txt,
         and data/ids/word_ids_vNNN.csv when new IDs were handed out
Nothing is written if any PDF entry or public word still needs a hand-written decision,
if a gloss fix names a card that does not exist, or if a card has no usable English meaning.
When four-character headwords still need a form (data/manual/four_char_words), only the batch
files for the form agents are written, to data/build/four_char_batches_vNNN/.
The report lists the cards whose word spacing needs a look, and ends with every card meaning
that holds a word CC-CEDICT never uses, for review.
"""
import logging
import sys
from collections import Counter

import jieba

from common import (all_version_paths, latest_version_path, next_version_path, next_versions, read_csv,
                    read_json, read_jsonl, write_new_csv, write_new_jsonl, write_new_text)
from meaning import en_short, fit_en, public_pos, unknown_words, vocabulary
from pinyin_text import (FORM_BATCH, FORM_BATCH_COLUMNS, card_py, form_rows, headword_joints, joints_from_sizes,
                         name_rows, printed_pinyin, py_base, syllable_count, tone_change)
from wordids import assign_ids
from wordlist import (NO_FREQUENCY, apply_gloss_fixes, english, level_of, pdf_words, public_only_words,
                      public_readings, second_readings)


def load_fixes():
    rows = read_csv(latest_version_path("data/manual/pdf_fixes", ".csv"))
    return {(int(r["file"]), int(r["n"])): {k: (v or "").strip() for k, v in r.items()} for r in rows}


def load_gloss_fixes():
    rows = read_csv(latest_version_path("data/manual/gloss_fixes", ".csv"))
    return {(r["hz"].strip(), r["pynum"].strip().lower()): r["gloss"].strip() for r in rows}


def latest_rows(stem):
    """The rows of the newest <stem>_vNNN.csv, or [] when there is none yet."""
    found = all_version_paths(stem, ".csv")
    return read_csv(found[-1][1]) if found else []


def cut(text):
    """The words jieba finds in text, from its own dictionary only (no guessing of unknown words)."""
    return jieba.lcut(text, HMM=False)


def card_pinyin(w, forms, names):
    """py, pyNum, pyBase and syl for one word, where py's word spacing came from, and any missing decision.

    py uses textbook word spacing. The source is "pdf" when an HSK 1 to 4 PDF entry prints pinyin
    that fits the card reading (its syllables, tones and capital are used as printed, so 互联网 is
    "hùliánwǎng" as HSK4 #776 prints it). Otherwise it is "idiom", "words" or "joined" for a
    four-character headword, whose form comes from `forms` ({hz: (form, words)} from
    data/manual/four_char_words), which has a row for every such headword, CC-CEDICT idioms
    included. Any other headword has the source "jieba". Only py shows the 一 and 不 tone changes.
    pyNum, pyBase and syl use the dictionary tones, so 不客气 gives py "bú kèqi" and pyNum
    "bu4 ke4 qi5".
    names ({hz: (words, capitals)} from data/manual/capitals) says whether a card without a fitting
    print has a capital, and for a person's name which words it has. A card that the public list or
    a pdf_fixes row writes with a capital needs a row there.
    The last two items returned name a missing decision (or None), and the four-character
    headword that needs a form (or None).
    """
    chars = w["hz"].replace("…", "")
    nums = w["num"].split()
    if len(chars) != len(nums):
        raise ValueError(f"{w['hz']}: {len(chars)} characters but reading {w['num']!r}")
    printed = printed_pinyin(w["latin"], w["hz"], nums)
    missing = needs_form = None
    if printed:
        shown, joints, capital = printed
        source = "pdf"
        if w["hz"] in names:
            missing = f"{w['hz']}: data/manual/capitals has a row, but its capital follows the HSK PDF print"
    else:
        stem = w["hz"][:-1] if len(w["hz"]) > 2 and w["hz"].endswith("儿") else w["hz"]
        form = forms.get(stem)
        if len(stem) == 4 and "…" not in stem and form is None:
            needs_form = stem
        shown, joints = tone_change(chars, nums), headword_joints(w["hz"], cut, form)
        parts, capital = names.get(w["hz"], ([w["hz"]], w["capital"]))
        if len(parts) > 1:
            joints = joints_from_sizes([len(p) for p in parts])
        if w["capital"] and w["hz"] not in names:
            missing = f"{w['hz']}: written with a capital in the public list; add a row to data/manual/capitals"
        source = form[0] if len(stem) == 4 and form else "jieba"
    return {"py": card_py(shown, joints, capital), "pyNum": " ".join(nums), "pyBase": py_base(nums),
            "syl": syllable_count(nums)}, source, missing, needs_form


def main():
    jieba.setLogLevel(logging.WARNING)
    old = read_json(latest_version_path("data/public/hsk2_old_exclusive", ".json"))
    complete = read_json(latest_version_path("data/public/hsk_complete", ".json"))
    entries = read_jsonl(latest_version_path("data/extract/pdf_entries", ".jsonl"))
    fwd = {int(r["cid"]): r["char"] for r in read_csv(latest_version_path("data/decode/cidmap", ".csv"))}
    chosen = {r["hz"]: r for r in read_csv(latest_version_path("data/manual/public_readings", ".csv"))}
    decided = {(r["hz"], r["pynum"].strip().lower()): r
               for r in read_csv(latest_version_path("data/manual/second_readings", ".csv"))}
    readings = public_readings(complete)
    info = {w["simplified"]: w for w in complete}
    idioms = {hz for hz, options in readings.items() if any("(idiom)" in m for r in options for m in r["meanings"])}
    old_level = {w["simplified"]: w["hsk"] for w in old}

    pdf, problems = pdf_words(entries, fwd, readings, load_fixes())
    listed, more = public_only_words(old, {w["hz"] for w in pdf.values()}, readings, chosen)
    problems += more
    second, more = second_readings(complete, readings, set(pdf) | set(listed), decided)
    problems += more
    words = {**pdf, **listed, **second}
    problems += apply_gloss_fixes(words, load_gloss_fixes())
    forms, more = form_rows(latest_rows("data/manual/four_char_words"))
    problems += more
    names, more = name_rows(read_csv(latest_version_path("data/manual/capitals", ".csv")))
    problems += more
    if problems:
        sys.exit("Stopped, nothing written. Add rows to data/manual/pdf_fixes, public_readings or "
                 "second_readings, or correct gloss_fixes, four_char_words or capitals:\n  " + "\n  ".join(problems))

    senses = {k: english(w, readings) for k, w in words.items()}
    empty = [f"{hz} {num}" for (hz, num), found in senses.items() if not found]
    if empty:
        sys.exit("Stopped, nothing written. No usable English meaning for: " + ", ".join(empty))
    for w in words.values():
        w["lv"] = level_of(w, old_level)
        w["freq"] = info.get(w["hz"], {}).get("frequency", NO_FREQUENCY)
    keys = sorted(words, key=lambda k: (words[k]["lv"], words[k]["freq"], k))
    found = all_version_paths("data/ids/word_ids", ".csv")
    frozen = read_csv(found[-1][1]) if found else []
    ids, new_rows = assign_ids(keys, frozen)

    rows, spacing, listed_capital, missing, need_forms = [], {}, {}, [], {}
    for key in keys:
        w = words[key]
        pinyin, spacing[ids[key]], need, stem = card_pinyin(w, forms, names)
        missing += [need] if need else []
        if stem:
            need_forms[stem] = [stem, w["num"], fit_en(senses[key]), "card", "", "idiom" if stem in idioms else ""]
        listed_capital[ids[key]] = w["capital"]
        rows.append({"id": ids[key], "hz": w["hz"], **pinyin, "lv": w["lv"],
                     "pos": w["pos"] or public_pos(info.get(w["hz"], {}).get("pos", [])),
                     "en": fit_en(senses[key]), "enShort": en_short(senses[key]), "freq": w["freq"],
                     "src": "pdf" if w["files"] else "list", "key": w["num"], "refs": w["refs"],
                     "sents": [list(s) for s in w["sents"]]})
    rows.sort(key=lambda r: r["id"])
    if missing:
        sys.exit("Stopped, nothing written. A hand-written decision is missing:\n  " + "\n  ".join(missing))
    if need_forms:
        folder = next_version_path("data/build/four_char_batches", "")
        folder.mkdir()
        batch = list(need_forms.values())
        for n in range(0, len(batch), FORM_BATCH):
            write_new_csv(folder / f"batch_{n // FORM_BATCH + 1:03d}.csv", FORM_BATCH_COLUMNS, batch[n:n + FORM_BATCH])
        sys.exit(f"Stopped before writing the word list: {len(batch)} four-character headwords need a form. "
                 f"Batch files for the form agents are in {folder}.")

    paths = next_versions(wordlist=("data/build/wordlist", ".jsonl"), report=("data/reports/wordlist", ".txt"))
    write_new_jsonl(paths["wordlist"], rows)
    ids_note = ""
    if new_rows:
        ids_path = next_version_path("data/ids/word_ids", ".csv")
        write_new_csv(ids_path, ["id", "hz", "pynum"], [[r["id"], r["hz"], r["pynum"]] for r in frozen + new_rows])
        ids_note = f" (written to {ids_path})"
    by_level = Counter(r["lv"] for r in rows)
    per_hz = Counter(r["hz"] for r in rows)
    vocab = vocabulary(m for options in readings.values() for r in options for m in r["meanings"])
    odd = [(r, unknown_words(r["en"], vocab)) for r in rows]
    odd = [(r, strange) for r, strange in odd if strange]
    by_source = Counter(spacing.values())
    unprinted = [r for r in rows if r["refs"] and any(int(ref.split()[0][3:]) <= 4 for ref in r["refs"])
                 and spacing[r["id"]] != "pdf"]
    in_file = {form: [r for r in rows if spacing[r["id"]] == form] for form in ("idiom", "words", "joined")}
    split = [r for r in rows if spacing[r["id"]] == "jieba" and " " in r["py"]]
    capitals = [r for r in rows if r["py"][:1].isupper()]
    printed_caps = [r for r in capitals if spacing[r["id"]] == "pdf"]
    listed_caps = [r for r in capitals if spacing[r["id"]] != "pdf"]
    lowered = [r for r in rows if listed_capital[r["id"]] and not r["py"][:1].isupper()]
    lines = ["Word list report", "",
             f"Cards: {len(rows)} ({len(pdf)} from the PDFs, {len(listed)} only in the public HSK 2.0 list, "
             f"{len(second)} second readings)",
             "Second readings: " + " ".join(f"{hz} {num}" for hz, num in sorted(second)),
             "By HSK level: " + ", ".join(f"HSK{lv} {by_level[lv]}" for lv in sorted(by_level)),
             f"Cards with at least one PDF sentence to choose from: {sum(1 for r in rows if r['sents'])}",
             "Headwords with more than one card: " + " ".join(sorted(h for h, n in per_hz.items() if n > 1)),
             f"IDs kept from the frozen file: {len(rows) - len(new_rows)}. New IDs: {len(new_rows)}{ids_note}",
             f"Cards without a part-of-speech label: {sum(1 for r in rows if not r['pos'])}",
             f"Cards whose quiz meaning was shortened with …: {sum(1 for r in rows if r['enShort'].endswith('…'))}",
             f"Cards whose meaning holds a word CC-CEDICT never uses: {len(odd)} (listed at the end of the report)",
             f"Card pinyin word spacing: {by_source['pdf']} from the HSK 1 to 4 PDFs, "
             f"{by_source['idiom'] + by_source['words'] + by_source['joined']} four-character words ({by_source['idiom']} "
             f"idioms, {by_source['words']} written as several words, {by_source['joined']} joined), "
             f"{by_source['jieba']} from jieba ({len(split)} of them more than one word)",
             f"Cards written with a capital: {len(capitals)} ({len(printed_caps)} as the HSK 1 to 4 PDFs print them, "
             f"{len(listed_caps)} as data/manual/capitals sets them). In lower case although the public list has "
             f"a capital: {len(lowered)}",
             ""]
    review = ["HSK 1 to 4 cards whose PDF pinyin does not fit the card reading, so jieba gave the spacing:"]
    review += [f"  {r['id']} {r['hz']} {r['py']} | {r['pyNum']}" for r in unprinted] or ["  none"]
    review += ["", "Four-character headwords whose form data/manual/four_char_words gives:"]
    review += [f"  {form}: " + (" ".join(f"{r['hz']} {r['py']}" for r in found) or "none")
               for form, found in in_file.items()]
    review += ["", "Headwords that jieba splits into more than one word:",
               "  " + (" ".join(f"{r['hz']} {r['py']}" for r in split) or "none"), ""]
    review += ["Cards written with a capital, as names. The first group follows the HSK 1 to 4 PDFs' print.",
               "The second takes its capital from data/manual/capitals, which follows the public list until the",
               "user decides, because the HSK 5 and 6 PDFs print every word in lower case. Show it to the user.",
               "  As printed: " + " ".join(f"{r['hz']} {r['py']}" for r in printed_caps),
               "  From data/manual/capitals: " + " ".join(f"{r['hz']} {r['py']}" for r in listed_caps),
               "In lower case although the public list has a capital, as the HSK 1 to 4 PDFs print them or as",
               "data/manual/capitals sets them:",
               "  " + (" ".join(f"{r['hz']} {r['py']}" for r in lowered) or "none"), ""]
    review += ["Card meanings with a word CC-CEDICT never uses. Most are real English words (noonday, kinsfolk).",
               "Look for words run together, misspellings and junk text, and fix them in a new gloss_fixes file.", ""]
    review += [f"  {r['id']} {r['hz']} {r['pyNum']}: {' '.join(strange)} | {r['en']}" for r, strange in odd]
    write_new_text(paths["report"], "\n".join(lines + review) + "\n")
    print("\n".join(lines))
    print(f"Word list: {paths['wordlist']}. Report: {paths['report']}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run it the first time**

Run: `PYTHONIOENCODING=utf-8 python tools/05_build_wordlist.py`
Expected on the first run:
```
Stopped before writing the word list: 120 four-character headwords need a form. Batch files for the form agents are in data\build\four_char_batches_v001.
```
The folder holds `batch_001.csv` with 100 rows and `batch_002.csv` with 20 (columns hz, pinyin, en, where, sentence, mark). On the prototype run they were the 120 four-character headwords whose spacing the PDFs do not print. 76 are CC-CEDICT idioms, with "idiom" in mark, 43 are words that jieba keeps whole without that mark, such as 迄今为止, 二氧化碳 and 通货膨胀, and one is 素食主义, which jieba splits.

If it stops with a list of entries instead, each named entry needs a row in a new `data/manual/pdf_fixes_v002.csv` (copy v001 and add the rows), or a named public word needs a row in a new `public_readings_v002.csv`, or a named second reading needs a row in a new `second_readings_v002.csv`. A named gloss fix whose card does not exist needs its headword or reading corrected in a new `gloss_fixes_v002.csv`. If it stops because a capital is missing, add the named row to a new `capitals_v002.csv` (copy v001 and add the row), following Open decision 5. Then rerun. If it stops because a card has no usable English meaning, show the user the named words and ask how to proceed.

- [ ] **Step 4: Decide the forms (multi-agent workflow)**

This step is done by Claude subagents, not by a script. The instructions below are this step's code, so give them to each agent word for word, with only the two file paths filled in. Plan 3b's step 8 uses the same instructions for the four-character words of the example sentences.
1. **Form agents.** Start one fresh agent per `batch_KKK.csv` in the latest `data/build/four_char_batches_vNNN/`, at most 8 at a time. Each gets the instructions with `{input}` = that batch file and `{output}` = `data/claude/four_char_vNNN/batch_KKK_v001.csv`, where `NNN` is the version of the batch folder.
2. **Merge.** When all agents have finished, run Step 6.
3. **Redo.** For every batch the merge names, start a fresh agent with the same instructions plus the "earlier attempt" paragraph of Task 10, filled with that batch's problem lines. It writes the next answer version (`batch_001_v002.csv`). Never edit or delete an earlier answer file.
4. **Limit.** After three redo rounds for the same batch, stop and ask the user.

The form instructions (the text between the two lines of dashes):

------------------------------------------------------------
You decide how the pinyin of four-character Chinese words is written, following the Chinese national standard for pinyin spelling (汉语拼音正词法, GB/T 16159). That standard writes such a word in one of three forms.

Read the input file {input}. It is a UTF-8 CSV with the columns hz (the four characters), pinyin (their numbered pinyin, one syllable per character), en (the English meaning of a flashcard word, or empty), where (card for a flashcard headword, sentence for a word from an example sentence), sentence (for a sentence word, one sentence that contains it) and mark (idiom when the Chinese-English dictionary CC-CEDICT calls the word an idiom, otherwise empty).

Write the output file {output} as a UTF-8 CSV with exactly this header line:
hz,form,words
Write one row per input row, in the input order. Copy hz exactly.

form is one of these three:
1. idiom. An idiom (成语) or another fixed four-character saying whose characters read as two pairs, such as 拔苗助长, 一路平安, 各行各业, 眉清目秀 and 丢三落四. The standard's own examples are 风平浪静, 爱憎分明 and 水到渠成. It is written as two joined pairs with a hyphen (bámiáo-zhùzhǎng). Leave words empty.
2. words. A compound or phrase made of two or more words that are each used on their own, such as 通货膨胀 (通货 + 膨胀, inflation), 市场经济 (市场 + 经济, market economy), 素食主义 (素食 + 主义), 足球比赛, 叹一口气 and 八十三岁. It is written as separate words (tōnghuò péngzhàng). In words, write those words separated by single spaces, so that together they spell hz exactly, for example 通货 膨胀, 叹 一 口 气 or 八十三 岁.
3. joined. One word whose parts are not used as words in this sense, such as the technical term 二氧化碳 (carbon dioxide, èryǎnghuàtàn). Also an idiom or fixed saying that does not divide into two pairs, which the standard writes joined, with its own examples 总而言之 (zǒng'éryánzhī), 层出不穷 (céngchūbùqióng), 不亦乐乎, 爱莫能助 and 一衣带水. Also every doubled AABB word, such as 断断续续 (duànduànxùxù) and 兢兢业业, as the standard writes 来来往往 and 清清楚楚. It is written as one joined word. Leave words empty.

Rules:
1. Decide by the word's meaning (en for a card, the sentence for a sentence word), as a Chinese textbook would print it.
2. Choose idiom only for a fixed saying. A phrase that simply puts two ordinary words together, such as 公共场所 (public place) or 售后服务 (after-sales service), is words, even when both halves have two characters.
3. When you write words, divide them as the standard does. A whole number from 11 to 99 is one word (八十三). A digit with 百, 千, 万 or 亿 is one word (一千 五百). A number is apart from its measure word (八十三 岁, 一 段 时间). A fraction is written one character at a time (三 分 之 一). 十几 and 几十 are one word each (几十 个). 们, 了, 着 and 过 stay joined to the word before them (看过).
4. Judge each row on its own four characters, even when they sit inside a longer name or phrase in the sentence.
5. mark is only a hint. A word that CC-CEDICT calls an idiom can still be joined (层出不穷) or words, and a word without the mark can be an idiom (迄今为止).

Do not read, create or change any other file. When you have finished, reply with one line giving the number of rows and the counts of idiom, words and joined.
------------------------------------------------------------

- [ ] **Step 5: Write `tools/05b_four_char_merge.py`**

```python
"""Step 5b. Turn the form agents' answers into a new data/manual/four_char_words file.

Step 5 (for card headwords) and Plan 3b's step 8 (for sentence words) write the batch files when
four-character words still need a form. This step is run after either of them.
Inputs:  the latest data/build/four_char_batches_vNNN/ and the answers in data/claude/four_char_vNNN/
         (for each batch_KKK.csv the latest batch_KKK_vMMM.csv; columns hz, form, words),
         and the latest data/manual/four_char_words_vFFF.csv if one exists
Output:  data/manual/four_char_words_vFFF.csv (next version; hz, form, words, where) holding every
         earlier row plus one row per answered word
Nothing is written while an answer file is missing or has problems.
"""
import sys
from pathlib import Path

from common import all_version_paths, latest_version_path, next_version_path, read_csv, write_new_csv
from pinyin_text import check_form_answers


def main():
    folder = latest_version_path("data/build/four_char_batches", "")
    answers_dir = Path("data/claude") / folder.name.replace("four_char_batches", "four_char")
    problems, new_rows = [], []
    for batch in sorted(folder.glob("batch_*.csv")):
        found = all_version_paths(answers_dir / batch.stem, ".csv")
        if not found:
            problems.append(f"{batch.stem}: no answer file")
            continue
        given = read_csv(batch)
        more, rows = check_form_answers(given, read_csv(found[-1][1]))
        problems += [f"{batch.stem}: {p}" for p in more]
        where = {r["hz"]: r["where"] for r in given}
        new_rows += [row + [where[row[0]]] for row in rows]
    if problems:
        sys.exit("Stopped, nothing written. Redo these answers:\n  " + "\n  ".join(problems[:40]))
    earlier = all_version_paths("data/manual/four_char_words", ".csv")
    merged = {r["hz"]: [r["hz"], r["form"], r["words"], r["where"]] for r in
              (read_csv(earlier[-1][1]) if earlier else [])}
    for row in new_rows:
        merged[row[0]] = row
    path = next_version_path("data/manual/four_char_words", ".csv")
    write_new_csv(path, ["hz", "form", "words", "where"], list(merged.values()))
    counts = {form: sum(1 for r in new_rows if r[1] == form) for form in ("idiom", "words", "joined")}
    print(f"{len(new_rows)} words answered: {counts['idiom']} idiom, {counts['words']} words, "
          f"{counts['joined']} joined. {len(merged)} rows in {path}.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Merge the answers and build the word list**

Run: `PYTHONIOENCODING=utf-8 python tools/05b_four_char_merge.py`
Expected: `120 words answered: I idiom, W words, J joined. 120 rows in data\manual\four_char_words_v001.csv.`, where I, W and J are the agents' counts. The prototype's stand-in answers gave 112 idiom, 3 words and 5 joined. If it stops with `Redo these answers`, go back to Step 4 for the named batches.

Then run: `PYTHONIOENCODING=utf-8 python tools/05_build_wordlist.py`
Expected (these are the numbers the prototype produced on the same inputs with the stand-in answers; the three form counts in the spacing line follow the agents' answers):
```
Word list report

Cards: 5043 (4063 from the PDFs, 977 only in the public HSK 2.0 list, 3 second readings)
Second readings: 得 de2 得 dei3 长 zhang3
By HSK level: HSK1 156, HSK2 161, HSK3 321, HSK4 652, HSK5 1250, HSK6 2503
Cards with at least one PDF sentence to choose from: 4058
Headwords with more than one card: 倒 只 得 扒 数 背 过 还 重 长
IDs kept from the frozen file: 0. New IDs: 5043 (written to data\ids\word_ids_v001.csv)
Cards without a part-of-speech label: 103
Cards whose quiz meaning was shortened with …: 52
Cards whose meaning holds a word CC-CEDICT never uses: 277 (listed at the end of the report)
Card pinyin word spacing: 1182 from the HSK 1 to 4 PDFs, 120 four-character words (112 idioms, 3 written as several words, 5 joined), 3741 from jieba (2 of them more than one word)
Cards written with a capital: 19 (8 as the HSK 1 to 4 PDFs print them, 11 as data/manual/capitals sets them). In lower case although the public list has a capital: 4

Word list: data\build\wordlist_v001.jsonl. Report: data\reports\wordlist_v001.txt
```


- [ ] **Step 7: Review the word spacing lists and the words CC-CEDICT never uses**

Open `data/reports/wordlist_v001.txt`.
- **Word spacing.** After the counts come the spacing lists. On the prototype run they held the 11 neutral-tone cards named in the facts, the 120 four-character headwords by the form the file gives (112 idiom, then 烟花爆竹 素食主义 通货膨胀 as words, then 二氧化碳 总而言之 层出不穷 断断续续 兢兢业业 joined, with the stand-in answers), and 系领带 涮火锅. Read them, and report any `py` that looks wrong to the user rather than changing the rules or the file. The user reviews the forms at the checkpoint.
- **Capitals.** Next come the cards written with a capital. On the prototype run 8 follow the HSK 1 to 4 PDFs' print (中国 北京 汉语 中文 黄河 亚洲 长城 长江), and 11 take their capital from `data/manual/capitals`, which copies the public list where the style sheet does not settle the word (除夕 元旦 国庆节 华裔 欧洲 国务院 摄氏度 元宵节 华侨 端午节 重阳节). 互联网, 礼拜天 and 京剧 are in lower case, as HSK 4 prints them, and 正月 "zhēngyuè" as point 7 of the style sheet writes a month name. Show the second group to the user at the checkpoint (Open decision 5) rather than changing it.
- **Meanings.** The list at the end gives the card, the unknown words and the card meaning, for example `w0139 中午 zhong1 wu3: noonday | noon; midday; noonday`. On the prototype run, with the fixes of Task 6, all 277 lines were real English words, such as noonday and kinsfolk. If a line shows two words run together, a misspelling or junk text, copy `gloss_fixes_v001.csv` to `gloss_fixes_v002.csv`, add a row with the corrected gloss, and run step 5 again. Rerunning keeps every ID, because the IDs file only grows.

- [ ] **Step 8: Spot-check tricky cards**

Run:
```bash
PYTHONIOENCODING=utf-8 python -c "
import json
rows=[json.loads(l) for l in open('data/build/wordlist_v001.jsonl',encoding='utf-8')]
by={}
for r in rows: by.setdefault(r['hz'],[]).append(r)
for hz in ['爱','不客气','一下','一点儿','女儿','可爱','北京','打电话','受不了','虽然…但是…','干活儿','第一','拔苗助长','总而言之','系领带','素食主义','通货膨胀','二氧化碳','还','局部','致力于','窗帘','没','长','得','哈','露','当','纽扣儿','互联网']:
    for r in by[hz]: print(r['id'],r['hz'],r['py'],'|',r['pyNum'],'|',r['lv'],r['pos'],'|',r['en'],'|',r['enShort'])"
```
Expected, among the lines:
```
w0048 爱 ài | ai4 | 1 ['v.'] | love; like doing sth. | love
w0156 不客气 bú kèqi | bu4 ke4 qi5 | 1 [] | You're welcome. | You're welcome.
w0313 一下 yíxià | yi1 xia4 | 2 ['m.'] | once; in a short while | once
w0151 一点儿 yìdiǎnr | yi1 dian3 r5 | 1 ['m.'] | a little | a little
w0106 女儿 nǚ'ér | nü3 er2 | 1 ['n.'] | daughter | daughter
w0431 可爱 kě'ài | ke3 ai4 | 3 ['adj.'] | cute; lovable; likeable | cute
w0148 北京 Běijīng | bei3 jing1 | 1 ['n.'] | Beijing | Beijing
w0119 打电话 dǎ diànhuà | da3 dian4 hua4 | 1 ['v.'] | make a phone call | make a phone call
w1109 受不了 shòubuliǎo | shou4 bu4 liao3 | 4 [] | can't bear; can't stand | can't bear
w0316 虽然…但是… suīrán…dànshì… | sui1 ran2 dan4 shi4 | 2 ['conj.'] | although …, (still) … | although …, (still) …
w2536 干活儿 gànhuór | gan4 huo2 r5 | 5 ['v.'] | work | work
w0206 第一 dì-yī | di4 yi1 | 2 ['num.'] | first | first
w5025 拔苗助长 bámiáo-zhùzhǎng | ba2 miao2 zhu4 zhang3 | 6 [] | spoil things by being too eager; help shoots grow by pulling them | spoil things by being too…
w4662 总而言之 zǒng'éryánzhī | zong3 er2 yan2 zhi1 | 6 ['conj.'] | all in all; in a word | all in all
w2540 系领带 xì lǐngdài | xi4 ling3 dai4 | 5 [] | to wear a tie | to wear a tie
w5041 素食主义 sùshí zhǔyì | su4 shi2 zhu3 yi4 | 6 ['n.'] | vegetarianism | vegetarianism
w5043 通货膨胀 tōnghuò péngzhàng | tong1 huo4 peng2 zhang4 | 6 ['n.'] | inflation | inflation
w4197 二氧化碳 èryǎnghuàtàn | er4 yang3 hua4 tan4 | 6 ['n.'] | CO2; carbon dioxide | CO2
w0162 还 hái | hai2 | 2 ['adv.'] | still; yet; in addition | still
w0163 还 huán | huan2 | 2 ['v.'] | return sth to the owner | return sth to the owner
w3581 局部 júbù | ju2 bu4 | 6 ['n.'] | part | part
w0207 长 cháng | chang2 | 2 ['adj.'] | long | long
w0208 长 zhǎng | zhang3 | 2 ['v.', 'n.'] | to grow; chief; head | to grow
w0170 得 dé | de2 | 2 ['v.'] | to get; to obtain; to win | to get
w0171 得 de | de5 | 2 ['part.'] | marker of complement | marker of complement
w0172 得 děi | dei3 | 2 ['v.'] | must; to have to | must
w1322 哈 hā | ha1 | 5 ['int.'] | ha! (laughter or surprise) | ha! (laughter or surprise)
w1707 露 lù | lu4 | 5 ['n.', 'v.'] | dew; to show; to reveal | dew
w0641 当 dāng | dang1 | 4 ['v.', 'prep.'] | to act as; to be; when | to act as
w5042 纽扣儿 niǔkòur | niu3 kou4 r5 | 6 [] | button; fastener | button
w1161 互联网 hùliánwǎng | hu4 lian2 wang3 | 4 ['n.'] | the Internet; internet | the Internet
```
`pyNum` shows the dictionary tones (bu4, yi1) while `py` shows the tone changes (bú, yí) and the textbook word spacing. 不客气, 打电话 and 第一 take their spacing from the PDFs, and 系领带 is split by jieba. 拔苗助长, 总而言之, 素食主义, 通货膨胀 and 二氧化碳 take their form from `four_char_words`, so they show the stand-in answers here (an idiom written AB-CD, an idiom that does not divide into two pairs and is joined, two words, two words, and joined) and will show the agents' answers. No meaning holds a Chinese character. 哈, 露 and 当 take their part of speech and meaning from `public_readings_v001.csv`. 纽扣儿 ends in the 儿 ending `r5`, although the public list writes it "niǔ kòu er", and 互联网 is in lower case as HSK4 #776 prints it, although the public list writes "Hù lián wǎng". The IDs depend only on level, frequency and headword, so they should match. If an ID differs, compare the counts in Step 3 first.

- [ ] **Step 9: Commit the IDs, the forms, the requirements and the build scripts**

`data/build/` and `data/reports/` are ignored by git. The IDs file is the permanent record and is committed, and so are the form agents' answers and the forms file.

```bash
git add tools/requirements.txt tools/05_build_wordlist.py tools/05b_four_char_merge.py data/claude/four_char_v001 data/manual/four_char_words_v001.csv data/ids/word_ids_v001.csv && git commit -F - <<'EOF'
feat: build the 5,043-card word list with frozen IDs and four-character forms

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 8: Themes, the Starter Kit rule and answer checks (`tools/themes.py`)

**Files:**
- Create: `tools/themes.py`
- Test: `tests/test_themes.py`

The Starter Kit rule, as widened by the user on 2026-09-28, admits only HSK 1 and 2 words of three kinds:
- pronouns;
- question words;
- the core words: the verbs 是 有 在 要 没有, the particles and adverbs 的 了 吗 呢 吧 不 没 很 也 都 太 还 就, the conjunction 和 and the measure phrase 一点儿.

还 has two cards, and only 还 hái (still) is a core word, not 还 huán (to return). The rule gives 40 words on the real data, exactly the minimum theme size, so the Starter Kit is checked against the minimum like every other theme.

A theme over 350 words is split into equal parts in curriculum order, so the first part holds the lowest levels.

- [ ] **Step 1: Write the failing test `tests/test_themes.py`**

```python
from themes import (THEMES, batch_rows, check_output, chunks, curriculum, is_starter, second_opinion_flags,
                    split_by_level)


def test_thirty_themes_starting_with_the_starter_kit():
    assert len(THEMES) == 30 and THEMES[0] == "Starter Kit" and THEMES[29] == "Idioms & Formal Expressions"


def test_starter_kit_rule():
    assert is_starter({"hz": "我", "lv": 1, "pos": ["pron."]})
    assert is_starter({"hz": "为什么", "lv": 2, "pos": []})
    assert is_starter({"hz": "吧", "lv": 2, "pos": ["part."]})
    assert not is_starter({"hz": "自己", "lv": 3, "pos": ["pron."]})
    assert not is_starter({"hz": "喜欢", "lv": 1, "pos": ["v."], "pyNum": "xi3 huan5"})


def test_starter_kit_rule_takes_the_six_added_words():
    assert is_starter({"hz": "和", "lv": 1, "pos": ["conj.", "prep."], "pyNum": "he2"})
    assert is_starter({"hz": "一点儿", "lv": 1, "pos": ["m."], "pyNum": "yi1 dian3 r5"})
    assert is_starter({"hz": "没有", "lv": 1, "pos": ["v."], "pyNum": "mei2 you3"})
    assert is_starter({"hz": "还", "lv": 2, "pos": ["adv."], "pyNum": "hai2"})
    assert not is_starter({"hz": "还", "lv": 2, "pos": ["v."], "pyNum": "huan2"})


def test_batch_rows_and_chunks():
    w = {"id": "w0001", "hz": "爱", "py": "ài", "lv": 1, "pos": ["v.", "n."], "en": "love"}
    assert batch_rows([w]) == [["w0001", "爱", "ài", 1, "v. n.", "love"]]
    assert [len(c) for c in chunks(list(range(5)), 2)] == [2, 2, 1]


INPUT = [{"id": "w0001", "hz": "爱"}, {"id": "w0002", "hz": "八"}]


def out(rid, hz, theme="20", conf="H", alt=""):
    return {"id": rid, "hz": hz, "theme_no": theme, "confidence": conf, "alt_theme_no": alt, "note": ""}


def test_check_output_accepts_a_clean_batch():
    assert check_output(INPUT, [out("w0001", "爱"), out("w0002", "八", "3", "M", "24")]) == []


def test_check_output_finds_every_kind_of_problem():
    problems = check_output(INPUT, [out("w0001", "受"), out("w0001", "爱", "1"), out("w0009", "九"),
                                    out("w0001", "爱", "20", "X", "99")])
    assert "w0001: hz '受' differs from the input '爱'" in problems
    assert "w0001: theme_no '1' is not 2 to 30" in problems
    assert "w0009: not in the input" in problems
    assert "w0001: confidence 'X' is not H, M or L" in problems
    assert "w0001: alt_theme_no '99' is not a theme number" in problems
    assert "w0001: classified 3 times" in problems
    assert "w0002: missing" in problems


def test_second_opinion_flags_only_real_disagreements():
    main = {"w1": ("6", ""), "w2": ("6", "9"), "w3": ("6", "")}
    second = {"w1": ("7", ""), "w2": ("9", ""), "w3": ("6", "")}
    assert second_opinion_flags(main, second) == {"w1": "7"}


def test_split_by_level():
    assert [len(p) for p in split_by_level(list(range(700)))] == [350, 350]
    assert [len(p) for p in split_by_level(list(range(351)))] == [176, 175]
    assert [len(p) for p in split_by_level(list(range(40)))] == [40]


def test_curriculum_orders_by_theme_level_frequency_and_splits_big_themes():
    words = [{"id": f"w{i:04d}", "lv": 6 - i % 2, "freq": i} for i in range(1, 401)] + \
            [{"id": "w0999", "lv": 1, "freq": 5}]
    theme_of = {w["id"]: 6 for w in words}
    theme_of["w0999"] = 2
    out_ = curriculum(words, theme_of, [2, 6, 3], {2: "Greetings & Courtesy", 6: "Food & Drink", 3: "Numbers"})
    assert [(no, name, len(ws)) for no, name, ws in out_] == [
        (2, "Greetings & Courtesy", 1), (6, "Food & Drink (Part 1)", 200), (6, "Food & Drink (Part 2)", 200)]
    part1 = out_[1][2]
    assert [w["lv"] for w in part1] == [5] * 200 and part1[0]["id"] == "w0001"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_themes.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'themes'`

- [ ] **Step 3: Write `tools/themes.py`**

```python
"""The 30 daily-life themes, the Starter Kit rule, and checks on Claude's theme choices.

Theme 1, the Starter Kit, is filled by a fixed rule, never by judgement. Every other
word is sorted into themes 2 to 30 by Claude batch agents, each writing one CSV per batch.
"""
import math

THEMES = ["Starter Kit", "Greetings & Courtesy", "Numbers & Measure Words", "Time & Dates",
          "Family & People", "Food & Drink", "Shopping & Money", "Home & Housework", "Daily Routine",
          "Body & Health", "Clothes & Appearance", "Transport & Travel", "Places & Directions",
          "Weather & Seasons", "Nature & Animals", "School & Study", "Work & Office",
          "Phone, Internet & Media", "Hobbies & Sports", "Feelings", "Personality & Behavior",
          "Friends & Social Life", "Talking & Thinking", "Describing Things", "Business & Economy",
          "Society, Law & Politics", "Science & Technology", "Culture, History & Arts",
          "Linking & Abstract Words", "Idioms & Formal Expressions"]
QUESTION_WORDS = {"什么", "谁", "哪", "哪儿", "几", "多少", "怎么", "怎么样", "为什么"}
CORE_WORDS = {"是", "有", "在", "要", "的", "了", "吗", "呢", "吧", "不", "没", "很", "也", "都",
              "和", "太", "还", "就", "没有", "一点儿"}
# A core headword with more than one card counts only in this reading, so 还 hái (still) counts and 还 huán (return) does not.
CORE_READINGS = {"还": "hai2"}
MAX_THEME, MIN_THEME = 350, 40
# Theme number 1 is the Starter Kit, whose words step 6b places by rule. Like every theme it
# needs at least MIN_THEME words.
STARTER_NO = 1
BATCH_COLUMNS = ["id", "hz", "py", "lv", "pos", "en"]
OUTPUT_COLUMNS = ["id", "hz", "theme_no", "confidence", "alt_theme_no", "note"]


def is_starter(word):
    """The Starter Kit rule, which admits an HSK 1 or 2 word that is a pronoun, a question word, or one of
    the core words 是 有 在 要 的 了 吗 呢 吧 不 没 很 也 都 和 太 还 就 没有 一点儿.

    A core word with two cards counts only in the reading CORE_READINGS gives, so 还 hái
    (still) is in and 还 huán (to return) is not.
    """
    core = word["hz"] in CORE_WORDS and CORE_READINGS.get(word["hz"], word.get("pyNum")) == word.get("pyNum")
    return word["lv"] <= 2 and ("pron." in word["pos"] or word["hz"] in QUESTION_WORDS or core)


def batch_rows(words):
    """One input row per word, in BATCH_COLUMNS order, with pos labels joined by spaces."""
    return [[w["id"], w["hz"], w["py"], w["lv"], " ".join(w["pos"]), w["en"]] for w in words]


def chunks(items, size):
    """Consecutive pieces of at most `size` items, so 5 items with size 2 give pieces of 2, 2 and 1."""
    return [items[i:i + size] for i in range(0, len(items), size)]


def check_output(inputs, outputs, first_theme=2):
    """Problems in one batch agent's output, compared with its input rows.

    inputs and outputs are lists of dicts (CSV rows). Each input id must appear exactly once,
    with the same hz, a theme_no from first_theme to 30, a confidence of H, M or L, and an
    alt_theme_no that is empty or a theme number. Returns a list of problem strings.
    """
    problems = []
    want = {r["id"]: r["hz"] for r in inputs}
    seen = {}
    for r in outputs:
        rid = (r.get("id") or "").strip()
        seen[rid] = seen.get(rid, 0) + 1
        if rid not in want:
            problems.append(f"{rid}: not in the input")
            continue
        if (r.get("hz") or "").strip() != want[rid]:
            problems.append(f"{rid}: hz {r.get('hz')!r} differs from the input {want[rid]!r}")
        theme = (r.get("theme_no") or "").strip()
        if not theme.isdigit() or not first_theme <= int(theme) <= len(THEMES):
            problems.append(f"{rid}: theme_no {theme!r} is not {first_theme} to {len(THEMES)}")
        if (r.get("confidence") or "").strip() not in ("H", "M", "L"):
            problems.append(f"{rid}: confidence {r.get('confidence')!r} is not H, M or L")
        alt = (r.get("alt_theme_no") or "").strip()
        if alt and (not alt.isdigit() or not 1 <= int(alt) <= len(THEMES)):
            problems.append(f"{rid}: alt_theme_no {alt!r} is not a theme number")
    problems += [f"{rid}: classified {n} times" for rid, n in seen.items() if n > 1 and rid in want]
    problems += [f"{rid}: missing" for rid in want if rid not in seen]
    return problems


def second_opinion_flags(main, second):
    """Ids where the independent checker disagrees with the batch agent.

    main and second map id to (theme_no, alt_theme_no) as strings. A disagreement counts only
    when neither agent's first choice is the other's first or second choice.
    """
    flags = {}
    for rid, (theme2, alt2) in second.items():
        theme1, alt1 = main[rid]
        if theme1 != theme2 and theme1 != alt2 and theme2 != alt1:
            flags[rid] = theme2
    return flags


def split_by_level(words):
    """Split one theme's words, already in curriculum order, into parts of at most MAX_THEME.

    The parts are as equal as possible and keep the order, so the first part holds the
    lowest levels. 700 words give two parts of 350; 351 words give parts of 176 and 175.
    """
    parts = math.ceil(len(words) / MAX_THEME) or 1
    base, extra = divmod(len(words), parts)
    out, start = [], 0
    for i in range(parts):
        size = base + (1 if i < extra else 0)
        out.append(words[start:start + size])
        start += size
    return out


def curriculum(words, theme_of, theme_order, theme_names):
    """Themes in study order with their words, split into parts where needed.

    words: word dicts with "id", "lv" and "freq". theme_of: {id: theme_no}.
    theme_order: theme numbers in the order they are studied. theme_names: {theme_no: name}.
    Returns [(theme_no, name, [word, ...])]. Inside a theme, words go by HSK level, then by
    frequency (a smaller number is more common), then by id. Themes with no words are left out.
    """
    out = []
    for no in theme_order:
        members = sorted((w for w in words if theme_of[w["id"]] == no),
                         key=lambda w: (w["lv"], w["freq"], w["id"]))
        if not members:
            continue
        parts = split_by_level(members)
        for i, part in enumerate(parts, start=1):
            name = theme_names[no] + (f" (Part {i})" if len(parts) > 1 else "")
            out.append((no, name, part))
    return out
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_themes.py -q`
Expected: `9 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/themes.py tests/test_themes.py && git commit -F - <<'EOF'
feat: themes, Starter Kit rule, answer checks and theme parts

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 9: Prepare the theme batches (`tools/06_themes_prepare.py`)

**Files:**
- Create: `tools/06_themes_prepare.py`
- Output: `data/build/theme_batches_v001/` (`starter.csv`, `batch_001.csv` to `batch_041.csv`, `check_sample.csv`)

- [ ] **Step 1: Write `tools/06_themes_prepare.py`**

```python
"""Step 6. Prepare the theme batches for the Claude batch agents.

Input:   data/build/wordlist_vNNN.jsonl (latest)
Outputs: data/build/theme_batches_vNNN/ with
           starter.csv          the Starter Kit words, placed by rule (id, hz)
           batch_001.csv ...    125 words each for the batch agents (id, hz, py, lv, pos, en)
           check_sample.csv     250 random words for the independent second-opinion agent
The agents write their answers to data/claude/themes_vNNN/ with the same NNN
(batch_001_v001.csv ..., check_v001.csv), columns id, hz, theme_no, confidence, alt_theme_no, note.
"""
import random
from pathlib import Path

from common import latest_version_path, next_version_path, read_jsonl, write_new_csv
from themes import BATCH_COLUMNS, batch_rows, chunks, is_starter

BATCH_SIZE = 125
SAMPLE_SIZE = 250


def main():
    words = read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))
    starter = [w for w in words if is_starter(w)]
    rest = [w for w in words if not is_starter(w)]
    folder = next_version_path("data/build/theme_batches", "")
    folder.mkdir()
    write_new_csv(folder / "starter.csv", ["id", "hz"], [[w["id"], w["hz"]] for w in starter])
    batches = chunks(rest, BATCH_SIZE)
    for n, batch in enumerate(batches, start=1):
        write_new_csv(folder / f"batch_{n:03d}.csv", BATCH_COLUMNS, batch_rows(batch))
    sample = sorted(random.Random(6).sample(rest, SAMPLE_SIZE), key=lambda w: w["id"])
    write_new_csv(folder / "check_sample.csv", BATCH_COLUMNS, batch_rows(sample))
    answers = Path("data/claude") / folder.name.replace("theme_batches", "themes")
    print(f"Starter Kit by rule: {len(starter)} words: {' '.join(w['hz'] for w in starter)}")
    print(f"{len(rest)} words in {len(batches)} batches and a second-opinion sample of {SAMPLE_SIZE} in {folder}")
    print(f"Agents write their answers to {answers}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `PYTHONIOENCODING=utf-8 python tools/06_themes_prepare.py`
Expected:
```
Starter Kit by rule: 40 words: 的 了 我 是 你 在 不 有 他 这 和 我们 都 很 她 没有 那 什么 没 吗 太 呢 怎么 谁 几 多少 哪 怎么样 哪儿 一点儿 就 要 也 还 吧 它 大家 为什么 每 您
5003 words in 41 batches and a second-opinion sample of 250 in data\build\theme_batches_v001
Agents write their answers to data\claude\themes_v001
```

- [ ] **Step 3: Commit**

```bash
git add tools/06_themes_prepare.py && git commit -F - <<'EOF'
feat: prepare theme batches for the batch agents

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 10: Sort the words into themes (multi-agent workflow)

**Files:**
- Create (by the agents): `data/claude/themes_v001/batch_001_v001.csv` to `batch_041_v001.csv`, `data/claude/themes_v001/check_v001.csv`

This step is done by Claude subagents, not by a script. The instructions below are this step's code, so give them to each agent word for word, with only the two file paths filled in. The workflow runs as follows.
1. **Batch agents.** Start one fresh agent per `batch_KKK.csv`, at most 8 at a time. Each gets the batch instructions with `{input}` = `data/build/theme_batches_v001/batch_KKK.csv` and `{output}` = `data/claude/themes_v001/batch_KKK_v001.csv`.
2. **The independent second-opinion agent.** Start one more fresh agent with the same instructions, `{input}` = `data/build/theme_batches_v001/check_sample.csv` and `{output}` = `data/claude/themes_v001/check_v001.csv`. It must not see any batch agent's answers. Step 6b compares its choices with the batch agents' and flags real disagreements for the user.
3. **Merge.** When all agents have finished, run Task 11 Step 2.
4. **Redo.** For every batch the merge names, start a fresh agent with the same instructions, plus the extra paragraph at the end filled with that batch's problem lines from the merge output. It writes the next version, for example `batch_007_v002.csv`. Never edit or delete an earlier answer file. Repeat the merge.
5. **Limit.** After three redo rounds for the same batch, stop and ask the user.

The batch instructions (the text between the two lines of dashes):

------------------------------------------------------------
You are sorting Chinese vocabulary cards into daily-life themes for a flashcard app. The learner is an English-speaking adult beginner who studies one theme at a time.

Read the input file {input}. It is a UTF-8 CSV with the columns id, hz (the Chinese word), py (its pinyin), lv (its HSK level, 1 to 6), pos (part-of-speech labels) and en (the English meaning shown on the card).

Write the output file {output} as a UTF-8 CSV with exactly this header line:
id,hz,theme_no,confidence,alt_theme_no,note
Write one row per input row, in the input order. Copy id and hz exactly. Quote a note that contains a comma.

Choose theme_no from 2 to 30. Theme 1 (Starter Kit) is filled by a fixed rule, so never use 1.
2 Greetings & Courtesy: hello, goodbye, thanks, apologies, polite phrases, introducing yourself.
3 Numbers & Measure Words: numbers, counting, measure words such as 个 本 张, amounts, percentages, units.
4 Time & Dates: clock time, days, weeks, months, years, earlier and later, how often.
5 Family & People: family members, kinds of people (man, child, neighbour), age, birth, marriage.
6 Food & Drink: food, drinks, cooking, tastes, meals, restaurants, tableware.
7 Shopping & Money: buying and selling, prices, money, shops, paying.
8 Home & Housework: rooms, furniture, household things, cleaning, repairs, moving house.
9 Daily Routine: getting up, washing, sleeping, and everyday actions such as take, put, open, wait.
10 Body & Health: body parts, illness, doctors, hospitals, medicine, injuries, fitness.
11 Clothes & Appearance: clothes, shoes, accessories, looks, hair, make-up.
12 Transport & Travel: vehicles, roads, tickets, trips, hotels, luggage, tourism.
13 Places & Directions: buildings, cities, countries, left and right, near and far, position words.
14 Weather & Seasons: weather, temperature, seasons, climate.
15 Nature & Animals: animals, plants, landscape, the environment, natural resources and disasters.
16 School & Study: school, subjects, exams, learning, reading and writing, languages.
17 Work & Office: jobs, the workplace, colleagues, meetings, careers.
18 Phone, Internet & Media: phones, computers, the internet, TV, news, newspapers, advertising.
19 Hobbies & Sports: sports, games, music and films as pastimes, leisure activities.
20 Feelings: emotions and moods (happy, angry, worried, afraid, surprised).
21 Personality & Behavior: character traits, manners, attitudes, good and bad conduct.
22 Friends & Social Life: friendship, parties, invitations, dating, helping each other, relationships.
23 Talking & Thinking: say, ask, explain, discuss, think, believe, decide, remember, opinions.
24 Describing Things: size, shape, colour, quality and state words, and comparisons, when not tied to one topic.
25 Business & Economy: companies, trade, markets, finance, industry, production.
26 Society, Law & Politics: government, law, police, crime, rights, the army, social issues.
27 Science & Technology: science, research, technology, engineering, mathematics, space.
28 Culture, History & Arts: history, traditions, festivals, religion, literature, art, philosophy.
29 Linking & Abstract Words: conjunctions, prepositions, particles, grammar adverbs such as 已经 就 才, and abstract words that fit no topic, such as 情况 方法 发生 变成.
30 Idioms & Formal Expressions: four-character idioms (chengyu), set phrases, and formal or literary words used mainly in writing.

Rules:
1. Choose the theme where a learner would most naturally meet the word in daily life. Decide by the card's English meaning in en, because a character can have other meanings.
2. A concrete word goes to its topic even if it can also be used figuratively, so 苹果 goes to 6, 医院 to 10 and 电脑 to 18.
3. An idiom or set phrase that clearly belongs to a topic goes to that topic (一路平安 goes to 12). Otherwise it goes to 30.
4. Use 29 only when no topic fits. Use 24 for describing words that are not tied to one topic.
5. confidence is H when the theme is clear, M when two themes fit about equally well, and L when you are unsure or no theme fits well.
6. For M and L rows, write your second choice in alt_theme_no. For H rows leave it empty.
7. note is optional and only for L rows. It says why, in at most 60 characters.

Do not skip, merge or add rows. Do not read, create or change any other file. When you have finished, reply with one line: the number of rows written and the counts of H, M and L.
------------------------------------------------------------

The extra paragraph for a redo agent (append it to the instructions above):

------------------------------------------------------------
An earlier attempt at this batch was rejected for these problems:
{problem lines for this batch, one per line}
Write a complete new answer file for the whole batch, avoiding these problems.
------------------------------------------------------------

- [ ] **Step 1: Run the 41 batch agents and the second-opinion agent as described above**

- [ ] **Step 2: Confirm every answer file exists**

Run: `ls data/claude/themes_v001 | wc -l`
Expected: `42`

---

### Task 11: Check the answers and write the review spreadsheet (`tools/06b_themes_merge.py`)

**Files:**
- Create: `tools/06b_themes_merge.py`
- Output: `data/review/themes_review_v001.csv`, `data/review/theme_list_v001.csv`, `data/reports/themes_v001.txt`

The review sheet has one row per word, sorted by theme and then level, and it opens in Excel with correct Chinese because it starts with a byte-order mark (the invisible marker that tells Excel the file is UTF-8). A row is flagged `CHECK` when the agent's confidence was L, or when the second-opinion agent disagreed. In that case `second_opinion` holds the other agent's theme number.

- [ ] **Step 1: Write `tools/06b_themes_merge.py`**

```python
"""Step 6b. Check the batch agents' theme choices and write the review spreadsheet.

Inputs:  data/build/theme_batches_vNNN/ (latest) and the answers in data/claude/themes_vNNN/
         (for each batch_KKK.csv the latest batch_KKK_vMMM.csv, and the latest check_vMMM.csv)
Outputs: data/review/themes_review_vRRR.csv  one row per word, sorted by theme then level, opens in Excel
         data/review/theme_list_vRRR.csv     the 30 themes with their order, names and word counts
         data/reports/themes_vRRR.txt        theme sizes, flags and the second-opinion agreement
Nothing is written while any batch is missing or has problems; the batches to redo are listed.
"""
import sys
from collections import Counter
from pathlib import Path

from common import (all_version_paths, latest_version_path, next_versions, read_csv, read_jsonl, write_new_csv,
                    write_new_text)
from themes import MAX_THEME, MIN_THEME, STARTER_NO, THEMES, check_output, second_opinion_flags

REVIEW_COLUMNS = ["id", "hz", "py", "lv", "en", "theme_no", "theme_name", "confidence", "flag",
                  "alt_theme_no", "second_opinion", "note"]


def latest_answer(folder, stem):
    found = all_version_paths(folder / stem, ".csv")
    return read_csv(found[-1][1]) if found else None


def main():
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    batches = latest_version_path("data/build/theme_batches", "")
    answers = Path("data/claude") / batches.name.replace("theme_batches", "themes")
    chosen, problems, redo = {}, [], []
    for batch in sorted(batches.glob("batch_*.csv")):
        rows = latest_answer(answers, batch.stem)
        found = check_output(read_csv(batch), rows) if rows is not None else ["no answer file"]
        if found:
            redo.append(batch.stem)
            problems += [f"{batch.stem}: {p}" for p in found[:10]]
            continue
        chosen.update({r["id"]: r for r in rows})
    sample = read_csv(batches / "check_sample.csv")
    second_rows = latest_answer(answers, "check")
    found = check_output(sample, second_rows) if second_rows is not None else ["no answer file"]
    if found:
        redo.append("check")
        problems += [f"check: {p}" for p in found[:10]]
    if problems:
        sys.exit("Stopped, nothing written. Redo these batches: " + " ".join(redo) + "\n  " + "\n  ".join(problems))

    for r in read_csv(batches / "starter.csv"):
        chosen[r["id"]] = {"id": r["id"], "theme_no": str(STARTER_NO), "confidence": "H", "alt_theme_no": "",
                           "note": "Starter Kit rule"}
    missing = sorted(set(words) - set(chosen))
    if missing:
        sys.exit(f"Stopped, nothing written. {len(missing)} words are in no batch, for example {missing[:5]}.")
    main_choice = {rid: (r["theme_no"].strip(), r["alt_theme_no"].strip()) for rid, r in chosen.items()}
    flags = second_opinion_flags(main_choice, {r["id"]: (r["theme_no"].strip(), r["alt_theme_no"].strip())
                                               for r in second_rows})
    rows = []
    for rid, r in chosen.items():
        w, no = words[rid], int(r["theme_no"])
        conf = r["confidence"].strip()
        flag = "CHECK" if conf == "L" or rid in flags else ""
        rows.append([rid, w["hz"], w["py"], w["lv"], w["en"], no, THEMES[no - 1], conf, flag,
                     r["alt_theme_no"].strip(), flags.get(rid, ""), r.get("note", "").strip()])
    rows.sort(key=lambda row: (row[5], row[3], words[row[0]]["freq"], row[0]))
    sizes = Counter(row[5] for row in rows)

    paths = next_versions(review=("data/review/themes_review", ".csv"), themes=("data/review/theme_list", ".csv"),
                          report=("data/reports/themes", ".txt"))
    write_new_csv(paths["review"], REVIEW_COLUMNS, rows, excel=True)
    write_new_csv(paths["themes"], ["theme_no", "order", "name", "words"],
                  [[n, n, name, sizes.get(n, 0)] for n, name in enumerate(THEMES, start=1)], excel=True)
    agree = len(second_rows) - len(flags)
    conf = Counter(row[7] for row in rows)
    lines = ["Theme report", "",
             f"Words: {len(rows)}. Confidence: H {conf['H']}, M {conf['M']}, L {conf['L']}.",
             f"Second opinion: agrees on {agree} of {len(second_rows)} sampled words "
             f"({100 * agree / len(second_rows):.0f}%).",
             f"Rows flagged CHECK (low confidence or a second-opinion disagreement): "
             f"{sum(1 for row in rows if row[8])}", "", "Theme sizes (limits: at least 40, at most 350 per part):"]
    for n, name in enumerate(THEMES, start=1):
        size = sizes.get(n, 0)
        note = (f"  will be split into {-(-size // MAX_THEME)} parts" if size > MAX_THEME
                else "  below 40" if size < MIN_THEME else "")
        lines.append(f"  {n:2d}. {name}: {size}{note}")
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"Review sheet: {paths['review']}. Theme list: {paths['themes']}. Report: {paths['report']}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `PYTHONIOENCODING=utf-8 python tools/06b_themes_merge.py`
Expected: a report that starts `Words: 5043. Confidence: H ...`, gives the second-opinion agreement as a percentage, lists 30 theme sizes (theme 1 shows `1. Starter Kit: 40` with no note), and ends with `Review sheet: data\review\themes_review_v001.csv. ...`. If it stops with `Redo these batches: ...`, go back to Task 10 step 4 for exactly those batches.

- [ ] **Step 3: Confirm the byte-order mark**

Run: `head -c 3 data/review/themes_review_v001.csv | od -An -tx1`
Expected: ` ef bb bf`

- [ ] **Step 4: Commit the script, the agents' answers and the review sheets**

```bash
git add tools/06b_themes_merge.py data/claude/themes_v001 data/review/themes_review_v001.csv data/review/theme_list_v001.csv && git commit -F - <<'EOF'
feat: merge theme answers and write the review spreadsheet

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 12: Checkpoint with the user (theme review in Excel)

- [ ] **Step 1: Run the full test suite**

Run: `python -m pytest tests -q`
Expected: `131 passed` (the 69 from Plan 1 plus 21 + 7 + 13 + 2 + 10 + 9 from this plan).

- [ ] **Step 2: Report to the user in plain language and hand over the review**

Give these facts from `data/reports/wordlist_v001.txt` and `data/reports/themes_v001.txt`:
- the number of cards (5,043) and how many come from the PDFs, how many only from the public list and how many are second readings;
- the Starter Kit's 40 words under the widened rule, and that it now needs at least 40 words like every theme;
- how the card pinyin is spaced (the counts from the PDFs, the four-character forms and jieba in the word list report), the spacing lists of Task 7 Step 7, and Open decision 4. Show every row of `data/manual/four_char_words_v001.csv` grouped by form, each with its `py`, and say that Claude form agents chose them following the textbook rules, with CC-CEDICT's idiom mark as a hint only, so an idiom that does not divide into two pairs is joined (总而言之 "zǒng'éryánzhī"). Ask whether any word should take another form or another division into words;
- the pinyin style sheet's nine fixed choices (the section near the top of this plan), and that card `py` follows them, with 正月 now "zhēngyuè";
- the cards written with a capital (Task 7 Step 7), and Open decision 5. Ask which of the 10 cards that the style sheet does not settle (the six festivals, 国务院, 摄氏度, 华裔 and 华侨) should be in lower case, and whether the sentence words 春节, 联合国, 奥运会 and 道教 should keep their capital;
- the 29 reading choices, and that the user can ask for a second card, for example 当 dàng;
- the 8 public-only words whose meaning was written by hand (当 露 系 抢 哈 片 匹 正) and the 42 PDF meanings repaired by hand, which the user can check in the review sheet's `en` column;
- the 3 second readings (长 zhǎng, 得 dé, 得 děi) and the open decision about which of them count;
- the theme sizes, which themes will be split into parts, and which are below 40;
- how many rows are flagged `CHECK`, and the second-opinion agreement rate.

Then give these instructions word for word:

> Open `data/review/themes_review_v001.csv` in Excel. Each row is one word. To move a word to another theme, change its **theme_no** (the number from 1 to 30); the theme_name column is only there to read and is ignored. Rows marked CHECK are the ones the sorting was least sure about, so look at those first. When you are done, choose File, Save As, pick the type **"CSV UTF-8 (Comma delimited) (*.csv)"**, and save it as `data/manual/themes_reviewed_v001.csv`. The plain "CSV (Comma delimited)" type would damage the Chinese characters.
>
> To rename or reorder themes, open `data/review/theme_list_v001.csv`, change **name** or **order** (keep theme_no as it is), and save it the same way as `data/manual/theme_list_reviewed_v001.csv`. If you do not change the theme list, you do not need to save a copy of it.
>
> A theme needs at least 40 words after your changes, the Starter Kit included. The Starter Kit has exactly 40, so if you move a word out of it, move another word into it. Themes over 350 words are split into parts automatically.

- [ ] **Step 3: Record the answers to Open decisions 4 and 5**

If the user keeps both as they are, skip this step. Otherwise:
1. Copy `data/manual/four_char_words_v001.csv` to `data/manual/four_char_words_v002.csv` and change the rows the user names. `form` is idiom, words or joined, and for words the `words` column lists the words, separated by spaces, that spell the headword. Every four-character headword without printed spacing has a row there, CC-CEDICT idioms included, so a change is always an edit of its row. Copy `data/manual/capitals_v001.csv` to `data/manual/capitals_v002.csv` and set `capital` to N for each word the user wants in lower case.
2. Run: `PYTHONIOENCODING=utf-8 python tools/05_build_wordlist.py`
   Expected: the counts of Task 7 Step 6, with `IDs kept from the frozen file: 5043. New IDs: 0`, except that the three form counts in the spacing line move by the rows the user changed, and `Cards written with a capital` falls, and `In lower case although the public list has a capital` rises, by the number of card rows set to N in `capitals`. The report lists the forms again. Only `py` changes, so the theme review is not affected, and Plan 3b uses the newest word list.
3. Commit:
```bash
git add data/manual/four_char_words_v*.csv data/manual/capitals_v*.csv && git commit -F - <<'EOF'
data: the user's answers on four-character words and capitals

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

- [ ] **Step 4: Wait for the user's reviewed file before starting Plan 3b**

Plan 3b starts with `tools/06c_themes_finalize.py`, which reads `data/manual/themes_reviewed_v001.csv`.

---

## Self-review

| Spec or task requirement | Where |
|---|---|
| Every PDF word plus every public HSK 2.0 word the PDFs lack, each once, at the lowest level in either source | Task 5 (`pdf_words`, `public_only_words`, `level_of`), Task 7 |
| Headwords from the decoded glyphs (cidmap v004, pdf_entries v002), not from the pinyin match | Task 5 (`decode_cids(match_head(...))`), Task 7 |
| One card per word and pronunciation (长 cháng and 长 zhǎng separate) | Task 5 (key = headword + reading, `second_readings`), Task 6 (`second_readings_v001.csv`), Facts (second readings) |
| Every HSK 2.0 public-list word the PDFs lack, including a second reading the list records separately | Task 5 (`public_only_words`, `second_readings`), Task 6, Open decision 3 |
| Pattern words with two ～ | Task 6 (headword with "…"), Task 2 (`fill_placeholder`), Task 1 (`card_py` with "…" joints) |
| Wrapped headwords 致力于, 拔苗助长, 总而言之 | Task 6 (headword and repaired sentence) |
| Cut pinyin (窗帘, 水龙头) and differing PDF pinyin (湖泊, 开拓, 泄露, 嗯) | Task 6 |
| ASCII ~ | Task 2 (`inline_text` turns ~ into ～) |
| 那（那儿） and 这（这儿） | `decode.match_head` in Task 5, clean gloss in Task 6, ～ filled with 那 or 这 in Task 2 |
| Contradicted entries | Task 5 (headword from glyphs, reading matched on that headword) |
| HSK4 entry 677 gap | Facts (弹, 当, 当地 are public-only cards), Task 6 (readings of 弹 and 当) |
| HSK5 H to Z without PDF entries | Task 5 (`public_only_words`: 878 HSK5 words) |
| Missing words (踢足球, 黄河 and the rest) | Task 6 |
| Multi-sense entries | Task 2 (`split_senses`), Task 5 (senses pooled per card) |
| Permanent IDs, frozen in a file, later builds only append | Task 4, Task 7 (`data/ids/word_ids_vNNN.csv`) |
| Part-of-speech labels | Task 3 (`split_pos`, `public_pos`), Task 7 |
| en at most 3 senses and 80 characters, enShort at most 30, PDF gloss first, else CC-CEDICT cleaned | Task 3 (`fit_en`, `en_short`, `cedict_senses`, which also removes sound notes, pronunciation notes, variants and Chinese characters), Task 5 (`english`, `public_readings`) |
| No part-of-speech label left inside a meaning (the separable-verb label "sv.", "/vm.") | Task 3 (`split_pos`, `LEFTOVER_LABEL`), checked in Plan 3b Task 18 |
| PDF glosses repaired: colons between senses, missing spaces, misspellings and junk text | Task 3 (`split_pos`, `clean_gloss`, `senses_of`), Task 5 (`apply_gloss_fixes`), Task 6 (`gloss_fixes_v001.csv`), Task 7 (review list from `unknown_words`) |
| No slang, old or colloquial labels on a beginner's card; literary and dialect senses last | Task 3 (`cedict_senses`) |
| A public-only word uses the everyday reading, not a capitalised name (哈 hā, 露 lù) | Task 5 (`public_only_words`) |
| A public-only word shows the meaning HSK teaches when CC-CEDICT lists others first (露 lù "to reveal", 系 xì "department") | Task 5 (`public_only_words`, `_with_row`), Task 6 (`pos` and `gloss` in `public_readings_v001.csv`) |
| `pyNum` in dictionary tones, tone changes only in `py`, the 儿 ending as `r5` not counted in `syl` (schema file) | Task 7 (`card_pinyin`), `words-json-schema.md` |
| The 儿 ending of 纽扣儿, which the public list writes "er", is `r5` like every other 儿 ending, before the IDs are first frozen | Task 1 (`join_erhua`), Task 5 (`public_readings`), Task 6 (`gloss_fixes_v001.csv` key), Facts; checked in Plan 3b Task 18 |
| The capital of `py` follows the HSK 1 to 4 PDFs' print where its spacing does (互联网 "hùliánwǎng"), and every capitalised card is listed for the user | Task 1 (`printed_pinyin`), Task 7 (`card_pinyin`, report), Open decision 5 |
| Card `py` follows points 5 to 8 of the pinyin style sheet, so a card that is a potential complement stays one word in its printed or listed form ("kànbuqǐ"), numbers are written as GB/T 16159-2012 6.1.5 writes them ("bǎifēnzhī", "dì-yī"), common nouns such as the month name 正月 are in lower case, and the 一 and 不 tone changes are written as spoken | Task 1 (`headword_joints`, `test_card_pinyin_follows_the_style_sheet`), Task 6 (`capitals_v001.csv`), Task 7 (form rule 3 with 十几 and 几十), Facts (sixth revision), Open decision 5 |
| The 30 themes in the spec's order | Task 8 (`THEMES`) |
| Starter Kit rule, widened on 2026-09-28 with 和 太 还 (hái only) 就 没有 一点儿 to 40 words, with no exemption from the 40-word minimum | Task 8 (`is_starter`, `CORE_READINGS`), Task 9 (placed by rule, not by an agent), Facts, Open decision 1 |
| Card `py` in textbook word spacing, with words joined, spaces between words, apostrophes before a, o, e inside a word and 儿 joined | Task 1 (`card_py`, `headword_joints`), Task 7 (`card_pinyin`), Facts (spacing counts) |
| Four-character words in the three forms of the textbook rules (an idiom that divides into two pairs AB-CD, a compound as separate words, and joined for a single word, an idiom that does not divide into two pairs or a doubled AABB word, as GB/T 16159-2012 writes them) | Task 1 (`form_joints`, `form_rows`, `headword_joints` with a form), Task 7 (`card_pinyin`), Open decision 4, Facts (third cross-review) |
| The forms decided per word by Claude form agents with exact instructions, for every four-character headword without printed spacing, with CC-CEDICT's idiom mark as a hint only, answers checked by a script, and every row reviewed by the user | Task 1 (`check_form_answers`), Task 7 (Steps 3 to 6 with the instructions and `05b_four_char_merge.py`), Task 12 (Steps 2 and 3), and Plan 3b's step 8 for the sentences |
| A person's name written with the surname apart from the given name, each with a capital, and a title apart in lower case | Task 1 (`capitalise`, `name_rows`), Task 6 (the `words` column of `capitals_v001.csv`), Task 7 (`card_pinyin`), and Plan 3b Task 11 |
| An answer to Open decision 4 or 5 only means editing a file, with no code change, and a word without a form or a capital row stops the build | Task 6 (Step 5), Task 7 (`card_pinyin` and the stops), Task 12 (Step 3) |
| Textbook pinyin printed in the HSK 1 to 4 PDFs used where its syllables fit the card reading; jieba otherwise, with its install step | Task 1 (`pdf_pinyin`), Task 5 (`latin`), Task 7 Steps 1 and 2 |
| A check that `py` fits `pyNum` once the 一 and 不 tone changes are removed and uses only spaces, hyphens and apostrophes | Task 1 (`py_problems`), run by Plan 3b's validator on every card |
| Theme classification by Claude in batches, with input and output formats and exact instructions | Task 9 (input), Task 10 (instructions, workflow, redo rule) |
| Merge checks every word classified exactly once with confidence H, M or L | Task 8 (`check_output`), Task 11 |
| Independent checker | Task 10 (second-opinion agent), Task 11 (`second_opinion_flags`) |
| Review spreadsheet with a byte-order mark, sorted by theme then level, low-confidence rows flagged | Task 11 |
| The user saves an edited copy under a new name | Task 12 |
| Outputs never overwritten, relative paths, docs/ untouched | Every script uses `common.next_versions` or `next_version_path` and the `write_new_*` writers; no script writes to `docs/` |
| Python tests for pinyin clean-up and never-overwrite naming | Task 1 (pinyin formats); never-overwrite naming is already tested in Plan 1 (`tests/test_common.py`) |

Left deliberately to Plan 3b (`2026-09-27-plan3b-sentences-audio.md`):
- applying the user's review;
- splitting themes over 350 words and the curriculum order (`ord`), whose functions are written and tested here in Task 8;
- the `noDistract` lists;
- sentences, translations, the independent sentence check and the user's 50-translation spot-check;
- sentence pinyin, spaced like the cards, drafted by rules and then corrected by Claude agents against the pinyin style sheet with a strict checker;
- audio;
- the words JSON file;
- validation;
- `ATTRIBUTION.md`.

Left to other plans:
- the app code that reads `docs/data/words_vNNN.json`, including how it finds the newest version (Plan 4);
- deployment (Plan 5).
