import { GoogleGenAI } from '@google/genai';
import Ajv from 'ajv';
import config from '../config/chatbot.json' with { type: 'json' };
import Product from '../models/Product.js';

const ajv = new Ajv();
const validateSearchArgs = ajv.compile(config.tool.parameters);
const productEmbeddingCache = new Map();
const embeddingBatchSize = 100;
const maxCachedProductEmbeddings = 5000;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const searchableFields = ['title', 'description', 'brand', 'category'];
const ignoredSearchTerms = new Set([
  'a',
  'an',
  'are',
  'do',
  'for',
  'find',
  'have',
  'i',
  'in',
  'is',
  'me',
  'of',
  'please',
  'product',
  'products',
  'show',
  'stock',
  'the',
  'to',
  'we',
  'what',
  'which',
  'with',
  'you',
  'available',
  'availability',
]);

const toGeminiSchema = (schema) => {
  if (Array.isArray(schema)) {
    return schema.map(toGeminiSchema);
  }

  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      key === 'type' && typeof value === 'string'
        ? value.toUpperCase()
        : toGeminiSchema(value),
    ]),
  );
};

export function buildProductSearchFilter(args) {
  const terms = getSearchTerms(args.query);
  const conditions = terms.map((term) => ({
    $or: searchableFields.map((field) => ({
      [field]: new RegExp(escapeRegex(term), 'i'),
    })),
  }));

  if (args.inStockOnly) conditions.push({ stock: { $gt: 0 } });
  if (conditions.length === 0) return null;

  const filter = { $and: conditions };

  if (args.maxPrice !== undefined) {
    filter.price = { $lte: args.maxPrice };
  }

  return filter;
}

function getSearchTerms(query) {
  return (query.match(/[\p{L}\p{N}]+(?:[.+#'-][\p{L}\p{N}]+)*/gu) ?? [])
    .filter((term) => !ignoredSearchTerms.has(term.toLowerCase()));
}

function getEditDistance(left, right) {
  const distances = Array.from(
    { length: left.length + 1 },
    () => Array(right.length + 1).fill(0),
  );

  for (let leftIndex = 0; leftIndex <= left.length; leftIndex += 1) {
    distances[leftIndex][0] = leftIndex;
  }
  for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
    distances[0][rightIndex] = rightIndex;
  }
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      distances[leftIndex][rightIndex] = Math.min(
        distances[leftIndex][rightIndex - 1] + 1,
        distances[leftIndex - 1][rightIndex] + 1,
        distances[leftIndex - 1][rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );

      if (
        leftIndex > 1 &&
        rightIndex > 1 &&
        left[leftIndex - 1] === right[rightIndex - 2] &&
        left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        distances[leftIndex][rightIndex] = Math.min(
          distances[leftIndex][rightIndex],
          distances[leftIndex - 2][rightIndex - 2] + 1,
        );
      }
    }
  }

  return distances[left.length][right.length];
}

function getPhoneticKey(word) {
  const normalized = word
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/qu/g, 'k')
    .replace(/[cq]/g, 'k');

  return normalized[0] + normalized.slice(1).replace(/[aeiou]/g, '');
}

export function getFuzzySearchScore(query, product) {
  const terms = getSearchTerms(query).map((term) => term.toLowerCase());
  if (!terms.length) return null;

  const productWords = searchableFields.flatMap((field) =>
    (product[field]?.match(/[\p{L}\p{N}]+(?:[.+#'-][\p{L}\p{N}]+)*/gu) ?? [])
      .map((word) => word.toLowerCase()),
  );
  let score = 0;

  for (const term of terms) {
    const maxDistance = term.length >= 8 ? 2 : term.length >= 4 ? 1 : 0;
    let bestDistance = Infinity;

    for (const word of productWords) {
      if (Math.abs(term.length - word.length) > maxDistance) continue;
      bestDistance = Math.min(bestDistance, getEditDistance(term, word));

      if (
        term.length >= 5 &&
        word.length >= 5 &&
        getPhoneticKey(term) === getPhoneticKey(word)
      ) {
        bestDistance = Math.min(bestDistance, 1);
      }
    }

    if (bestDistance > maxDistance) return null;
    score += bestDistance;
  }

  return score;
}

export function getSemanticSearchResults(queryEmbedding, products, embeddings) {
  const queryMagnitude = Math.sqrt(
    queryEmbedding.reduce((sum, value) => sum + value * value, 0),
  );
  if (!queryMagnitude) return [];

  return products
    .map((product, index) => {
      const embedding = embeddings[index];
      if (!embedding || embedding.length !== queryEmbedding.length) {
        return { product, similarity: 0 };
      }

      const productMagnitude = Math.sqrt(
        embedding.reduce((sum, value) => sum + value * value, 0),
      );
      const dotProduct = queryEmbedding.reduce(
        (sum, value, dimension) => sum + value * embedding[dimension],
        0,
      );

      return {
        product,
        similarity: productMagnitude ? dotProduct / (queryMagnitude * productMagnitude) : 0,
      };
    })
    .filter(({ similarity }) => similarity >= config.semanticSearchMinSimilarity)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 5)
    .map(({ product }) => product);
}

function getProductEmbeddingText(product) {
  return searchableFields
    .map((field) => product[field])
    .filter((value) => typeof value === 'string' && value.trim())
    .join('. ')
    .slice(0, 2000);
}

async function embedTexts(ai, texts) {
  const embeddings = [];

  for (let start = 0; start < texts.length; start += embeddingBatchSize) {
    const batch = texts.slice(start, start + embeddingBatchSize);
    const response = await ai.models.embedContent({
      model: config.embeddingModel,
      contents: batch,
    });
    const batchEmbeddings = response.embeddings?.map((embedding) => embedding.values);

    if (
      !batchEmbeddings ||
      batchEmbeddings.length !== batch.length ||
      batchEmbeddings.some(
        (embedding) =>
          !Array.isArray(embedding) ||
          embedding.length === 0 ||
          embedding.some((value) => !Number.isFinite(value)),
      )
    ) {
      throw new Error('Gemini returned invalid product search embeddings.');
    }

    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
}

async function searchProductsSemantically(args, products, ai) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY is required for semantic product search.');
  }

  if (!products.length) return [];

  const queryEmbeddings = await embedTexts(ai, [args.query]);
  const uncachedProducts = [];
  products.forEach((product) => {
    const id = String(product._id);
    const text = getProductEmbeddingText(product);
    if (!text) return;
    const cached = productEmbeddingCache.get(id);
    if (cached?.text === text) return;

    uncachedProducts.push({ id, text });
  });

  const newEmbeddings = await embedTexts(ai, uncachedProducts.map(({ text }) => text));
  uncachedProducts.forEach(({ id, text }, index) => {
    productEmbeddingCache.set(id, { text, embedding: newEmbeddings[index] });
    if (productEmbeddingCache.size > maxCachedProductEmbeddings) {
      productEmbeddingCache.delete(productEmbeddingCache.keys().next().value);
    }
  });

  const embeddings = products.map(
    (product) => productEmbeddingCache.get(String(product._id))?.embedding ?? [],
  );

  return getSemanticSearchResults(queryEmbeddings[0], products, embeddings);
}

export function prepareChatHistory(history) {
  const mappedHistory = history
    .filter(
      (item) =>
        item &&
        ['user', 'assistant'].includes(item.role) &&
        typeof item.content === 'string',
    )
    .slice(-config.maxHistoryMessages)
    .map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content.slice(0, config.maxMessageLength) }],
    }));
  const firstUserMessage = mappedHistory.findIndex((item) => item.role === 'user');
  return firstUserMessage === -1 ? [] : mappedHistory.slice(firstUserMessage);
}

async function searchProducts(args, ai) {
  const filter = buildProductSearchFilter(args);
  const query = filter ?? {};
  const projection = 'title description price brand category stock images';

  let productQuery = Product.find(query)
    .select(projection)
    .limit(5);

  if (args.inStockOnly && getSearchTerms(args.query).length === 0) {
    productQuery = productQuery.sort({ stock: -1, title: 1 });
  }

  let products = await productQuery.lean();

  if (!products.length && getSearchTerms(args.query).length) {
    const fallbackFilter = {};
    if (args.inStockOnly) fallbackFilter.stock = { $gt: 0 };
    if (args.maxPrice !== undefined) fallbackFilter.price = { $lte: args.maxPrice };

    const candidates = await Product.find(fallbackFilter).select(projection).lean();
    products = candidates
      .map((product) => ({
        product,
        score: getFuzzySearchScore(args.query, product),
      }))
      .filter(({ score }) => score !== null)
      .sort((left, right) => left.score - right.score)
      .slice(0, 5)
      .map(({ product }) => product);

    if (!products.length) {
      products = await searchProductsSemantically(args, candidates, ai);
    }
  }

  return products.map((product) => ({
    id: String(product._id),
    title: product.title,
    description: product.description?.slice(0, 500) ?? '',
    price: product.price,
    brand: product.brand,
    category: product.category,
    inStock: product.stock > 0,
    image: product.images?.[0] ?? null,
  }));
}

export async function postChatMessage(req, res) {
  const { message, history = [] } = req.body ?? {};

  if (/\b(in[\s-]+stock|available|availability|stock)\b/i.test(message)) {
    try {
      const ai = process.env.GEMINI_API_KEY
        ? new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { timeout: 20000, maxRetries: 0 },
          })
        : null;
      const products = await searchProducts({ query: message, inStockOnly: true }, ai);
      return res.json({
        reply: products.length
          ? 'Here are the matching products currently in stock:'
          : 'I could not find any matching products in stock. What would you like to try searching for instead?',
        products,
      });
    } catch (error) {
      console.error(`Chat inventory search failed (${error.name}): ${error.message}`);
      return res.status(503).json({
        message: 'Product availability is temporarily unavailable. Please try again shortly.',
      });
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('Chat request failed: GEMINI_API_KEY is not configured.');
    return res.status(503).json({ message: 'Chat service is not configured.' });
  }

  try {
    const safeHistory = prepareChatHistory(history);

    const contents = [
      ...safeHistory,
      { role: 'user', parts: [{ text: message.trim() }] },
    ];
    const foundProducts = [];
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        timeout: 20000,
        maxRetries: 0,
      },
    });
    const functionDeclaration = {
      ...config.tool,
      parameters: toGeminiSchema(config.tool.parameters),
    };

    for (let turn = 0; turn < 3; turn += 1) {
      const response = await ai.models.generateContent({
        model: config.model,
        contents,
        config: {
          systemInstruction: config.systemPrompt,
          temperature: config.temperature,
          maxOutputTokens: config.maxOutputTokens,
          tools: [{ functionDeclarations: [functionDeclaration] }],
        },
      });

      const functionCalls = response.functionCalls ?? [];
      if (functionCalls.length === 0) {
        const uniqueProducts = [
          ...new Map(foundProducts.map((product) => [product.id, product])).values(),
        ];

        return res.json({
          reply: response.text || 'I could not create a reply. Please try again.',
          products: uniqueProducts,
        });
      }

      const modelContent = response.candidates?.[0]?.content;
      if (!modelContent) {
        throw new Error('Gemini returned a function call without response content.');
      }
      contents.push(modelContent);

      const functionResponses = [];
      for (const functionCall of functionCalls) {
        if (functionCall.name !== config.tool.name) {
          throw new Error(`Unsupported chatbot tool: ${functionCall.name}`);
        }

        const args = functionCall.args;
        if (!validateSearchArgs(args)) {
          throw new Error('Gemini returned invalid product search arguments.');
        }

        const products = await searchProducts(args, ai);
        foundProducts.push(...products);
        functionResponses.push({
          functionResponse: {
            name: functionCall.name,
            response: { products },
          },
        });
      }
      contents.push({ role: 'user', parts: functionResponses });
    }

    return res.status(502).json({
      message: 'The assistant could not finish this reply. Please try again.',
    });
  } catch (error) {
    console.error(`Chat request failed (${error.name}): ${error.message}`);
    const providerBusy =
      /"code":\s*503|"code":\s*429|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(error.message);
    const isTimeout =
      error.name === 'TimeoutError' ||
      error.name === 'AbortError' ||
      /timeout|timed out/i.test(error.message);

    return res
      .status(providerBusy ? 503 : isTimeout ? 504 : 502)
      .json({
        message: isTimeout
          ? 'Gemini is taking too long to respond. Please try again.'
          : providerBusy
            ? 'Gemini is busy or its free-tier limit is temporarily reached. Please try again shortly.'
          : 'Chat service is temporarily unavailable.',
      });
  }
}
