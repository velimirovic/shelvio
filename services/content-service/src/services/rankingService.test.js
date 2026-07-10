const {
  stripLeadingArticle,
  textMatchScore,
  popularityScore,
  relevanceScore
} = require('./rankingService');

describe('stripLeadingArticle', () => {
  test('skida "the/a/an" s pocetka naslova', () => {
    expect(stripLeadingArticle('the kite runner')).toBe('kite runner');
    expect(stripLeadingArticle('a beautiful mind')).toBe('beautiful mind');
    expect(stripLeadingArticle('an education')).toBe('education');
  });

  test('ne dira clan usred naslova', () => {
    expect(stripLeadingArticle('gone with the wind')).toBe('gone with the wind');
  });

  test('ne dira rec koja samo POCINJE kao clan ("theory" nije "the ory")', () => {
    expect(stripLeadingArticle('theory of everything')).toBe('theory of everything');
  });
});

describe('textMatchScore', () => {
  test('tacno poklapanje = 1', () => {
    expect(textMatchScore('Dune', 'dune')).toBe(1);
  });

  test('naslov sa clanom i bez clana se broje kao isto ime', () => {
    expect(textMatchScore('The Kite Runner', 'kite runner')).toBe(1);
    expect(textMatchScore('Kite Runner', 'the kite runner')).toBe(1);
  });

  test('prefiks (0.8) > substring (0.5) > bez poklapanja (0.2)', () => {
    expect(textMatchScore('Dune: Part Two', 'dune')).toBe(0.8);
    expect(textMatchScore('Children of Dune', 'dune')).toBe(0.5);
    expect(textMatchScore('Blade Runner', 'dune')).toBe(0.2);
  });

  test('bez naslova = 0', () => {
    expect(textMatchScore(null, 'dune')).toBe(0);
    expect(textMatchScore('', 'dune')).toBe(0);
  });
});

describe('popularityScore', () => {
  test('film/serija koristi TMDB "popularity", knjiga Hardcover "users_count"', () => {
    expect(popularityScore({ popularity: 99 }, 'movie')).toBeCloseTo(0.5);
    expect(popularityScore({ users_count: 99 }, 'book')).toBeCloseTo(0.5);
    // Za knjigu se popularity polje IGNORISE (pogresan izvor za taj tip).
    expect(popularityScore({ popularity: 99 }, 'book')).toBe(0);
  });

  test('log10 skala je ogranicena na opseg 0-1', () => {
    expect(popularityScore({ popularity: 0 }, 'movie')).toBe(0);
    expect(popularityScore({ popularity: 10_000_000 }, 'movie')).toBe(1);
  });
});

describe('relevanceScore', () => {
  test('tekst dominira: tacno poklapanje bez popularnosti > popularan naslov bez poklapanja', () => {
    const exactButObscure = relevanceScore({ title: 'Dune', popularity: 0 }, 'movie', 'dune');
    const popularButUnrelated = relevanceScore({ title: 'Blade Runner', popularity: 10_000 }, 'movie', 'dune');

    expect(exactButObscure).toBeGreaterThan(popularButUnrelated);
  });

  test('popularnost razdvaja dva jednako dobra tekstualna poklapanja', () => {
    const popular = relevanceScore({ title: 'Dune', popularity: 5000 }, 'movie', 'dune');
    const obscure = relevanceScore({ title: 'Dune', popularity: 2 }, 'movie', 'dune');

    expect(popular).toBeGreaterThan(obscure);
  });

  test('serije citaju naslov iz "name" polja (TMDB oblik), filmovi iz "title"', () => {
    const series = relevanceScore({ name: 'Dark', popularity: 100 }, 'series', 'dark');
    const movie = relevanceScore({ title: 'Dark', popularity: 100 }, 'movie', 'dark');

    expect(series).toBe(movie);
  });
});
