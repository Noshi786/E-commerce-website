import config from '../config/chatbot.json' with { type: 'json' };

export function validateChatRequest(req, res, next) {
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

  return next();
}
