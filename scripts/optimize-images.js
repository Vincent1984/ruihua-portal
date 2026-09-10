#!/usr/bin/env node
/**
 * 批量优化图片脚本
 *
 * 功能：
 * 1. 压缩 JPEG/PNG 图片
 * 2. 生成 WebP 格式
 * 3. 生成响应式尺寸
 *
 * 使用：node scripts/optimize-images.js
 */

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

const config = {
  inputDir: path.join(__dirname, '../public/images'),
  outputDir: path.join(__dirname, '../public/images/optimized'),
  // 生成的响应式尺寸
  sizes: [400, 800, 1200],
  // 图片质量
  quality: 85,
  // 跳过的目录
  skipDirs: ['optimized', 'favicon']
};

async function getAllImages(dir, fileList = []) {
  const files = await fs.readdir(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      // 跳过特定目录
      if (config.skipDirs.includes(file)) continue;
      await getAllImages(filePath, fileList);
    } else if (/\.(jpe?g|png)$/i.test(file)) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

async function optimizeImage(imagePath) {
  try {
    const relativePath = path.relative(config.inputDir, imagePath);
    const dirname = path.dirname(relativePath);
    const basename = path.basename(relativePath, path.extname(relativePath));
    const ext = path.extname(relativePath).toLowerCase();

    console.log(`Processing: ${relativePath}`);

    // 确保输出目录存在
    const outputDir = path.join(config.outputDir, dirname);
    await fs.mkdir(outputDir, { recursive: true });

    // 读取图片
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    // 为每个尺寸生成 JPEG 和 WebP
    for (const size of config.sizes) {
      // 如果原图小于目标尺寸，跳过
      if (metadata.width && metadata.width < size) continue;

      // JPEG
      await image
        .clone()
        .resize(size, null, { withoutEnlargement: true })
        .jpeg({ quality: config.quality, mozjpeg: true })
        .toFile(path.join(outputDir, `${basename}-${size}.jpg`));

      // WebP
      await image
        .clone()
        .resize(size, null, { withoutEnlargement: true })
        .webp({ quality: config.quality })
        .toFile(path.join(outputDir, `${basename}-${size}.webp`));

      console.log(`  ✓ Generated ${basename}-${size}.jpg and .webp`);
    }

    // 生成原始尺寸的 WebP
    await image
      .clone()
      .webp({ quality: config.quality })
      .toFile(path.join(outputDir, `${basename}.webp`));

    console.log(`  ✓ Generated ${basename}.webp`);

  } catch (error) {
    console.error(`  ✗ Error processing ${imagePath}:`, error.message);
  }
}

async function main() {
  console.log('🖼️  Image Optimization Started\n');
  console.log(`Input: ${config.inputDir}`);
  console.log(`Output: ${config.outputDir}`);
  console.log(`Sizes: ${config.sizes.join(', ')}px`);
  console.log(`Quality: ${config.quality}%\n`);

  // 确保输出目录存在
  await fs.mkdir(config.outputDir, { recursive: true });

  // 获取所有图片
  const images = await getAllImages(config.inputDir);
  console.log(`Found ${images.length} images to process\n`);

  // 批量处理
  let processed = 0;
  for (const imagePath of images) {
    await optimizeImage(imagePath);
    processed++;
    console.log(`Progress: ${processed}/${images.length}\n`);
  }

  console.log('✅ Image optimization completed!');
  console.log(`\nProcessed ${processed} images`);
  console.log(`Output directory: ${config.outputDir}`);
}

main().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
