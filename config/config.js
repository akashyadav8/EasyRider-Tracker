const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  // AI Provider Selection 
  aiProvider: 'groq',
  
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama3-8b-8192',
    maxTokens: parseInt(process.env.MAX_TOKENS) || 150,
    temperature: parseFloat(process.env.TEMPERATURE) || 0.7,
  },
  
  bot: {
    name: process.env.BOT_NAME || 'AI Assistant',
    systemPrompt: 'You are a helpful AI assistant for EasyRider, a real-time location tracking application. Keep your responses concise, friendly, and focused on helping users with location tracking, group management, and navigation features.',
  },
  app: {
    exitCommands: ['exit', 'quit', 'bye', 'goodbye'],
    helpCommands: ['help', '?'],
  }
};

module.exports = config; 