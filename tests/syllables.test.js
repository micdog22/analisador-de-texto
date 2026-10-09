import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syllabify, countSyllables, hyphenate } from '../src/syllables.js';

// Separação oficial (ortográfica) de palavras escolhidas para cobrir cada regra.
const CURATED = {
  // pedidas na especificação
  computador: 'com-pu-ta-dor',
  saúde: 'sa-ú-de',
  queijo: 'quei-jo',
  guerra: 'guer-ra',
  psicologia: 'psi-co-lo-gi-a',
  rainha: 'ra-i-nha',
  país: 'pa-ís',
  // ditongos decrescentes
  pai: 'pai', caixa: 'cai-xa', primeiro: 'pri-mei-ro', noite: 'noi-te', muito: 'mui-to', fui: 'fui',
  auto: 'au-to', europeu: 'eu-ro-peu', pouco: 'pou-co', viu: 'viu', céu: 'céu', chapéu: 'cha-péu',
  papéis: 'pa-péis', herói: 'he-rói', gratuito: 'gra-tui-to', cuidado: 'cui-da-do', saudade: 'sau-da-de',
  neurônio: 'neu-rô-ni-o', azuis: 'a-zuis', possui: 'pos-sui',
  // ditongos nasais
  mãe: 'mãe', pão: 'pão', cães: 'cães', põe: 'põe', coração: 'co-ra-ção', lições: 'li-ções', opinião: 'o-pi-ni-ão',
  // i e u seguidos de vogal: hiato na separação escrita
  história: 'his-tó-ri-a', família: 'fa-mí-li-a', série: 'sé-ri-e', rio: 'ri-o', navio: 'na-vi-o', lua: 'lu-a',
  tênue: 'tê-nu-e', vácuo: 'vá-cu-o', dia: 'di-a',
  // hiato por acento
  baú: 'ba-ú', saída: 'sa-í-da', juízo: 'ju-í-zo', egoísmo: 'e-go-ís-mo', heroína: 'he-ro-í-na', Piauí: 'Pi-au-í',
  // hiato antes de nh e de l, m, n, r, z que fecham a sílaba
  moinho: 'mo-i-nho', campainha: 'cam-pa-i-nha', ainda: 'a-in-da', ruim: 'ru-im', juiz: 'ju-iz', raiz: 'ra-iz',
  sair: 'sa-ir', cair: 'ca-ir', Raul: 'Ra-ul', Coimbra: 'Co-im-bra', contribuinte: 'con-tri-bu-in-te',
  construir: 'cons-tru-ir', saindo: 'sa-in-do', amendoim: 'a-men-do-im',
  // mesmas letras, mas ditongo (a consoante abre a sílaba seguinte)
  bairro: 'bair-ro', Jaime: 'Jai-me', boina: 'boi-na', Raimundo: 'Rai-mun-do', beira: 'bei-ra', cuidar: 'cui-dar',
  paulista: 'pau-lis-ta', Aimoré: 'Ai-mo-ré', deixar: 'dei-xar',
  // vogais fortes ou iguais: hiato
  teatro: 'te-a-tro', poeta: 'po-e-ta', coelho: 'co-e-lho', caos: 'ca-os', aorta: 'a-or-ta', Rafael: 'Ra-fa-el',
  geografia: 'ge-o-gra-fi-a', área: 'á-re-a', pessoa: 'pes-so-a', voo: 'vo-o', leem: 'le-em', xiita: 'xi-i-ta',
  zoológico: 'zo-o-ló-gi-co', Saara: 'Sa-a-ra', aeroporto: 'a-e-ro-por-to',
  // três vogais seguidas
  ideia: 'i-dei-a', saia: 'sai-a', praia: 'prai-a', joia: 'joi-a', areia: 'a-rei-a', maior: 'mai-or', saiu: 'sa-iu',
  caiu: 'ca-iu', possuiu: 'pos-su-iu', atraiu: 'a-tra-iu', Cuiabá: 'Cui-a-bá', baiuca: 'bai-u-ca',
  // qu e gu
  aquilo: 'a-qui-lo', sangue: 'san-gue', esquema: 'es-que-ma', água: 'á-gua', Paraguai: 'Pa-ra-guai',
  iguais: 'i-guais', quais: 'quais', saguão: 'sa-guão', quieto: 'qui-e-to', psiquiatra: 'psi-qui-a-tra',
  ambíguo: 'am-bí-guo', linguiça: 'lin-gui-ça', aguentar: 'a-guen-tar', quociente: 'quo-ci-en-te', agudo: 'a-gu-do',
  // grupos consonantais inseparáveis
  abraço: 'a-bra-ço', atleta: 'a-tle-ta', livro: 'li-vro', planta: 'plan-ta', problema: 'pro-ble-ma',
  atlântico: 'a-tlân-ti-co', reflexo: 're-fle-xo', obrigado: 'o-bri-ga-do', outro: 'ou-tro', cofre: 'co-fre',
  // duas consoantes que se separam
  parte: 'par-te', advogado: 'ad-vo-ga-do', ritmo: 'rit-mo', apto: 'ap-to', pacto: 'pac-to', digno: 'dig-no',
  absoluto: 'ab-so-lu-to', submarino: 'sub-ma-ri-no', admitir: 'ad-mi-tir', objeto: 'ob-je-to',
  segmento: 'seg-men-to', técnico: 'téc-ni-co', mesmo: 'mes-mo', também: 'tam-bém', tempo: 'tem-po',
  // dígrafos
  carro: 'car-ro', passo: 'pas-so', nascer: 'nas-cer', desça: 'des-ça', exceto: 'ex-ce-to', exsudar: 'ex-su-dar',
  chave: 'cha-ve', filho: 'fi-lho', ninho: 'ni-nho', malha: 'ma-lha', piscina: 'pis-ci-na', crescer: 'cres-cer',
  // três ou mais consoantes
  abstrato: 'abs-tra-to', transporte: 'trans-por-te', perspectiva: 'pers-pec-ti-va', instrumento: 'ins-tru-men-to',
  obstáculo: 'obs-tá-cu-lo', inspetor: 'ins-pe-tor', monstro: 'mons-tro', transplante: 'trans-plan-te',
  // consoantes no começo da palavra
  pneu: 'pneu', pneumonia: 'pneu-mo-ni-a', gnomo: 'gno-mo',
  // h e x
  Bahia: 'Ba-hi-a', homem: 'ho-mem', táxi: 'tá-xi', exceção: 'ex-ce-ção',
  // prefixos
  sublinhar: 'sub-li-nhar', abrupto: 'ab-rup-to', sublime: 'su-bli-me',
  // palavras longas e outras
  otorrinolaringologista: 'o-tor-ri-no-la-rin-go-lo-gis-ta',
  inconstitucionalissimamente: 'in-cons-ti-tu-ci-o-na-lis-si-ma-men-te',
  paralelepípedo: 'pa-ra-le-le-pí-pe-do', pássaro: 'pás-sa-ro', Brasil: 'Bra-sil', Limeira: 'Li-mei-ra',
  ação: 'a-ção', ao: 'ao', aos: 'aos', é: 'é', a: 'a', guarda: 'guar-da',
};

test('separação silábica de palavras escolhidas', () => {
  const wrong = [];
  for (const [word, expected] of Object.entries(CURATED)) {
    const got = hyphenate(word);
    if (got !== expected) wrong.push(`${word}: esperado ${expected}, veio ${got}`);
  }
  assert.deepEqual(wrong, []);
  assert.ok(Object.keys(CURATED).length >= 150, `lista com ${Object.keys(CURATED).length} palavras`);
});

test('contagem das palavras da especificação', () => {
  const expected = { computador: 4, saúde: 3, queijo: 2, guerra: 2, psicologia: 5, rainha: 3, país: 2 };
  for (const [word, n] of Object.entries(expected)) assert.equal(countSyllables(word), n, word);
});

test('contagem é igual ao número de partes da separação', () => {
  for (const word of Object.keys(CURATED)) assert.equal(countSyllables(word), syllabify(word).length, word);
});

test('maiúsculas, acentos e hífen', () => {
  assert.equal(hyphenate('COMPUTADOR'), 'COM-PU-TA-DOR');
  assert.equal(hyphenate('Saúde'), 'Sa-ú-de');
  assert.equal(hyphenate('guarda-chuva'), 'guar-da-chu-va');
  assert.equal(countSyllables('guarda-chuva'), 4);
  assert.equal(hyphenate('fazê-lo'), 'fa-zê-lo');
  // texto em NFD (acento como caractere separado) dá o mesmo resultado
  assert.equal(hyphenate('saúde'.normalize('NFD')), 'sa-ú-de');
});

test('casos sem vogal e entradas vazias', () => {
  assert.equal(countSyllables('CPF'), 1);
  assert.equal(countSyllables('2026'), 1);
  assert.equal(countSyllables(''), 0);
  assert.equal(countSyllables(null), 0);
  assert.deepEqual(syllabify('   '), []);
});

test('trema antigo e y', () => {
  assert.equal(hyphenate('lingüiça'), 'lin-güi-ça');
  assert.equal(hyphenate('tranqüilo'), 'tran-qüi-lo');
  assert.equal(hyphenate('Yasmin'), 'Yas-min');
  assert.equal(countSyllables('hobby'), 2);
});

// Limites conhecidos da heurística (documentados no README). Estes testes fixam o
// comportamento atual: se algum deles mudar, a documentação precisa mudar junto.
test('limites conhecidos: hiatos que dependem da pronúncia', () => {
  assert.equal(hyphenate('proibido'), 'proi-bi-do'); // oficial: pro-i-bi-do
  assert.equal(hyphenate('juizado'), 'jui-za-do'); // oficial: ju-i-za-do
  assert.equal(hyphenate('reunião'), 'reu-ni-ão'); // oficial: re-u-ni-ão
  assert.equal(hyphenate('druida'), 'drui-da'); // oficial: dru-i-da
  assert.equal(hyphenate('arguir'), 'ar-guir'); // oficial: ar-gu-ir
});

test('limites conhecidos: divisão diferente com a mesma contagem', () => {
  assert.equal(hyphenate('aleluia'), 'a-le-lui-a'); // oficial: a-le-lu-ia
  assert.equal(countSyllables('aleluia'), 4);
});

test('limites conhecidos: palavras estrangeiras seguem a escrita, não a pronúncia', () => {
  assert.equal(hyphenate('software'), 'soft-wa-re'); // pronúncia: duas sílabas
  assert.equal(countSyllables('site'), 2);
  assert.equal(countSyllables('mouse'), 2);
});
