// Listas de palavras usadas na análise.

// Palavras comuns do português (artigos, preposições, pronomes, conjunções, advérbios
// muito frequentes e formas dos verbos ser, estar, ter, haver, ir, poder e fazer).
// Elas ficam de fora da lista de palavras mais frequentes e das repetições.
export const STOPWORDS = new Set(`
a à agora ai aí ainda além algo alguém algum alguma algumas alguns ali ante antes ao aos apenas após aquela aquelas
aquele aqueles aquilo as às assim até cá cada coisa com comigo como conforme conosco contigo contra contudo convosco
cujo cuja cujos cujas da daquela daquele daquilo das de dela delas dele deles demais depois desde dessa dessas desse
desses desta destas deste destes deve devem deveria devia disso disto do dos durante e é ela elas ele eles em embora
enquanto entre então era eram éramos essa essas esse esses esta está estamos estão estar estas estava estavam este
esteja estejam estes esteve estive estou eu faz fazem fazer feita feito foi fomos for fora foram fosse fossem fui
há haja havia houve hoje isso isto já la lá lhe lhes lo logo mais mal mas me mesma mesmas mesmo mesmos meu meus mim
minha minhas muita muitas muito muitos na nada não naquela naquele nas nem nenhum nenhuma nessa nesse nesta neste
né ninguém nisso nisto no nos nós nossa nossas nosso nossos num numa nunca o onde os ou outra outras outro outros
para pela pelas pelo pelos perante pode podem poder poderia podia pois por porém porque porquê pouco pra pro qual
quais qualquer quando quanto quantos quanta quantas que quem se segundo seja sejam sem sempre sendo ser será serão
seria seriam seu seus si sido só sob sobre sua suas talvez também tampouco tanta tantas tanto tantos te tem têm
temos tenha tenham tenho ter teu teus teve ti tinha tinham tive toda todas todo todos tu tua tuas tudo um uma umas
uns vai vamos vão você vocês vos vou
`.trim().split(/\s+/));

// Palavras terminadas em -mente que não são advérbios (substantivos, adjetivos e verbos).
export const NOT_ADVERBS = new Set(`
mente mentes demente dementes semente sementes clemente veemente dormente dormentes cimente comente comentem
lamente lamentem aumente aumentem alimente alimentem experimente experimentem fomente fomentem implemente
implementem complemente complementem documente documentem atormente fermente argumente argumentem incremente
movimente movimentem fragmente segmente cumprimente regulamente sedimente ornamente
`.trim().split(/\s+/));
