const contentService = require('../services/contentService');
const AppError = require('../middleware/AppError');

function requireQuery(req) {
  const { query } = req.query;

  if (!query || query.trim().length === 0) {
    throw new AppError("Query parameter 'query' is required.", 400);
  }

  return query;
}

async function searchMovies(req, res) {
  const query = requireQuery(req);
  const results = await contentService.searchMovies(query);
  res.json({ query, count: results.length, results });
}

async function searchSeries(req, res) {
  const query = requireQuery(req);
  const results = await contentService.searchSeries(query);
  res.json({ query, count: results.length, results });
}

async function searchBooks(req, res) {
  const query = requireQuery(req);
  const results = await contentService.searchBooks(query);
  res.json({ query, count: results.length, results });
}

async function getDetails(req, res) {
  const { type, id } = req.params;
  const validTypes = ['movie', 'series', 'book'];

  if (!validTypes.includes(type)) {
    throw new AppError(`Invalid content type '${type}'. Must be one of: ${validTypes.join(', ')}.`, 400);
  }

  const details = await contentService.getDetails(type, id);

  if (!details) {
    throw new AppError('Content not found.', 404);
  }

  res.json(details);
}

async function getTrending(req, res) {
  const results = await contentService.getTrending();
  res.json({ count: results.length, results });
}

module.exports = { searchMovies, searchSeries, searchBooks, getDetails, getTrending };
