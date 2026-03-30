(() => {
  const DEFAULTS = {
    article: '/fallback-image/article',
    avatar: '/fallback-image/avatar',
    video: '/fallback-image/video'
  };

  function setFallback(img) {
    const fallback = img.getAttribute('data-fallback');
    if (fallback) {
      img.src = fallback;
      return;
    }
    const cls = img.className || '';
    if (cls.includes('avatar') || img.id.includes('avatar')) {
      img.src = DEFAULTS.avatar;
    } else if (cls.includes('video') || img.closest('[data-video]')) {
      img.src = DEFAULTS.video;
    } else {
      img.src = DEFAULTS.article;
    }
  }

  function retryOnce(img, delay = 1200) {
    const original = img.getAttribute('data-original-src');
    if (!original) return setFallback(img);
    const retried = img.getAttribute('data-retried') === '1';
    if (retried) return setFallback(img);
    img.setAttribute('data-retried', '1');
    setTimeout(() => {
      img.src = original;
    }, delay);
  }

  function wireImage(img) {
    if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
    const currentSrc = img.getAttribute('src') || '';
    if (!img.getAttribute('data-original-src')) img.setAttribute('data-original-src', currentSrc);
    img.addEventListener('error', () => retryOnce(img));
  }

  function lazyInit() {
    const imgs = Array.from(document.querySelectorAll('img'));
    imgs.forEach(wireImage);
    const lazyImgs = Array.from(document.querySelectorAll('img[data-src]'));
    if (lazyImgs.length === 0) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target;
          const src = el.getAttribute('data-src');
          if (src) {
            el.src = src;
            el.removeAttribute('data-src');
          }
          io.unobserve(el);
        }
      });
    }, { rootMargin: '100px' });
    lazyImgs.forEach(img => io.observe(img));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', lazyInit);
  } else {
    lazyInit();
  }
})();
