(() => {
  const VIDEO_LINKS = {
    '20 · Casa Manolo': 'https://youtu.be/04nmdKvayT4?is=ucY_kaUv8CVfEoHv'
  };

  function addVideoLinks() {
    document.querySelectorAll('.finca-card').forEach(card => {
      const title = card.querySelector('h3')?.textContent?.trim();
      const url = VIDEO_LINKS[title];
      if (!url) return;
      const actions = card.querySelector('.card-actions');
      if (!actions || actions.querySelector('.video-link')) return;
      const link = document.createElement('a');
      link.className = 'video-link';
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Video ansehen ▶';
      actions.appendChild(link);
    });
  }

  const observer = new MutationObserver(addVideoLinks);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', addVideoLinks);
  addVideoLinks();
})();
