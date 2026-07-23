import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imageDir = path.join(__dirname, '..', 'assets', 'image');

async function runOptimization() {
  console.log('--- Starting Media Optimization Pipeline ---');
  if (!fs.existsSync(imageDir)) {
    console.error(`Directory not found: ${imageDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(imageDir);
  const imageFiles = files.filter(f => /\.(png|jpe?g)$/i.test(f));
  const videoFiles = files.filter(f => /\.(mp4|webm|mov)$/i.test(f));

  console.log(`Found ${imageFiles.length} image assets and ${videoFiles.length} video assets.`);

  const dimensionsMap = {};

  // 1. Process Images
  for (const file of imageFiles) {
    const filePath = path.join(imageDir, file);
    const parsed = path.parse(file);
    const avifPath = path.join(imageDir, `${parsed.name}.avif`);
    const webpPath = path.join(imageDir, `${parsed.name}.webp`);

    try {
      const metadata = await sharp(filePath).metadata();
      dimensionsMap[file] = { width: metadata.width, height: metadata.height };
      dimensionsMap[`${parsed.name}.webp`] = { width: metadata.width, height: metadata.height };
      dimensionsMap[`${parsed.name}.avif`] = { width: metadata.width, height: metadata.height };

      // Convert to AVIF (q=65)
      await sharp(filePath)
        .avif({ quality: 65, effort: 4 })
        .toFile(avifPath);

      // Convert to WebP (q=80)
      await sharp(filePath)
        .webp({ quality: 80, effort: 4 })
        .toFile(webpPath);

      const origSize = fs.statSync(filePath).size;
      const avifSize = fs.statSync(avifPath).size;
      const webpSize = fs.statSync(webpPath).size;

      console.log(`[Processed Image] ${file} -> AVIF: ${(avifSize/1024).toFixed(1)}KB, WebP: ${(webpSize/1024).toFixed(1)}KB (Orig: ${(origSize/1024).toFixed(1)}KB)`);
    } catch (err) {
      console.error(`Error processing ${file}:`, err.message);
    }
  }

  // Also store existing webp metadata
  const webpFiles = files.filter(f => /\.webp$/i.test(f));
  for (const file of webpFiles) {
    if (!dimensionsMap[file]) {
      try {
        const filePath = path.join(imageDir, file);
        const metadata = await sharp(filePath).metadata();
        dimensionsMap[file] = { width: metadata.width, height: metadata.height };
      } catch(e) {}
    }
  }

  // 2. Process Video Assets (Poster Generation)
  for (const videoFile of videoFiles) {
    const videoPath = path.join(imageDir, videoFile);
    const parsed = path.parse(videoFile);
    const rawPosterPng = path.join(imageDir, `${parsed.name}-poster-raw.png`);
    const posterWebp = path.join(imageDir, `${parsed.name}-poster.webp`);
    const posterAvif = path.join(imageDir, `${parsed.name}-poster.avif`);

    try {
      // Extract frame 00:00:01
      execSync(`ffmpeg -y -i "${videoPath}" -ss 00:00:01 -vframes 1 "${rawPosterPng}"`, { stdio: 'ignore' });
      if (fs.existsSync(rawPosterPng)) {
        const metadata = await sharp(rawPosterPng).metadata();
        dimensionsMap[`${parsed.name}-poster.webp`] = { width: metadata.width, height: metadata.height };
        dimensionsMap[`${parsed.name}-poster.avif`] = { width: metadata.width, height: metadata.height };

        await sharp(rawPosterPng).webp({ quality: 80 }).toFile(posterWebp);
        await sharp(rawPosterPng).avif({ quality: 65 }).toFile(posterAvif);
        fs.unlinkSync(rawPosterPng);

        console.log(`[Generated Video Poster] ${videoFile} -> ${parsed.name}-poster.webp (${metadata.width}x${metadata.height})`);
      }
    } catch (err) {
      console.error(`Error generating poster for ${videoFile}:`, err.message);
    }
  }

  // Save dimensions json
  const jsonPath = path.join(__dirname, 'image-dimensions.json');
  fs.writeFileSync(jsonPath, JSON.stringify(dimensionsMap, null, 2));
  console.log(`Saved image metadata to ${jsonPath}`);
  console.log('--- Batch Optimization Complete ---');
}

runOptimization();
