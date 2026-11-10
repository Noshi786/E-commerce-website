import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProductSearchFilter,
  getFuzzySearchScore,
  getSemanticSearchResults,
} from '../controllers/chatController.js';

test('product search matches each query word across searchable fields', () => {
  const filter = buildProductSearchFilter({ query: 'new arrivals gift' });

  assert.equal(filter.$and.length, 3);
  assert.deepEqual(
    filter.$and.map((condition) => condition.$or[0].title.source),
    ['new', 'arrivals', 'gift'],
  );
  assert.ok(filter.$and.every((condition) => condition.$or.length === 4));
  const matches = (index, field, value) =>
    filter.$and[index].$or.some((condition) => condition[field]?.test(value));
  assert.ok(matches(0, 'title', 'New bracelet'));
  assert.ok(matches(1, 'description', 'Arrivals today'));
  assert.ok(matches(2, 'category', 'Gift sets'));
});

test('product search escapes regex characters and preserves the maximum price', () => {
  const filter = buildProductSearchFilter({ query: 'ring.v2 silver', maxPrice: 5000 });

  assert.equal(filter.price.$lte, 5000);
  assert.equal(filter.$and.length, 2);
  assert.ok(filter.$and[0].$or[0].title.test('A ring.v2'));
  assert.equal(filter.$and[0].$or[0].title.test('A ringxv2'), false);
});

test('product search ignores a query without searchable words', () => {
  assert.equal(buildProductSearchFilter({ query: '?!' }), null);
});

test('availability search filters for positive stock without searching stock as a product term', () => {
  const filter = buildProductSearchFilter({
    query: 'What products are in stock?',
    inStockOnly: true,
  });

  assert.deepEqual(filter, { $and: [{ stock: { $gt: 0 } }] });
});

test('availability search can match product terms and require positive stock', () => {
  const filter = buildProductSearchFilter({
    query: 'Do you have the blue scarf in stock?',
    inStockOnly: true,
  });
  const searchConditions = filter.$and.filter((condition) => condition.$or);

  assert.deepEqual(
    searchConditions.map((condition) => condition.$or[0].title.source),
    ['blue', 'scarf'],
  );
  assert.deepEqual(filter.$and.at(-1), { stock: { $gt: 0 } });
});

test('natural-language filler does not prevent product search matches', () => {
  const filter = buildProductSearchFilter({ query: 'Show me new arrivals' });

  assert.deepEqual(
    filter.$and.map((condition) => condition.$or[0].title.source),
    ['new', 'arrivals'],
  );
});

test('fuzzy product matching handles a misspelled product name', () => {
  assert.equal(
    getFuzzySearchScore('braclet', { title: 'Silver bracelet' }),
    1,
  );
});

test('fuzzy product matching handles phonetic spelling like moskra for mascara', () => {
  assert.equal(getFuzzySearchScore('moskra', { title: 'Mascara' }), 1);
});

test('fuzzy product matching handles transposed letters and searchable fields', () => {
  assert.equal(
    getFuzzySearchScore('bleu scarf', {
      title: 'Winter scarf',
      category: 'Blue accessories',
    }),
    1,
  );
});

test('fuzzy product matching rejects unrelated words and short typo terms', () => {
  assert.equal(getFuzzySearchScore('shoe', { title: 'Silver bracelet' }), null);
  assert.equal(getFuzzySearchScore('ca', { title: 'cat' }), null);
});

test('semantic product search ranks relevant products by cosine similarity', () => {
  const products = [
    { title: 'Somewhat related' },
    { title: 'Best match' },
    { title: 'Unrelated' },
  ];

  assert.deepEqual(
    getSemanticSearchResults(
      [1, 0],
      products,
      [
        [0.8, 0.6],
        [1, 0],
        [0.1, 0.99],
      ],
    ),
    [products[1], products[0]],
  );
});

test('semantic product search returns no results for zero query vectors', () => {
  assert.deepEqual(
    getSemanticSearchResults([0, 0], [{ title: 'Product' }], [[1, 0]]),
    [],
  );
});
