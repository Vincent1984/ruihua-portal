
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const filesToProcess = [
    'solutions-hcvm.html',
    'solutions-ohcvm.html'
];

const rootDir = path.join(__dirname, '..');
const baseUrl = 'https://www.ruihuaconsulting.com';

filesToProcess.forEach(file => {
    const filePath = path.join(rootDir, file);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    console.log(`Processing ${file}...`);
    const content = fs.readFileSync(filePath, 'utf8');
    const dom = new JSDOM(content);
    const document = dom.window.document;

    // 1. Update internal links
    const anchors = document.querySelectorAll('a[href]');
    anchors.forEach(a => {
        let href = a.getAttribute('href');
        if (!href) return;

        // Skip external links
        if (href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return;
        }

        // Handle internal .html links
        if (href.includes('.html')) {
            // Handle anchors
            const parts = href.split('#');
            let pathPart = parts[0];
            const hashPart = parts[1] ? '#' + parts[1] : '';

            // Handle index.html specifically
            if (pathPart === 'index.html' || pathPart === '/index.html') {
                a.setAttribute('href', '/' + hashPart);
                return;
            }

            // Handle other .html files
            if (pathPart.endsWith('.html')) {
                let newPath = pathPart.replace('.html', '/');
                // Ensure directory style has trailing slash if not already there (replace adds it if it was .html)
                // But wait, 'foo.html' -> 'foo/'
                // '/foo.html' -> '/foo/'
                // 'solutions-ahcvm.html' -> 'solutions-ahcvm/'
                a.setAttribute('href', newPath + hashPart);
            }
        }
    });

    // 2. Update canonical link
    // Remove existing canonical if any
    const existingCanonical = document.querySelector('link[rel="canonical"]');
    if (existingCanonical) {
        existingCanonical.remove();
    }

    // Create new canonical
    const canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    
    // Construct canonical URL
    // Assume file name maps to directory name
    const slug = file.replace('.html', '/'); 
    // solutions-ahcvm.html -> solutions-ahcvm/
    
    canonical.setAttribute('href', `${baseUrl}/${slug}`);
    document.head.appendChild(canonical);

    // Save file
    fs.writeFileSync(filePath, dom.serialize());
    console.log(`Updated ${file}`);
});

console.log('URL prettification complete.');
