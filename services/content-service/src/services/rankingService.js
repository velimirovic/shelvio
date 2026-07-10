// Algoritam rangiranja rezultata pretrage - IZDVOJEN u zaseban modul jer su ovo ciste
// funkcije (bez Redis/HTTP zavisnosti), pa se testiraju izolovano (rankingService.test.js).
//
// relevanceScore = textMatchScore*0.7 + popularityScore*0.3 - tekst dominira,
// popularnost samo razdvaja slicno dobra poklapanja.

// Skida "the/a/an " s pocetka - bez ovoga "The Kite Runner" i "Kite Runner" (cest
// slucaj duplikata istog naslova sa/bez clana) ne broje se kao isto ime, pa losiji
// (manje poznat) duplikat moze da pretekne pravu/poznatu knjigu/film samo zato sto mu
// se naziv slovo-po-slovo bukvalnije poklapa sa upitom.
function stripLeadingArticle(text) {
  return text.replace(/^(the|a|an)\s+/, '');
}

function textMatchScore(title, query) {
  if (!title) return 0;

  const normalizedTitle = stripLeadingArticle(title.toLowerCase().trim());
  const normalizedQuery = stripLeadingArticle(query.toLowerCase().trim());

  if (normalizedTitle === normalizedQuery) return 1;
  if (normalizedTitle.startsWith(normalizedQuery)) return 0.8;
  if (normalizedTitle.includes(normalizedQuery)) return 0.5;

  return 0.2;
}

// TMDB "popularity" ili Hardcover "users_count" (koliko korisnika ima knjigu u
// biblioteci - jaci signal poznatosti od ratings_count), log10-skalirano u opseg 0-1.
function popularityScore(raw, kind) {
  const rawPopularity = kind === 'movie' || kind === 'series' ? raw.popularity || 0 : raw.users_count || 0;

  return Math.min(Math.log10(rawPopularity + 1) / 4, 1);
}

function titleOf(raw, kind) {
  if (kind === 'movie') return raw.title;
  if (kind === 'series') return raw.name;
  return raw.title;
}

function relevanceScore(raw, kind, query) {
  return textMatchScore(titleOf(raw, kind), query) * 0.7 + popularityScore(raw, kind) * 0.3;
}

module.exports = {
  stripLeadingArticle,
  textMatchScore,
  popularityScore,
  relevanceScore
};
