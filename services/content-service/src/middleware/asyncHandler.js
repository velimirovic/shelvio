// Express 4 ne hvata greske iz async funkcija - ovo ih prosledjuje u next(err).
function asyncHandler(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

module.exports = asyncHandler;
