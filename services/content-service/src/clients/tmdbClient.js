const axios = require('axios');
const config = require('../config');

// Specijalizovan axios klijent za TMDB - baseURL/api_key se dodaju automatski.
const tmdbClient = axios.create({
  baseURL: config.tmdb.baseUrl,
  timeout: 8000,
  params: {
    api_key: config.tmdb.apiKey,
    language: 'en-US'
  }
});

function posterUrl(posterPath) {
  return posterPath ? `https://image.tmdb.org/t/p/w342${posterPath}` : null;
}

async function searchMovies(query) {
  const { data } = await tmdbClient.get('/search/movie', { params: { query } });
  return data.results;
}

async function searchSeries(query) {
  const { data } = await tmdbClient.get('/search/tv', { params: { query } });
  return data.results;
}

async function getMovieDetails(id) {
  const { data } = await tmdbClient.get(`/movie/${id}`);
  return data;
}

async function getSeriesDetails(id) {
  const { data } = await tmdbClient.get(`/tv/${id}`);
  return data;
}

async function trendingMovies() {
  const { data } = await tmdbClient.get('/trending/movie/week');
  return data.results;
}

async function trendingSeries() {
  const { data } = await tmdbClient.get('/trending/tv/week');
  return data.results;
}

module.exports = {
  searchMovies,
  searchSeries,
  getMovieDetails,
  getSeriesDetails,
  trendingMovies,
  trendingSeries,
  posterUrl
};
