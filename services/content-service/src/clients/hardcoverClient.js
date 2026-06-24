const axios = require('axios');
const config = require('../config');

// Hardcover je licni nalog vezan token (ne anonimni app-kljuc kao TMDB) - GraphQL API,
// jedan endpoint za sve upite. Testirano direktno (curl) - odgovara za ~0.6-0.9s, mnogo
// brze od Open Library-ja (8-10s za neke zapise).
const hardcoverClient = axios.create({
  baseURL: 'https://api.hardcover.app/v1',
  timeout: 10000,
  headers: {
    Authorization: config.hardcover.token,
    'Content-Type': 'application/json'
  }
});

async function graphql(query, variables) {
  const { data } = await hardcoverClient.post('/graphql', { query, variables });

  if (data.errors) {
    throw new Error(data.errors.map((e) => e.message).join('; '));
  }

  return data.data;
}

// query_type:"Book" koristi Typesense full-text pretragu sa podrazumevanim poljima
// (title, isbns, series_names, author_names, alternative_titles).
async function searchBooks(query) {
  const data = await graphql(
    `query SearchBooks($query: String!) {
      search(query: $query, query_type: "Book", per_page: 20) {
        results
      }
    }`,
    { query }
  );

  // Typesense vraca "hits" omotac (hit.document, hit.highlight, ...) - dalje u
  // contentService nam treba samo sam dokument, isto kao TMDB/sirovi rezultati.
  return (data.search.results?.hits ?? []).map((hit) => hit.document);
}

// "Slicne knjige" - Hardcover nema poseban "similar" endpoint, ali pretraga PO IMENU
// AUTORA (fields: "author_names" override) daje smislenu zamenu - ostale knjige istog
// autora, sto je realisticnija "slicnost" nego generic zanr-browsing (koji smo koristili
// kod Open Library-ja).
async function searchByAuthor(authorName) {
  const data = await graphql(
    `query SearchByAuthor($query: String!) {
      search(query: $query, query_type: "Book", fields: "author_names", weights: "1", typos: "5", per_page: 10) {
        results
      }
    }`,
    { query: authorName }
  );

  return (data.search.results?.hits ?? []).map((hit) => hit.document);
}

// Direktan upit po ID-u (NE search) - search je za TEKST pretragu, za pouzdano
// dobijanje TACNO ove knjige (puni opis, ocena, slika, zanrovi) koristi se obican
// GraphQL "books" upit. default_physical_edition.release_date je TACNIJI od
// books.release_year (koji je nekad pogresan - npr. najstarija/placeholder edicija).
async function getBookById(id) {
  const data = await graphql(
    `query GetBook($id: Int!) {
      books(where: { id: { _eq: $id } }) {
        id
        title
        description
        rating
        pages
        cached_image
        cached_tags
        default_physical_edition {
          release_date
        }
        contributions {
          author {
            name
          }
        }
      }
    }`,
    { id: Number(id) }
  );

  return data.books[0] ?? null;
}

// books_trending vraca SAMO ID-eve (ne pune objekte) - drugi upit (books where id _in)
// dovlaci podatke. Hasura "_in" filter NE cuva redosled ulazne liste, zato se rezultat
// rucno presortira da bi "Popular this week" zaista bio sortiran po popularnosti.
async function getTrendingBooks(limit = 20) {
  const trending = await graphql(
    `query TrendingBooks($limit: Int) {
      books_trending(duration: week, limit: $limit) {
        ids
      }
    }`,
    { limit }
  );

  const ids = trending.books_trending.ids ?? [];

  if (ids.length === 0) {
    return [];
  }

  const data = await graphql(
    `query BooksByIds($ids: [Int!]) {
      books(where: { id: { _in: $ids } }) {
        id
        title
        description
        rating
        cached_image
        default_physical_edition {
          release_date
        }
      }
    }`,
    { ids }
  );

  const byId = new Map(data.books.map((book) => [book.id, book]));

  return ids.map((id) => byId.get(id)).filter(Boolean);
}

module.exports = { searchBooks, searchByAuthor, getBookById, getTrendingBooks };
