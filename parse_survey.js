const fs = require('fs');
const text = fs.readFileSync('survey_content.txt', 'utf-8');

// I will parse this manually to output the required HTML and JS snippets.
// Let's print out the options for E1-E8 to see exactly what they are.

const extractSection = (regex) => {
    const match = text.match(regex);
    return match ? match[1] : null;
};

console.log("Parsing...");
