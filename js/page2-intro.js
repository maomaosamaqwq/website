/* ============================
   page2-intro.js — 介绍页（星空穿越版）
   ============================ */
const IntroPage = {
  canvas: null,
  ctx: null,
  stars: [],
  width: 0,
  height: 0,
  centerX: 0,
  centerY: 0,
  animFrame: null,
  isActive: false,
  isWarpingOut: false,
  warpOutSpeed: 0,

  // 参数
  starCount: 1000,
  speed: 5,
  fov: 300,
  starBaseSize: 2,
  starMaxSize: 2,

  // 星空汇聚参数
  convergeProgress: 0,
  convergeSpeed: 0,

  init() {
    this.canvas = document.getElementById('warp-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // 开始按钮
    document.getElementById('btn-start').addEventListener('click', () => {
      MainController.switchPage('page-intro', 'page-particles');
    });
  },

  // 设置星空汇聚（为过渡做准备）
  setWarpOut() {
    this.isWarpingOut = true;
    this.warpOutSpeed = -12; // 反向速度，星星往回飞
    this.convergeProgress = 0;
  },

  createStar(initial = false) {
    return {
      x: (Math.random() - 0.5) * this.width * 2,
      y: (Math.random() - 0.5) * this.height * 2,
      z: initial ? Math.random() * this.width : this.width,
      // 保存初始位置用于汇聚效果
      origX: (Math.random() - 0.5) * this.width * 2,
      origY: (Math.random() - 0.5) * this.height * 2,
    };
  },

  resetStar(star) {
    star.x = (Math.random() - 0.5) * this.width * 2;
    star.y = (Math.random() - 0.5) * this.height * 2;
    star.z = this.width;
  },

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
  },

  loop() {
    if (!this.isActive) return;

    const ctx = this.ctx;
    ctx.fillStyle = `rgba(248, 248, 248, 1)`;
    ctx.fillRect(0, 0, this.width, this.height);

    for (const star of this.stars) {
      // 更新
      if (this.isWarpingOut) {
        // 汇聚模式：星星往回飞向中心
        star.z -= this.warpOutSpeed;
        this.convergeProgress = Math.min(1, (this.width - star.z) / this.width);
        
        // 当星星飞到屏幕外时重置到远处
        if (star.z > this.width * 2) {
          // 不重置，让它们飞走消失
          continue;
        }
      } else {
        star.z -= this.speed;
        if (star.z <= 0) {
          this.resetStar(star);
        }
      }

      // 绘制
      const scale = this.fov / star.z;
      const sx = star.x * scale + this.centerX;
      const sy = star.y * scale + this.centerY;
      const size = Math.min(this.starBaseSize * scale, this.starMaxSize);

      if (sx < -10 || sx > this.width + 10 || sy < -10 || sy > this.height + 10) continue;
      if (star.z > this.width * 2) continue;

      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      
      // 汇聚时颜色变暗消失
      if (this.isWarpingOut) {
        const fadeAlpha = Math.max(0, 1 - this.convergeProgress);
        ctx.fillStyle = `rgba(100, 100, 100, ${fadeAlpha * 0.8})`;
      } else {
        ctx.fillStyle = '#888888';
      }
      
      ctx.fill();
    }

    this.animFrame = requestAnimationFrame(() => this.loop());
  },

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.isWarpingOut = false;
    this.warpOutSpeed = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // 创建星星
    this.stars = [];
    for (let i = 0; i < this.starCount; i++) {
      this.stars.push(this.createStar(true));
    }

    this.loop();
  },

  stop() {
    this.isActive = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }
};
