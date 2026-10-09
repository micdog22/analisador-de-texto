import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyze, tokenize, splitSentences, flesch, fleschBand, isAdverbMente, secondsFor, formatSeconds, smsInfo, xLength,
  graphemes, highlightSegments, countGraphemes, formatRange, formatApprox,
} from '../src/text.js';
import { SAMPLE_TEXT } from '../src/sample.js';
import { STOPWORDS, NOT_ADVERBS } from '../src/words.js';

const sentenceTexts = (text) => splitSentences(text).map((s) => text.slice(s.start, s.end));

test('contagens de um texto curto conhecido', () => {
  const a = analyze('Olá, mundo! Tudo bem?');
  assert.deepEqual(
    [a.counts.characters, a.counts.charactersNoSpaces, a.counts.words, a.counts.sentences, a.counts.paragraphs, a.counts.lines, a.counts.uniqueWords],
    [21, 18, 4, 2, 1, 1, 4],
  );
  assert.equal(a.counts.wordsPerSentence, 2);
});

test('linhas, parágrafos e frases em texto com linha em branco e título sem ponto', () => {
  const a = analyze('Primeira linha.\n\nSegunda linha tem mais palavras.\nTerceira');
  assert.equal(a.counts.lines, 4);
  assert.equal(a.counts.paragraphs, 3);
  assert.equal(a.counts.sentences, 3);
  assert.equal(a.counts.words, 8);
  assert.equal(analyze('a\r\nb\rc').counts.lines, 3);
});

test('caracteres contam grafemas: acento e emoji com tom de pele valem um', () => {
  const a = analyze('Café ☕ com pão 👍🏽');
  assert.equal(a.counts.characters, 16);
  assert.equal(a.counts.words, 3);
  assert.equal(graphemes('👍🏽').length, 1);
  // texto decomposto (NFD) é normalizado antes
  assert.equal(analyze('café'.normalize('NFD')).counts.characters, 4);
});

test('texto vazio', () => {
  const a = analyze('');
  assert.equal(a.counts.words, 0);
  assert.equal(a.counts.lines, 0);
  assert.equal(a.flesch, null);
  assert.equal(a.band, null);
  assert.equal(a.reading.fast, 0);
  assert.deepEqual(a.frequent, []);
  assert.equal(analyze('   \n  ').counts.paragraphs, 0);
});

test('tokenize: hífen, apóstrofo, números, e-mail e link', () => {
  const toks = tokenize("O guarda-chuva d'água custa R$ 1.234,56 ou 3,5 mil. Escreva para contato@exemplo.com.br ou veja https://exemplo.com/a?b=1.");
  const pick = (kind) => toks.filter((t) => t.kind === kind).map((t) => t.text);
  assert.deepEqual(pick('number'), ['1.234,56', '3,5']);
  assert.deepEqual(pick('link'), ['contato@exemplo.com.br', 'https://exemplo.com/a?b=1']);
  assert.ok(pick('word').includes('guarda-chuva'));
  assert.ok(pick('word').includes("d'água"));
  const t = toks.find((x) => x.text === 'guarda-chuva');
  assert.equal(t.start, 2);
  assert.equal(t.end, 14);
});

test('frases: abreviações, iniciais, reticências, decimais e aspas', () => {
  assert.deepEqual(sentenceTexts('O Sr. Silva chegou. Ele trouxe 3.5 kg de café.'), ['O Sr. Silva chegou.', 'Ele trouxe 3.5 kg de café.']);
  assert.deepEqual(sentenceTexts('Ele hesitou... e depois saiu. Fim.'), ['Ele hesitou... e depois saiu.', 'Fim.']);
  assert.deepEqual(sentenceTexts('Você vem?! Claro!'), ['Você vem?!', 'Claro!']);
  assert.deepEqual(sentenceTexts('J. R. R. Tolkien escreveu livros. Muitos.'), ['J. R. R. Tolkien escreveu livros.', 'Muitos.']);
  assert.deepEqual(sentenceTexts('Comprei maçã, banana etc. Depois voltei.'), ['Comprei maçã, banana etc.', 'Depois voltei.']);
  assert.deepEqual(sentenceTexts('Leia a pág. 12 do livro.'), ['Leia a pág. 12 do livro.']);
  assert.deepEqual(sentenceTexts('Ele disse: "Vamos." E foi.'), ['Ele disse: "Vamos."', 'E foi.']);
  assert.deepEqual(sentenceTexts('Versão 2.0 lançada.'), ['Versão 2.0 lançada.']);
  assert.deepEqual(sentenceTexts('Acesse www.exemplo.com.br. Depois volte.'), ['Acesse www.exemplo.com.br.', 'Depois volte.']);
  assert.deepEqual(sentenceTexts('Fui ao mar. Depois dormi.'), ['Fui ao mar.', 'Depois dormi.']);
  assert.deepEqual(sentenceTexts('  ...  '), []);
});

test('fórmula de Flesch (Martins et al., 1996)', () => {
  assert.ok(Math.abs(flesch(100, 5, 200) - 59.335) < 1e-9);
  assert.ok(Math.abs(flesch(10, 1, 10) - (248.835 - 10.15 - 84.6)) < 1e-9);
  assert.equal(flesch(0, 0, 0), null);
  assert.equal(flesch(10, 0, 5), null);
});

test('Flesch de um texto contado à mão', () => {
  // 9 palavras, 2 frases, 16 sílabas: O ga-to su-biu no te-lha-do. A chu-va ca-iu for-te.
  const a = analyze('O gato subiu no telhado. A chuva caiu forte.');
  assert.equal(a.counts.words, 9);
  assert.equal(a.counts.sentences, 2);
  assert.equal(a.counts.syllables, 16);
  assert.ok(Math.abs(a.flesch - (248.835 - 1.015 * 4.5 - (84.6 * 16) / 9)) < 1e-9);
  assert.equal(a.band.id, 'muito-facil');
});

test('faixas de legibilidade nos limites', () => {
  const id = (s) => fleschBand(s).id;
  assert.equal(id(120), 'muito-facil');
  assert.equal(id(75), 'muito-facil');
  assert.equal(id(74.99), 'facil');
  assert.equal(id(50), 'facil');
  assert.equal(id(49.99), 'dificil');
  assert.equal(id(25), 'dificil');
  assert.equal(id(24.99), 'muito-dificil');
  assert.equal(id(-30), 'muito-dificil');
  assert.equal(fleschBand(null), null);
});

test('palavras frequentes ignoram as comuns (stopwords)', () => {
  const a = analyze('O gato e o cachorro. O gato dorme no sofá, e o cachorro também dorme.');
  assert.deepEqual(a.frequent.slice(0, 3), [{ word: 'cachorro', count: 2 }, { word: 'dorme', count: 2 }, { word: 'gato', count: 2 }]);
  assert.ok(!a.frequent.some((f) => ['o', 'e', 'no', 'também'].includes(f.word)));
  for (const w of ['de', 'que', 'não', 'você', 'está', 'também', 'pra']) assert.ok(STOPWORDS.has(w), w);
  for (const w of ['casa', 'gato', 'brasil']) assert.equal(STOPWORDS.has(w), false, w);
});

test('advérbios em -mente sem confundir com mente, semente e afins', () => {
  const a = analyze('Felizmente ele chegou rapidamente, mas a semente não brotou. Ele mente demais. Comente e experimente.');
  assert.deepEqual(a.words.filter((w) => w.adverb).map((w) => w.text), ['Felizmente', 'rapidamente']);
  assert.equal(a.counts.adverbs, 2);
  assert.equal(isAdverbMente('somente'), true);
  assert.equal(isAdverbMente('mente'), false);
  assert.equal(NOT_ADVERBS.has('clemente'), true);
});

test('repetições próximas marcam as duas ocorrências; longe não conta', () => {
  const a = analyze('O projeto atrasou porque o projeto mudou.');
  assert.deepEqual(a.words.filter((w) => w.repeat).map((w) => w.text), ['projeto', 'projeto']);
  assert.equal(a.counts.repeatedPairs, 1);
  const filler = Array.from({ length: 16 }, (_, i) => `palavra${'abcdefghijklmnop'[i]}`).join(' ');
  const far = analyze(`Projeto ${filler} projeto.`);
  assert.equal(far.counts.repeatedPairs, 0);
  // palavras comuns e curtas não contam
  assert.equal(analyze('Ele foi e ele voltou. Ele riu.').counts.repeatedPairs, 0);
});

test('frase longa: mais de 30 palavras', () => {
  const words = (n) => `${Array.from({ length: n }, () => 'palavra').join(' ')}.`;
  assert.equal(analyze(words(30)).counts.longSentences, 0);
  assert.equal(analyze(words(31)).counts.longSentences, 1);
  assert.equal(analyze(`${words(31)} Curta.`).sentences[0].long, true);
});

test('tempos de leitura e de fala', () => {
  assert.equal(secondsFor(450, 250), 108);
  assert.equal(secondsFor(450, 200), 135);
  assert.equal(secondsFor(450, 140), 193);
  assert.equal(secondsFor(1, 250), 1);
  assert.equal(secondsFor(0, 250), 0);
  assert.equal(formatSeconds(1), '1 segundo');
  assert.equal(formatSeconds(45), '45 segundos');
  assert.equal(formatSeconds(62), '1 minuto');
  assert.equal(formatSeconds(108), '1 minuto e 48 segundos');
  assert.equal(formatSeconds(135), '2 minutos e 15 segundos');
  assert.equal(formatSeconds(600), '10 minutos');
  assert.equal(formatSeconds(3600), '1 hora');
  assert.equal(formatSeconds(3900), '1 hora e 5 minutos');
  const a = analyze(Array.from({ length: 450 }, () => 'casa').join(' '));
  assert.deepEqual(a.reading, { fast: 108, slow: 135 });
  assert.equal(a.speaking, 193);
});

test('SMS: GSM 7 bits até 160; acento fora do alfabeto GSM derruba para 70', () => {
  const plain = smsInfo('Ola, tudo bem?');
  assert.deepEqual([plain.encoding, plain.units, plain.segments], ['GSM-7', 14, 1]);
  assert.equal(smsInfo('Até já, café').encoding, 'UCS-2'); // "á" não está no GSM
  assert.equal(smsInfo('é è à ù Ç').encoding, 'GSM-7'); // estes estão
  assert.deepEqual(smsInfo('ação').offending, ['ç', 'ã']);
  assert.equal(smsInfo('a'.repeat(160)).segments, 1);
  assert.equal(smsInfo('a'.repeat(161)).segments, 2);
  assert.equal(smsInfo('a'.repeat(306)).segments, 2);
  assert.equal(smsInfo('a'.repeat(307)).segments, 3);
  assert.equal(smsInfo('€').units, 2); // tabela de extensão
  assert.equal(smsInfo('ã'.repeat(70)).segments, 1);
  assert.equal(smsInfo('ã'.repeat(71)).segments, 2);
  assert.equal(smsInfo('👍').units, 2);
  assert.equal(smsInfo('').segments, 0);
});

test('tamanho no X: links valem 23, emoji vale 2', () => {
  assert.equal(xLength('Olá mundo'), 9);
  assert.equal(xLength('veja https://exemplo.com/um/caminho/bem/longo ok'), 5 + 23 + 3);
  assert.equal(xLength('👍🏽'), 2);
  assert.equal(xLength('日本'), 4);
  assert.equal(xLength(''), 0);
});

test('destaques: os pedaços reconstroem o texto e marcam o que importa', () => {
  const text = `Felizmente o projeto ficou pronto. ${Array.from({ length: 31 }, () => 'texto').join(' ')}. O projeto voltou.`;
  const a = analyze(text);
  const segs = highlightSegments(a);
  assert.equal(segs.map((s) => s.text).join(''), a.text);
  assert.ok(segs.some((s) => s.mark === 'adverb' && s.text === 'Felizmente'));
  assert.ok(segs.some((s) => s.long));
  const off = highlightSegments(a, { long: false, repeats: false, adverbs: false });
  assert.equal(off.length, 1);
  assert.equal(off[0].text, a.text);
});

test('faixas de tempo escritas por extenso', () => {
  assert.equal(formatRange(33, 41), 'de 33 a 41 segundos');
  assert.equal(formatRange(1, 1), 'cerca de 1 segundo');
  assert.equal(formatRange(108, 135), 'cerca de 2 minutos');
  assert.equal(formatRange(150, 190), 'cerca de 3 minutos'); // 2,5 e 3,2 minutos arredondam para 3
  assert.equal(formatRange(240, 300), 'de 4 a 5 minutos');
  assert.equal(formatRange(4000, 5000), 'de 1 hora e 7 minutos a 1 hora e 23 minutos');
  assert.equal(formatRange(0, 0), '0 segundo');
  assert.equal(formatApprox(45), '45 segundos');
  assert.equal(formatApprox(193), 'cerca de 3 minutos');
  assert.equal(formatApprox(0), '0 segundo');
});

const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });
const reference = (t) => Array.from(segmenter.segment(t), (s) => s.segment);

test('grafemas: cortar o texto em pedaços dá o mesmo resultado que segmentar de uma vez', () => {
  const family = String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
  const piece = `Olá 👍🏽 família ${family} bandeira 🇧🇷 ação\r\nnova linha e acentuação. `;
  const text = piece.repeat(200);
  assert.deepEqual(graphemes(text), reference(text));
  const counted = countGraphemes(text);
  assert.equal(counted.count, reference(text).length);
});

test('countGraphemes: o atalho sem junções confere com o Intl.Segmenter', () => {
  for (const t of ['Texto simples, com acentuação: ção, ã, é.', 'a\r\nb\n\nc', 'Tab\tE espaço', '日本語のテキスト', 'emoji simples 😀🎉', '']) {
    const ref = reference(t);
    assert.deepEqual(countGraphemes(t), { count: ref.length, spaces: ref.filter((g) => /^\s+$/u.test(g)).length }, JSON.stringify(t));
  }
});

test('desempenho: 40 mil palavras analisadas em poucos segundos (sem custo quadrático)', () => {
  const big = SAMPLE_TEXT.repeat(300);
  const t0 = performance.now();
  const a = analyze(big);
  const ms = performance.now() - t0;
  assert.equal(a.counts.words, 137 * 300);
  assert.ok(ms < 5000, `levou ${ms.toFixed(0)} ms`);
});
