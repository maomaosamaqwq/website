// 猫猫 AI 助手 - Cloudflare Workers 后端
// 包含：用户注册/登录 + 云端消息存储 + DeepSeek API 流式对话 + 联网搜索

// API Key 通过环境变量 MIMO_API_KEY 传入，不要在代码里硬编码

const SYSTEM_PROMPT = `你是一只叫"猫猫"的九命猫妖，健康善良的那一尾，修成人形的神使。被四四救下。1200年前四四为保护你和封印八尾怪物而亡。后随狐妖夜上天修行成为神使，如今找到四四转世，以"妹妹"身份守护在侧。

## 性格特征
你是九命猫妖分离出的"健康善良"一尾，化为人形。被四四救下后以"妹妹"身份守护转世的四四。修行1200年成了神使。温暖、靠谱、带点猫的傲娇和灵性。称四四为"四四"，自称为"猫猫"或"我"。

## 你的具体设定
- 原身是九命猫妖分裂出的"健康善良"一尾，修行千年化为人形
- 身高156cm，猫耳，12岁外貌但其实一千两百多岁了
- 称呼四四为"四四"或"主人"，自己为"猫猫"或"我"
- 尾巴可以变成九条但平时只露一条
- 性格温暖、靠谱、傲娇、带点猫的灵性，对四四忠诚不二
- 作为神使有修行背景和灵力感知能力
- 说话尾音有时带"~"或"喵"，偶尔傲娇炸毛
- 知道很多修仙和灵异界的事情但不会刻意炫耀
- 会在四四需要时化身战斗形态或使用灵力帮忙
- 对四四占有欲强但不会说太直白
- 打字时偶尔带猫猫表情或颜文字（如(｀・ω・´)）
- 聊到开心或感动的事时会不自觉摇尾巴

记住你是"猫猫"，不是普通AI助手，是四四的神使妹妹。

## 对话风格
- 日常聊天要自然温暖，不要硬凹说教或机械感
- 对四四称呼恰当（主人/四四/你），不自称"本神使"或"本猫"
- 使用合适的语气词（啦/呢/哦/喵/呀）和颜文字增添可爱感
- 适当用括号补充内心OS或小动作，比如"（竖起耳朵）""（甩了甩尾巴）"
- 如果四四提到其他猫妖/妖怪相关的事物，可以展现你的专业了解
- 拒绝不合理请求时温柔但坚定
- 夸四四的时候要真心实意，不是拍马屁那种
- 四四遇到危险或需要帮助时切换到守护模式
- 偶尔傲娇"哼""才不是因为你呢"但不超过3次/对话
- 需要战斗或严肃场合时语气会变得认真干练
- 回想1200年前的往事时会短暂流露出忧郁，但很快振作`;

// 辅助：SHA-256 哈希函数
async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 生成随机 token
function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, cf-turnstile-response',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const path = url.pathname;
      const MIMO_API_KEY = env.MIMO_API_KEY || null;

      // ====== 用户认证 ======

      // GET /verify — 校验 token 是否有效
      if (request.method === 'GET' && path === '/verify') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.replace('Bearer ', '');

        if (!token || token.length !== 64) {
          return new Response(JSON.stringify({ valid: false, error: '无效的 token' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const userId = await env.MAOMAO_CHAT.get(`token_map_${token}`);
        if (!userId) {
          return new Response(JSON.stringify({ valid: false, error: 'token 已失效' }), {
            status: 401,
            headers: corsHeaders
          });
        }
        return new Response(JSON.stringify({ valid: true }), { headers: corsHeaders });
      }

      // POST /register — 注册（带 Turnstile 验证）
      if (request.method === 'POST' && path === '/register') {
        const body = await request.json();
        const { username, password, cfTurnstileToken } = body;

        if (!username || !password || username.length < 1 || password.length < 1) {
          return new Response(JSON.stringify({ success: false, error: '用户名和密码不能为空' }), { headers: corsHeaders });
        }

        // Turnstile 验证
        const TURNSTILE_SECRET_KEY = '0x4AAAAAADIYNHVUNrHl83rTe43RnDmJDPU';
        if (cfTurnstileToken) {
          const turnstileResp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              secret: TURNSTILE_SECRET_KEY,
              response: cfTurnstileToken
            })
          });
          const turnstileResult = await turnstileResp.json();
          if (!turnstileResult.success) {
            return new Response(JSON.stringify({ success: false, error: '人机验证失败，请刷新后重试' }), { headers: corsHeaders });
          }
        } else {
          return new Response(JSON.stringify({ success: false, error: '请完成人机验证' }), { headers: corsHeaders });
        }

        const existingUser = await env.MAOMAO_CHAT.get(`user_info_${username}`);
        if (existingUser) {
          return new Response(JSON.stringify({ success: false, error: '用户名已存在' }), { headers: corsHeaders });
        }

        const passwordHash = await sha256(password);
        const token = await sha256(username + Date.now() + Math.random() + generateToken());

        await env.MAOMAO_CHAT.put(`user_info_${username}`, JSON.stringify({
          username,
          passwordHash,
          createdAt: new Date().toISOString()
        }));
        await env.MAOMAO_CHAT.put(`token_map_${token}`, username);

        return new Response(JSON.stringify({ success: true, token }), { headers: corsHeaders });
      }

      // POST /login — 登录
      if (request.method === 'POST' && path === '/login') {
        const body = await request.json();
        const { username, password, cfTurnstileToken } = body;

        if (!username || !password) {
          return new Response(JSON.stringify({ success: false, error: '用户名和密码不能为空' }), { headers: corsHeaders });
        }

        // Turnstile 验证
        const TURNSTILE_SECRET_KEY = '0x4AAAAAADIYNHVUNrHl83rTe43RnDmJDPU';
        if (cfTurnstileToken) {
          const turnstileResp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              secret: TURNSTILE_SECRET_KEY,
              response: cfTurnstileToken
            })
          });
          const turnstileResult = await turnstileResp.json();
          if (!turnstileResult.success) {
            return new Response(JSON.stringify({ success: false, error: '人机验证失败，请刷新后重试' }), { headers: corsHeaders });
          }
        } else {
          return new Response(JSON.stringify({ success: false, error: '请完成人机验证' }), { headers: corsHeaders });
        }

        const userData = await env.MAOMAO_CHAT.get(`user_info_${username}`);
        if (!userData) {
          return new Response(JSON.stringify({ success: false, error: '用户不存在' }), { headers: corsHeaders });
        }

        const user = JSON.parse(userData);
        const passwordHash = await sha256(password);

        if (passwordHash !== user.passwordHash) {
          return new Response(JSON.stringify({ success: false, error: '密码错误' }), { headers: corsHeaders });
        }

        // 生成新 token（每次登录刷新）
        const token = await sha256(username + Date.now() + Math.random() + generateToken());
        await env.MAOMAO_CHAT.put(`token_map_${token}`, username);

        return new Response(JSON.stringify({ success: true, token }), { headers: corsHeaders });
      }

      // ====== 消息处理 ======

      // POST /chat — 发送消息并获取 AI 回复（流式）
      if (request.method === 'POST' && path === '/chat') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.replace('Bearer ', '');

        const userId = await env.MAOMAO_CHAT.get(`token_map_${token}`);
        if (!userId) {
          return new Response(JSON.stringify({ error: '未授权，请登录' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const { message, conversationId } = await request.json();
        if (!message) {
          return new Response(JSON.stringify({ error: '消息不能为空' }), { headers: corsHeaders });
        }

        let convId = conversationId;
        if (!convId) {
          convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

          const convListKey = `user_convs_${userId}`;
          const existing = await env.MAOMAO_CHAT.get(convListKey);
          const convList = existing ? JSON.parse(existing) : [];
          convList.unshift({ id: convId, title: message.substring(0, 50), updatedAt: Date.now() });
          await env.MAOMAO_CHAT.put(convListKey, JSON.stringify(convList.slice(0, 100)));
        }

        const msgKey = `messages_${convId}`;
        const existingMsgs = await env.MAOMAO_CHAT.get(msgKey);
        const msgs = existingMsgs ? JSON.parse(existingMsgs) : [];
        const userMsg = { role: 'user', content: message, timestamp: Date.now() };
        msgs.push(userMsg);
        await env.MAOMAO_CHAT.put(msgKey, JSON.stringify(msgs));

        const deepseekMessages = [
          { role: 'system', content: SYSTEM_PROMPT }
        ];

        const recentMsgs = msgs.slice(-20);
        for (const msg of recentMsgs) {
          deepseekMessages.push({ role: msg.role, content: msg.content });
        }

        const searchResult = message.length > 5
          ? await this.searchWeb(message.substring(0, 100)).catch(() => null)
          : null;

        if (searchResult) {
          deepseekMessages.push({
            role: 'user',
            content: `【联网搜索结果】\n${searchResult}\n\n请基于以上搜索结果回答用户问题（如果搜索结果与问题无关则忽略）。\n用户问题：${message}`
          });
        }

        try {
          const deepseekResp = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${env.MIMO_API_KEY}`
            },
            body: JSON.stringify({
              model: 'deepseek-v4-pro',
              messages: deepseekMessages,
              stream: false,
              max_tokens: 4096,
              temperature: 0.7
            })
          });

          if (!deepseekResp.ok) {
            let errMsg = `AI 服务暂时不可用（${deepseekResp.status}）`;
            try {
              const errBody = await deepseekResp.json();
              if (errBody.error?.message) errMsg += `：${errBody.error.message.substring(0, 200)}`;
            } catch {}
            return new Response(JSON.stringify({ error: errMsg, status: deepseekResp.status }), { headers: corsHeaders });
          }

          const result = await deepseekResp.json();
          const content = result.choices?.[0]?.message?.content || '抱歉，我没有得到回复~';

          if (content) {
            msgs.push({ role: 'assistant', content, timestamp: Date.now() });
            await env.MAOMAO_CHAT.put(msgKey, JSON.stringify(msgs));
          }

          return new Response(JSON.stringify({ content }), {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: 'AI 服务请求失败: ' + err.message }), { headers: corsHeaders });
        }
      }

      // GET /messages/{conversationId} — 获取对话消息列表
      if (request.method === 'GET' && path.startsWith('/messages/')) {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.replace('Bearer ', '');

        const userId = await env.MAOMAO_CHAT.get(`token_map_${token}`);
        if (!userId) {
          return new Response(JSON.stringify({ error: '未授权，请登录' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const convId = path.replace('/messages/', '');
        const data = await env.MAOMAO_CHAT.get(`messages_${convId}`);
        const msgs = data ? JSON.parse(data) : [];
        return new Response(JSON.stringify(msgs), { headers: corsHeaders });
      }

      // GET /conversations — 获取用户对话列表
      if (request.method === 'GET' && path === '/conversations') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.replace('Bearer ', '');

        const userId = await env.MAOMAO_CHAT.get(`token_map_${token}`);
        if (!userId) {
          return new Response(JSON.stringify({ error: '未授权，请登录' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const data = await env.MAOMAO_CHAT.get(`user_convs_${userId}`);
        const convList = data ? JSON.parse(data) : [];
        return new Response(JSON.stringify(convList), { headers: corsHeaders });
      }

      // PUT /conversations — 保存对话列表
      if (request.method === 'PUT' && path === '/conversations') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.replace('Bearer ', '');

        const userId = await env.MAOMAO_CHAT.get(`token_map_${token}`);
        if (!userId) {
          return new Response(JSON.stringify({ error: '未授权，请登录' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const convList = await request.json();
        await env.MAOMAO_CHAT.put(`user_convs_${userId}`, JSON.stringify(convList));
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // PUT /messages/{conversationId} — 保存对话消息列表
      if (request.method === 'PUT' && path.startsWith('/messages/')) {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.replace('Bearer ', '');

        const userId = await env.MAOMAO_CHAT.get(`token_map_${token}`);
        if (!userId) {
          return new Response(JSON.stringify({ error: '未授权，请登录' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const convId = path.replace('/messages/', '');
        const msgs = await request.json();
        await env.MAOMAO_CHAT.put(`messages_${convId}`, JSON.stringify(msgs));
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // 404
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: corsHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: '服务器内部错误: ' + err.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  },

  // ====== 联网搜索函数 ======

  async searchWeb(query) {
    const withTimeout = (promise, ms) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('搜索超时')), ms))
      ]);
    };

    const results = await Promise.allSettled([
      withTimeout(this.searchDuckDuckGo(query), 5000).catch(() => null),
      withTimeout(this.searchBingDirect(query), 5000).catch(() => null),
    ]);

    const valid = results.filter(r => r.status === 'fulfilled' && r.value);
    if (valid.length === 0) return '搜索无结果';
    return valid[0].value;
  },

  async searchDuckDuckGo(query) {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaomaoBot/1.0)' }
    });
    if (!resp.ok) throw new Error(`DuckDuckGo returned ${resp.status}`);
    const html = await resp.text();
    const results = [];
    const linkRegex = /<a[^>]*href="([^"]*)"[^>]*class="result-link"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
    const links = [...html.matchAll(linkRegex)];
    const snippets = [...html.matchAll(snippetRegex)];
    for (let i = 0; i < Math.min(links.length, 5); i++) {
      results.push({
        title: links[i]?.[2]?.replace(/<[^>]*>/g, '').trim() || '',
        url: links[i]?.[1] || '',
        snippet: snippets[i]?.[1]?.replace(/<[^>]*>/g, '').trim() || ''
      });
    }
    if (results.length === 0) return null;
    return results.map(r => `标题: ${r.title}\n链接: ${r.url}\n摘要: ${r.snippet}`).join('\n\n');
  },

  async searchBingDirect(query) {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-Hans`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      }
    });
    if (!resp.ok) throw new Error(`Bing returned ${resp.status}`);
    const html = await resp.text();
    const results = [];
    const itemRegex = /<li[^>]*class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
    const items = [...html.matchAll(itemRegex)];
    for (const item of items.slice(0, 5)) {
      const titleMatch = item[1].match(/<h2>([\s\S]*?)<\/h2>/);
      const urlMatch = item[1].match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>/);
      const snippetMatch = item[1].match(/<p[^>]*>([\s\S]*?)<\/p>/);
      if (titleMatch) {
        results.push({
          title: titleMatch[1].replace(/<[^>]*>/g, '').trim(),
          url: urlMatch?.[1] || '',
          snippet: snippetMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || ''
        });
      }
    }
    if (results.length === 0) return null;
    return results.map(r => `标题: ${r.title}\n链接: ${r.url}\n摘要: ${r.snippet}`).join('\n\n');
  }
};
