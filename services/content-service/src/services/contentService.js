const tmdbClient = require('../clients/tmdbClient');
const openLibraryClient = require('../clients/openLibraryClient');
const cacheService = require('./cacheService');

// Fiksira TMDB-ov "sirov" float (npr. 7.7790000004) na tacno 2 decimale.
function roundRating(value) {
  return Math.round(value * 100) / 100;
}

// Prevodi TMDB/Open Library odgovore u jedinstven oblik (contentId, contentType, title, year, posterUrl, rating, overview).
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

function normalizeBook(doc) {
  return {
    contentId: doc.key.replace('/works/', ''),
    contentType: 'book',
    title: doc.title,
    year: doc.first_publish_year ? String(doc.first_publish_year) : null,
    posterUrl: openLibraryClient.coverUrl(doc.cover_i),
    // Open Library ocenjuje 0-5, skaliramo na 0-10 (kao TMDB) - zato *2.
    rating: doc.ratings_average ? roundRating(doc.ratings_average * 2) : null,
    // Opis se povlaci tek u getDetails(), search rezultati ga ne sadrze.
    overview: ''
  };
}

// Rangiranje: relevanceScore = textMatchScore*0.7 + popularityScore*0.3 - tekst dominira, popularnost samo razdvaja slicno dobre poklapanja.
function textMatchScore(title, query) {
  if (!title) return 0;

  const normalizedTitle = title.toLowerCase().trim();
  const normalizedQuery = query.toLowerCase().trim();

  if (normalizedTitle === normalizedQuery) return 1;
  if (normalizedTitle.startsWith(normalizedQuery)) return 0.8;
  if (normalizedTitle.includes(normalizedQuery)) return 0.5;

  return 0.2;
}

// TMDB "popularity" ili Open Library "ratings_count", log10-skalirano u opseg 0-1.
function popularityScore(raw, kind) {
  const rawPopularity = kind === 'movie' || kind === 'series' ? raw.popularity || 0 : raw.ratings_count || 0;

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

// Pretraga po tipu (ne kombinovano) - Open Library je sporiji od TMDB-a, ne treba da blokira prikaz filmova/serija.
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
  // Open Library odbija upite krace od 3 karaktera (422) - vrati praznu listu umesto greske.
  if (query.trim().length < 3) {
    return Promise.resolve([]);
  }

  return searchByKind('book', query, openLibraryClient.searchBooks, normalizeBook);
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
      overview: data.overview ?? ''
    };
  } else if (contentType === 'book') {
    // Detalji i ocena su dva razlicita Open Library endpoint-a, pozivaju se paralelno.
    const [work, rating] = await Promise.all([
      openLibraryClient.getWorkDetails(contentId),
      openLibraryClient.getWorkRating(contentId)
    ]);

    const description = typeof work.description === 'string' ? work.description : work.description?.value ?? '';

    details = {
      contentId,
      contentType: 'book',
      title: work.title,
      year: null, // works endpoint nema godinu prvog izdanja
      posterUrl: work.covers?.[0] ? openLibraryClient.coverUrl(work.covers[0]) : null,
      rating: rating ? roundRating(rating * 2) : null,
      genres: (work.subjects || []).slice(0, 5),
      overview: description
    };
  } else {
    return null;
  }

  await cacheService.setCached(cacheKey, details);

  return details;
}

// Prikazuje se dok je polje za pretragu prazno - samo filmovi+serije (Open Library nema trending endpoint).
async function getTrending() {
  const cacheKey = 'content:trending';
  const cached = await cacheService.getCached(cacheKey);

  if (cached) {
    return cached;
  }

  const [movies, series] = await Promise.all([tmdbClient.trendingMovies(), tmdbClient.trendingSeries()]);

  const results = [...movies.map(normalizeMovie), ...series.map(normalizeSeries)].filter((item) =>
    Boolean(item.posterUrl)
  );

  await cacheService.setCached(cacheKey, results, 60 * 60); // kraci TTL (1h) - trending se cesce menja

  return results;
}

module.exports = { searchMovies, searchSeries, searchBooks, getDetails, getTrending };
