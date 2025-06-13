class ChatLauncher {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.isProcessing = false;
    this.isListening = false;
    this.recognition = null;
    this.audioContext = null;
    this.synthesis = window.speechSynthesis;
    this.voices = [];
    this.selectedVoice = null;
    this.initSpeechRecognition();
    this.initSpeechSynthesis();
    this.init();
    this.clearChatHistory();
  }

  async initSpeechRecognition() {
    try {
      // Check for browser support
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Speech recognition not supported in this browser');
        return;
      }

      // Initialize audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Create speech recognition instance
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();

      // Configure recognition settings
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      // Handle recognition results
      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        this.input.value = transcript;
        this.sendMessage();
      };

      // Handle recognition errors
      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        let errorMessage = 'Sorry, there was an error with voice recognition. ';
        
        switch (event.error) {
          case 'no-speech':
            errorMessage += 'No speech was detected. Please try again.';
            break;
          case 'audio-capture':
            errorMessage += 'No microphone was found. Please ensure your microphone is connected and try again.';
            break;
          case 'not-allowed':
            errorMessage += 'Microphone access was denied. Please allow microphone access and try again.';
            break;
          case 'network':
            errorMessage += 'Network error occurred. Please check your internet connection and try again.';
            break;
          default:
            errorMessage += 'Please try typing instead.';
        }
        
        this.addMessage(errorMessage, 'system');
        this.stopListening();
      };

      // Handle recognition end
      this.recognition.onend = () => {
        this.stopListening();
      };

      // Request microphone permission
      await this.requestMicrophonePermission();
    } catch (error) {
      console.error('Error initializing speech recognition:', error);
      this.addMessage('Error initializing voice input. Please try typing instead.', 'system');
    }
  }

  async requestMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Microphone permission error:', error);
      this.addMessage('Please allow microphone access to use voice input.', 'system');
    }
  }

  async toggleVoiceInput() {
    if (!this.recognition) {
      this.addMessage('Voice input is not supported in your browser. Please use typing instead.', 'system');
      return;
    }

    if (this.isListening) {
      this.stopListening();
    } else {
      await this.startListening();
    }
  }

  async startListening() {
    try {
      // Resume audio context if it's suspended
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Check if we have microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream after checking

      this.recognition.start();
      this.isListening = true;
      this.micButton.classList.add('chat-launcher__mic--active');
      this.addMessage('Listening...', 'system');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      
      let errorMessage = 'Error starting voice input. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow microphone access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No microphone found. Please check your audio device connection.';
      } else {
        errorMessage += 'Please try again or use typing instead.';
      }
      
      this.addMessage(errorMessage, 'system');
      this.stopListening();
    }
  }

  stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
    this.isListening = false;
    this.micButton.classList.remove('chat-launcher__mic--active');
  }

  async initSpeechSynthesis() {
    try {
      // Wait for voices to be loaded
      this.voices = await this.getVoices();
      
      // Select Google US English as default voice
      this.selectedVoice = this.voices.find(voice => 
        voice.name === 'Google US English'
      ) || this.voices.find(voice => 
        voice.lang.includes('en-US')
      ) || this.voices[0];

      if (!this.selectedVoice) {
        console.warn('Google US English voice not found, using default voice');
      }
    } catch (error) {
      console.error('Error initializing speech synthesis:', error);
    }
  }

  getVoices() {
    return new Promise((resolve) => {
      const voices = this.synthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
      } else {
        this.synthesis.onvoiceschanged = () => {
          resolve(this.synthesis.getVoices());
        };
      }
    });
  }

  speak(text) {
    if (!this.synthesis || !this.selectedVoice) return;

    // Stop any ongoing speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.selectedVoice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Add speaking indicator
    this.addSpeakingIndicator();

    utterance.onend = () => {
      this.removeSpeakingIndicator();
    };

    utterance.onerror = (error) => {
      console.error('Speech synthesis error:', error);
      this.removeSpeakingIndicator();
    };

    this.synthesis.speak(utterance);
  }

  addSpeakingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'chat-message chat-message--system chat-message--speaking';
    indicator.innerHTML = '<span class="speaking-dot"></span><span class="speaking-dot"></span><span class="speaking-dot"></span>';
    indicator.id = 'speaking-indicator';
    this.messagesContainer.appendChild(indicator);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  removeSpeakingIndicator() {
    const indicator = document.getElementById('speaking-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  init() {
    // Create and inject the chat launcher HTML
    const chatHTML = `
      <div class="chat-launcher" role="dialog" aria-label="Chat window">
        <button class="chat-launcher__button ai-chat-button" aria-label="Open chat" aria-expanded="false">
          <img src="./img/icon/brain-icon.png" alt="AI Icon" class="ai-chat-icon">
        </button>
        <div class="chat-launcher__window" aria-hidden="true">
          <div class="chat-launcher__header">
            <h2 class="chat-launcher__title">Chat with AI Assistant</h2>
            <button class="chat-launcher__close" aria-label="Close chat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div class="chat-launcher__messages" role="log" aria-live="polite"></div>
          <div class="chat-launcher__input-container">
            <input type="text" class="chat-launcher__input" placeholder="Type your message..." aria-label="Message input">
            <button class="chat-launcher__mic" aria-label="Voice input" title="Voice input">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </button>
            <button class="chat-launcher__send" aria-label="Send message">Send</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatHTML);

    // Cache DOM elements
    this.button = document.querySelector('.chat-launcher__button');
    this.window = document.querySelector('.chat-launcher__window');
    this.closeButton = document.querySelector('.chat-launcher__close');
    this.input = document.querySelector('.chat-launcher__input');
    this.sendButton = document.querySelector('.chat-launcher__send');
    this.micButton = document.querySelector('.chat-launcher__mic');
    this.messagesContainer = document.querySelector('.chat-launcher__messages');

    // Bind event listeners
    this.button.addEventListener('click', () => this.toggle());
    this.closeButton.addEventListener('click', () => this.close());
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.micButton.addEventListener('click', () => this.toggleVoiceInput());
    this.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    // Add initial welcome message
    this.addMessage('Hello! I\'m your AI assistant. How can I help you today?', 'system');
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    this.button.setAttribute('aria-expanded', 'true');
    this.window.classList.add('chat-launcher__window--open');
    this.window.setAttribute('aria-hidden', 'false');
    this.input.focus();
  }

  close() {
    this.isOpen = false;
    this.button.setAttribute('aria-expanded', 'false');
    this.window.classList.remove('chat-launcher__window--open');
    this.window.setAttribute('aria-hidden', 'true');
    this.button.focus();
  }

  async sendMessage() {
    const message = this.input.value.trim();
    if (!message || this.isProcessing) return;

    this.isProcessing = true;
    this.input.value = '';
    this.input.disabled = true;
    this.sendButton.disabled = true;

    // Add user message
    this.addMessage(message, 'user');

    try {
      // Show typing indicator
      this.addTypingIndicator();

      // Check if message is location-related
      const locationKeywords = ['where am i', 'my location', 'current location', 'where am i now', 'what is my location'];
      const isLocationQuery = locationKeywords.some(keyword => message.toLowerCase().includes(keyword));
      
      let locationData = null;
      if (isLocationQuery) {
        try {
          locationData = await this.getCurrentLocation();
        } catch (error) {
          console.error('Error getting location:', error);
        }
      }
      
      // Send message to server
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          location: locationData
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      // Remove typing indicator
      this.removeTypingIndicator();
      
      // Add AI response
      this.addMessage(data.response, 'system');

      // Speak the response
      this.speak(data.response);
    } catch (error) {
      console.error('Chat error:', error);
      this.removeTypingIndicator();
      this.addMessage('Sorry, I encountered an error. Please try again.', 'system');
    } finally {
      this.isProcessing = false;
      this.input.disabled = false;
      this.sendButton.disabled = false;
      this.input.focus();
    }
  }

  addMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message chat-message--${type}`;
    messageDiv.textContent = text;
    this.messagesContainer.appendChild(messageDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  addTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'chat-message chat-message--system chat-message--typing';
    indicator.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    indicator.id = 'typing-indicator';
    this.messagesContainer.appendChild(indicator);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            // Get location name using reverse geocoding
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await response.json();
            const location = {
              latitude,
              longitude,
              name: data.display_name || 'Unknown location'
            };
            resolve(location);
          } catch (error) {
            reject(error);
          }
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  clearChatHistory() {
    // Clear the chat messages container
    this.messagesContainer.innerHTML = '';
    
    // Add welcome message
    this.addMessage('Hello! How can I help you today?', 'system');
    
    // Clear conversation history in the backend
    fetch('/api/chat/clear', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(error => {
      console.error('Error clearing chat history:', error);
    });
  }
}

// Initialize chat launcher when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ChatLauncher();
}); 