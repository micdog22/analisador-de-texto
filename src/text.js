// Análise de texto em português: contagens, frases, legibilidade, tempos, palavras
// frequentes, repetições, advérbios em -mente e limites de redes sociais e SMS.
// Módulo puro (sem DOM).

import { countSyllables } from './syllables.js';
import { STOPWORDS, NOT_ADVERBS } from './words.js';

export const LONG_SENTENCE = 30; // palavras
export const REPEAT_WINDOW = 15; // palavras para trás
export const READING_WPM = [200, 250];
export const SPEAKING_WPM = 140;

// Abreviações que não encerram frase quando aparecem antes de um ponto.
const ABBREVIATIONS = new Set([
  'sr', 'sra', 'srta', 'srs', 'sras', 'dr', 'dra', 'drs', 'dras', 'prof', 'profa', 'profs', 'eng', 'enga', 'arq',
  'adv', 'av', 'r', 'rod', 'pç', 'n', 'nº', 'núm', 'pág', 'págs', 'p', 'pp', 'cap', 'caps', 'fig', 'figs',
  'ex', 'exs', 'obs', 'tel', 'cel', 'ltda', 'cia', 'vol', 'vols', 'ed', 'séc', 'aprox',
  'jan', 'fev', 'abr', 'jun', 'jul', 'ago', 'nov', 'dez', 'exmo', 'exma', 'ilmo', 'ilma',
  'sto', 'sta', 'gal', 'ten', 'sgt', 'cel', 'cmte', 'pe', 'v', 'vs', 'cf', 'op', 'cit', 'ref', 'refs', 'etc',
]);

// Palavra, número (com . ou , no meio), e-mail ou link.
const TOKEN_RE = /(?:https?:\/\/|www\.)[^\s]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\p{N}+(?:[.,]\p{N}+)*|[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu;

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }) : null;

const CHUNK = 2048;
const isAsciiPrintable = (code) => code >= 0x20 && code <= 0x7e;

/**
 * Percorre os grafemas (o que a pessoa vê como um caractere: "é", "👍🏽").
 * Em alguns motores, o Intl.Segmenter fica quadrático em textos longos, então o texto
 * é cortado em pedaços de uns 2 mil caracteres. O corte só acontece entre dois
 * caracteres ASCII visíveis (como "a b" ou "s."), que nunca formam um grafema juntos.
 */
export function* eachGrapheme(text) {
  if (!segmenter) {
    yield* text;
    return;
  }
  let start = 0;
  while (start < text.length) {
    let end = text.length;
    if (text.length - start > CHUNK) {
      end = -1;
      const stop = Math.min(text.length, start + CHUNK * 4);
      for (let p = start + CHUNK; p < stop; p++) {
        if (isAsciiPrintable(text.charCodeAt(p - 1)) && isAsciiPrintable(text.charCodeAt(p))) {
          end = p;
          break;
        }
      }
      if (end === -1) end = text.length; // sem ponto seguro por perto: segmenta o resto de uma vez
    }
    for (const piece of segmenter.segment(text.slice(start, end))) yield piece.segment;
    start = end;
  }
}

export function graphemes(text) {
  return Array.from(eachGrapheme(text));
}

// Caracteres que podem juntar dois ou mais pontos de código num único grafema: marcas
// combinantes, ZWJ, seletores de variação, bandeiras, tons de pele, jamo coreano e
// etiquetas de emoji. Montado a partir dos números para não depender de caracteres
// invisíveis no código-fonte.
const cp = (n) => String.fromCodePoint(n);
const JOINERS = new RegExp(`[\\p{M}${cp(0x200d)}${cp(0xfe00)}-${cp(0xfe0f)}${cp(0x1f1e6)}-${cp(0x1f1ff)}`
  + `${cp(0x1f3fb)}-${cp(0x1f3ff)}${cp(0xe0020)}-${cp(0xe007f)}${cp(0x1100)}-${cp(0x11ff)}${cp(0xa960)}-${cp(0xa97f)}`
  + `${cp(0xd7b0)}-${cp(0xd7ff)}${cp(0xe0100)}-${cp(0xe01ef)}]`, 'u');

/**
 * Conta grafemas e grafemas de espaço. Sem nenhum caractere de junção, cada ponto de
 * código é um grafema (com CR + LF contando como um), o que é bem mais rápido.
 */
export function countGraphemes(text) {
  let count = 0;
  let spaces = 0;
  if (!JOINERS.test(text)) {
    let prev = '';
    for (const ch of text) {
      if (!(ch === '\n' && prev === '\r')) {
        count++;
        if (/\s/.test(ch)) spaces++;
      }
      prev = ch;
    }
    return { count, spaces };
  }
  for (const g of eachGrapheme(text)) {
    count++;
    if (/^\s+$/u.test(g)) spaces++;
  }
  return { count, spaces };
}

export function normalizeText(text) {
  return String(text ?? '').normalize('NFC');
}

/** Lista de palavras com posição: { text, lower, start, end, kind } (kind: word, number, link). */
export function tokenize(text) {
  const t = normalizeText(text);
  const out = [];
  for (const m of t.matchAll(TOKEN_RE)) {
    let raw = m[0];
    let kind = 'word';
    if (/^(?:https?:\/\/|www\.)/i.test(raw)) {
      raw = raw.replace(/[.,;:!?)\]"'”’»]+$/, ''); // pontuação colada no fim do link
      kind = 'link';
    } else if (raw.includes('@')) {
      kind = 'link';
    } else if (/^\p{N}+(?:[.,]\p{N}+)*$/u.test(raw)) {
      kind = 'number';
    }
    out.push({ text: raw, lower: raw.toLocaleLowerCase('pt-BR'), start: m.index, end: m.index + raw.length, kind });
  }
  return out;
}

function isLowerStart(ch) {
  return ch !== undefined && /\p{Ll}/u.test(ch);
}

/**
 * Divide em frases. Uma frase termina em . ! ? ou reticências seguidas de espaço (ou do
 * fim), e também no fim de cada linha com texto (títulos e listas sem pontuação).
 * Não termina depois de abreviação conhecida (Sr., Dra., pág.), de inicial (J. Silva)
 * ou quando o texto seguinte começa com minúscula ("Ele hesitou... e saiu.").
 * Retorna [{ start, end }].
 */
export function splitSentences(text) {
  const t = normalizeText(text);
  const sentences = [];
  const lineRe = /[^\r\n]+/g;
  for (const line of t.matchAll(lineRe)) {
    const base = line.index;
    const s = line[0];
    let start = 0;
    const endRe = /[.!?…]+["'”’»)\]]*(?=\s|$)/g;
    for (const m of s.matchAll(endRe)) {
      const punct = m[0];
      const before = s.slice(start, m.index);
      const lastWord = (before.match(/([\p{L}\p{N}º]+)$/u) || [])[1] || '';
      const next = s.slice(m.index + punct.length).trimStart()[0];
      if (/^\.$/.test(punct.replace(/["'”’»)\]]+$/, ''))) {
        if (ABBREVIATIONS.has(lastWord.toLocaleLowerCase('pt-BR')) && lastWord.toLocaleLowerCase('pt-BR') !== 'etc') continue;
        if (/^\p{Lu}$/u.test(lastWord)) continue; // inicial de nome
      }
      if (isLowerStart(next)) continue;
      const end = m.index + punct.length;
      if (/[\p{L}\p{N}]/u.test(s.slice(start, end))) sentences.push({ start: base + start, end: base + end });
      start = end;
    }
    const rest = s.slice(start);
    if (/[\p{L}\p{N}]/u.test(rest)) sentences.push({ start: base + start, end: base + s.length });
  }
  // remove espaços do começo de cada frase
  return sentences.map(({ start, end }) => {
    let a = start;
    while (a < end && /\s/.test(t[a])) a++;
    return { start: a, end };
  });
}

/** Índice de legibilidade de Flesch adaptado ao português (Martins et al., 1996). */
export function flesch(words, sentences, syllables) {
  if (!words || !sentences) return null;
  return 248.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
}

export const FLESCH_BANDS = [
  { min: 75, id: 'muito-facil', label: 'Muito fácil', audience: 'adequado para os primeiros anos do ensino fundamental' },
  { min: 50, id: 'facil', label: 'Fácil', audience: 'adequado para os anos finais do ensino fundamental' },
  { min: 25, id: 'dificil', label: 'Difícil', audience: 'adequado para o ensino médio e o ensino superior' },
  { min: -Infinity, id: 'muito-dificil', label: 'Muito difícil', audience: 'típico de textos acadêmicos e técnicos' },
];

export function fleschBand(score) {
  if (score === null || !Number.isFinite(score)) return null;
  return FLESCH_BANDS.find((b) => score >= b.min);
}

export function isAdverbMente(lower) {
  return lower.length >= 7 && lower.endsWith('mente') && !NOT_ADVERBS.has(lower);
}

/** Tempo em segundos para ler ou falar `words` palavras a `wpm` palavras por minuto. */
export function secondsFor(words, wpm) {
  return words ? Math.max(1, Math.round((words / wpm) * 60)) : 0;
}

/** "45 segundos", "1 minuto", "3 minutos e 20 segundos", "1 hora e 5 minutos". */
export function formatSeconds(total) {
  if (!total) return '0 segundo';
  if (total < 60) return `${total} ${total === 1 ? 'segundo' : 'segundos'}`;
  if (total < 3600) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    const mm = `${m} ${m === 1 ? 'minuto' : 'minutos'}`;
    if (m >= 10 || s < 5) return mm;
    return `${mm} e ${s} segundos`;
  }
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  const hh = `${h} ${h === 1 ? 'hora' : 'horas'}`;
  return m ? `${hh} e ${m} ${m === 1 ? 'minuto' : 'minutos'}` : hh;
}

/** Faixa de tempo de leitura: "de 33 a 41 segundos", "cerca de 2 minutos", "de 2 a 3 minutos". */
export function formatRange(fast, slow) {
  if (!slow) return '0 segundo';
  if (slow < 60) return fast === slow ? `cerca de ${formatSeconds(slow)}` : `de ${fast} a ${slow} segundos`;
  if (slow < 3600) {
    const a = Math.max(1, Math.round(fast / 60));
    const b = Math.max(1, Math.round(slow / 60));
    if (a === b) return `cerca de ${a} ${a === 1 ? 'minuto' : 'minutos'}`;
    return `de ${a} a ${b} minutos`;
  }
  return `de ${formatSeconds(fast)} a ${formatSeconds(slow)}`;
}

/** Tempo aproximado: segundos exatos até 1 minuto, depois minutos arredondados. */
export function formatApprox(seconds) {
  if (!seconds) return '0 segundo';
  if (seconds < 60) return formatSeconds(seconds);
  if (seconds < 3600) {
    const m = Math.round(seconds / 60);
    return `cerca de ${m} ${m === 1 ? 'minuto' : 'minutos'}`;
  }
  return `cerca de ${formatSeconds(seconds)}`;
}

// ---------- limites ----------

// Alfabeto GSM 03.38 (7 bits) usado em SMS e a tabela de extensão (vale 2 posições).
const GSM_BASIC = new Set(Array.from(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
));
const GSM_EXTENDED = new Set(Array.from('^{}\\[~]|€'));

/**
 * Quantos SMS o texto ocupa. Se todos os caracteres estão no alfabeto GSM 7 bits, cabem
 * 160 por mensagem (153 quando o texto é dividido em várias). Um único caractere fora
 * dele (ã, õ, ç, á, emoji...) obriga o UCS-2: 70 por mensagem (67 quando dividido).
 */
export function smsInfo(text) {
  const t = normalizeText(text);
  let septets = 0;
  const offending = [];
  for (const ch of t) {
    if (GSM_BASIC.has(ch)) septets += 1;
    else if (GSM_EXTENDED.has(ch)) septets += 2;
    else if (!offending.includes(ch)) offending.push(ch);
  }
  if (!offending.length) {
    const segments = septets === 0 ? 0 : septets <= 160 ? 1 : Math.ceil(septets / 153);
    return { encoding: 'GSM-7', units: septets, limit: 160, segments, offending };
  }
  const units = t.length; // unidades UTF-16: emoji fora do plano básico vale 2
  const segments = units === 0 ? 0 : units <= 70 ? 1 : Math.ceil(units / 67);
  return { encoding: 'UCS-2', units, limit: 70, segments, offending };
}

const URL_RE = /\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+/gi;
const EMOJI_RE = /\p{Extended_Pictographic}/u;

function xWeight(cp) {
  return cp <= 4351 || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247) ? 1 : 2;
}

/**
 * Tamanho de um post no X pelas regras públicas de contagem: links valem 23,
 * emojis valem 2, letras latinas valem 1 e a maioria dos outros sistemas de escrita vale 2.
 */
export function xLength(text) {
  const t = normalizeText(text);
  let total = 0;
  const rest = t.replace(URL_RE, () => {
    total += 23;
    return '';
  });
  if (!JOINERS.test(rest)) {
    // sem junções, cada emoji é um ponto de código só, e todos têm peso 2
    for (const ch of rest) total += xWeight(ch.codePointAt(0));
    return total;
  }
  for (const g of eachGrapheme(rest)) {
    if (EMOJI_RE.test(g)) total += 2;
    else for (const ch of g) total += xWeight(ch.codePointAt(0));
  }
  return total;
}

// ---------- análise completa ----------

/**
 * Analisa o texto inteiro. Retorna contagens, frases, palavras (com marcações de
 * repetição e advérbio), legibilidade, tempos, frequência e limites.
 */
export function analyze(input, { longSentence = LONG_SENTENCE, repeatWindow = REPEAT_WINDOW } = {}) {
  const text = normalizeText(input);
  const { count: charCount, spaces: spaceCount } = countGraphemes(text);
  const tokens = tokenize(text);
  const sentenceRanges = splitSentences(text);

  // palavras, sílabas e marcações
  const lastSeen = new Map();
  let syllables = 0;
  const words = tokens.map((tok, i) => {
    const syl = tok.kind === 'word' ? Math.max(1, countSyllables(tok.text)) : 1;
    syllables += syl;
    const stop = STOPWORDS.has(tok.lower);
    const w = { ...tok, index: i, syllables: syl, stop, adverb: tok.kind === 'word' && isAdverbMente(tok.lower), repeat: false };
    if (tok.kind === 'word' && !stop && tok.lower.length >= 4) {
      const prev = lastSeen.get(tok.lower);
      if (prev !== undefined && i - prev <= repeatWindow) {
        w.repeat = true;
        w.repeatOf = prev;
      }
      lastSeen.set(tok.lower, i);
    }
    return w;
  });
  for (const w of words) if (w.repeat) words[w.repeatOf].repeat = true;

  // frases com suas palavras
  let wi = 0;
  const sentences = sentenceRanges.map((r) => {
    while (wi < words.length && words[wi].end <= r.start) wi++;
    let count = 0;
    for (let k = wi; k < words.length && words[k].start < r.end; k++) count++;
    return { ...r, words: count, long: count > longSentence };
  }).filter((s) => s.words > 0);

  // frequência sem palavras comuns
  const freq = new Map();
  for (const w of words) {
    if (w.kind !== 'word' || w.stop || w.lower.length < 2 || /^\p{N}/u.test(w.lower)) continue;
    freq.set(w.lower, (freq.get(w.lower) || 0) + 1);
  }
  const frequent = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([word, count]) => ({ word, count }));

  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const score = flesch(wordCount, sentenceCount, syllables);
  const lines = text === '' ? 0 : text.split(/\r\n|\r|\n/).length;
  const paragraphs = text.split(/\r\n|\r|\n/).filter((l) => l.trim()).length;
  const repeatedPairs = words.filter((w) => w.repeatOf !== undefined).length;

  return {
    text,
    counts: {
      characters: charCount,
      charactersNoSpaces: charCount - spaceCount,
      words: wordCount,
      sentences: sentenceCount,
      paragraphs,
      lines,
      uniqueWords: new Set(words.map((w) => w.lower)).size,
      syllables,
      wordsPerSentence: sentenceCount ? wordCount / sentenceCount : 0,
      syllablesPerWord: wordCount ? syllables / wordCount : 0,
      longSentences: sentences.filter((s) => s.long).length,
      adverbs: words.filter((w) => w.adverb).length,
      repeatedPairs,
    },
    flesch: score,
    band: fleschBand(score),
    reading: { fast: secondsFor(wordCount, READING_WPM[1]), slow: secondsFor(wordCount, READING_WPM[0]) },
    speaking: secondsFor(wordCount, SPEAKING_WPM),
    words,
    sentences,
    frequent,
    limits: { x: xLength(text), instagram: charCount, sms: smsInfo(text) },
  };
}

/**
 * Trechos para a visualização com destaques: cada pedaço do texto com as marcas que
 * se aplicam a ele (frase longa, repetição, advérbio). Os pedaços cobrem o texto todo,
 * em ordem, então juntar os textos devolve o original.
 */
export function highlightSegments(analysis, { long = true, repeats = true, adverbs = true } = {}) {
  const { text } = analysis;
  const marks = [];
  for (const w of analysis.words) {
    if (adverbs && w.adverb) marks.push({ start: w.start, end: w.end, type: 'adverb' });
    else if (repeats && w.repeat) marks.push({ start: w.start, end: w.end, type: 'repeat' });
  }
  const longs = long ? analysis.sentences.filter((s) => s.long) : [];
  const points = new Set([0, text.length]);
  for (const m of marks) points.add(m.start).add(m.end);
  for (const s of longs) points.add(s.start).add(s.end);
  const sorted = [...points].sort((a, b) => a - b);
  const segments = [];
  let mi = 0;
  let li = 0;
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    while (mi < marks.length && marks[mi].end <= a) mi++;
    while (li < longs.length && longs[li].end <= a) li++;
    const mark = mi < marks.length && marks[mi].start <= a && b <= marks[mi].end ? marks[mi].type : null;
    const inLong = li < longs.length && longs[li].start <= a && b <= longs[li].end;
    const last = segments[segments.length - 1];
    if (last && last.mark === mark && last.long === inLong) last.text += text.slice(a, b);
    else segments.push({ text: text.slice(a, b), mark, long: inLong });
  }
  return segments;
}
