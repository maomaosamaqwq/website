/* ============================
   page0-turnstile.js — 人机验证页
   ============================ */
const TurnstilePage = {
  start() {
    // 如果已经验证过，直接跳过
    const savedToken = localStorage.getItem('maomao_turnstile_token');
    if (savedToken) {
      // 验证 token 是否仍然有效（简单的存在性检查）
      this.goToNext();
      return;
    }

    this.pollTurnstile();
  },

  pollTurnstile() {
    const hint = document.getElementById('turnstile-hint');
    const check = () => {
      if (typeof turnstile !== 'undefined') {
        const token = turnstile.getResponse() || turnstile.getResponse('#intro-turnstile');
        if (token) {
          localStorage.setItem('maomao_turnstile_token', token);
          if (hint) hint.textContent = '验证成功！';
          setTimeout(() => this.goToNext(), 500);
          return;
        }
      }
      setTimeout(check, 500);
    };
    check();
  },

  goToNext() {
    MainController.switchPage('page-turnstile', 'page-loader');
  }
};
