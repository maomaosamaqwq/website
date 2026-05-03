/* ============================
   page4-chat.js — 聊天界面逻辑
   ============================ */
const ChatPage = {
  canvas: null,
  neuronSystem: null,
  apiKey: '',
  messages: [],
  currentConvId: null,
  isActive: false,
  isStreaming: false,

  init() {
    this.canvas = document.getElementById('neuron-canvas');
    if (!this.canvas) return;

    // 神经元背景粒子
    this.neuronSystem = new ParticleSystem(this.canvas, {
      count: 80,
      speed: 0.2,
      size: 1.5,
      connectDistance: 200,
      connectOpacity: 0.08,
    });

    // 检查是否有已保存的 API key
    this.apiKey = localStorage.getItem('maomao_api_key') || '';

    // 检查是否有当前会话
    const currentConv = localStorage.getItem('maomao_current_conv');
    if (currentConv) {
      try {
        const conv = JSON.parse(currentConv);
        this.currentConvId = conv.id;
        this.loadMessages(conv.id);
      } catch {}
    }

    // 事件绑定
    document.getElementById('btn-confirm-key').addEventListener('click', () => this.confirmKey());
    document.getElementById('api-key-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.confirmKey();
    });
    document.getElementById('btn-send').addEventListener('click', () => this.sendMessage());
    document.getElementById('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    document.getElementById('btn-new-chat-sm').addEventListener('click', () => this.startNewChat());

    // 自动调整输入框高度
    document.getElementById('chat-input').addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    });

    // 设置按钮
    document.getElementById('btn-settings').addEventListener('click', () => {
      document.getElementById('api-config').style.display = 'flex';
      document.getElementById('chat-messages').style.display = 'none';
    });

    // 如果有 API key，自动进入聊天
    if (this.apiKey) {
      this.enterChat();
    }
  },

  confirmKey() {
    const input = document.getElementById('api-key-input');
    const key = input.value.trim();
    
    if (!key) {
      input.style.borderColor = '#ef4444';
      setTimeout(() => { input.style.borderColor = ''; }, 2000);
      return;
    }

    this.apiKey = key;
    localStorage.setItem('maomao_api_key', key);
    this.enterChat();
  },

  enterChat() {
    document.getElementById('api-config').style.display = 'none';
    document.getElementById('chat-messages').style.display = 'flex';
    this.renderHistoryList();
    this.renderMessages();
  },

  loadMessages(convId) {
    try {
      const saved = localStorage.getItem(`maomao_messages_${convId}`);
      this.messages = saved ? JSON.parse(saved) : [];
    } catch {
      this.messages = [];
    }
  },

  saveMessages() {
    if (this.currentConvId) {
      localStorage.setItem(`maomao_messages_${this.currentConvId}`, JSON.stringify(this.messages));
    }
  },

  renderMessages() {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';

    this.messages.forEach(msg => {
      const div = document.createElement('div');
      div.className = `message ${msg.role}`;
      div.innerHTML = `<div class="msg-content">${this.escapeHtml(msg.content)}</div>`;
      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
  },

  renderHistoryList() {
    const list = document.getElementById('chat-history-list');
    list.innerHTML = '';

    let conversations = [];
    try {
      const saved = localStorage.getItem('maomao_conversations');
      conversations = saved ? JSON.parse(saved) : [];
    } catch {}

    conversations.forEach(conv => {
      const item = document.createElement('div');
      item.className = `history-item${conv.id === this.currentConvId ? ' active' : ''}`;
      item.textContent = conv.title;
      item.addEventListener('click', () => {
        this.currentConvId = conv.id;
        this.loadMessages(conv.id);
        this.renderMessages();
        this.renderHistoryList();
      });
      list.appendChild(item);
    });
  },

  startNewChat() {
    this.messages = [];
    this.currentConvId = null;
    document.getElementById('messages-container').innerHTML = '';
    document.getElementById('api-config').style.display = 'flex';
    document.getElementById('chat-messages').style.display = 'none';
    document.getElementById('api-key-input').value = this.apiKey || '';
  },

  async sendMessage() {
    if (this.isStreaming) return;

    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    if (!this.apiKey) {
      document.getElementById('api-config').style.display = 'flex';
      document.getElementById('chat-messages').style.display = 'none';
      return;
    }

    // 如果没有当前会话 ID，创建一个新的
    if (!this.currentConvId) {
      this.currentConvId = 'conv_' + Date.now();
      
      let conversations = [];
      try {
        const saved = localStorage.getItem('maomao_conversations');
        conversations = saved ? JSON.parse(saved) : [];
      } catch {}
      
      conversations.unshift({
        id: this.currentConvId,
        title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
        date: new Date().toLocaleDateString(),
        preview: content.slice(0, 50) + (content.length > 50 ? '...' : '')
      });
      localStorage.setItem('maomao_conversations', JSON.stringify(conversations));
      this.renderHistoryList();
    }

    // 添加用户消息
    this.messages.push({ role: 'user', content });
    this.renderMessages();
    input.value = '';
    input.style.height = 'auto';

    // 显示打字指示器
    this.showTyping();
    this.isStreaming = true;

    try {
      // 构建消息历史
      const apiMessages = this.messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: apiMessages,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`API 错误: ${response.status}`);
      }

      // 流式读取
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      this.hideTyping();

      // 创建助手消息容器
      const container = document.getElementById('messages-container');
      const msgDiv = document.createElement('div');
      msgDiv.className = 'message assistant';
      const contentDiv = document.createElement('div');
      contentDiv.className = 'msg-content';
      msgDiv.appendChild(contentDiv);
      container.appendChild(msgDiv);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices[0]?.delta?.content || '';
            assistantContent += delta;
            contentDiv.textContent = this.escapeHtml(assistantContent);
            container.scrollTop = container.scrollHeight;
          } catch {}
        }
      }

      // 保存消息
      this.messages.push({ role: 'assistant', content: assistantContent });
      this.saveMessages();

      // 更新对话标题（如果是第一条）
      this.updateConversationTitle();

    } catch (err) {
      this.hideTyping();
      const container = document.getElementById('messages-container');
      const errorDiv = document.createElement('div');
      errorDiv.className = 'message assistant';
      errorDiv.innerHTML = `<div class="msg-content" style="color:#ef4444;">连接失败: ${err.message}</div>`;
      container.appendChild(errorDiv);
    }

    this.isStreaming = false;
  },

  showTyping() {
    const container = document.getElementById('messages-container');
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.id = 'typing-indicator';
    div.innerHTML = `
      <div class="msg-content typing-indicator">
        <span></span><span></span><span></span>
      </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  },

  hideTyping() {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();
  },

  updateConversationTitle() {
    // 用第一条消息更新对话标题
    if (this.messages.length === 2 && this.messages[0].role === 'user') {
      let conversations = JSON.parse(localStorage.getItem('maomao_conversations') || '[]');
      const idx = conversations.findIndex(c => c.id === this.currentConvId);
      if (idx >= 0) {
        conversations[idx].title = this.messages[0].content.slice(0, 30) + 
          (this.messages[0].content.length > 30 ? '...' : '');
        localStorage.setItem('maomao_conversations', JSON.stringify(conversations));
        this.renderHistoryList();
      }
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  start() {
    this.isActive = true;
    if (this.neuronSystem) {
      this.neuronSystem.start();
    }
  },

  stop() {
    this.isActive = false;
    if (this.neuronSystem) {
      this.neuronSystem.stop();
    }
  }
};
