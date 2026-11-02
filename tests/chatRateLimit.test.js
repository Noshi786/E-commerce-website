import assert from 'node:assert/strict';
import test from 'node:test';
import { chatRateLimit } from '../middleware/chatRateLimit.js';

test('chat rate limit fails closed when MongoDB is not connected', async () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  let statusCode;
  let responseBody;
  let nextCalled = false;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  try {
    await chatRateLimit({ ip: '127.0.0.1' }, response, () => {
      nextCalled = true;
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(statusCode, 503);
  assert.equal(responseBody.message, 'Chat is temporarily unavailable because the database is not connected.');
  assert.equal(nextCalled, false);
});
