const AppError = require('./AppError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Greska od eksternog API-ja (axios postavlja err.response kad server odgovori sa lose statusom).
  if (err.response) {
    const upstreamStatus = err.response.status;
    console.error('External API error:', upstreamStatus, err.response.data);

    // 404 prosledjujemo kao 404, sve ostalo (401/429/5xx) kao generican 502.
    if (upstreamStatus === 404) {
      return res.status(404).json({ error: 'Content not found.' });
    }

    return res.status(502).json({ error: 'Upstream content provider error.' });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'An unexpected error occurred.' });
}

module.exports = errorHandler;
