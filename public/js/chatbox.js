class Chatbox {
    constructor() {
        this.socket = io();
        this.username = 'Akash'; // Set default username
        this.messages = [];
        this.isOpen = false;
        
        this.init();
    }
    
    init() {
        // Create chatbox elements
        this.createElements();
        
        // Add event listeners
        this.addEventListeners();
        
        // Listen for socket events
        this.setupSocketListeners();
    }
    
    createElements() {
        // Create chatbox container
        this.container = document.createElement('div');
        this.container.className = 'chatbox-container';
        this.container.style.display = 'none';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'chatbox-header';
        header.innerHTML = `
            <h3>Group Chat</h3>
            <button class="close-btn">&times;</button>
        `;
        
        // Create messages container
        this.messagesContainer = document.createElement('div');
        this.messagesContainer.className = 'chatbox-messages';
        
        // Create input container
        const inputContainer = document.createElement('div');
        inputContainer.className = 'chatbox-input';
        inputContainer.innerHTML = `
            <input type="text" placeholder="Type a message...">
            <button>Send</button>
        `;
        
        // Append elements
        this.container.appendChild(header);
        this.container.appendChild(this.messagesContainer);
        this.container.appendChild(inputContainer);
        document.body.appendChild(this.container);
        
        // Store references
        this.closeBtn = header.querySelector('.close-btn');
        this.input = inputContainer.querySelector('input');
        this.sendBtn = inputContainer.querySelector('button');
        
        // Get the chat feature card and update its button
        const chatCard = document.querySelector('.feature-card:nth-child(3)');
        if (chatCard) {
            const existingBtn = chatCard.querySelector('.chat-btn');
            if (existingBtn) {
                existingBtn.innerHTML = `
                    <i class="fas fa-comment-dots"></i> 
                    <span class="btn-text">Open Group Chat</span>
                `;
                this.toggleBtn = existingBtn;
            }
        }
    }
    
    addEventListeners() {
        // Toggle chatbox
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => {
                if (!this.isOpen) {
                    this.joinChat();
                } else {
                    this.toggleChatbox();
                }
            });
        }
        this.closeBtn.addEventListener('click', () => this.toggleChatbox());
        
        // Send message
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }
    
    setupSocketListeners() {
        // Handle chat history
        this.socket.on('chat-history', (messages) => {
            this.messages = messages;
            this.renderMessages();
        });
        
        // Handle new messages
        this.socket.on('chat-message', (message) => {
            this.messages.push(message);
            this.renderMessages();
        });
    }
    
    joinChat() {
        this.socket.emit('join-group-chat', { username: this.username }, (response) => {
            if (response.success) {
                this.toggleChatbox();
            }
        });
    }
    
    sendMessage() {
        const message = this.input.value.trim();
        if (!message) return;
        
        this.socket.emit('send-chat-message', message, () => {
            this.input.value = '';
            this.input.focus();
        });
    }
    
    toggleChatbox() {
        this.isOpen = !this.isOpen;
        this.container.style.display = this.isOpen ? 'flex' : 'none';
        
        if (this.toggleBtn) {
            const btnText = this.toggleBtn.querySelector('.btn-text');
            if (btnText) {
                btnText.textContent = this.isOpen ? 'Close Group Chat' : 'Open Group Chat';
            }
        }
        
        if (this.isOpen) {
            this.input.focus();
        }
    }
    
    renderMessages() {
        this.messagesContainer.innerHTML = '';
        
        this.messages.forEach(message => {
            const messageEl = document.createElement('div');
            messageEl.className = `chat-message ${message.system ? 'system' : message.username === this.username ? 'own' : 'other'}`;
            
            if (!message.system) {
                messageEl.innerHTML = `
                    <div class="message-header">
                        <span>${message.username}</span>
                        <span>${message.time}</span>
                    </div>
                    <div class="message-content">${message.message}</div>
                `;
            } else {
                messageEl.textContent = message.message;
            }
            
            this.messagesContainer.appendChild(messageEl);
        });
        
        // Scroll to bottom
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
}

// Initialize chatbox when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Chatbox();
}); 