const tmdbClient = require('../clients/tmdbClient');
const hardcoverClient = require('../clients/hardcoverClient');
const cacheService = require('./cacheService');

// Fiksira TMDB-ov "sirov" float (npr. 7.7790000004) na tacno 2 decimale.
function roundRating(value) {
  return Math.round(value * 100) / 100;
}

// Prevodi TMDB/Hardcover odgovore u jedinstven oblik (contentId, contentType, title, year, posterUrl, rating, overview).
function normalizeMovie(result) {
  return {
    contentId: String(result.id),
    contentType: 'movie',
    title: result.title,
    year: result.release_date ? result.release_date.slice(0, 4) : null,
    posterUrl: tmdbClient.posterUrl(result.poster_path),
    rating: result.vote_average ? roundRating(result.vote_average) : null,
    overview: result.overview ?? ''
  };
}

function normalizeSeries(result) {
  return {
    contentId: String(result.id),
    contentType: 'series',
    title: result.name,
    year: result.first_air_date ? result.first_air_date.slice(0, 4) : null,
    posterUrl: tmdbClient.posterUrl(result.poster_path),
    rating: result.vote_average ? roundRating(result.vote_average) : null,
    overview: result.overview ?? ''
  };
}

// Hardcover search hit document (i search i searchByAuthor vracaju isti oblik).
function normalizeBook(doc) {
  return {
    contentId: String(doc.id),
    contentType: 'book',
    title: doc.title,
    year: doc.release_year ? String(doc.release_year) : null,
    posterUrl: doc.image?.url ?? null,
    // Hardcover ocenjuje 0-5, skaliramo na 0-10 (kao TMDB) - zato *2.
    rating: doc.rating ? roundRating(doc.rating * 2) : null,
    overview: doc.description ?? ''
  };
}

// Rangiranje: relevanceScore = textMatchScore*0.7 + popularityScore*0.3 - tekst dominira, popularnost samo razdvaja slicno dobre poklapanja.

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

// Pretraga po tipu (ne kombinovano) - svaki tip se nezavisno prikazuje na frontu, ne treba da se cekaju jedan drugog.
async function searchByKind(kind, query, fetchRaw, normalize) {
  const cacheKey = `content:search:${kind}:${query.toLowerCase().trim()}`;
  const cached = await cacheService.getCached(cacheKey);

  if (cached) {
    return cached;
  }

  const raw = await fetchRaw(query);

  const results = raw
    .map((item) => ({ item, score: relevanceScore(item, kind, query) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => normalize(entry.item))
    .filter((entry) => Boolean(entry.posterUrl)); // izbaci stavke bez postera

  await cacheService.setCached(cacheKey, results);

  return results;
}

function searchMovies(query) {
  return searchByKind('movie', query, tmdbClient.searchMovies, normalizeMovie);
}

function searchSeries(query) {
  return searchByKind('series', query, tmdbClient.searchSeries, normalizeSeries);
}

function searchBooks(query) {
  return searchByKind('book', query, hardcoverClient.searchBooks, normalizeBook);
}

async function getDetails(contentType, contentId) {
  const cacheKey = `content:detail:${contentType}:${contentId}`;
  const cached = await cacheService.getCached(cacheKey);

  if (cached) {
    return cached;
  }

  let details;

  if (contentType === 'movie') {
    const data = await tmdbClient.getMovieDetails(contentId);
    details = {
      contentId: String(data.id),
      contentType: 'movie',
      title: data.title,
      year: data.release_date ? data.release_date.slice(0, 4) : null,
      posterUrl: tmdbClient.posterUrl(data.poster_path),
      rating: data.vote_average ? roundRating(data.vote_average) : null,
      genres: data.genres?.map((g) => g.name) ?? [],
      // Koristi se za "ukupno vreme gledanja" statistiku u Tracking Service-u.
      durationMinutes: data.runtime || null,
      pages: null, // koncept "broja stranica" se ne primenjuje na filmove
      overview: data.overview ?? ''
    };
  } else if (contentType === 'series') {
    const data = await tmdbClient.getSeriesDetails(contentId);
    details = {
      contentId: String(data.id),
      contentType: 'series',
      title: data.name,
      year: data.first_air_date ? data.first_air_date.slice(0, 4) : null,
      posterUrl: tmdbClient.posterUrl(data.poster_path),
      rating: data.vote_average ? roundRating(data.vote_average) : null,
      genres: data.genres?.map((g) => g.name) ?? [],
      // TMDB nema jedinstveno "trajanje" za seriju - aproksimacija: trajanje epizode * broj epizoda.
      durationMinutes:
        data.episode_run_time?.[0] && data.number_of_episodes
          ? data.episode_run_time[0] * data.number_of_episodes
          : null,
      pages: null, // koncept "broja stranica" se ne primenjuje na serije
      overview: data.overview ?? ''
    };
  } else if (contentType === 'book') {
    const book = await hardcoverClient.getBookById(contentId);

    if (!book) {
      return null;
    }

    // default_physical_edition.release_date je TACNIJI od books.release_year (koji je
    // ponekad pogresan - npr. najstarija/placeholder edicija u njihovoj bazi).
    const releaseDate = book.default_physical_edition?.release_date;

    details = {
      contentId: String(book.id),
      contentType: 'book',
      title: book.title,
      year: releaseDate ? releaseDate.slice(0, 4) : null,
      posterUrl: book.cached_image?.url ?? null,
      rating: book.rating ? roundRating(book.rating * 2) : null,
      genres: (book.cached_tags?.Genre ?? []).map((g) => g.tag).slice(0, 5),
      durationMinutes: null, // koncept "trajanja" se ne primenjuje na knjige
      // "Pages read" statistika u Tracking Service-u (isti princip kao durationMinutes).
      pages: book.pages ?? null,
      // Koristi se kao "hint" za /similar (pretraga ostalih knjiga istog autora).
      author: book.contributions?.[0]?.author?.name ?? null,
      overview: book.description ?? ''
    };
  } else {
    return null;
  }

  await cacheService.setCached(cacheKey, details);

  return details;
}

// books_trending(duration: week) vraca "books" oblik (id/title/rating/cached_image/
// default_physical_edition), RAZLICIT od search hit dokumenta - zato posebna normalize.
function normalizeTrendingBook(book) {
  const releaseDate = book.default_physical_edition?.release_date;

  return {
    contentId: String(book.id),
    contentType: 'book',
    title: book.title,
    year: releaseDate ? releaseDate.slice(0, 4) : null,
    posterUrl: book.cached_image?.url ?? null,
    rating: book.rating ? roundRating(book.rating * 2) : null,
    overview: book.description ?? ''
  };
}

// "Popular this week" - tri nezavisna poziva (isti princip kao searchMovies/Series/
// Books - svaki tip se prikazuje cim stigne, ne ceka ostale).
async function getTrendingByKind(kind, fetchRaw, normalize) {
  const cacheKey = `content:trending:${kind}`;
  const cached = await cacheService.getCached(cacheKey);

  if (cached) {
    return cached;
  }

  const raw = await fetchRaw();
  const results = raw.map(normalize).filter((item) => Boolean(item.posterUrl));

  await cacheService.setCached(cacheKey, results, 60 * 60); // kraci TTL (1h) - trending se cesce menja

  return results;
}

function getTrendingMovies() {
  return getTrendingByKind('movie', tmdbClient.trendingMovies, normalizeMovie);
}

function getTrendingSeries() {
  return getTrendingByKind('series', tmdbClient.trendingSeries, normalizeSeries);
}

function getTrendingBooks() {
  return getTrendingByKind('book', hardcoverClient.getTrendingBooks, normalizeTrendingBook);
}

// "Slicni naslovi" za Detail ekran. Filmovi/serije koriste TMDB-ov sopstveni
// /recommendations endpoint (stvarno povezan sa konkretnim naslovom). Hardcover nema
// ekvivalentan endpoint, pa se za knjige koristi pretraga po AUTORU (ostale knjige
// istog autora) kao najbliza zamena - hint (autor) dolazi od frontenda (vec ga ima sa
// Detail stranice), bez njega vraca se prazna lista.
async function getSimilar(contentType, contentId, hint) {
  const cacheKey = `content:similar:${contentType}:${contentId}:${hint || ''}`;
  const cached = await cacheService.getCached(cacheKey);

  if (cached) {
    return cached;
  }

  let results;

  if (contentType === 'movie') {
    const raw = await tmdbClient.movieRecommendations(contentId);
    results = raw.map(normalizeMovie).filter((item) => Boolean(item.posterUrl));
  } else if (contentType === 'series') {
    const raw = await tmdbClient.seriesRecommendations(contentId);
    results = raw.map(normalizeSeries).filter((item) => Boolean(item.posterUrl));
  } else if (contentType === 'book' && hint) {
    const raw = await hardcoverClient.searchByAuthor(hint);
    results = raw.map(normalizeBook).filter((item) => Boolean(item.posterUrl) && item.contentId !== contentId);
  } else {
    results = [];
  }

  results = results.slice(0, 5);

  await cacheService.setCached(cacheKey, results);

  return results;
}

module.exports = {
  searchMovies,
  searchSeries,
  searchBooks,
  getDetails,
  getTrendingMovies,
  getTrendingSeries,
  getTrendingBooks,
  getSimilar
};
