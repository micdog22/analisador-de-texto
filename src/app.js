// Interface do Analisador de Texto: liga o campo de texto à análise e mostra os resultados.

import { analyze, highlightSegments, formatRange, formatApprox } from './text.js';
import { syllabify } from './syllables.js';
import { SAMPLE_TEXT } from './sample.js';

const TEXT_KEY = 'analisador-de-texto:texto';
const REMEMBER_KEY = 'analisador-de-texto:lembrar';

const $ = (id) => document.getElementById(id);
const els = {
  text: $('text'), sample: $('sample'), clear: $('clear'), remember: $('remember'), counts: $('counts'),
  reading: $('reading'), speaking: $('speaking'), needle: $('needle'), score: $('score'), audience: $('audience'),
  formula: $('formula'), limits: $('limits'), frequent: $('frequent'), highlight: $('highlight'),
  hlLong: $('hl-long'), hlRepeat: $('hl-repeat'), hlAdverb: $('hl-adverb'),
  nLong: $('n-long'), nRepeat: $('n-repeat'), nAdverb: $('n-adverb'), word: $('word'), syllables: $('syllables'),
};

const nf = new Intl.NumberFormat('pt-BR');
const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

let last = null;
let timer = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function storage(action, key, value) {
  try {
    if (action === 'get') return localStorage.getItem(key);
    if (action === 'set') localStorage.setItem(key, value);
    if (action === 'remove') localStorage.removeItem(key);
  } catch {
    // armazenamento indisponível: segue sem lembrar
  }
  return null;
}

// ---------- blocos de resultado ----------

function renderCounts(c) {
  const items = [
    ['Palavras', nf.format(c.words)],
    ['Caracteres', nf.format(c.characters)],
    ['Caracteres sem espaços', nf.format(c.charactersNoSpaces)],
    ['Frases', nf.format(c.sentences)],
    ['Parágrafos', nf.format(c.paragraphs)],
    ['Linhas', nf.format(c.lines)],
    ['Palavras diferentes', nf.format(c.uniqueWords)],
    ['Palavras por frase', c.sentences ? nf1.format(c.wordsPerSentence) : '0'],
    ['Sílabas', nf.format(c.syllables)],
    ['Sílabas por palavra', c.words ? nf2.format(c.syllablesPerWord) : '0'],
  ];
  els.counts.replaceChildren(...items.map(([label, value]) => {
    const box = el('div');
    box.append(el('dt', '', label), el('dd', '', value));
    return box;
  }));
}

function renderTimes(a) {
  els.reading.textContent = formatRange(a.reading.fast, a.reading.slow);
  els.speaking.textContent = formatApprox(a.speaking);
}

function renderFlesch(a) {
  if (a.flesch === null) {
    els.needle.hidden = true;
    els.score.textContent = 'Digite um texto para calcular.';
    els.audience.textContent = '';
    els.formula.textContent = '';
    return;
  }
  const shown = Math.max(0, Math.min(100, a.flesch));
  els.needle.hidden = false;
  els.needle.style.left = `${shown}%`;
  els.score.replaceChildren(el('strong', '', nf1.format(a.flesch)), ` · ${a.band.label}`);
  els.audience.textContent = `Na escala de Martins et al. (1996), ${a.band.audience}.`;
  const c = a.counts;
  els.formula.textContent = `248,835 - 1,015 × ${nf2.format(c.wordsPerSentence)} - 84,6 × ${nf3.format(c.syllablesPerWord)} = ${nf1.format(a.flesch)}`;
}

function limitRow(label, value, max, note, over) {
  const row = el('div', `limit${over ? ' over' : ''}`);
  const head = el('div', 'limit-head');
  head.append(el('span', '', label), el('strong', '', `${nf.format(value)} / ${nf.format(max)}`));
  const bar = el('progress');
  bar.max = max;
  bar.value = Math.min(value, max);
  bar.setAttribute('aria-label', `${label}: ${nf.format(value)} de ${nf.format(max)}`);
  row.append(head, bar);
  if (note) row.append(el('p', '', note));
  return row;
}

function renderLimits(a) {
  const { x, instagram, sms } = a.limits;
  const overBy = (v, max) => (v > max ? `Passou ${nf.format(v - max)} do limite.` : '');
  const xNote = overBy(x, 280) || 'Contagem do X: links valem 23 e emojis valem 2.';
  let smsNote;
  if (!sms.segments) smsNote = 'Até 160 caracteres por mensagem no alfabeto GSM.';
  else if (sms.encoding === 'GSM-7') smsNote = `${sms.segments} ${sms.segments === 1 ? 'mensagem' : 'mensagens'} no alfabeto GSM (7 bits).`;
  else {
    const chars = sms.offending.slice(0, 5).map((ch) => (ch === ' ' ? 'espaço' : ch)).join(' ');
    smsNote = `${sms.segments} ${sms.segments === 1 ? 'mensagem' : 'mensagens'}. Por causa de ${chars}, o SMS usa UCS-2 e cabem só 70 caracteres por mensagem (67 quando dividida).`;
  }
  els.limits.replaceChildren(
    limitRow('Post no X', x, 280, xNote, x > 280),
    limitRow('Legenda do Instagram', instagram, 2200, overBy(instagram, 2200), instagram > 2200),
    limitRow(`SMS (${sms.encoding === 'GSM-7' ? 'GSM 7 bits' : 'UCS-2'})`, sms.units, sms.limit, smsNote, sms.units > sms.limit),
  );
}

function renderFrequent(a) {
  const top = a.frequent.slice(0, 12);
  if (!top.length) {
    els.frequent.replaceChildren(el('li', 'empty', 'Nenhuma palavra ainda.'));
    return;
  }
  const max = top[0].count;
  els.frequent.replaceChildren(...top.map(({ word, count }) => {
    const li = el('li');
    const bar = el('span', 'bar');
    bar.style.width = `${Math.round((count / max) * 100)}%`;
    li.append(el('span', 'word', word), el('span', 'n', `${count}×`), bar);
    return li;
  }));
}

function renderHighlights(a) {
  els.nLong.textContent = String(a.counts.longSentences);
  els.nRepeat.textContent = String(a.words.filter((w) => w.repeat).length);
  els.nAdverb.textContent = String(a.counts.adverbs);
  if (!a.text.trim()) {
    els.highlight.replaceChildren();
    return;
  }
  const segments = highlightSegments(a, { long: els.hlLong.checked, repeats: els.hlRepeat.checked, adverbs: els.hlAdverb.checked });
  const frag = document.createDocumentFragment();
  for (const s of segments) {
    let node = s.mark ? el('mark', `hl-${s.mark}`, s.text) : document.createTextNode(s.text);
    if (s.mark === 'repeat') node.title = 'Repetida perto daqui';
    if (s.mark === 'adverb') node.title = 'Advérbio em -mente';
    if (s.long) {
      const wrap = el('span', 'hl-long');
      wrap.title = 'Frase com mais de 30 palavras';
      wrap.append(node);
      node = wrap;
    }
    frag.append(node);
  }
  els.highlight.replaceChildren(frag);
}

function renderSyllables() {
  const words = els.word.value.match(/[\p{L}]+(?:-[\p{L}]+)*/gu) || [];
  els.syllables.replaceChildren(...words.slice(0, 12).map((w) => {
    const parts = syllabify(w);
    const li = el('li');
    li.append(el('span', 'parts', parts.join('-')), ` · ${parts.length} ${parts.length === 1 ? 'sílaba' : 'sílabas'}`);
    return li;
  }));
}

// ---------- ciclo ----------

function run() {
  timer = 0;
  last = analyze(els.text.value);
  renderCounts(last.counts);
  renderTimes(last);
  renderFlesch(last);
  renderLimits(last);
  renderFrequent(last);
  renderHighlights(last);
  if (els.remember.checked) storage('set', TEXT_KEY, els.text.value);
}

function schedule() {
  clearTimeout(timer);
  // textos grandes esperam a digitação parar um pouco; pequenos atualizam na hora
  timer = setTimeout(run, els.text.value.length > 20000 ? 250 : 60);
}

function init() {
  const remember = storage('get', REMEMBER_KEY) === '1';
  els.remember.checked = remember;
  if (remember) els.text.value = storage('get', TEXT_KEY) || '';

  els.text.addEventListener('input', schedule);
  els.sample.addEventListener('click', () => {
    els.text.value = SAMPLE_TEXT;
    run();
    els.text.focus();
  });
  els.clear.addEventListener('click', () => {
    els.text.value = '';
    run();
    els.text.focus();
  });
  els.remember.addEventListener('change', () => {
    storage('set', REMEMBER_KEY, els.remember.checked ? '1' : '0');
    if (els.remember.checked) storage('set', TEXT_KEY, els.text.value);
    else storage('remove', TEXT_KEY);
  });
  for (const box of [els.hlLong, els.hlRepeat, els.hlAdverb]) box.addEventListener('change', () => last && renderHighlights(last));
  els.word.addEventListener('input', renderSyllables);
  renderSyllables();
  run();
}

init();
