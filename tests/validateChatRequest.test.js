import assert from 'node:assert/strict';
import test from 'node:test';
import { validateChatRequest } from '../middleware/validateChatRequest.js';

function runValidation(body) {
  let statusCode;
  let responseBody;
  let nextCalled = false;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      responseBody = value;
      return this;
    },
  };

  validateChatRequest({ body }, response, () => {
    nextCalled = true;
  });

  return { statusCode, responseBody, nextCalled };
}

test('chat validation allows a valid message and optional history', () => {
  assert.deepEqual(runValidation({ message: 'Find me a gift' }), {
    statusCode: undefined,
    responseBody: undefined,
    nextCalled: true,
  });
});

test('chat validation rejects missing messages, oversized messages, and invalid history', () => {
  assert.equal(runValidation({ message: ' ' }).statusCode, 400);
  assert.equal(runValidation({ message: 'x'.repeat(2001) }).statusCode, 400);
  assert.equal(runValidation({ message: 'Hello', history: {} }).statusCode, 400);
});
