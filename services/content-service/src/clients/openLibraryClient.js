const axios = require('axios');

// Open Library ne trazi API kljuc - samo opisni User-Agent header.
const openLibraryClient = axios.create({
  baseURL: 'https://openlibrary.org',
  timeout: 8000,
  headers: { 'User-Agent': 'Shelvio/1.0 (student thesis project; contact: n/a)' }
});

function coverUrl(coverId, size = 'L') {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg` : null;
}

async function searchBooks(query) {
  const { data } = await openLibraryClient.get('/search.json', {
    params: {
      q: query,
      limit: 20,
      fields: 'key,title,author_name,cover_i,first_publish_year,ratings_average,ratings_count'
    }
  });
  return data.docs || [];
}

// workKey je "OL893415W" bez "/works/" prefiksa (da ne sadrzi "/" u contentId-u).
async function getWorkDetails(workKey) {
  const { data } = await openLibraryClient.get(`/works/${workKey}.json`);
  return data;
}

async function getWorkRating(workKey) {
  try {
    const { data } = await openLibraryClient.get(`/works/${workKey}/ratings.json`);
    return data.summary?.average ?? null;
  } catch {
    // Neke knjige nemaju ocene - rating ostaje null.
    return null;
  }
}

module.exports = { searchBooks, getWorkDetails, getWorkRating, coverUrl };
