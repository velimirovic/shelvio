const express = require('express');
const rateLimit = require('express-rate-limit');
const contentController = require('../controllers/contentController');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// Ogranicava broj poziva po IP adresi (stiti i nas i TMDB/Open Library limit).
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

// /search/* mora ici pre /:type/:id (Express bi inace "search" protumacio kao type).
router.get('/search/movies', searchLimiter, asyncHandler(contentController.searchMovies));
router.get('/search/series', searchLimiter, asyncHandler(contentController.searchSeries));
router.get('/search/books', searchLimiter, asyncHandler(contentController.searchBooks));
router.get('/trending', asyncHandler(contentController.getTrending));
router.get('/:type/:id', asyncHandler(contentController.getDetails));

module.exports = router;
