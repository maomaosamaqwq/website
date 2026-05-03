/* ============================
   page1-loader.js — 加载页逻辑
   ============================ */
const LoaderPage = {
  progressBar: null,
  progressLabel: null,
  progress: 0,
  isComplete: false,

  init() {
    this.progressBar = document.querySelector('.progress-bar');
    this.progressLabel = document.querySelector('.progress-label');
    if (!this.progressBar || !this.progressLabel) return;
    this.startLoading();
  },

  startLoading() {
    this.progress = 0;
    const loadInterval = setInterval(() => {
      // 模拟加载：先快后慢
      const increment = this.progress < 50 ? 3 + Math.random() * 5 :
                        this.progress < 80 ? 1.5 + Math.random() * 3 :
                        this.progress < 95 ? 0.5 + Math.random() * 1 :
                        0.2 + Math.random() * 0.3;

      this.progress = Math.min(100, this.progress + increment);
      this.updateProgress();

      if (this.progress >= 100) {
        clearInterval(loadInterval);
        this.isComplete = true;
        // 加载完成后延迟一下再切换页面
        setTimeout(() => {
          MainController.switchPage('page-loader', 'page-intro');
        }, 600);
      }
    }, 80);
  },

  updateProgress() {
    const percent = Math.floor(this.progress);
    this.progressBar.style.height = `${percent}%`;
    this.progressLabel.textContent = `${percent}%`;
  }
};
