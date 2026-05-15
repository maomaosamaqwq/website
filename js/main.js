/* ============================
   main.js — 主控制器
   ============================ */
const MainController = {
  currentPage: 'page-turnstile',
  pages: {},

  init() {
    this.pages = {
      'page-turnstile': TurnstilePage,
      'page-loader': LoaderPage,
      'page-intro': IntroPage,
      'page-particles': ParticlePage,
      'page-chat': ChatPage
    };

    Object.values(this.pages).forEach(page => {
      if (page.init) page.init();
    });

    // 从验证页开始
    if (TurnstilePage.start) TurnstilePage.start();
  },

  switchPage(fromId, toId) {
    const fromPage = document.getElementById(fromId);
    const toPage = document.getElementById(toId);
    if (!fromPage || !toPage) return;

    const fromCtrl = this.pages[fromId];
    if (fromCtrl && fromCtrl.stop) fromCtrl.stop();

    if (fromId === 'page-intro' && toId === 'page-particles') {
      this.warpFadeTransition(fromPage, toPage);
    } else {
      this.slideTransition(fromPage, toPage);
    }
  },

  warpFadeTransition(fromPage, toPage) {
    // 平滑过渡：当前页淡出 + 缩放，目标页淡入 + 放大
    fromPage.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    fromPage.style.transform = 'scale(1.1)';
    fromPage.style.opacity = '0';

    setTimeout(() => {
      fromPage.classList.remove('active');
      fromPage.style.display = 'none';
      fromPage.style.transform = '';
      fromPage.style.opacity = '';
      fromPage.style.transition = '';

      // 准备目标页
      toPage.style.display = 'flex';
      toPage.style.opacity = '0';
      toPage.style.transform = 'scale(0.9)';
      toPage.style.transition = 'opacity 0.8s ease, transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
      toPage.classList.add('active');

      // 强制回流
      void toPage.offsetHeight;

      // 淡入 + 放大
      toPage.style.opacity = '1';
      toPage.style.transform = 'scale(1)';

      const toCtrl = this.pages[toPage.id];
      if (toCtrl && toCtrl.start) {
        setTimeout(() => toCtrl.start(), 200);
      }

      this.currentPage = toPage.id;

      setTimeout(() => {
        toPage.style.transform = '';
        toPage.style.opacity = '';
        toPage.style.transition = '';
      }, 1000);
    }, 600);
  },

  slideTransition(fromPage, toPage) {
    fromPage.classList.add('slide-out');

    setTimeout(() => {
      fromPage.classList.remove('active', 'slide-out');
      fromPage.style.display = 'none';

      toPage.style.display = 'flex';
      toPage.classList.add('active', 'slide-in');

      const toCtrl = this.pages[toPage.id];
      if (toCtrl && toCtrl.start) toCtrl.start();

      this.currentPage = toPage.id;

      setTimeout(() => {
        toPage.classList.remove('slide-in');
      }, 800);
    }, 800);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  MainController.init();
});
