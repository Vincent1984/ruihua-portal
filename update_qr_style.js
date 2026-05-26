const fs = require('fs');

let content = fs.readFileSync('admin/js/nqoc-survey.js', 'utf8');

const newQrcodeFunc = `function generateQrcodeWithLogo(container, link, displaySize) {
    container.innerHTML = '';
    const renderSize = displaySize < 200 ? 200 : displaySize; 
    
    new QRCode(container, {
        text: link,
        width: renderSize,
        height: renderSize,
        colorDark : "#7c4dff", // Updated to brand primary color
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    // Make sure the elements scale to the requested display size
    const canvas = container.querySelector('canvas');
    const qrImg = container.querySelector('img');
    if (canvas) {
        canvas.style.width = displaySize + 'px';
        canvas.style.height = displaySize + 'px';
    }
    if (qrImg) {
        qrImg.style.width = displaySize + 'px';
        qrImg.style.height = displaySize + 'px';
        qrImg.style.display = 'none';
    }

    setTimeout(() => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // 1. Draw outer white rounded rectangle (border/padding)
        const outerLogoSize = renderSize * 0.28;
        const outerLogoX = (renderSize - outerLogoSize) / 2;
        const outerLogoY = (renderSize - outerLogoSize) / 2;
        const outerCornerRadius = renderSize * 0.08;
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(outerLogoX + outerCornerRadius, outerLogoY);
        ctx.lineTo(outerLogoX + outerLogoSize - outerCornerRadius, outerLogoY);
        ctx.quadraticCurveTo(outerLogoX + outerLogoSize, outerLogoY, outerLogoX + outerLogoSize, outerLogoY + outerCornerRadius);
        ctx.lineTo(outerLogoX + outerLogoSize, outerLogoY + outerLogoSize - outerCornerRadius);
        ctx.quadraticCurveTo(outerLogoX + outerLogoSize, outerLogoY + outerLogoSize, outerLogoX + outerLogoSize - outerCornerRadius, outerLogoY + outerLogoSize);
        ctx.lineTo(outerLogoX + outerCornerRadius, outerLogoY + outerLogoSize);
        ctx.quadraticCurveTo(outerLogoX, outerLogoY + outerLogoSize, outerLogoX, outerLogoY + outerLogoSize - outerCornerRadius);
        ctx.lineTo(outerLogoX, outerLogoY + outerCornerRadius);
        ctx.quadraticCurveTo(outerLogoX, outerLogoY, outerLogoX + outerCornerRadius, outerLogoY);
        ctx.closePath();
        ctx.fillStyle = '#ffffff'; // White border background
        ctx.fill();
        ctx.restore();

        // 2. Draw inner purple gradient rounded rectangle
        const innerPadding = outerLogoSize * 0.08; // The width of the white border
        const innerLogoSize = outerLogoSize - innerPadding * 2;
        const innerLogoX = outerLogoX + innerPadding;
        const innerLogoY = outerLogoY + innerPadding;
        const innerCornerRadius = outerCornerRadius * 0.8;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(innerLogoX + innerCornerRadius, innerLogoY);
        ctx.lineTo(innerLogoX + innerLogoSize - innerCornerRadius, innerLogoY);
        ctx.quadraticCurveTo(innerLogoX + innerLogoSize, innerLogoY, innerLogoX + innerLogoSize, innerLogoY + innerCornerRadius);
        ctx.lineTo(innerLogoX + innerLogoSize, innerLogoY + innerLogoSize - innerCornerRadius);
        ctx.quadraticCurveTo(innerLogoX + innerLogoSize, innerLogoY + innerLogoSize, innerLogoX + innerLogoSize - innerCornerRadius, innerLogoY + innerLogoSize);
        ctx.lineTo(innerLogoX + innerCornerRadius, innerLogoY + innerLogoSize);
        ctx.quadraticCurveTo(innerLogoX, innerLogoY + innerLogoSize, innerLogoX, innerLogoY + innerLogoSize - innerCornerRadius);
        ctx.lineTo(innerLogoX, innerLogoY + innerCornerRadius);
        ctx.quadraticCurveTo(innerLogoX, innerLogoY, innerLogoX + innerCornerRadius, innerLogoY);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(innerLogoX, innerLogoY, innerLogoX + innerLogoSize, innerLogoY + innerLogoSize);
        gradient.addColorStop(0, '#c026d3'); // Lighter pinkish-purple
        gradient.addColorStop(1, '#7c4dff'); // Brand primary
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();

        // 3. Draw the white logo image
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            ctx.save();
            const logoImagePadding = innerLogoSize * 0.15;
            ctx.drawImage(img, innerLogoX + logoImagePadding, innerLogoY + logoImagePadding, innerLogoSize - logoImagePadding * 2, innerLogoSize - logoImagePadding * 2);
            ctx.restore();
            
            if (qrImg) {
                qrImg.src = canvas.toDataURL('image/png');
                qrImg.style.display = 'block';
                canvas.style.display = 'none';
            }
        };
        img.src = 'https://ruihua-portal.tos-cn-shanghai.volces.com/page/LOGO-%E5%8F%8D%E7%99%BD.png';
    }, 50);
}`;

const regex = /function generateQrcodeWithLogo\(container, link, displaySize\) \{[\s\S]*?\}, 50\);\n\}/;
content = content.replace(regex, newQrcodeFunc);
fs.writeFileSync('admin/js/nqoc-survey.js', content, 'utf8');
console.log('Updated admin/js/nqoc-survey.js with white border + gradient QR code');
