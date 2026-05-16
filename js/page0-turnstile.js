/* ============================
   page0-turnstile.js — 已移除验证，直接跳转
   ============================ */
const TurnstilePage = {
  start() {
    MainController.switchPage('page-turnstile', 'page-loader');
  },

  goToNext() {
    MainController.switchPage('page-turnstile', 'page-loader');
  }
};
