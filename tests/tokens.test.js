import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { generateToken, getJwtSecret } from '../utils/tokens.js'

test('token creation and verification require a configured secret', () => {
  const previousSecret = process.env.JWT_SECRET
  delete process.env.JWT_SECRET

  try {
    assert.throws(() => getJwtSecret(), /JWT_SECRET must be configured/)
    assert.throws(() => generateToken('user-id'), /JWT_SECRET must be configured/)
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  }
})

test('generated authentication tokens use the configured secret', () => {
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'unit-test-only-signing-secret'

  try {
    const token = generateToken('user-id')
    assert.equal(jwt.verify(token, process.env.JWT_SECRET).id, 'user-id')
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  }
})
