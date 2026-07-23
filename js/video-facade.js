/**
 * Zero-Data Video Facade Engine
 * Ensures 0 video network payload bytes on initial page load.
 * Instantiates & plays video streams strictly on click or viewport intersection.
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Local HTML5 Video Facades (.video-facade)
  const facadeElements = document.querySelectorAll('.video-facade');

  facadeElements.forEach(facade => {
    const playBtn = facade.querySelector('.video-facade-play-btn') || facade;
    
    playBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (facade.classList.contains('is-loaded')) return;

      const videoSrcOpt = facade.getAttribute('data-video-src-opt');
      const videoSrc = facade.getAttribute('data-video-src');
      const poster = facade.getAttribute('data-poster');

      const video = document.createElement('video');
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.borderRadius = 'inherit';
      if (poster) video.poster = poster;

      if (videoSrcOpt) {
        const sourceOpt = document.createElement('source');
        sourceOpt.src = videoSrcOpt;
        sourceOpt.type = 'video/mp4';
        video.appendChild(sourceOpt);
      }

      if (videoSrc) {
        const source = document.createElement('source');
        source.src = videoSrc;
        source.type = 'video/mp4';
        video.appendChild(source);
      }

      facade.innerHTML = '';
      facade.appendChild(video);
      facade.classList.add('is-loaded');
      video.play().catch(err => console.log('Autoplay error:', err));
    });
  });

  // 2. YouTube Video Proof Facades (.video-proof-box)
  const proofBoxes = document.querySelectorAll('.video-proof-box[data-video-id]');

  proofBoxes.forEach(box => {
    box.addEventListener('click', (e) => {
      if (box.querySelector('iframe')) return;

      const videoId = box.getAttribute('data-video-id');
      if (!videoId) return;

      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
      iframe.title = 'YouTube video player';
      iframe.frameBorder = '0';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; webshare';
      iframe.allowFullscreen = true;
      iframe.style.position = 'absolute';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.zIndex = '10';

      box.appendChild(iframe);
    });
  });
});
