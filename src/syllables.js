// Separação silábica do português por regras (heurística ortográfica).
//
// O número de sílabas é o número de núcleos vocálicos. O trabalho está em decidir,
// em cada encontro de vogais, se elas ficam na mesma sílaba (ditongo, tritongo) ou em
// sílabas diferentes (hiato), e em distribuir as consoantes entre as sílabas.
//
// Regras usadas, em ordem:
//  1. "u" depois de q ou g e antes de vogal não é núcleo (qu, gu): quei-jo, guer-ra, á-gua.
//  2. Vogal nasal ã/õ seguida de e, o ou i forma ditongo: mãe, pão, põe, cãi-bra.
//  3. i e u sem acento depois de outra vogal formam ditongo decrescente: pai, mui-to, céu.
//     Exceções (hiato): antes de "nh" (ra-i-nha) e antes de l, m, n, r ou z que fecham a
//     sílaba (a-in-da, sa-ir, Ra-ul, ju-iz, ru-im). "rr" não fecha: bair-ro.
//  4. "iu" ou "ui" no fim da palavra depois de outra vogal ficam juntos: sa-iu, pos-su-iu.
//  5. Os demais encontros são hiatos: vogais fortes (te-a-tro, po-e-ta), vogais iguais
//     (vo-o, le-em), vogal acentuada (sa-ú-de, pa-ís) e i/u antes de vogal (his-tó-ri-a).
//  6. Consoantes: uma entre vogais vai para a sílaba seguinte (ca-sa); duas se separam
//     (par-te, rit-mo), menos os grupos com l ou r (a-bra-ço, a-tle-ta) e os dígrafos
//     ch, lh, nh, qu e gu (fi-lho, a-qui-lo). rr, ss, sc, sç, xc e xs se separam
//     (car-ro, nas-cer, ex-ce-to). Com três ou mais, só a última vai para a próxima
//     sílaba, ou as duas últimas se formarem grupo: cons-tru-ir, pers-pec-ti-va.
//  7. Consoantes do começo e do fim ficam na primeira e na última sílaba: psi-co-lo-gi-a.

const VOWELS = 'aeiouáàâãéêíóôõúüy';
const NASAL = 'ãõ';
const CODA_HIATUS = 'lmnrz';
const CLUSTER_FIRST = 'pbtdcgfv';
const CLUSTER_SECOND = 'lr';

// Palavras com prefixo em que b + l/r não formam grupo (sub-li-nhar, ab-rup-to).
const PREFIX_BREAKS = [['sublinh', 3], ['subloc', 3], ['sublun', 3], ['subrog', 3], ['abrupt', 2], ['abrog', 2]];

const isVowel = (c) => c !== undefined && VOWELS.includes(c);
const isWeak = (c) => c === 'i' || c === 'u' || c === 'y';

/** Duas vogais seguidas (v e c) ficam na mesma sílaba? `after` é o que vem depois de c. */
function joins(v, c, after) {
  if (NASAL.includes(v) && 'eoi'.includes(c)) return true;
  if (!isWeak(c) || v === c) return false;
  if (after !== null) {
    if (after.startsWith('nh')) return false;
    const c1 = after[0];
    const c2 = after[1];
    if (c1 !== undefined && CODA_HIATUS.includes(c1) && !isVowel(c2) && c2 !== c1 && c2 !== 'h') return false;
  }
  return true;
}

/** Divide uma sequência de vogais em núcleos. Retorna o tamanho de cada grupo. */
function splitRun(run, after) {
  const k = run.length;
  const glide = new Array(k).fill(false);
  let limit = k;
  if (k >= 3 && after === '' && isWeak(run[k - 2]) && isWeak(run[k - 1]) && run[k - 2] !== run[k - 1]) {
    glide[k - 1] = true; // sa-iu: o "u" acompanha o "i"
    limit = k - 2;
  }
  for (let j = 1; j < limit; j++) {
    if (glide[j - 1]) continue;
    if (joins(run[j - 1], run[j], j === k - 1 ? after : null)) glide[j] = true;
  }
  const groups = [];
  for (let j = 0; j < k; j++) {
    if (glide[j]) groups[groups.length - 1]++;
    else groups.push(1);
  }
  return groups;
}

/** Onde começa a próxima sílaba entre as posições a e b (só consoantes entre dois núcleos). */
function splitPoint(w, a, b, kind) {
  if (a === b) return a;
  const units = [];
  let i = a;
  while (i < b) {
    const pair = w.slice(i, i + 2);
    if (i + 1 < b && (pair === 'ch' || pair === 'lh' || pair === 'nh')) {
      units.push([i, i + 2]);
      i += 2;
    } else if ((w[i] === 'q' || w[i] === 'g') && i + 1 < b && kind[i + 1] === 'G') {
      units.push([i, i + 2]);
      i += 2;
    } else {
      units.push([i, i + 1]);
      i++;
    }
  }
  if (units.length === 1) return units[0][0];
  const last = units[units.length - 1];
  const prev = units[units.length - 2];
  const single = (u) => u[1] - u[0] === 1;
  if (single(prev) && single(last) && CLUSTER_FIRST.includes(w[prev[0]]) && CLUSTER_SECOND.includes(w[last[0]])) {
    return prev[0];
  }
  return last[0];
}

function splitSimple(text) {
  let original = text;
  let w = original.toLocaleLowerCase('pt-BR');
  if (w.length !== original.length) original = w; // minúscula com tamanho diferente (raro): usa a minúscula
  const n = w.length;
  if (!n) return [];
  if (w === 'ao' || w === 'aos') return [original];
  // V = vogal, G = "u" de qu/gu (vai junto com a consoante), C = consoante
  const kind = new Array(n);
  for (let i = 0; i < n; i++) {
    const c = w[i];
    if (!isVowel(c)) kind[i] = 'C';
    else if (c === 'y' && i === 0 && isVowel(w[1])) kind[i] = 'C';
    else if ((c === 'u' || c === 'ü') && (w[i - 1] === 'q' || w[i - 1] === 'g') && isVowel(w[i + 1])) kind[i] = 'G';
    else kind[i] = 'V';
  }
  const nuclei = [];
  for (let i = 0; i < n;) {
    if (kind[i] !== 'V') {
      i++;
      continue;
    }
    let j = i;
    while (j < n && kind[j] === 'V') j++;
    const run = w.slice(i, j).replace(/ü/g, 'u');
    let pos = i;
    for (const len of splitRun(run, w.slice(j))) {
      nuclei.push([pos, pos + len]);
      pos += len;
    }
    i = j;
  }
  if (nuclei.length <= 1) return [original];
  const cuts = [];
  for (let k = 1; k < nuclei.length; k++) {
    const a = nuclei[k - 1][1];
    const b = nuclei[k][0];
    let cut = splitPoint(w, a, b, kind);
    for (const [prefix, at] of PREFIX_BREAKS) {
      if (w.startsWith(prefix) && at >= a && at <= b) cut = at;
    }
    cuts.push(cut);
  }
  const out = [];
  let start = 0;
  for (const cut of cuts) {
    out.push(original.slice(start, cut));
    start = cut;
  }
  out.push(original.slice(start));
  return out;
}

/**
 * Separa uma palavra em sílabas. Palavras com hífen são separadas parte por parte
 * (guar-da-chu-va). Retorna a lista de sílabas, preservando maiúsculas e acentos.
 */
export function syllabify(word) {
  const clean = String(word ?? '').normalize('NFC').trim();
  if (!clean) return [];
  return clean.split(/-+/).filter(Boolean).flatMap((part) => splitSimple(part.replace(/[^\p{L}]/gu, '') || part));
}

/** Número de sílabas (no mínimo 1 para qualquer palavra não vazia). */
export function countSyllables(word) {
  const parts = syllabify(word);
  return parts.length ? parts.length : 0;
}

/** Sílabas separadas por hífen, como na escola: "com-pu-ta-dor". */
export function hyphenate(word) {
  return syllabify(word).join('-');
}
