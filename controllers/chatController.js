import { GoogleGenAI } from '@google/genai';
import Ajv from 'ajv';
import config from '../config/chatbot.json' with { type: 'json' };
import Product from '../models/Product.js';

const ajv = new Ajv();
const validateSearchArgs = ajv.compile(config.tool.parameters);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

async function searchProducts(args) {
  const expression = new RegExp(escapeRegex(args.query.trim()), 'i');
  const filter = {
    $or: [
      { title: expression },
      { description: expression },
      { brand: expression },
      { category: expression },
    ],
  };

  if (args.maxPrice !== undefined) {
    filter.price = { $lte: args.maxPrice };
  }

  const products = await Product.find(filter)
    .select('title price brand category stock images')
    .limit(5)
    .lean();

  return products.map((product) => ({
    id: String(product._id),
    title: product.title,
    price: product.price,
    brand: product.brand,
    category: product.category,
    inStock: product.stock > 0,
    image: product.images?.[0] ?? null,
  }));
}

export async function postChatMessage(req, res) {
  const { message, history = [] } = req.body ?? {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ message: 'A message is required.' });
  }

  if (message.length > config.maxMessageLength) {
    return res.status(400).json({ message: 'Your message is too long.' });
  }

  if (!Array.isArray(history)) {
    return res.status(400).json({ message: 'Chat history must be an array.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('Chat request failed: GEMINI_API_KEY is not configured.');
    return res.status(503).json({ message: 'Chat service is not configured.' });
  }

  try {
    const safeHistory = history
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

        const products = await searchProducts(args);
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
