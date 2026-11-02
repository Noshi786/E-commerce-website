import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import config from '../config/chatbot.json' with { type: 'json' };

const COLLECTION_NAME = 'chat_rate_limits';
let indexesPromise;

const getIdentifier = (req) => {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (token && process.env.JWT_SECRET) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (typeof payload !== 'string' && typeof payload.id === 'string') {
        return `user:${payload.id}`;
      }
    } catch (error) {
      if (!(error instanceof jwt.JsonWebTokenError)) {
        throw error;
      }
    }
  }

  return `ip:${req.ip}`;
};

const getBucketId = (identifier) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required to safely identify chat rate-limit buckets.');
  }

  return createHmac('sha256', process.env.JWT_SECRET)
    .update(identifier)
    .digest('hex');
};

const ensureIndexes = (collection) => {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).catch((error) => {
      indexesPromise = undefined;
      throw error;
    });
  }

  return indexesPromise;
};

const updateBucket = async (collection, bucketId, now, windowStart) => {
  const activeTimestamps = {
    $filter: {
      input: { $ifNull: ['$timestamps', []] },
      as: 'timestamp',
      cond: { $gt: ['$$timestamp', windowStart] },
    },
  };

  return collection.findOneAndUpdate(
    { _id: bucketId },
    [
      {
        $set: {
          timestamps: {
            $let: {
              vars: { active: activeTimestamps },
              in: {
                $cond: [
                  { $lt: [{ $size: '$$active' }, config.rateLimit.requests] },
                  { $concatArrays: ['$$active', [now]] },
                  '$$active',
                ],
              },
            },
          },
          lastRequestAllowed: {
            $let: {
              vars: { active: activeTimestamps },
              in: { $lt: [{ $size: '$$active' }, config.rateLimit.requests] },
            },
          },
          expiresAt: new Date(now.getTime() + config.rateLimit.windowSeconds * 1000),
        },
      },
    ],
    { upsert: true, returnDocument: 'after' },
  );
};

export async function chatRateLimit(req, res, next) {
  if (!mongoose.connection.db) {
    console.error('Chat rate limit unavailable: MongoDB is not connected.');
    return res.status(503).json({
      message: 'Chat is temporarily unavailable because the database is not connected.',
    });
  }

  try {
    const collection = mongoose.connection.db.collection(COLLECTION_NAME);
    await ensureIndexes(collection);

    const now = new Date();
    const windowMilliseconds = config.rateLimit.windowSeconds * 1000;
    const bucketId = getBucketId(getIdentifier(req));
    let bucket;

    try {
      bucket = await updateBucket(
        collection,
        bucketId,
        now,
        new Date(now.getTime() - windowMilliseconds),
      );
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }

      bucket = await updateBucket(
        collection,
        bucketId,
        now,
        new Date(now.getTime() - windowMilliseconds),
      );
    }

    const timestamps = bucket?.timestamps ?? [];
    const retryAfterSeconds = timestamps.length
      ? Math.max(
          1,
          Math.ceil(
            (timestamps[0].getTime() + windowMilliseconds - now.getTime()) / 1000,
          ),
        )
      : config.rateLimit.windowSeconds;
    const success = bucket?.lastRequestAllowed === true;

    res.set({
      'RateLimit-Limit': String(config.rateLimit.requests),
      'RateLimit-Remaining': String(Math.max(0, config.rateLimit.requests - timestamps.length)),
      'RateLimit-Reset': String(retryAfterSeconds),
    });

    if (!success) {
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        message: 'You have reached the chat message limit. Please try again shortly.',
        retryAfterSeconds,
      });
    }

    return next();
  } catch (error) {
    console.error(`Chat rate limit failed (${error.name}): ${error.message}`);
    return res.status(503).json({
      message: 'Chat is temporarily unavailable. Please try again shortly.',
    });
  }
}
