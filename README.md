# Analisador de Texto

Cole um texto em português e veja na hora: palavras, caracteres, frases, parágrafos, sílabas, tempo de leitura e de fala, índice de legibilidade de Flesch adaptado ao português, palavras mais frequentes, destaques para revisar (frases longas, repetições próximas e advérbios em -mente) e os limites do X, do Instagram e do SMS. Tudo no navegador, sem enviar o texto para lugar nenhum.

**Acesse online:** https://micdog22.github.io/analisador-de-texto/

## Recursos

- **Contagens:** caracteres com e sem espaços (contando o que se vê: "é" e um emoji valem um), palavras, frases, parágrafos, linhas, palavras diferentes, média de palavras por frase, sílabas e média de sílabas por palavra.
- **Separação silábica** por regras do português (ditongos, hiatos, dígrafos, encontros consonantais), com uma caixa para separar qualquer palavra: `psi-co-lo-gi-a`, `ra-i-nha`, `quei-jo`.
- **Tempo de leitura** (de 200 a 250 palavras por minuto) e **de fala** (cerca de 140).
- **Índice de Flesch** adaptado ao português (Martins et al., 1996), com a faixa de dificuldade e a conta feita com os números do seu texto.
- **Palavras mais frequentes** sem artigos, preposições e outras palavras muito comuns.
- **Destaques:** frases com mais de 30 palavras, a mesma palavra repetida em menos de 15 palavras e advérbios em -mente (sem confundir com "mente" ou "semente").
- **Limites** com barras de progresso: post no X (280, com as regras de peso de links e emojis), legenda do Instagram (2.200) e SMS (160 no alfabeto GSM, 70 quando há "ã", "ç" ou emoji, com o número de mensagens).
- Opção de lembrar o texto neste navegador (desligada por padrão).
- Rápido mesmo com textos longos: um livro de 40 mil palavras é analisado em uma fração de segundo.
- Sem dependências, sem servidor, sem rastreadores. A página bloqueia qualquer envio de dados pela rede (CSP).

## Como usar

Abra a página e cole ou digite o texto. Os números atualizam enquanto você digita. O botão **Texto de exemplo** carrega um parágrafo com frase longa, repetições e advérbios para ver os destaques funcionando.

## Como rodar localmente

Módulos ES não carregam via `file://`, então sirva a pasta com qualquer servidor estático:

```bash
python3 -m http.server 8000
```

Depois abra http://localhost:8000.

## Testes

```bash
npm test
```

São 30 testes com `node:test`, sem dependências:

- **sílabas:** uma lista de mais de 150 palavras com a separação oficial, escolhidas para cobrir cada regra (incluindo computador 4, saúde 3, queijo 2, guerra 2, psicologia 5, rainha 3 e país 2), maiúsculas, hífen, texto decomposto (NFD), trema antigo e os limites conhecidos;
- **contagens** em textos conhecidos, inclusive com emoji e quebra de linha do Windows;
- **frases** com abreviações, iniciais, reticências, números decimais, links e aspas;
- **Flesch:** a fórmula, um texto contado à mão e os limites de cada faixa;
- **palavras comuns, repetições, advérbios, tempos, SMS e X;**
- **grafemas:** a contagem rápida e a contagem em pedaços conferidas contra o `Intl.Segmenter`, e um teste de desempenho que pega qualquer volta de custo quadrático.

## Como funciona

### Sílabas

O número de sílabas é o número de núcleos vocálicos. O trabalho está nos encontros de vogais (ficam na mesma sílaba ou não?) e na distribuição das consoantes. As regras, na ordem em que são aplicadas:

1. **qu e gu:** o "u" depois de q ou g e antes de vogal acompanha a consoante e não é núcleo: `quei-jo`, `guer-ra`, `á-gua`, `Pa-ra-guai`.
2. **Ditongos nasais:** ã ou õ seguidos de e, o ou i ficam juntos: `mãe`, `pão`, `põe`, `co-ra-ção`.
3. **Ditongos decrescentes:** i e u sem acento depois de outra vogal ficam na mesma sílaba: `pai`, `mui-to`, `céu`, `he-rói`.
4. **Hiatos com i e u:** antes de "nh" (`ra-i-nha`, `mo-i-nho`) e antes de l, m, n, r ou z que fecham a sílaba (`a-in-da`, `sa-ir`, `Ra-ul`, `ju-iz`, `ru-im`, `cons-tru-ir`). Se a consoante abre a sílaba seguinte, é ditongo: `Jai-me`, `boi-na`, `bei-ra`; e "rr" não fecha a sílaba: `bair-ro`.
5. **Fim em "iu" ou "ui" depois de outra vogal:** `sa-iu`, `ca-iu`, `pos-su-iu`.
6. **Os demais encontros são hiatos:** vogais fortes (`te-a-tro`, `po-e-ta`), vogais iguais (`vo-o`, `le-em`), vogal com acento (`sa-ú-de`, `pa-ís`) e i ou u antes de vogal (`his-tó-ri-a`, `sé-ri-e`). Este último segue a separação escrita ensinada na escola; na fala, muita gente diz "his-tó-ria".
7. **Consoantes:** uma só entre vogais vai para a sílaba seguinte (`ca-sa`); duas se separam (`par-te`, `rit-mo`, `ad-vo-ga-do`), menos os grupos com l ou r (`a-bra-ço`, `a-tle-ta`) e os dígrafos ch, lh, nh (`fi-lho`, `ni-nho`). Já rr, ss, sc, sç, xc e xs se separam (`car-ro`, `nas-cer`, `ex-ce-to`). Com três ou mais consoantes, só a última passa para a próxima sílaba, ou as duas últimas se formarem grupo: `cons-tru-ir`, `pers-pec-ti-va`, `trans-plan-te`.
8. **Começo e fim:** consoantes antes da primeira vogal e depois da última ficam na primeira e na última sílaba: `psi-co-lo-gi-a`, `pneu-mo-ni-a`.

Prefixos como "sub" e "ab" desfazem grupos em algumas palavras (`sub-li-nhar`, `ab-rup-to`); elas estão numa pequena lista de exceções.

**Limites conhecidos.** Algumas separações dependem da sílaba tônica, que a escrita nem sempre mostra:

| Palavra | Heurística | Oficial |
| --- | --- | --- |
| proibido | proi-bi-do | pro-i-bi-do |
| juizado | jui-za-do | ju-i-za-do |
| reunião | reu-ni-ão | re-u-ni-ão |
| druida | drui-da | dru-i-da |
| arguir | ar-guir | ar-gu-ir |
| aleluia | a-le-lui-a | a-le-lu-ia (a contagem bate) |

Palavras estrangeiras seguem a escrita, não a pronúncia: "software" vira `soft-wa-re`. Siglas sem vogal ("CPF") e números contam como uma sílaba.

### Frases

Uma frase termina em ponto, exclamação, interrogação ou reticências seguidos de espaço, e também no fim de cada linha (títulos e listas sem pontuação). Não termina:

- depois de abreviações conhecidas: "Sr.", "Dra.", "pág.", "Ltda.", "nº";
- depois de uma inicial maiúscula: "J. R. R. Tolkien";
- quando o texto seguinte começa com minúscula: "Ele hesitou... e saiu.".

Pontos dentro de números ("3.5"), links e e-mails não contam, porque não vêm seguidos de espaço.

### Legibilidade (Flesch)

O índice de Flesch (1948) mede a facilidade de leitura pelo tamanho das frases e das palavras. Para o português, Martins, Ghiraldelo, Nunes e Oliveira Jr. (1996) somaram 42 à fórmula original, porque as palavras em português têm, em média, mais sílabas que em inglês:

```
248,835 - 1,015 × (palavras / frases) - 84,6 × (sílabas / palavras)
```

| Índice | Faixa | Costuma corresponder a |
| --- | --- | --- |
| 75 a 100 | Muito fácil | primeiros anos do ensino fundamental |
| 50 a 75 | Fácil | anos finais do ensino fundamental |
| 25 a 50 | Difícil | ensino médio e ensino superior |
| 0 a 25 | Muito difícil | textos acadêmicos e técnicos |

O índice é uma medida grosseira: não sabe se as palavras são conhecidas nem se o texto faz sentido. Serve melhor para comparar versões do mesmo texto.

### Caracteres e grafemas

Em JavaScript, `"👍🏽".length` é 4: o emoji são dois pontos de código, cada um com duas unidades UTF-16. O que a pessoa vê como um caractere é um **grafema**, e quem sabe agrupá-los é o `Intl.Segmenter`. Ele tem um problema prático: em alguns motores, percorrer um texto muito longo fica quadrático (o dobro do texto, quatro vezes o tempo). Por isso:

1. se o texto não tem nenhum caractere capaz de juntar pontos de código (marcas combinantes, ZWJ, seletores de variação, bandeiras, tons de pele, jamo coreano), cada ponto de código é um grafema e a contagem é direta, com CR + LF valendo um;
2. senão, o texto é cortado em pedaços de uns 2 mil caracteres, sempre entre dois caracteres ASCII visíveis (que nunca formam um grafema juntos), e cada pedaço passa pelo `Intl.Segmenter`.

Os testes conferem os dois caminhos contra o `Intl.Segmenter` aplicado ao texto inteiro.

### SMS: por que um "ã" muda tudo

SMS usa o alfabeto **GSM 03.38**, de 7 bits: 160 caracteres cabem em 140 bytes. Ele tem "é", "à", "ü" e "Ç", mas não tem "ã", "õ", "ç", "á", "í", "ó", "ú", "â", "ê" e "ô". Um único caractere fora do alfabeto obriga a mensagem inteira a usar **UCS-2** (16 bits por caractere), e o limite cai para 70. Mensagens maiores são divididas em partes de 153 (GSM) ou 67 (UCS-2) caracteres, porque cada parte guarda alguns bytes para a remontagem. Alguns símbolos (`€`, `{`, `[`, `~`) usam a tabela de extensão e valem 2.

### X (antigo Twitter)

O limite de 280 é por peso: letras latinas e a pontuação comum valem 1, a maioria dos outros sistemas de escrita (japonês, chinês) vale 2, cada emoji vale 2 e todo link vale 23, não importa o tamanho.

### Repetições e palavras frequentes

Para não poluir a lista, ficam de fora quase 280 palavras muito comuns (artigos, preposições, pronomes, conjunções e formas de ser, estar, ter, ir e poder). Uma repetição é a mesma palavra de quatro letras ou mais aparecendo de novo em até 15 palavras.

## Contribuindo

Issues e pull requests são bem-vindos.

## Licença

MIT. Veja [LICENSE](LICENSE).
