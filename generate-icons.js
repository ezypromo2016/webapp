#!/usr/bin/env node
/**
 * Icon Generator Script
 * Generates placeholder PWA icons using Canvas API (Node.js)
 * Run: node generate-icons.js
 * Requires: npm install canvas
 */

const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 192, 512];
const outputDir = path.join(__dirname, '../frontend/icons');

// Ensure output dir exists
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Try to use canvas if available, otherwise create SVG placeholders
try {
  const { createCanvas } = require('canvas');

  sizes.forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#6366f1';
    const radius = size * 0.2;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();

    // Store emoji / text
    const fontSize = size * 0.5;
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏪', size / 2, size / 2);

    const buffer = canvas.toBuffer('image/png');
    const filename = path.join(outputDir, `icon-${size}x${size}.png`);
    fs.writeFileSync(filename, buffer);
    console.log(`✅ Generated: icon-${size}x${size}.png`);
  });

  console.log('\n🎉 All icons generated!');
} catch (err) {
  console.log('canvas module not available. Creating SVG placeholder icons...');
  
  // Create SVG placeholders that work as icons
  sizes.forEach(size => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#6366f1"/>
  <text x="50%" y="55%" font-size="${size * 0.45}" text-anchor="middle" dominant-baseline="middle">🏪</text>
</svg>`;
    
    // Save as SVG (rename .png in manifest if needed for dev)
    const filename = path.join(outputDir, `icon-${size}x${size}.svg`);
    fs.writeFileSync(filename, svg);
    console.log(`✅ Generated SVG: icon-${size}x${size}.svg`);
  });
  
  // Also create one PNG-named SVG for favicon compatibility
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#6366f1"/>
  <text x="50%" y="55%" font-size="18" text-anchor="middle" dominant-baseline="middle">🏪</text>
</svg>`;
  fs.writeFileSync(path.join(outputDir, 'favicon.svg'), favicon);
  
  console.log('\n✅ SVG icons created. For production, convert to PNG using:');
  console.log('   npx sharp-cli --input icons/*.svg --output icons/ --format png');
}
