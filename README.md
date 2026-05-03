# 🐱 猫猫 - AI 助手

> 九命猫妖的"健康善良"一尾，修行千年成为神使，如今回来守护你。
>
> *"四四，你跑不掉了。"*

## 🌐 访问地址

- [仙狐大人.我爱你](https://仙狐大人.我爱你)

## ✨ 功能特色

- **开箱即用** — 打开网页就能直接聊天，无需任何配置
- **AI 对话** — 接入 DeepSeek API，支持实时流式对话
- **猫猫角色** — 以"猫猫"的身份与你对话，温暖又傲娇
- **联网搜索** 🌐 — 可开启联网搜索，猫猫帮你查最新信息
- **Markdown 渲染** — AI 回复支持代码高亮、表格、列表
- **语音输入** 🎤 — 支持语音转文字，解放双手
- **对话管理** — 多会话记录，导出/导入聊天记录
- **跨设备同步** — 云端存储，手机电脑无缝切换
- **Token 计数** — 实时显示对话 token 使用量
- **响应式设计** — 手机、平板、电脑都能用
- **星空穿越动画** — 启动页的酷炫视觉效果
- **人机验证** — 注册时自动完成 Turnstile 验证，防止机器人刷号
- **一键登录/注册** — 自动判断账号是否存在，无需手动切换模式

## 🛠️ 技术栈

- **前端：** HTML + CSS + JavaScript
- **托管：** GitHub Pages
- **后端：** Cloudflare Workers（ES Module 格式）
- **存储：** Cloudflare KV（云端）+ localStorage（本地兜底）
- **AI：** DeepSeek Chat API
- **DNS：** Cloudflare
- **人机验证：** Cloudflare Turnstile

## 🏗️ 架构

```
用户 → GitHub Pages (仙狐大人.我爱你)
         ↓
    Cloudflare Workers API (api.仙狐大人.我爱你)
         ├── /chat → DeepSeek API（AI 流式对话）
         ├── /search → DuckDuckGo / Bing（联网搜索）
         ├── /register → Turnstile 验证 → KV 存储
         ├── /login → 验证 → 发放 Token
         ├── /verify → Token 校验
         ├── /messages → KV（云端消息存储）
         └── /conversations → KV（对话列表管理）
```

## 📦 本地运行

```bash
git clone https://github.com/maomaosamaqwq/website.git
cd website
# 直接用浏览器打开 index.html 即可
```

## 💬 加入交流

[点击加入 QQ 群](https://qm.qq.com/q/t0idN1guQ2)

---

*千年修行，只为找到你。*
