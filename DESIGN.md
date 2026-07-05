# Design System: Folia (Tactile Flipbook)

This document outlines the visual identity, design tokens, and aesthetic principles for the **Folia** project—a digital platform for creating and sharing tactile, heritage-inspired digital flipbooks.

## Aesthetic Vision
The design is centered around **"Tactile Digitalism."** It mimics the physical experience of browsing a high-quality archival album or a vintage journal. Key qualities include:
- **Spatial Memory:** Layouts that use paper-like metaphors to help users orient themselves.
- **Materiality:** Subtle grain, paper textures, and shadows that give elements "weight."
- **Timelessness:** A bridge between 19th-century photogravure aesthetics and modern functional UI.

---

## Typography
The system uses a single, expressive serif typeface to maintain an editorial and archival feel. Units are expressed in `rem` for accessibility and responsiveness (assuming a base of 16px).

- **Primary Font:** `Newsreader` (Google Fonts)
- **Scale:**
  - **Display Large:** `2.5rem` / `Leading: 1.2` / `Bold Italic` (Hero headers)
  - **Headline Medium:** `1.75rem` / `Leading: 1.3` / `SemiBold` (Section titles)
  - **Body Text:** `1rem` / `Leading: 1.6` / `Medium` (Narratives and descriptions)
  - **UI Label:** `0.75rem` / `Tracking: 0.05em` / `Uppercase` (Buttons, tags, metadata)

---

## Color Palette
A warm, monochromatic-leaning palette inspired by aged paper, ink-wash tones, and natural materials.

### Surface Colors
- **Surface:** `#fcf9f2` (Main paper background)
- **Surface Dim:** `#dcdad3` (Deepened shadows/dividers)
- **Surface Container:** `#f6f3ec` (Card backgrounds)
- **Surface Bright:** `#ffffff` (Highlighted paper)

### Brand & Accents
- **Primary:** `#2c2926` (Charcoal ink for high-contrast text and primary actions)
- **Secondary:** `#8c4b1d` (Burnt sienna/leather accent for CTAs and highlights)
- **Outline:** `#c4c2bc` (Subtle borders mimicking paper edges)

---

## Design Tokens & Spacing
- **Roundness:** `0.25rem` (4px equivalent) - Subtle rounding to match hand-cut paper edges.
- **Shadows:** Soft, multi-layered shadows to provide depth without looking "digital."
- **Margins:** 
  - Desktop: `4rem` (64px equivalent) edge margin.
  - Mobile: `1.25rem` (20px equivalent) edge margin.

---

## Component Guidelines

### 1. The Flipbook Container
- Must use a book-like spread metaphor on desktop.
- Pages should have a slight "curl" or shadow at the spine.
- Use `{{DATA:IMAGE:IMAGE_N}}` for archival photos, processed with subtle sepia or grain filters.

### 2. Navigation
- **Desktop:** Minimal top bar or a "library desk" sidebar.
- **Mobile:** Bottom navigation for reachability, using icons that feel like stamps or hand-drawn marks.

### 3. Step Markers
- All major views must be numbered (e.g., "1. Home Page," "2. Explore").
- Numbers should be housed in a "pill" or "tag" component that looks like a hand-applied label.

---

## Interaction Principles
- **Transitions:** Use soft fades or page-flip animations rather than sliding "app-like" transitions.
- **Feedback:** Buttons should have a subtle "press" state that mimics the tactile response of a physical button or stamp.
- **States:** Active navigation links are highlighted with an italic font and a subtle hand-ruled underline.
