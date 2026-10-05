# The app's word data file: shared contract between Plan 2 (app logic) and Plan 3 (word list)

Plan 3 writes `docs/data/words_vNNN.json`, and the app reads it. Every field below is required unless it is marked optional.

```json
{
  "version": "v001",
  "generated": "2026-10-05",
  "license": "Meanings adapted from CC-CEDICT (CC BY-SA 4.0) via drkameleon/complete-hsk-vocabulary (MIT). Example sentences: see ATTRIBUTION.md.",
  "themes": [
    {"id": "t01", "order": 1, "name": "Starter Kit", "count": 40}
  ],
  "words": [
    {
      "id": "w0001",
      "hz": "爱",
      "py": "ài",
      "pyNum": "ai4",
      "pyBase": "ai",
      "syl": 1,
      "lv": 1,
      "pos": ["v."],
      "en": "to love; to like",
      "enShort": "to love",
      "theme": "t20",
      "ord": 1234,
      "au": "w/w0001_3fa2b1c9.mp3",
      "noDistract": ["w0412"],
      "ex": {
        "hz": "我爱我的家。",
        "py": "wǒ ài wǒ de jiā.",
        "en": "I love my home.",
        "au": "s/w0001_91ab22c0.mp3",
        "src": "pdf"
      }
    }
  ]
}
```

## Field meanings

| Field | Meaning |
|---|---|
| `id` | Permanent word ID. It never changes between builds, and new words only get new IDs appended. |
| `hz` | Simplified characters. |
| `py` | Tone-marked pinyin in textbook word spacing (the 汉语拼音正词法 rules), described in the sections "Pinyin style sheet" and "Word spacing in `py`" below ("píngguǒ", "bú kèqi", "bámiáo-zhùzhǎng"). It is the only field that shows the tone changes of 一 and 不 that textbooks print (不客气 "bú kèqi", 一下 "yíxià", and the neutral bu of 受不了 "shòubuliǎo"). Its syllables spell `pyNum` with the same tones once those tone changes are removed. |
| `pyNum` | Numbered pinyin in dictionary tones, one syllable per space ("ping2 guo3"). It never shows the 一 and 不 tone changes, so 不客气 is "bu4 ke4 qi5" and 一下 is "yi1 xia4". Tone 5 is the neutral tone. The 儿 ending that joins the syllable before it is its own item "r5", so 一点儿 is "yi1 dian3 r5". A word of more than one character that ends in a neutral 儿 always ends in "r5", never "er5", so 纽扣儿 is "niu3 kou4 r5" although the public list writes it "niǔ kòu er". A 儿 with its own tone is a full syllable, as in 女儿 "nü3 er2". |
| `pyBase` | Toneless pinyin, lower case, no spaces, with ü kept ("pingguo", "lü", "yidianr"). |
| `syl` | Number of syllables, which is the number of items in `pyNum` that are not "r5". So 一点儿 has `syl` 2, while it has 3 items in `pyNum` and 3 characters in `hz`. For every word without the 儿 ending, `syl` equals the number of `pyNum` items. |
| `lv` | HSK 2.0 level 1 to 6, the lowest level at which the word appears in either source. |
| `pos` | Part-of-speech labels as short strings ("n.", "v.", "adj.", "adv.", "m.", "pron.", "prep.", "conj.", "part.", "num.", "int."). It can be an empty list. |
| `en` | Card meaning, at most 3 senses and 80 characters. |
| `enShort` | Quiz-choice meaning, at most 30 characters. |
| `theme` | ID of a theme in `themes`. |
| `ord` | Global curriculum position, from 1 to N. Every word has exactly one position. The order is level first, then theme (the user's decision of 2026-09-29): the level groups HSK 1-2, 3, 4, 5 and 6 come in that order, inside a group the themes come in theme order, and inside one theme of one group the HSK level never goes down. |
| `au` | Word audio path, relative to `docs/audio/`. |
| `noDistract` | Word IDs that must never be offered as wrong quiz choices for this word, because their meanings overlap. It can be an empty list. |
| `ex.hz` | Example sentence, with the headword written out and never ～. |
| `ex.py` | Style-sheet pinyin of the sentence, that is, pinyin written as the section "Pinyin style sheet" below says, in the same word spacing as `py`, with Western punctuation attached and all in lower case, the start of a sentence and names included ("tā zài dǎ diànhuà ne.", 'tā shuō: "nǐ kàn."'). Plan 3b makes it in two stages. A program writes a draft by rules (step 8), and then Claude agents correct every line against the style sheet, while a strict checker (Plan 3b Task 13) accepts a corrected line only when each Chinese character (〇, the zero of years, included) lines up with one syllable that is a known reading of it, tone included, 一 and 不 show the tone changes that a rule settles, the words of points 1 and 2 of the style sheet are one word each, numbers are spaced as point 6 says, a 了 that ends a sentence or a clause stands apart, digits, Latin letters and punctuation are unchanged, the headword is as on its card and no capital letter stands anywhere except in the sentence's own Latin letters ("IT"). The section "How the sheet is applied" below says exactly what it checks. A line that fails its answer and two redos keeps the draft, and the user sees it listed, with a note when the draft itself fails the checker. `ex.py` holds no Chinese character, 〇 included. The headword is written exactly as its card's `py`, except that a 一 or 不 at its end may show another tone change ("bú shì" for the card 不 "bù"). It never takes a capital, not at the start of a sentence and not in a name ("shāndōng shěng" for the card 省, "chángchéng" for the card 长). Its syllables may be a word of their own or stand inside a longer word, as long as they start and end at syllable edges there. That happens when a card word or a word of the public list holds the headword (男 "nán" in "nánrén", 春 "chūn" in "chūntiān"), when a particle, suffix or result joins it ("kànzhe" for the card 看 and for the card 着, "jiàshǐyuán" for 驾驶, "xiěhǎo" for 写), and in a number word (百 "bǎi" in "liǎngbǎi"). A 一 or 不 inside the headword keeps the tone its card shows (受不了 "shòubuliǎo"). No word has a capital (the user's decision of 2026-09-29). |
| `ex.en` | English translation of the sentence. |
| `ex.au` | Sentence audio path, relative to `docs/audio/`. |
| `ex.src` | "pdf" or "claude". |

## Pinyin style sheet

Card `py` and sentence `ex.py` follow this sheet, which the user set on 2026-09-28 and changed on 2026-09-29 in points 7, 8 and 9 (all pinyin in lower case, and the tone change of 一 before every syllable). Where it does not settle a case, these sources decide, in this order:
1. the form that the user's HSK PDFs print (the HSK 1 to 4 PDFs print textbook pinyin with word spacing);
2. a word that is a single entry in the card list or in the public word lists is written joined, as one word;
3. the national standard GB/T 16159-2012 (汉语拼音正词法基本规则, the basic rules of pinyin spelling).

The fixed choices are these.
1. **这 and 那 with a measure word.** 这个, 那个 and 哪个 are "zhège", "nàge" and "nǎge", and 这些 and 那些 are "zhèxiē" and "nàxiē". Before any other measure word, 这, 那 and 哪 are written apart ("zhè běn shū").
2. **Months and weekdays.** Month and weekday names are one word each ("bāyuè", "xīngqīyī"), and a day number stands apart ("bāyuè jiǔ rì").
3. **Aspect particles.** 了, 着 and 过 right after a verb are joined to it ("kànle", "kànzhe", "kànguo"). A 了 at the end of a sentence or a clause stands apart ("zuótiān xià yǔ le.").
4. **Results and directions.** A verb of one syllable and a result or direction complement of one syllable are one word ("xiěhǎo", "shōudào", "liúxià"). A verb of two or more syllables stands apart from such a complement ("bāozhuāng hǎo", "zhuǎnyí dào"), as GB/T 16159-2012 6.1.2.4 writes it, unless the whole form is a card or a word of the public list. A complement of two syllables stands apart ("zǒu jìnlai").
5. **Potential complements** are three words with a neutral bu ("zhǎo bu dào", "tīng bu dǒng", "mǎi bu qǐ"). Cards and list words keep the form the PDFs print or the list gives ("duìbuqǐ", "shòubuliǎo", "láibují", "kànbuqǐ"). Here the list words are the words of the HSK 2.0 list that the cards come from, which are all cards. So a potential complement that only the larger public list has, such as 买不起, is written as three words, as the example "mǎi bu qǐ" shows.
6. **Numbers**, as GB/T 16159-2012 6.1.5 writes them. A number from 11 to 99 is one word ("sānshísān"), and each group of 百, 千, 万 and 亿 stands apart ("yìqiān wǔbǎi"). 几十 and 十几 are one word each ("jǐshí", "shíjǐ"). An approximate pair takes a hyphen ("yì-liǎng"), and so does an ordinal with 第 ("dì-shí"). A numeral stands apart from its measure word ("sān gè rén"). A fraction is written syllable by syllable in a sentence ("sān fēn zhī yī"), while the card 百分之 keeps the PDF's "bǎifēnzhī". A decimal is read digit by digit, and its 一 keeps its first tone ("sān diǎn yī sì").
7. **Names.** On 2026-09-29 the user decided that all pinyin is in lower case, names included. A surname and a given name are still two words ("lǐ míng"), and a title still stands apart ("lǐ lǎoshī", "wáng xiānsheng"). The kind of a place stands apart from its name ("fújiàn shěng", "běijīng shì"). Names of languages, countries and peoples are in lower case too ("hànyǔ", "zhōngguó", "ōuzhōu"), as are common nouns ("xīngqīrì", "měiyuán", "xīfāng") and month names ("zhēngyuè"). So `data/manual/capitals` now only says which words are names and how their words are spaced, and it no longer gives any capital letter.
8. **Tones.** The tone changes of 一 and 不 are written as they are spoken, in `py` and in `ex.py` ("yí gè", "bú shì", "yìqǐ"). Neutral tones are written as the dictionary gives them ("dōngxi", "xiàlai"). On 2026-09-29 the user decided that the checker requires this for 一. A 一 before any following syllable is "yí" before a fourth tone and "yì" before the other tones (一看 "yí kàn", 一听 "yì tīng", 一起 "yìqǐ"). It keeps "yī" only as an ordinal or in counting (第一 "dì-yī", 十一 "shíyī", 一百一十 "yìbǎi yīshí"), in a decimal, in a year or other number read digit by digit ("yī jiǔ jiǔ bā nián"), at the end of a word or phrase (统一 "tǒngyī", 之一), and where it stands alone with no syllable after it. Before a word that may make it an ordinal or a date (一楼 "yī lóu", the first floor) either form passes. A card keeps the tones its `py` shows.
9. **Lower case and punctuation.** Since the user's decision of 2026-09-29 no capital letter is written anywhere, so a sentence and a quotation after a colon start in lower case ("wǒ qù běijīng.", 'tā shuō: "nǐ kàn."'). Only Latin letters that the Chinese sentence itself holds keep their capitals ("IT"). In `ex.py` each Chinese punctuation mark becomes the matching Western mark. 。 becomes ".", ， and 、 become ",", ？ ！ ： and ； become "?", "!", ":" and ";", “ and ” become '"', （ and ） become "(" and ")", …… becomes "...", and the Chinese dash of two long dashes becomes one hyphen with a space on each side (" - ").

**The headword comes first.** In its own sentence, a card's headword keeps the syllables, tones and word spacing its card shows, even where a point above would write it otherwise. Only a 一 or 不 at its end may show its tone change (the card 不 "bù" in "tā bú shì xuésheng."), and it never takes a capital.

**How the sheet is applied.** Plan 3a writes card `py` by it (Tasks 1, 6 and 7). Plan 3b writes a draft of `ex.py` by rules (step 8), Claude agents correct every draft line against this sheet (Plan 3b Task 14), and a strict checker (Plan 3b Task 13) accepts a corrected line only when all of these hold.
- Every Chinese character lines up with one syllable that is a known reading of it, tone included. The known readings are the public list's readings of the character when the list has it as a word of its own, or else pypinyin's, and the readings that longer list words and cards give it. So the rare old readings that pypinyin also knows (他 tuó, 是 tí) do not count, and a neutral tone that the readings lack counts only inside a word ("xuésheng"). 〇, the zero of years (二〇〇八年), counts as a Chinese character whose one reading is líng.
- 一 and 不 show the tone changes of point 8 where one of these rules settles them.
  - 不 is "bú" before a fourth tone and "bù" before the other tones.
  - 一 keeps "yī" in a decimal (point 6), where no syllable follows it, after 第, a numeral, 星期 or 礼拜 ("dì-yī gè", "shíyī gè", "xīngqīyī", "yìbǎi yīshí"), and before another digit, because a year or other number of bare digits is read digit by digit ("yī jiǔ jiǔ bā nián"). Before 百, 千, 万 or 亿, and at the start of a card or list word such as 一定 after 千万, a numeral before it settles nothing.
  - Elsewhere 一 is "yí" before a fourth tone and "yì" before the other tones, and since the user's decision of 2026-09-29 it must show one of these tone changes before every following syllable ("yí gè", "yì nián", "yìqiān", "yí kàn", "yì tīng"). It may keep "yī" where it ends a card or a word of the public list and the line ends the pinyin word there (同一 in "tóngyī gè rén"). The public list writes its words in dictionary tones, so a 一 inside one of its words (一口气) follows the rule above.
  - Nothing is settled before a word that makes 一 an ordinal or a date (一号, 一日, 一班, 一年级, 一级, 一期, 一季度, 一楼, 一层) and before 点 except in 一点儿 and 一点点 (一点 may be one o'clock). Before a neutral tone 一 must still change, and the choice between "yí" and "yì" is left open.
  - A neutral "bu" or "yi" passes only in a doubled word ("kàn yi kàn", "hǎo bu hǎo", "xǐ bu xǐhuan"), in a potential complement after a verb ("zhǎo bu dào", "tīng bu dǒng") and where a card or a word of the public list shows it ("duìbuqǐ", "chàbuduō"). A 一 or 不 inside a card of two or more characters may always show the tone its card shows ("yìqǐ").
- 这个, 那个, 哪个, 这些 and 那些 (point 1), 哪些 (a single entry of the public list, so reference rule 2 joins it) and month and weekday names (point 2) are one word each, except 这个 and 这些 in the sentences of the cards 个 and 些.
- Numbers are spaced as point 6 says, inside and around each run of numerals. 11 to 99 and each group of 百, 千, 万 and 亿 are one word ("shí'èr", "yìqiān wǔbǎi"), the digits of a year stand apart ("èr líng líng bā nián"), and an approximate pair takes a hyphen ("yì-liǎng"). 第 takes a hyphen ("dì-shí"). A numeral stands apart from a measure word after it ("sān gè", "yìqiān yuán"), unless a card or list word holds both (一些, 一下, 一点儿, 十分). A fraction and the digits after the point of a decimal are written syllable by syllable ("sān fēn zhī yī", "sān diǎn yī sì"). The checker leaves open the digits of a date or a festival (五一节), a doubled word (零零落落, 一天天), and the inside of a number that is itself a word of the lists (千万, 万一). Inside the headword the card's spacing wins, so the card 百分之 keeps "bǎifēnzhī".
- A 了 read "le" that ends a sentence or a clause, before a punctuation mark, at the end of the line or before a particle such as 吗, 吧 or 呢, is a word of its own ("zuótiān xià yǔ le.", point 3), unless a card or list word ends in it (算了).
- Digits, Latin letters and punctuation are unchanged, the headword is as on its card, and no capital letter stands anywhere except in the sentence's own Latin letters (points 7 and 9, as the user decided on 2026-09-29). So "wǒ ài běijīng." passes, while "Wǒ ài běijīng." and "wǒ ài Běijīng." fail.
- The words of a name of `data/manual/capitals` are spaced as that file gives them, where the line writes it as a name, meaning its first character starts a pinyin word and its last character ends one ("lǐ lǎoshī", "shāndōng shěng").

That checker cannot judge other word spacing (whether a result joins its verb, "xiěhǎo", or a 了 after a verb joins it, "kànle"), or choose between two real readings of a character (长 cháng or zhǎng, the verb guò or the particle guo of "qùguo"), so an independent Claude agent reads a random sample of 150 corrected lines against this sheet.

## Word spacing in `py`

On 2026-09-28 the user chose textbook word spacing (the 汉语拼音正词法 rules, the national standard GB/T 16159). The points below follow those rules. The section "Pinyin style sheet" above settles the cases they leave open, and where the two differ, the style sheet wins. Where a rule needs a judgement for each word, which is the form of a four-character word, Claude form agents propose it (Plan 3a Task 7) and the user reviews it.
- **Words.** The syllables of one word are written together, and words are separated by one space. 不客气 is "bú kèqi" (不 + 客气), 打电话 is "dǎ diànhuà", and 电子邮件 is "diànzǐyóujiàn".
- **Particles and suffixes.** 们 and the aspect particles 着, 了 and 过 are joined to the word before them ("kànzhe", "qùguo", "tóngxuémen", "yòngle liǎng gè xiǎoshí"), but a 了 that ends a sentence stays apart ("zuótiān xià yǔ le."), and so does a particle such as 吧, 吗 or 呢 at the end of a sentence ("hē bēi kāfēi ba."). The suffixes 子, 者, 员, 性 and 化 are joined too ("jiàshǐyuán").
- **Results and potential complements.** A one-character verb and a one-character result or direction after it are one word, as GB/T 16159-2012 6.1.2.4 writes 搞坏 "gǎohuài", so 写好 is "xiěhǎo" and 关上了 "guānshàngle". A potential complement such as 找不到, 睡不着, 买不来 or 忍受不了 is three words with a neutral bu ("zhǎo bu dào", "shuì bu zháo", "mǎi bu lái", "rěnshòu bu liǎo"), as point 5 of the style sheet sets it, and so is one that only the larger public list has (买不起 "mǎi bu qǐ"). A card keeps its card's spacing (受不了 "shòubuliǎo").
- **Four-character words** take one of three forms. An idiom (成语) that divides into two pairs is written as two joined pairs with a hyphen, so 拔苗助长 is "bámiáo-zhùzhǎng". A compound of two or more words is written as those words, so 通货膨胀 is "tōnghuò péngzhàng" and 市场经济 is "shìchǎng jīngjì". A single word that cannot be divided is joined, so 二氧化碳 is "èryǎnghuàtàn", and so are an idiom that does not divide into two pairs and a doubled AABB word, as GB/T 16159-2012 writes 总而言之 "zǒng'éryánzhī", 层出不穷 "céngchūbùqióng" and 来来往往 "láilaiwǎngwǎng", so 断断续续 is "duànduànxùxù". `data/manual/four_char_words` gives each word's form. Claude form agents propose it for every such word, and CC-CEDICT's idiom mark is only a hint to them. This holds for cards and for sentence words alike. Where the HSK 1 to 4 PDFs print a four-character card, the print is kept (公共汽车 "gōnggòngqìchē").
- **Numbers.** A whole number from 11 to 99 is one word (十二 "shí'èr", 八十三 "bāshísān"), and so are 十几 and 几十 (十几个人 "shíjǐ gè rén", 几十个国家 "jǐshí gè guójiā"). A digit, or 十, with 百, 千, 万 or 亿 is one word, and each such group is a word of its own, so 九亿七万二千三百五十六 is "jiǔyì qīwàn èrqiān sānbǎi wǔshíliù". 零 is a word of its own, and 万 or 亿 after a number of two or more characters stands apart (二十亿 "èrshí yì"). A number stands apart from its measure word (三个人 "sān gè rén"). 第 joins its number with a hyphen, as the HSK PDFs print 第一 "dì-yī" (第十课 "dì-shí kè"). Two rising digits are an approximate number with a hyphen (一两个月 "yì-liǎng gè yuè"), and digits without 十, 百, 千, 万 or 亿 are read one by one (二零一二年 "èr líng yī èr nián"). A fraction is written syllable by syllable, as GB/T 16159-2012 6.1.5.1 writes 二分之一 "èr fèn zhī yī", so 三分之一 is "sān fēn zhī yī" and 百分之十 "bǎi fēn zhī shí". Only where 分之 or 百分之 is the headword does it keep its card's joined spelling ("fēnzhī", "bǎifēnzhī"). A decimal is read digit by digit, and its 一 keeps its first tone (三点一四 "sān diǎn yī sì", 零点一米 "líng diǎn yī mǐ"), while 三点一刻 is a time of day ("sān diǎn yí kè").
- **Apostrophe.** Inside a word, an apostrophe (') stands before a syllable that starts with a, o or e, and nowhere else, as in 西安 "xī'ān", 女儿 "nǚ'ér" and 可爱 "kě'ài". After a space or a hyphen there is none (不言而喻 "bùyán-éryù").
- **The 儿 ending** joins the syllable before it with no apostrophe, as in 一点儿 "yìdiǎnr" and 哪儿 "nǎr".
- **Names** are in lower case, as the user decided on 2026-09-29 (北京 "běijīng", 中国 "zhōngguó", 欧洲 "ōuzhōu"), whether or not the HSK PDFs or the public list print a capital. A person's surname and given name are two words, and a title after the name is a word of its own, as in 王建国 "wáng jiànguó", 小王 "xiǎo wáng" and 李老师 "lǐ lǎoshī". The kind of a place is a word of its own, as GB/T 16159-2012 6.2.2.1 writes 河北省 as two words, so 福建省 is "fújiàn shěng". `data/manual/capitals` says which words are names and how their words are spaced. Its Y now only marks a name and its N a common noun. A name that the HSK 1 to 4 PDFs print keeps the print's word spacing, and a row for it must agree with that spacing. capitals_v002 adds 中国, 北京, 汉语, 中文, 黄河, 亚洲, 长城 and 长江 as one word each, so the sentence checker still spaces them as names.
- **Pattern words** put "…" after each half, as in 虽然…但是… "suīrán…dànshì…".
- **Sentence words that neither list has.** In `ex.py`, a word that is neither a card nor a word of the public list is split into known words where the rules write words apart. That is after a pronoun or a word such as 这 or 每 (我家 "wǒ jiā", 这本书 "zhè běn shū", but 这个 "zhège" and 这些 "zhèxiē" are one word each by point 1 of the style sheet), after an adverb (很多 "hěn duō"), between a number and a measure word (一个 "yí gè"), before a preposition after a verb (坐在 "zuò zài"), between a noun and a place word after it (树上 "shù shàng"), and between a measure word and its noun after a number. Names and words with a suffix stay joined (企业家 "qǐyèjiā", 歌唱家 "gēchàngjiā", 桃子 "táozi"), and so do 有点 "yǒudiǎn", 差点 "chàdiǎn" and words whose first part is first of all a noun or an adjective (面孔 "miànkǒng", 热天 "rètiān"). Month and weekday names stay one word by point 2 of the style sheet ("bāyuè", "xīngqīwǔ"). A card word or a word of the public list that holds the headword is never cut for it, so the card 男 has "nánrén" in its sentence. A four-character word takes its form, as above (足球比赛 "zúqiú bǐsài"), and a longer word is split into known words when they spell it. Other such words stay joined (把守 "bǎshǒu").
- **Characters.** Besides letters, `py` holds only the space, the hyphen (-), the apostrophe (') and, in a pattern word, "…". None of the space, hyphen or apostrophe stands at either end, and no two stand together.
- **Where the spacing comes from.** Where the HSK 1 to 4 PDFs print textbook pinyin for the word and its syllables fit the card's reading, `py` uses its syllables and word spacing as printed, in lower case. Otherwise a four-character headword takes its form, and any other headword is split into words with the jieba segmenter. A headword of one or two characters is always one word.

## Themes

`themes` is ordered by `order`, and `id` runs "t01", "t02" and so on. Themes are not split into parts (the user's decision of 2026-09-29). `count` is the number of words in the theme.
