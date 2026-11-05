import express from 'express';
import { postChatMessage } from '../controllers/chatController.js';
import { chatRateLimit } from '../middleware/chatRateLimit.js';
import { validateChatRequest } from '../middleware/validateChatRequest.js';

const router = express.Router();

router.post('/', validateChatRequest, chatRateLimit, postChatMessage);

export default router;