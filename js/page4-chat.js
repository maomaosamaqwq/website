/* ============================
   page4-chat.js — 聊天界面逻辑（云端版 + 登录）
   ============================ */
const ChatPage = {
  canvas: null,
  neuronSystem: null,
  messages: [],
  currentConvId: null,
  isActive: false,
  isStreaming: false,
  useSearch: false,
  token: '',
  cloudApiUrl: 'https://api.仙狐大人.我爱你',
  cloudApiUrlFallback: 'https://maomao-api.b35a90441d9dea81207b863b34b6516a.workers.dev',

  init() {
    this.canvas = document.getElementById('neuron-canvas');
    if (!this.canvas) return;

    this.neuronSystem = new ParticleSystem(this.canvas, {
      count: 80,
      speed: 0.2,
      size: 1.5,
      connectDistance: 200,
      connectOpacity: 0.08,
    });

    // 读取已保存的信息
    this.token = localStorage.getItem('maomao_token') || '';
    this.savedUsername = localStorage.getItem('maomao_username') || '';

    // 登录相关
    document.getElementById('btn-login').addEventListener('click', () => this.login());
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.login();
    });
    document.getElementById('login-username').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('login-password').focus();
    });

    // 注册链接
    const registerLink = document.getElementById('login-register-link');
    if (registerLink) {
      registerLink.addEventListener('click', () => this.toggleRegister());
    }

    // 如果有 token，直接进入聊天
    if (this.token) {
      this.loginPage.style.display = 'none';
      this.chatPage.style.display = 'flex';
    }

    // 聊天界面初始化
    this.initChat();
  },

  get loginPage() { return document.getElementById('login-page'); },
  get chatPage() { return document.getElementById('chat-messages'); },

  // 注册/登录模式切换
  isRegisterMode: false,

  toggleRegister() {
    this.isRegisterMode = !this.isRegisterMode;
    const btn = document.getElementById('btn-login');
    const link = document.getElementById('login-register-link');
    const title = document.querySelector('.login-desc');
    
    if (this.isRegisterMode) {
      btn.textContent = '注册';
      link.textContent = '已有账号？登录';
      title.textContent = '注册新账号';
    } else {
      btn.textContent = '登录';
      link.textContent = '还没有账号？注册';
      title.textContent = '输入账号密码开始聊天';
    }
  },

  get loginPage() { return document.getElementById('login-page'); },
  get chatPage() { return document.getElementById('chat-messages'); },

  initChat() {
    const currentConv = localStorage.getItem('maomao_current_conv');
    if (currentConv) {
      try {
        const conv = JSON.parse(currentConv);
        this.currentConvId = conv.id;
        this.loadMessages(conv.id);
      } catch {}
    }

    // 事件绑定
    document.getElementById('btn-send').addEventListener('click', () => this.sendMessage());
    document.getElementById('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    document.getElementById('btn-new-chat-sm').addEventListener('click', () => this.startNewChat());

    document.getElementById('chat-input').addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    });

    if (document.getElementById('btn-voice')) {
      document.getElementById('btn-voice').addEventListener('click', () => this.toggleVoiceInput());
    }

    document.getElementById('btn-export').addEventListener('click', () => this.exportChat());
    document.getElementById('btn-import').addEventListener('click', () => this.importChat());

    document.getElementById('btn-menu-toggle').addEventListener('click', () => this.toggleSidebar());
    document.getElementById('sidebar-overlay').addEventListener('click', () => this.toggleSidebar());

    const searchToggle = document.getElementById('btn-search-toggle');
    if (searchToggle) {
      searchToggle.addEventListener('click', () => this.toggleSearch());
    }

    const syncBtn = document.getElementById('btn-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => this.manualSync());
    }

    this.renderHistoryList();
    this.renderMessages();
    setTimeout(() => this.tryCloudSync(), 200);
  },

  /* ========== 登录 ========== */
  async login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    if (!username || !password) {
      alert('请输入用户名和密码');
      return;
    }

    const btn = document.getElementById('btn-login');
    btn.textContent = this.isRegisterMode ? '注册中...' : '登录中...';
    btn.disabled = true;

    try {
      const endpoint = this.isRegisterMode ? '/register' : '/login';
      const resp = await this.apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!resp) {
        alert('无法连接到服务器，请稍后重试');
        return;
      }

      const data = await resp.json();

      if (data.success) {
        this.token = data.token;
        localStorage.setItem('maomao_token', this.token);
        localStorage.setItem('maomao_username', username);
        
        this.loginPage.style.display = 'none';
        this.chatPage.style.display = 'flex';
        
        // 登录成功，同步数据
        setTimeout(() => this.tryCloudSync(), 200);
      } else {
        alert(data.error || '操作失败');
      }
    } catch (e) {
      alert('操作失败: ' + e.message);
    } finally {
      btn.textContent = this.isRegisterMode ? '注册' : '登录';
      btn.disabled = false;
    }
  },

  /* ========== API 请求（带 token + 双域名 fallback） ========== */
  async apiFetch(path, options = {}) {
    const headers = { ...options.headers, 'Authorization': `Bearer ${this.token}` };
    const fetchOpts = { ...options, headers };

    for (const baseUrl of [this.cloudApiUrl, this.cloudApiUrlFallback]) {
      try {
        const resp = await fetch(`${baseUrl}${path}`, {
          ...fetchOpts,
          signal: AbortSignal.timeout(10000)
        });
        if (resp.ok || resp.status === 401) return resp;
      } catch {}
    }
    return null;
  },

  /* ========== 云端同步 ========== */
  async tryCloudSync() {
    if (!this.token) return;
    try {
      const convResp = await this.apiFetch('/conversations');
      if (convResp && convResp.ok) {
        const cloudConvs = await convResp.json();
        
        let localConvs = [];
        try {
          const saved = localStorage.getItem('maomao_conversations');
          localConvs = saved ? JSON.parse(saved) : [];
        } catch {}

        if (Array.isArray(cloudConvs) && cloudConvs.length > 0) {
          localStorage.setItem('maomao_conversations', JSON.stringify(cloudConvs));
          this.renderHistoryList();
          
          if (this.currentConvId) {
            const msgResp = await this.apiFetch(`/messages/${this.currentConvId}`);
            if (msgResp && msgResp.ok) {
              const cloudMsgs = await msgResp.json();
              if (Array.isArray(cloudMsgs) && cloudMsgs.length > 0) {
                this.messages = cloudMsgs;
                this.renderMessages();
                return;
              }
            }
          }
        } 
        
        if (Array.isArray(localConvs) && localConvs.length > 0) {
          await this.apiFetch('/conversations', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localConvs),
          });
          for (const conv of localConvs) {
            const msgs = localStorage.getItem(`maomao_messages_${conv.id}`);
            if (msgs) {
              await this.apiFetch(`/messages/${conv.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: msgs,
              });
            }
          }
        }
      }
    } catch (e) {
      console.log('云端同步失败:', e.message);
    }
  },

  async syncToCloud() {
    if (!this.currentConvId || !this.token) return;
    try {
      const msgResp = await this.apiFetch(`/messages/${this.currentConvId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.messages),
      });
      if (!msgResp) return;
      
      let conversations = [];
      try {
        const saved = localStorage.getItem('maomao_conversations');
        conversations = saved ? JSON.parse(saved) : [];
      } catch {}
      await this.apiFetch('/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversations),
      });
    } catch (e) {}
  },

  /* ========== 手动同步 ========== */
  async manualSync() {
    const btn = document.getElementById('btn-sync');
    if (btn) {
      btn.textContent = '⏳';
      btn.style.pointerEvents = 'none';
    }
    await this.tryCloudSync();
    if (btn) {
      btn.textContent = '🔄';
      btn.style.pointerEvents = '';
      btn.style.animation = 'none';
      btn.offsetHeight;
      btn.style.animation = 'syncFlash 0.5s ease';
    }
  },

  /* ========== 进入聊天 ========== */
  enterChat() {
    // 登录成功时已经显示聊天页
  },

  /* ========== 消息管理 ========== */
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
      this.syncToCloud();
    }
  },

  renderMarkdown(text) {
    if (typeof marked === 'undefined') {
      return `<p>${this.escapeHtml(text)}</p>`;
    }
    let html = marked.parse(text, { breaks: true, gfm: true });
    if (typeof hljs !== 'undefined') {
      html = html.replace(/<pre><code class="language-(\w+)">/g, (match, lang) => {
        return `<pre><code class="language-${lang}">`;
      });
    }
    return html;
  },

  renderMessages() {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';

    this.messages.forEach(msg => {
      const div = document.createElement('div');
      div.className = `message ${msg.role}`;
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'msg-content';
      
      if (msg.role === 'assistant') {
        contentDiv.innerHTML = this.renderMarkdown(msg.content);
        if (typeof hljs !== 'undefined') {
          contentDiv.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
          });
        }
      } else {
        contentDiv.textContent = msg.content;
      }
      
      div.appendChild(contentDiv);
      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
    this.updateTokenCounter();
  },

  updateTokenCounter() {
    const counter = document.getElementById('token-counter');
    if (!counter) return;
    
    let totalChars = 0;
    this.messages.forEach(m => {
      const chineseChars = (m.content.match(/[\u4e00-\u9fff]/g) || []).length;
      const otherChars = m.content.length - chineseChars;
      totalChars += Math.ceil(chineseChars * 1.5 + otherChars * 0.25);
    });
    
    const maxTokens = 128000;
    const usedTokens = totalChars;
    const pct = (usedTokens / maxTokens) * 100;
    
    counter.textContent = `≈${usedTokens.toLocaleString()} / ${(maxTokens/1000).toFixed(0)}k tokens`;
    counter.className = 'token-counter';
    if (pct > 80) counter.classList.add('danger');
    else if (pct > 50) counter.classList.add('warning');
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
        this.closeSidebar();
      });
      list.appendChild(item);
    });
  },

  closeSidebar() {
    const sidebar = document.querySelector('.chat-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  },

  startNewChat() {
    this.messages = [];
    this.currentConvId = null;
    document.getElementById('messages-container').innerHTML = '';
    document.getElementById('chat-input').focus();
    this.closeSidebar();
  },

  /* ========== 发送消息 ========== */
  async sendMessage() {
    if (this.isStreaming) return;

    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

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
      this.syncToCloud();
    }

    this.messages.push({ role: 'user', content });
    this.renderMessages();
    input.value = '';
    input.style.height = 'auto';

    this.showTyping();
    this.isStreaming = true;

    try {
      const apiMessages = this.messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      let response = await this.apiFetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          useSearch: this.useSearch
        })
      });

      if (!response) {
        throw new Error('无法连接到服务器，请稍后再试');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      this.hideTyping();

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
            
            contentDiv.innerHTML = this.renderMarkdown(assistantContent);
            if (typeof hljs !== 'undefined') {
              contentDiv.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
              });
            }
            
            container.scrollTop = container.scrollHeight;
          } catch {}
        }
      }

      this.messages.push({ role: 'assistant', content: assistantContent });
      this.saveMessages();
      this.updateConversationTitle();
      this.updateTokenCounter();

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

  /* ========== 语音输入 ========== */
  isListening: false,
  recognition: null,

  toggleVoiceInput() {
    if (this.isListening) {
      this.stopVoiceInput();
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('您的浏览器不支持语音输入，请使用 Chrome 或 Edge。');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'zh-CN';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    const btn = document.getElementById('btn-voice');
    btn.classList.add('listening');
    btn.textContent = '⏺';
    this.isListening = true;

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const input = document.getElementById('chat-input');
      input.value = (input.value + transcript).trim();
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      this.stopVoiceInput();
    };

    this.recognition.onerror = () => {
      this.stopVoiceInput();
    };

    this.recognition.start();
  },

  stopVoiceInput() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
      this.recognition = null;
    }
    const btn = document.getElementById('btn-voice');
    if (btn) {
      btn.classList.remove('listening');
      btn.textContent = '🎤';
    }
    this.isListening = false;
  },

  /* ========== 导出 ========== */
  exportChat() {
    if (this.messages.length === 0) {
      alert('当前对话为空，没有可导出的内容。');
      return;
    }

    let md = `# 猫猫 AI 对话记录\n\n`;
    md += `导出时间: ${new Date().toLocaleString()}\n`;
    md += `对话 ID: ${this.currentConvId || '未保存'}\n\n---\n\n`;

    this.messages.forEach(msg => {
      const role = msg.role === 'user' ? '**你**' : '**猫猫**';
      md += `### ${role}\n\n${msg.content}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `猫猫对话_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /* ========== 导入 ========== */
  importChat() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.md,.txt';

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          if (Array.isArray(data) && data.length > 0 && data[0].role && data[0].content) {
            this.importMessages(data);
            return;
          }
          alert('无法识别的文件格式。支持格式：导出的 .json 或 .md 文件。');
        } catch {
          alert('无法解析文件，请确保是有效的聊天导出文件。');
        }
      };

      reader.readAsText(file);
    });

    input.click();
  },

  importMessages(messages) {
    this.currentConvId = 'conv_' + Date.now();
    this.messages = messages;
    this.saveMessages();

    let conversations = [];
    try {
      const saved = localStorage.getItem('maomao_conversations');
      conversations = saved ? JSON.parse(saved) : [];
    } catch {}
    
    conversations.unshift({
      id: this.currentConvId,
      title: `导入对话 ${new Date().toLocaleDateString()}`,
      date: new Date().toLocaleDateString(),
      preview: messages[0]?.content?.slice(0, 50) || ''
    });
    localStorage.setItem('maomao_conversations', JSON.stringify(conversations));

    this.renderHistoryList();
    this.renderMessages();
    this.closeSidebar();
    this.syncToCloud();
  },

  /* ========== 联网搜索开关 ========== */
  toggleSearch() {
    this.useSearch = !this.useSearch;
    const btn = document.getElementById('btn-search-toggle');
    if (btn) {
      btn.classList.toggle('active', this.useSearch);
      btn.title = this.useSearch ? '联网搜索：已开启' : '联网搜索：已关闭';
    }
  },

  /* ========== 工具函数 ========== */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /* ========== 生命周期 ========== */
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
