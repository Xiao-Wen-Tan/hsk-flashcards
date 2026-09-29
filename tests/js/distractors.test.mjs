import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChoices, makePool, meaningKeys, pickDistractors } from '../../docs/js/distractors.js';
import { dayRange } from '../../docs/js/dates.js';
import { brokenRules, loadFixture, word } from './helpers.mjs';

const data = loadFixture();
const pool = makePool(data.words);
const DAYS = dayRange('2026-10-01', 40);
const w = (hz) => word(data, hz);
const pick = (hz, quiz, day, step = 0) => pickDistractors(pool, w(hz), quiz, { day, step });
const hzOf = (choice) => data.words.find((x) => x.id === choice.id)?.hz;

test('meaning keys drop brackets, "to" and articles', () => {
  assert.deepEqual([...meaningKeys(w('认识'))], ['know', 'meet']);
  assert.deepEqual([...meaningKeys(w('两'))], ['two', 'both']);
  assert.deepEqual([...meaningKeys(w('您'))], ['you']);
  assert.deepEqual([...meaningKeys(w('高兴'))], ['happy', 'glad']);
});

test('every fixture word gets 3 valid wrong choices in both quizzes, on every day and step', () => {
  const problems = [];
  for (const answer of data.words) {
    for (const quiz of ['listen', 'pinyin']) {
      for (const day of DAYS.slice(0, 10)) {
        for (const step of [0, 1, 2, 5]) {
          const wrong = pickDistractors(pool, answer, quiz, { day, step });
          problems.push(...brokenRules(data.words, meaningKeys, answer, quiz, wrong, step));
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('the listening quiz never offers exact homophones such as 他, 她 and 它 (all tā)', () => {
  for (const day of DAYS) {
    for (const hz of ['他', '她', '它']) {
      const offered = pick(hz, 'listen', day).map(hzOf);
      assert.ok(!offered.some((h) => ['他', '她', '它'].includes(h)), `${hz} on ${day}: ${offered}`);
    }
  }
});

test('same-meaning words never appear together', () => {
  const pairs = [['高兴', '快乐'], ['二', '两'], ['你', '您']];
  for (const day of DAYS) {
    for (const [a, b] of pairs) {
      for (const quiz of ['listen', 'pinyin']) {
        assert.ok(!pick(a, quiz, day, 3).map(hzOf).includes(b), `${a} ${quiz} ${day}`);
        assert.ok(!pick(b, quiz, day, 3).map(hzOf).includes(a), `${b} ${quiz} ${day}`);
      }
    }
  }
});

test('from step 2 a real tone twin can fill one pinyin slot, so 买 mǎi gets 卖 mài', () => {
  const at = (step) => DAYS.map((day) => pick('买', 'pinyin', day, step).filter((c) => c.toneVariant));
  assert.ok(at(0).every((v) => v.length === 0));
  assert.ok(at(1).every((v) => v.length === 0));
  const step2 = at(2);
  assert.ok(step2.some((v) => v.length === 1));
  assert.ok(step2.every((v) => v.length === 0 || (v[0].text === 'mài' && hzOf(v[0]) === '卖')));
});

test('without a real twin, one syllable\'s tone is changed to a tone a real word uses', () => {
  // For 老师 lǎoshī, shi2 (十) and shi4 (是) exist in the list, while lao1, lao2 and lao4 do not.
  const variants = DAYS.flatMap((day) => pick('老师', 'pinyin', day, 2).filter((c) => c.toneVariant));
  assert.ok(variants.length > 0);
  assert.ok(variants.every((v) => v.id === null && ['lǎoshí', 'lǎoshì'].includes(v.text)));
});

test('a made-up tone variant keeps the word spacing of the answer, so 没关系 méi guānxi gets mèi guānxi', () => {
  // mei4 (妹妹) is the only other tone of mei in the fixture, and guan has no other tone.
  const variants = DAYS.flatMap((day) => pick('没关系', 'pinyin', day, 2).filter((c) => c.toneVariant));
  assert.ok(variants.length > 0);
  assert.ok(variants.every((v) => v.id === null && v.text === 'mèi guānxi'));
});

test('a tone variant never uses the dictionary tone of a sandhi syllable', () => {
  // 不客气 is shown as "bú kèqi", but bu4 is its dictionary tone, so "bù kèqi" is not wrong.
  const texts = DAYS.flatMap((day) => pick('不客气', 'pinyin', day, 3).map((c) => c.text));
  assert.ok(!texts.includes('bù kèqi'));
});

test('every pinyin choice has the answer\'s word spacing, so 不客气 "bú kèqi" gets "duì buqǐ"', () => {
  // 不客气 is 不 + 客气, and 对不起 "duìbuqǐ", 没关系 "méi guānxi" and 服务员 "fúwùyuán" are its
  // wrong choices. For the joined answer 对不起, the others are shown joined.
  const shown = new Map();
  for (const day of DAYS) {
    for (const [hz, step] of [['不客气', 1], ['对不起', 1], ['不客气', 3]]) {
      for (const c of pick(hz, 'pinyin', day, step)) shown.set(`${hz} ${hzOf(c) ?? 'variant'}`, c.text);
    }
  }
  assert.equal(shown.get('不客气 对不起'), 'duì buqǐ');
  assert.equal(shown.get('不客气 没关系'), 'méi guānxi');
  assert.equal(shown.get('不客气 服务员'), 'fú wùyuán');
  assert.equal(shown.get('对不起 不客气'), 'búkèqi');
  assert.equal(shown.get('对不起 没关系'), 'méiguānxi');
});

test('wrong choices come from the same theme first, then wider tiers', () => {
  // 爸爸 (Family & People, n., HSK 1) has enough same-theme nouns of a similar length.
  for (const day of DAYS.slice(0, 10)) {
    assert.ok(pick('爸爸', 'listen', day).every((c) => data.words.find((x) => x.id === c.id).theme === 't04'));
  }
  // 不客气 has 3 syllables and no part of speech, so the 2 other Greetings words with
  // 3 syllables come first, then 服务员 from the "anything" tier.
  for (const day of DAYS.slice(0, 10)) {
    const offered = pick('不客气', 'pinyin', day, 1).map(hzOf);
    assert.deepEqual(offered.slice(0, 2).sort(), ['对不起', '没关系'].sort());
    assert.equal(offered[2], '服务员');
  }
});

test('choices are fixed for a word and day, and change between days', () => {
  assert.deepEqual(pick('苹果', 'listen', '2026-10-06'), pick('苹果', 'listen', '2026-10-06'));
  const seen = new Set(DAYS.map((day) => JSON.stringify(pick('苹果', 'listen', day))));
  assert.ok(seen.size > 1);
});

test('buildChoices gives 4 choices with the answer at answerIndex', () => {
  const { choices, answerIndex } = buildChoices(pool, w('苹果'), 'listen', { day: '2026-10-06' });
  assert.equal(choices.length, 4);
  assert.equal(choices.filter((c) => c.correct).length, 1);
  assert.deepEqual(choices[answerIndex], { id: w('苹果').id, text: 'apple', toneVariant: false, correct: true });
  assert.deepEqual(buildChoices(pool, w('苹果'), 'listen', { day: '2026-10-06' }).choices, choices);
  const positions = new Set(DAYS.map((day) => buildChoices(pool, w('苹果'), 'pinyin', { day }).answerIndex));
  assert.deepEqual([...positions].sort(), [0, 1, 2, 3]);
  assert.throws(() => buildChoices(pool, w('苹果'), 'recall', { day: '2026-10-06' }), /No choices/);
});

// A small hand-made word list for three rules the fixture cannot test on its own, kept
// here so the fixture stays as it is. Each pair sits alone in its own theme, where wrong
// choices are looked for first, and 8 plain words sit in theme t02. So if a rule were
// missing, the word it forbids would be picked on every day.
const mini = (id, hz, py, pyNum, pyBase, pos, en, enShort, theme, noDistract = []) =>
  ({ id, hz, py, pyNum, pyBase, syl: pyNum.split(' ').length, lv: 1, pos: [pos], en, enShort, theme, noDistract });
const PLAIN = [
  ['水', 'shuǐ', 'shui3', 'shui', 'water'], ['书', 'shū', 'shu1', 'shu', 'book'],
  ['茶', 'chá', 'cha2', 'cha', 'tea'], ['猫', 'māo', 'mao1', 'mao', 'cat'],
  ['桌子', 'zhuōzi', 'zhuo1 zi5', 'zhuozi', 'table'], ['椅子', 'yǐzi', 'yi3 zi5', 'yizi', 'chair'],
  ['面包', 'miànbāo', 'mian4 bao1', 'mianbao', 'bread'], ['手机', 'shǒujī', 'shou3 ji1', 'shouji', 'phone'],
];
const MINI = [
  mini('m01', '长', 'cháng', 'chang2', 'chang', 'adj.', 'long', 'long', 't01'),
  mini('m02', '长', 'zhǎng', 'zhang3', 'zhang', 'v.', 'to grow', 'to grow', 't01'),
  mini('m03', '爸爸', 'bàba', 'ba4 ba5', 'baba', 'n.', 'dad', 'dad', 't03', ['m04']),
  mini('m04', '父亲', 'fùqin', 'fu4 qin5', 'fuqin', 'n.', 'father', 'father', 't03'),
  mini('m05', '妈妈', 'māma', 'ma1 ma5', 'mama', 'n.', 'mum; mother', 'mum', 't04'),
  mini('m06', '母亲', 'mǔqin', 'mu3 qin5', 'muqin', 'n.', 'mother', 'mother', 't04'),
  ...PLAIN.map(([hz, py, pyNum, pyBase, en], i) => mini(`m${10 + i}`, hz, py, pyNum, pyBase, 'n.', en, en, 't02')),
];
const miniPool = makePool(MINI);

// The IDs of every wrong choice offered for this word, in both quizzes, over 40 days.
function offeredFor(id) {
  const answer = MINI.find((x) => x.id === id);
  const ids = new Set();
  for (const day of DAYS) {
    for (const quiz of ['listen', 'pinyin']) {
      const wrong = pickDistractors(miniPool, answer, quiz, { day });
      assert.equal(wrong.length, 3, `${answer.hz} ${quiz} ${day}`);
      wrong.forEach((c) => ids.add(c.id));
    }
  }
  return ids;
}

test('a word with the same characters is never offered, so 长 cháng never gets 长 zhǎng', () => {
  assert.ok(!offeredFor('m01').has('m02'));
  assert.ok(!offeredFor('m02').has('m01'));
});

test('a noDistract word is never offered, even when no meaning key is shared', () => {
  // "dad" and "father" share no key. Only 爸爸 lists 父亲, so the second line checks
  // that the rule also works from the other side.
  assert.ok(!offeredFor('m03').has('m04'));
  assert.ok(!offeredFor('m04').has('m03'));
});

test('a word sharing a meaning key with the answer is never offered, even without noDistract', () => {
  // 妈妈 "mum; mother" and 母亲 "mother" share the key "mother" and list no noDistract.
  assert.ok(!offeredFor('m05').has('m06'));
  assert.ok(!offeredFor('m06').has('m05'));
});

// Four-character idioms in textbook spelling, two joined pairs with a hyphen, added to
// the small list above. 八庙主张 is made up for this test. Its pinyin has the same letters
// as 拔苗助长 but a space where the idiom has a hyphen, so it differs in more than tone.
const IDIOM_LIST = [
  ...MINI,
  mini('m20', '拔苗助长', 'bámiáo-zhùzhǎng', 'ba2 miao2 zhu4 zhang3', 'bamiaozhuzhang', 'v.', 'to spoil things through haste', 'to rush things', 't05'),
  mini('m21', '一路平安', "yílù-píng'ān", 'yi1 lu4 ping2 an1', 'yilupingan', 'v.', 'to have a safe journey', 'safe journey', 't05'),
  mini('m22', '画蛇添足', 'huàshé-tiānzú', 'hua4 she2 tian1 zu2', 'huashetianzu', 'v.', 'to ruin something by adding to it', 'to overdo it', 't05'),
  mini('m23', '自言自语', 'zìyán-zìyǔ', 'zi4 yan2 zi4 yu3', 'ziyanziyu', 'v.', 'to talk to oneself', 'to talk to oneself', 't05'),
  mini('m24', '八庙主张', 'bāmiào zhǔzhāng', 'ba1 miao4 zhu3 zhang1', 'bamiaozhuzhang', 'n.', 'made-up test word', 'made-up test word', 't06'),
];
const idiomPool = makePool(IDIOM_LIST);
const idiomVariants = (id) => DAYS.flatMap((day) => {
  const answer = IDIOM_LIST.find((x) => x.id === id);
  const wrong = pickDistractors(idiomPool, answer, 'pinyin', { day, step: 2 });
  assert.deepEqual(brokenRules(IDIOM_LIST, meaningKeys, answer, 'pinyin', wrong, 2), []);
  return wrong.filter((c) => c.toneVariant);
});

test('a tone variant of an idiom keeps its hyphen and apostrophe', () => {
  // yílù is yi1 lu4 in the dictionary, and yi3 (椅子) is the only other tone of yi in use.
  const variants = idiomVariants('m21');
  assert.ok(variants.length > 0);
  assert.ok(variants.every((v) => v.text === "yǐlù-píng'ān"));
});

test('a real word with the same letters but other spacing is never a tone variant', () => {
  const variants = idiomVariants('m20');
  assert.ok(variants.length > 0);
  assert.ok(variants.every((v) => v.id === null && /^b.mi.o-zh.zh.ng$/.test(v.text)), JSON.stringify(variants));
});

// Names start with a capital ("Běijīng"). If only the answer had one, the capital would give
// it away, and for a lower-case answer a capitalised wrong choice would stand out. The fixture
// has no names, so they are added to the small list above. 背景 "bèijǐng" is the real tone
// twin of 北京 "Běijīng", and 中国, 汉语 and 长城 are names in another theme.
const NAME_LIST = [
  ...MINI,
  mini('m30', '北京', 'Běijīng', 'bei3 jing1', 'beijing', 'n.', 'Beijing', 'Beijing', 't07'),
  mini('m31', '背景', 'bèijǐng', 'bei4 jing3', 'beijing', 'n.', 'background', 'background', 't07'),
  mini('m32', '中国', 'Zhōngguó', 'zhong1 guo2', 'zhongguo', 'n.', 'China', 'China', 't08'),
  mini('m33', '汉语', 'Hànyǔ', 'han4 yu3', 'hanyu', 'n.', 'Chinese language', 'Chinese', 't08'),
  mini('m34', '长城', 'Chángchéng', 'chang2 cheng2', 'changcheng', 'n.', 'the Great Wall', 'the Great Wall', 't08'),
];
// The wrong choices of the pinyin quiz at step 2 on each of the 40 days, checked with brokenRules.
const pinyinPicks = (list, id) => {
  const listPool = makePool(list);
  const answer = list.find((x) => x.id === id);
  return DAYS.flatMap((day) => {
    const wrong = pickDistractors(listPool, answer, 'pinyin', { day, step: 2 });
    assert.deepEqual(brokenRules(list, meaningKeys, answer, 'pinyin', wrong, 2), []);
    return wrong;
  });
};

// Four-syllable words in each of the three forms of the textbook rules, which are an idiom
// with a hyphen, a compound written as two words, and one word written joined.
const FOUR_LIST = [
  ...MINI,
  IDIOM_LIST.find((x) => x.id === 'm20'),
  mini('m25', '通货膨胀', 'tōnghuò péngzhàng', 'tong1 huo4 peng2 zhang4', 'tonghuopengzhang', 'n.', 'inflation', 'inflation', 't05'),
  mini('m26', '高速公路', 'gāosùgōnglù', 'gao1 su4 gong1 lu4', 'gaosugonglu', 'n.', 'expressway', 'expressway', 't05'),
  mini('m27', '素食主义', 'sùshí zhǔyì', 'su4 shi2 zhu3 yi4', 'sushizhuyi', 'n.', 'vegetarianism', 'vegetarianism', 't05'),
];

test('four-syllable choices take the answer\'s form: idiom, two words or joined', () => {
  const shown = (id) => new Set(pinyinPicks(FOUR_LIST, id).filter((c) => !c.toneVariant).map((c) => c.text));
  assert.deepEqual([...shown('m20')].sort(), ['gāosù-gōnglù', 'sùshí-zhǔyì', 'tōnghuò-péngzhàng']);
  assert.deepEqual([...shown('m25')].sort(), ['bámiáo zhùzhǎng', 'gāosù gōnglù', 'sùshí zhǔyì']);
  assert.deepEqual([...shown('m26')].sort(), ['bámiáozhùzhǎng', 'sùshízhǔyì', 'tōnghuòpéngzhàng']);
});

test('a real word that already has the answer\'s look comes before one that must be reshaped', () => {
  // 通货膨胀 "tōnghuò péngzhàng" is two words. The idiom and the joined word of its own theme would have to be
  // reshaped, while three words of another theme are already written as two words, so they are chosen.
  const list = [
    ...FOUR_LIST,
    mini('m28', '市场经济', 'shìchǎng jīngjì', 'shi4 chang3 jing1 ji4', 'shichangjingji', 'n.', 'market economy', 'market economy', 't09'),
    mini('m29', '足球比赛', 'zúqiú bǐsài', 'zu2 qiu2 bi3 sai4', 'zuqiubisai', 'n.', 'football match', 'football match', 't09'),
  ].map((w) => (w.id === 'm27' ? { ...w, theme: 't09' } : w));
  const picked = pinyinPicks(list, 'm25').filter((c) => !c.toneVariant);
  assert.ok(picked.length > 0);
  for (const c of picked) {
    assert.ok(['m27', 'm28', 'm29'].includes(c.id), c.text);
    assert.equal(c.text, list.find((x) => x.id === c.id).py);
  }
});

test('an answer with the 儿 ending gets at least two choices that end in it', () => {
  // 一点儿 "yìdiǎnr" sits with plain two-syllable words, and three words with the 儿 ending are in another theme.
  const erhua = (id, hz, py, pyNum, pyBase, en, theme) => ({ ...mini(id, hz, py, pyNum, pyBase, 'n.', en, en, theme), syl: 2 });
  const list = [
    ...MINI,
    erhua('m40', '一点儿', 'yìdiǎnr', 'yi1 dian3 r5', 'yidianr', 'a little', 't02'),
    erhua('m41', '一会儿', 'yíhuìr', 'yi1 hui4 r5', 'yihuir', 'a moment', 't10'),
    erhua('m42', '一块儿', 'yíkuàir', 'yi1 kuai4 r5', 'yikuair', 'together', 't10'),
    erhua('m43', '好玩儿', 'hǎowánr', 'hao3 wan2 r5', 'haowanr', 'fun', 't10'),
  ];
  const listPool = makePool(list);
  const answer = list.find((x) => x.id === 'm40');
  for (const day of DAYS) {
    for (const step of [0, 2]) {
      const wrong = pickDistractors(listPool, answer, 'pinyin', { day, step });
      assert.deepEqual(brokenRules(list, meaningKeys, answer, 'pinyin', wrong, step), []);
      assert.ok(wrong.filter((c) => c.text.endsWith('r')).length >= 2, wrong.map((c) => c.text).join(' '));
    }
  }
  // brokenRules finds the broken rule when only one choice ends in the 儿 ending.
  const plain = [{ id: 'm14', text: 'zhuōzi', toneVariant: false }, { id: 'm15', text: 'yǐzi', toneVariant: false }];
  assert.deepEqual(brokenRules(list, meaningKeys, answer, 'pinyin', [...plain, { id: 'm41', text: 'yíhuìr', toneVariant: false }], 0),
    ['一点儿 pinyin: only 1 choices end in the 儿 ending, although 3 words could']);
});

test('a name gets other names as wrong choices, and its tone twin is shown with a capital', () => {
  const picked = pinyinPicks(NAME_LIST, 'm30');
  assert.ok(picked.some((c) => c.toneVariant));
  assert.ok(picked.every((c) => (c.toneVariant ? c.id === 'm31' && c.text === 'Bèijǐng' : ['m32', 'm33', 'm34'].includes(c.id))),
    picked.map((c) => c.text).join(' '));
});

test('a lower-case answer shows a name in lower case, so 背景 bèijǐng gets běijīng', () => {
  const picked = pinyinPicks(NAME_LIST, 'm31');
  const variants = picked.filter((c) => c.toneVariant);
  assert.ok(variants.length > 0);
  assert.ok(variants.every((v) => v.id === 'm30' && v.text === 'běijīng'));
  assert.ok(picked.every((c) => !['m32', 'm33', 'm34'].includes(c.id)));
});

test('with too few other names, a name gets other words shown with a capital', () => {
  // 北京 is the only name here, so its wrong choices are plain words such as 桌子 "Zhuōzi".
  const list = [...MINI, NAME_LIST.find((x) => x.id === 'm30')];
  const picked = pinyinPicks(list, 'm30');
  assert.equal(picked.length, 3 * DAYS.length);
  for (const c of picked) {
    const py = list.find((x) => x.id === c.id).py;
    assert.equal(c.text, py[0].toUpperCase() + py.slice(1));
  }
});
