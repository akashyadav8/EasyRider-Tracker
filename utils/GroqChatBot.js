const axios = require('axios');
const config = require('../config/config');

class GroqChatBot {
  constructor() {
    this.apiKey = config.groq?.apiKey;
    this.model = config.groq?.model || 'llama3-8b-8192';
    this.baseURL = 'https://api.groq.com/openai/v1';
    this.conversationHistory = [
      {
        role: 'system',
        content: config.bot.systemPrompt,
      }
    ];
  }

  async sendMessage(message, context = '') {
    try {
      // Add context to the message if provided
      const fullMessage = context ? `${context}${message}` : message;
      
      // Add user message to history
      this.conversationHistory.push({ role: 'user', content: fullMessage });

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: this.conversationHistory,
          max_tokens: config.groq?.maxTokens || 150,
          temperature: config.groq?.temperature || 0.7,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;

      // Add AI response to history
      this.conversationHistory.push({ role: 'assistant', content: aiResponse });

      // Keep conversation history manageable
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      return aiResponse;
    } catch (error) {
      if (error.response?.status === 429) {
        return 'Rate limit exceeded. Please wait a moment before trying again.';
      }
      if (error.response?.status === 401) {
        return 'Invalid API key. Please check your Groq API key.';
      }
      console.error('Error in GroqChatBot:', error.message);
      return 'Sorry, I encountered an error. Please try again.';
    }
  }

  clearHistory() {
    this.conversationHistory = [
      {
        role: 'system',
        content: config.bot.systemPrompt,
      }
    ];
  }

  getConversationLength() {
    return this.conversationHistory.length - 1;
  }
}

module.exports = GroqChatBot; 