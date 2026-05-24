# DESIGN SYSTEM - LeadGenius
## Complete Visual Language & Component Design

================================================================================
## 1. COLOR PALETTE
================================================================================

### Primary Brand Colors
  Primary Blue:      #2563EB (brand-600)
  Primary Dark:      #1E3A8A (brand-900)  
  Primary Light:     #DBEAFE (brand-100)
  Primary 50:        #EFF6FF (brand-50)

### Neutral Colors
  Background:        #F8FAFC (slate-50)
  Surface:           #FFFFFF
  Surface-Hover:     #F1F5F9 (slate-100)
  Border:            #E2E8F0 (slate-200)
  Border-Hover:      #CBD5E1 (slate-300)
  Text-Primary:      #0F172A (slate-900)
  Text-Secondary:    #475569 (slate-600)
  Text-Muted:        #94A3B8 (slate-400)
  Text-Inverse:      #FFFFFF

### Semantic Colors
  Success:           #10B981 (emerald-500)
  Success-Bg:        #ECFDF5 (emerald-50)
  Warning:           #F59E0B (amber-500)
  Warning-Bg:        #FFFBEB (amber-50)
  Error:             #EF4444 (red-500)
  Error-Bg:          #FEF2F2 (red-50)
  Info:              #3B82F6 (blue-500)
  Info-Bg:           #EFF6FF (blue-50)

### AI-Specific Colors
  AI-Primary:        #8B5CF6 (violet-500)
  AI-Bg:             #F5F3FF (violet-50)
  AI-Badge:          #7C3AED (violet-600)

### Status Colors (Lead Pipeline)
  New:               #3B82F6 (blue-500)
  Contacted:         #F59E0B (amber-500)
  Replied:           #8B5CF6 (violet-500)
  Converted:         #10B981 (emerald-500)
  Lost:              #EF4444 (red-500)

### Intent Colors (AI Analysis)
  HIGH:              #EF4444 (red-500) - Ready to buy
  MEDIUM:            #F59E0B (amber-500) - Interested
  LOW:               #94A3B8 (slate-400) - Not interested

### Channel Colors
  Email:             #2563EB (blue-600)
  WhatsApp:          #25D366 (whatsapp-green)

================================================================================
## 2. TYPOGRAPHY
================================================================================

### Font Family
  Primary:           Inter (sans-serif)
  Monospace:         JetBrains Mono (for code, technical content)

### Font Sizes (Tailwind scale)
  xs:                0.75rem  (12px)  - Labels, badges
  sm:                0.875rem (14px)  - Metadata, secondary text
  base:              1rem     (16px)  - Body text
  lg:                1.125rem (18px)  - Large body
  xl:                1.25rem  (20px)  - Sub-headings
  2xl:               1.5rem   (24px)  - Section headings
  3xl:               1.875rem (30px)  - Page headings
  4xl:               2.25rem  (36px)  - Hero headings

### Font Weights
  normal:            400
  medium:            500
  semibold:          600
  bold:              700

### Line Heights
  tight:             1.2   - Headings
  normal:            1.5   - Body
  relaxed:           1.75  - Long form

================================================================================
## 3. SPACING
================================================================================

### Base Unit: 4px

  Space-1:           0.25rem (4px)
  Space-2:           0.5rem  (8px)
  Space-3:           0.75rem (12px)
  Space-4:           1rem    (16px)
  Space-5:           1.25rem (20px)
  Space-6:           1.5rem  (24px)
  Space-8:           2rem    (32px)
  Space-10:          2.5rem  (40px)
  Space-12:          3rem    (48px)
  Space-16:          4rem    (64px)

### Component Spacing
  Page padding:      24px (desktop), 16px (mobile)
  Card padding:      20px
  Section gap:       32px
  Form element gap:  16px
  Button icon gap:   8px
  Table cell padding: 12px 16px

================================================================================
## 4. BORDERS & SHADOWS
================================================================================

### Border Radius
  none:              0px
  sm:                4px
  md:                8px
  lg:                12px
  xl:                16px
  full:              9999px

### Shadows (Tailwind)
  sm:                "0 1px 2px 0 rgb(0 0 0 / 0.05)"
  DEFAULT:           "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"
  md:                "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)"
  lg:                "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"
  xl:                "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"

================================================================================
## 5. COMPONENT SPECIFICATIONS
================================================================================

### 5.1 Buttons

  Primary Button:
    - bg: brand-600 (#2563EB)
    - text: white
    - hover: brand-700 (#1D4ED8)
    - active: brand-800 (#1E40AF)
    - disabled: bg-slate-300, text-slate-500, cursor-not-allowed
    - focus: ring-2 ring-brand-500 ring-offset-2
    - padding: 10px 20px (md), 8px 16px (sm), 12px 24px (lg)
    - border-radius: 8px
    - font: semibold, 14px
    - states: default, hover, active, disabled, loading (show spinner)

  Secondary Button:
    - bg: white
    - border: slate-300
    - text: slate-700
    - hover: bg-slate-50, border-slate-400
    - same padding/radius/weight as primary

  Ghost Button:
    - bg: transparent
    - text: slate-600
    - hover: bg-slate-100
    - no border

  Danger Button:
    - bg: red-600
    - text: white
    - hover: red-700

  Icon Button:
    - size: 36x36px (sm), 40x40px (md)
    - same bg/state patterns as ghost
    - icon centered

### 5.2 Cards
    - bg: white
    - border: 1px solid slate-200
    - border-radius: 12px
    - shadow: sm
    - padding: 20px
    - hover: shadow-md (for clickable cards)

### 5.3 Input Fields
    - bg: white
    - border: 1px solid slate-300
    - border-radius: 8px
    - padding: 10px 14px
    - text: 14px
    - placeholder: text-slate-400
    - focus: border-brand-500, ring-1 ring-brand-500
    - error: border-red-500, ring-1 ring-red-500
    - disabled: bg-slate-50, text-slate-400
    - label: 14px, semibold, text-slate-700, mb-1
    - helper text: 12px, text-slate-500, mt-1
    - error text: 12px, text-red-500, mt-1

### 5.4 Dropdown / Select
    - Same as input field
    - ChevronDown icon on right
    - Options panel: bg-white, shadow-lg, border, rounded-lg, p-1
    - Option item: px-3 py-2, hover:bg-slate-100, text-sm
    - Selected: bg-brand-50 text-brand-700

### 5.5 Table
    - Header: bg-slate-50, text-xs uppercase tracking-wider text-slate-500, font-semibold
    - Row: border-b border-slate-100
    - Row hover: bg-slate-50
    - Selected row: bg-brand-50
    - Cell padding: 12px 16px

### 5.6 Modals
    - Overlay: bg-black/50
    - Content: bg-white, rounded-xl, shadow-xl
    - Width: sm (480px), md (640px), lg (800px), xl (1024px), full (90vw)
    - Animation: scale-95 -> scale-100, opacity-0 -> opacity-100 (200ms)
    - Close: X button top-right
    - Header: px-6 py-4, border-b
    - Body: px-6 py-4
    - Footer: px-6 py-4, border-t, flex justify-end gap-3

### 5.7 Badges
    - padding: 2px 10px
    - font-size: 12px
    - font-weight: 500
    - border-radius: full
    - Variants: 
      - default: bg-slate-100 text-slate-700
      - success: bg-emerald-50 text-emerald-700
      - warning: bg-amber-50 text-amber-700
      - error: bg-red-50 text-red-700
      - info: bg-blue-50 text-blue-700
      - ai: bg-violet-50 text-violet-700

### 5.8 Toast / Notifications
    - Position: top-right (fixed)
    - bg: white
    - border: 1px solid border-color
    - shadow-lg
    - border-radius: 8px
    - padding: 12px 16px
    - max-width: 400px
    - Icon on left, message, close on right
    - Duration: 5s auto-dismiss
    - Types: success (green icon), error (red icon), info (blue icon), warning (amber icon)
    - Animation: slide in from right, fade out

### 5.9 Tabs
    - Tab bar: border-b border-slate-200
    - Tab: px-4 py-3, text-sm font-medium
    - Active tab: text-brand-600, border-b-2 border-brand-600, mb-[-1px]
    - Inactive: text-slate-500, hover:text-slate-700
    - Tab content: pt-6

### 5.10 Loading States
    - Skeleton: bg-slate-200, animate-pulse, rounded-md
    - Spinner: border-2, border-t-brand-600, border-slate-200, rounded-full, animate-spin
    - Sizes: sm(16px), md(24px), lg(32px), xl(48px)
    - Page loading: centered spinner with "Loading..." text
    - Section loading: 3-4 skeleton rows matching content shape

================================================================================
## 6. ANIMATIONS
================================================================================

### Transitions (Framer Motion)
  Page transitions:    fade + slide up (300ms)
  Modal:              scale + opacity (200ms)
  Dropdown:           scale-y + opacity (150ms)
  Sidebar collapse:   width (300ms)
  Toast:              slide in/out (300ms)
  Badge update:       scale pulse (200ms)
  List reorder:       layout animation (300ms)
  Skeleton shimmer:   1.5s infinite

### Micro-interactions
  Button click:       scale 0.97 -> 1.0 (100ms)
  Card hover:         translateY -2px (200ms)
  Row hover:          bg transition (150ms)
  Checkbox toggle:    150ms ease
  Tab switch:         crossfade (200ms)

================================================================================
## 7. RESPONSIVE BREAKPOINTS
================================================================================

  Mobile:             0 - 639px     (sm)
  Tablet:             640 - 1023px  (md)
  Desktop:            1024 - 1279px (lg)
  Wide:               1280 - 1535px (xl)
  Ultrawide:          1536px+       (2xl)

### Layout Adjustments
  Mobile (<640px):
    - Single column layout
    - Full-width cards
    - Collapsed sidebar (hamburger menu)
    - Stacked form fields
    - Bottom sheet instead of modal
    - Smaller text, tighter spacing

  Tablet (640-1023px):
    - 2-column grid
    - Collapsible sidebar
    - Condensed table view
    - Medium cards

  Desktop (1024+):
    - Full layout as designed
    - 3-column grids where appropriate
    - Expanded sidebar
    - Full data tables

================================================================================
## 8. ACCESSIBILITY (a11y)
================================================================================

  - All interactive elements must be keyboard accessible
  - Focus indicators: ring-2 ring-brand-500 ring-offset-2
  - ARIA labels on all icons, icon buttons, and interactive elements
  - Color contrast ratios must meet WCAG AA standards
    - Normal text: 4.5:1 minimum
    - Large text: 3:1 minimum
  - Form inputs must have associated labels
  - Error messages must be announced by screen readers (aria-live)
  - Skip to main content link
  - Semantic HTML (nav, main, article, section, aside)
  - Heading hierarchy (h1 -> h6, no skipping)
  - Alt text on all images
  - Role attributes on custom interactive elements
  - Reduced motion media query for animations
  - Touch targets: minimum 44x44px on mobile

================================================================================
## 9. DARK MODE (Future)
================================================================================

  - Uses CSS custom properties
  - class="dark" on <html> to toggle
  - Colors invert via Tailwind dark: prefix
  - Dark surface: #1E293B (slate-800)
  - Dark bg: #0F172A (slate-900)
  - Dark border: #334155 (slate-700)
  - Dark text: #E2E8F0 (slate-100)
  - Theme persisted in localStorage
  - System preference detected via prefers-color-scheme
