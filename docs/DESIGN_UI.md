# Design Document: Color System & UI Standards

## 1. Overview
This section defines the standard color palette and UI component styles to ensure consistency across the entire website.

## 2. Color Palette

### 2.1 Primary Brand Colors
- **Brand Primary (Brand 600)**: `#7c3aed` (RGB: 124, 58, 237)
  - Usage: Primary buttons, active states, key highlights.
- **Brand Hover (Brand 700)**: `#6d28d9` (RGB: 109, 40, 217)
  - Usage: Hover state for primary buttons.
- **Brand Active (Brand 800)**: `#5b21b6` (RGB: 91, 33, 182)
  - Usage: Active/Pressed state for primary buttons.

### 2.2 Secondary Colors
- **Slate 900**: `#0f172a` (Headings, Footer Background)
- **Slate 600**: `#475569` (Body Text)
- **Slate 50**: `#f8fafc` (Light Backgrounds)

## 3. UI Component Standards

### 3.1 Primary Call-to-Action (CTA) Buttons
Used for "预约专家咨询" (Book Consultation) and other main actions.

- **Base Style**:
  - Background: `bg-brand-600` (#7c3aed)
  - Text: `text-white`
  - Font Weight: `font-medium` or `font-bold`
  - Border Radius: `rounded-full` (Navbar) or `rounded-xl` (Hero/Content)
  - Padding: `px-6 py-2.5` (Navbar) or `px-8 py-4` (Hero)
  - Shadow: `shadow-lg shadow-brand-500/20`

- **Interactive States**:
  - **Hover**: 
    - Background: `hover:bg-brand-700` (#6d28d9)
    - Transform: `hover:-translate-y-0.5` (Lift effect)
  - **Mobile**:
    - Background: `bg-brand-600`
    - Text: `text-white`
    - Width: Full width or block level in menu

### 3.2 Consistency Checklist
- Ensure all "预约专家咨询" buttons in Navbar match the Primary CTA definition.
- Verify HEX codes in `tailwind-config.js` match the design specs.

---

# Design Document: Form Management & Permission Isolation
(Original content continues below...)
