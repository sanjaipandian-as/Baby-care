import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const htmlPath = path.join(rootDir, 'baby-workshop-clone.html');
const dimPath = path.join(__dirname, 'image-dimensions.json');

const dimensions = JSON.parse(fs.readFileSync(dimPath, 'utf8'));

let html = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Starting HTML Refactoring ---');

// 1. Update Head section (Preloads, Font Overrides, Critical CSS, Non-blocking CSS)

// Add Preloads for Hero AVIF and WebP + CSS Preload in head
const preloads = `
  <!-- Preload LCP Hero Images -->
  <link rel="preload" as="image" href="assets/image/hero-card.avif" type="image/avif" fetchpriority="high">
  <link rel="preload" as="image" href="assets/image/hero-card.webp" type="image/webp" fetchpriority="high">

  <!-- Asynchronous Non-Critical CSS -->
  <link rel="preload" href="css/deferred.css" as="style" onload="this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="css/deferred.css"></noscript>
`;

// Replace existing preload hero line
html = html.replace(/<link rel="preload" as="image" href="assets\/image\/hero-card\.webp" type="image\/webp" fetchpriority="high">/gi, preloads.trim());

// Add Font Overrides and Aspect-Ratio rule in Critical CSS
const criticalExtras = `
    /* Font Fallback Metric Overrides for CLS Prevention */
    @font-face {
      font-family: 'DM Sans Fallback';
      src: local('Arial');
      ascent-override: 95%;
      descent-override: 25%;
      line-gap-override: 0%;
      size-adjust: 100%;
    }
    @font-face {
      font-family: 'Forum Fallback';
      src: local('Georgia');
      ascent-override: 90%;
      descent-override: 20%;
      line-gap-override: 0%;
      size-adjust: 100%;
    }
    img, picture, video, .video-facade {
      max-width: 100%;
      height: auto;
      aspect-ratio: attr(width) / attr(height);
    }
`;

html = html.replace('/* CRITICAL & FLUID CORE STYLES */', `/* CRITICAL & FLUID CORE STYLES */\n${criticalExtras}`);

// Remove inline <style id="deferred-css">...</style> since it is now in css/deferred.css
html = html.replace(/<style id="deferred-css">[\s\S]*?<\/style>/gi, '');

// 2. Refactor Video Card into Zero-Data Facade Pattern
const oldVideoRegex = /<div class="video-card">[\s\S]*?<\/div>/gi;
const videoFacadeHtml = `<div class="video-card">
          <div class="video-facade" data-video-src-opt="assets/image/gec-video-opt.mp4" data-video-src="assets/image/gec-video.mp4" data-poster="assets/image/gec-video-opt-poster.webp">
            <picture>
              <source srcset="assets/image/gec-video-opt-poster.avif" type="image/avif">
              <source srcset="assets/image/gec-video-opt-poster.webp" type="image/webp">
              <img src="assets/image/gec-video-opt-poster.webp" alt="Whispering Brain Studio Video Award" width="1920" height="1080" loading="lazy" decoding="async">
            </picture>
            <div class="video-facade-play-btn" aria-label="Play Video">
              <div class="play-triangle"></div>
            </div>
          </div>
        </div>`;

html = html.replace(oldVideoRegex, videoFacadeHtml);

// 3. Process image tags and picture tags in HTML
// Helper to get image filename from src string
function getImgFilename(src) {
  const match = src.match(/assets\/image\/([^"'\s?#]+)/);
  return match ? match[1] : null;
}

// Transform standalone <img> elements into <picture> elements with width/height/loading/decoding attributes
// We handle both existing <picture> blocks and standalone <img> tags.

// A. First update all existing <picture> elements to include <source type="image/avif"> if missing, and ensure exact width/height on <img>
html = html.replace(/<picture>([\s\S]*?)<\/picture>/gi, (fullMatch, inner) => {
  const imgMatch = inner.match(/<img\s+([^>]+)>/i);
  if (!imgMatch) return fullMatch;

  const srcMatch = inner.match(/src="([^"]+)"/i);
  if (!srcMatch) return fullMatch;

  const src = srcMatch[1];
  const filename = getImgFilename(src);
  if (!filename) return fullMatch;

  const baseName = path.parse(filename).name;
  const dim = dimensions[filename] || dimensions[`${baseName}.png`] || dimensions[`${baseName}.jpg`] || dimensions[`${baseName}.webp`] || { width: 800, height: 600 };

  const isHero = src.includes('hero-card');
  const loadingAttr = isHero ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  const altMatch = inner.match(/alt="([^"]*)"/i);
  const altText = altMatch ? altMatch[1] : 'Image';
  const classMatch = inner.match(/class="([^"]*)"/i);
  const classAttr = classMatch ? `class="${classMatch[1]}"` : '';

  return `<picture>
              <source srcset="assets/image/${baseName}.avif" type="image/avif">
              <source srcset="assets/image/${baseName}.webp" type="image/webp">
              <img src="assets/image/${baseName}.png" alt="${altText}" ${classAttr} width="${dim.width}" height="${dim.height}" ${loadingAttr} decoding="async">
            </picture>`;
});

// B. Standalone <img> tags (not inside a <picture>)
html = html.replace(/<img\s+(?![^>]*data-processed)([^>]+)>/gi, (fullMatch, attrs) => {
  // Ignore if already inside picture (or handled)
  const srcMatch = attrs.match(/src="([^"]+)"/i);
  if (!srcMatch) return fullMatch;

  const src = srcMatch[1];
  if (!src.startsWith('assets/image/')) {
    // External images like mentor external webp or placeholders
    const dimWidth = attrs.match(/width="([^"]+)"/i);
    const dimHeight = attrs.match(/height="([^"]+)"/i);
    let w = dimWidth ? dimWidth[1] : '340';
    let h = dimHeight ? dimHeight[1] : '400';

    if (!attrs.includes('loading=')) {
      attrs += ' loading="lazy" decoding="async"';
    }
    if (!attrs.includes('width=')) {
      attrs += ` width="${w}" height="${h}"`;
    }
    return `<img ${attrs}>`;
  }

  const filename = getImgFilename(src);
  if (!filename) return fullMatch;

  const baseName = path.parse(filename).name;
  const dim = dimensions[filename] || dimensions[`${baseName}.png`] || dimensions[`${baseName}.jpg`] || dimensions[`${baseName}.webp`] || { width: 800, height: 600 };

  const isHero = src.includes('hero-card') || src.includes('bg123015');
  const loadingAttr = isHero ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  const altMatch = attrs.match(/alt="([^"]*)"/i);
  const altText = altMatch ? altMatch[1] : 'Image';
  const classMatch = attrs.match(/class="([^"]*)"/i);
  const classAttr = classMatch ? `class="${classMatch[1]}"` : '';

  return `<picture>
        <source srcset="assets/image/${baseName}.avif" type="image/avif">
        <source srcset="assets/image/${baseName}.webp" type="image/webp">
        <img src="assets/image/${baseName}.png" alt="${altText}" ${classAttr} width="${dim.width}" height="${dim.height}" ${loadingAttr} decoding="async">
      </picture>`;
});

// 4. Inject Video Facade script before </body>
if (!html.includes('js/video-facade.js')) {
  html = html.replace('</body>', '  <script src="js/video-facade.js" defer></script>\n</body>');
}

fs.writeFileSync(htmlPath, html);
console.log(`Successfully refactored ${htmlPath}`);
console.log('--- HTML Refactoring Complete ---');
