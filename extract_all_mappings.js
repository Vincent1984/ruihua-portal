const fs = require('fs');

const html = fs.readFileSync('public/nqoc/survey.html', 'utf-8');

const mappings = {};

// 1. Likert and other standard format
const questionRegex1 = /<p[^>]*>\s*([A-Z][0-9]\.[0-9]\.[0-9]|[V]\d\.\d\.\d)\s+([^<]+)<\/p>/g;
let match;
while ((match = questionRegex1.exec(html)) !== null) {
    const originalKey = match[1];
    mappings[originalKey] = originalKey + " " + match[2].trim();
}

// 2. Objective multiple choice
const questionRegex2 = /<label[^>]*>\s*【客观题\s+([A-Z]-[A-Z0-9]+)】([^<]+)<\/label>/g;
while ((match = questionRegex2.exec(html)) !== null) {
    const key = match[1];
    mappings[key] = "【客观题 " + key + "】" + match[2].trim();
}

// 3. S, O, E, R series (handling <span class="text-red-500">*</span>)
const questionRegex3 = /<label[^>]*>\s*([E|R|O|S]\d+(?:\.\d+)?)\.?\s+([\s\S]*?)<\/label>/g;
while ((match = questionRegex3.exec(html)) !== null) {
    const key = match[1];
    let text = match[2];
    // remove span tags and clean up
    text = text.replace(/<span[^>]*>.*?<\/span>/g, '').trim();
    // remove trailing stars or whitespace
    text = text.replace(/\*$/, '').trim();
    mappings[key] = key + ". " + text;
}

// 4. Options
const optionRegex = /<input[^>]+name="([^"]+)"[^>]+value="([^"]+)"[^>]*>\s*(?:<span[^>]*>)?([^<]+)(?:<\/span>)?/g;
while ((match = optionRegex.exec(html)) !== null) {
    let name = match[1];
    let value = match[2];
    let label = match[3].trim();
    if (!value || label === '') continue;
    label = label.replace(/★$/, '').trim();
    mappings[name + '_' + value] = label;
}

// 5. Select options
const selectRegex = /<select[^>]+name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g;
while ((match = selectRegex.exec(html)) !== null) {
    const name = match[1];
    const optionsHtml = match[2];
    const optionRegex2 = /<option[^>]+value="([^"]+)"[^>]*>([^<]+)<\/option>/g;
    let match2;
    while ((match2 = optionRegex2.exec(optionsHtml)) !== null) {
        const value = match2[1];
        const label = match2[2].trim();
        if (value) {
            mappings[name + '_' + value] = label;
        }
    }
}

// Additional fix for S8 if missed
mappings["S8"] = "S8. 补充反馈或建议（选填）";

fs.writeFileSync('admin/js/survey_mappings.json', JSON.stringify(mappings, null, 2), 'utf-8');
console.log('Generated mappings with ' + Object.keys(mappings).length + ' entries.');
