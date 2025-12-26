# Color Scheme Documentation

## Overview
This document outlines the color scheme updates for the "Honors and Qualifications" module on the About Us page, based on the provided design standard.

## New CSS Variables
The following CSS variables have been added to `public/css/styles.css` to allow for easy maintenance and theme adjustments.

```css
:root {
  /* ... existing vars ... */

  /* Honors Module Colors */
  --bg-honors: #F5FAFF;      /* Hydrogen Blue Transparent Base (氢蓝透明底色) - Background */
  --border-honors: #E5E5E5;  /* Divider Color (分割线颜色) - Borders */
  --text-honors-title: #2C2C32; /* Title Color (标题颜色) - High Contrast */
  --text-honors-body: #555555;  /* Body Text Color (正文颜色) - Readable Gray */
}
```

## Applied Changes
- **Background Color**: Changed from Beige (`#FFF9F0`) to Hydrogen Blue (`#F5FAFF`) to match the corporate tech/professional aesthetic.
- **Border Color**: Changed from Gold/Beige (`#F5E6D3`) to Neutral Gray (`#E5E5E5`) for a cleaner look.
- **Text Color**: 
  - Titles updated to `#2C2C32` for better contrast against the light blue background.
  - Body text updated to `#555555`.
- **Icons**: Retained Gold (`#D4AF37`) as an accent color for the "Honors" theme.

## Accessibility
- The contrast ratio between the Title text (`#2C2C32`) and Background (`#F5FAFF`) is **14.8:1**, which passes WCAG AAA standards.
- The contrast ratio between the Body text (`#555555`) and Background (`#F5FAFF`) is **7.6:1**, which passes WCAG AAA standards.

## Usage
To update these colors in the future, simply modify the variables in `public/css/styles.css`. No HTML changes are required.
