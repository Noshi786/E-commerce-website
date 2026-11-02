import express from 'express';
import { postChatMessage } from '../controllers/chatController.js';
import { chatRateLimit } from '../middleware/chatRateLimit.js';

const router = express.Router();

router.post('/', chatRateLimit, postChatMessage);

export default router;