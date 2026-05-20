const fs = require('fs');
const html = fs.readFileSync('public/nqoc/survey.html', 'utf8');

const mapping = {};

const regex = /<p class="[^"]*">([^<]+)<\/p>\s*<div class="[^"]*">\s*<label[^>]*><input[^>]*name="([^"]+)"/g;
let match;
while ((match = regex.exec(html)) !== null) {
    mapping[match[2]] = match[1].trim();
}

const regexSelect = /<p class="[^"]*">([^<]+)<\/p>\s*<div class="[^"]*">\s*<label[^>]*><input[^>]*type="checkbox"[^>]*name="([^"]+)"/g;
while ((match = regexSelect.exec(html)) !== null) {
    mapping[match[2]] = match[1].trim();
}

const regexTextarea = /<p class="[^"]*">([^<]+)<\/p>\s*<textarea[^>]*name="([^"]+)"/g;
while ((match = regexTextarea.exec(html)) !== null) {
    mapping[match[2]] = match[1].trim();
}

console.log(JSON.stringify(mapping, null, 2));
