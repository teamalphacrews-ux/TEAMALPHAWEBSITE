---
name: Team Alpha Studio OS
description: The existing connected photography-studio workspace
colors:
  primary: "#245bd8"
  primary-hover: "#1c4cc0"
  primary-soft: "#edf3ff"
  canvas: "#ffffff"
  text: "#20242b"
  muted: "#69717d"
  border: "#e3e7ed"
  field-border: "#8a94a3"
  subtle: "#f5f6f8"
  dark-canvas: "#131416"
  dark-surface: "#202124"
  dark-text: "#f2f2f4"
  dark-muted: "#b0b0b5"
  dark-border: "#3c3d41"
  destructive: "#ba3444"
typography:
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif'
    fontSize: "14px"
    lineHeight: 1.55
  control:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-.012em"
rounded:
  small: "10px"
  control: "12px"
  panel: "16px"
spacing:
  one: "4px"
  two: "8px"
  three: "12px"
  four: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  panel:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.panel}"
---

# Design System: Team Alpha Studio OS

## Overview

The incumbent workspace uses a system sans-serif, white daylight canvas, dark-gray alternative theme, blue actions and softly coloured destination symbols. The interface supports daily operational tasks with clear record hierarchy and compact controls. Refinement preserves this identity and the existing animated overview cards.

**Key Characteristics:**
- Clear operational hierarchy.
- Shared geometry and restrained depth.
- Readable, equally functional daylight and dark-gray themes.

## Colors

Blue identifies primary actions and selected navigation. Daylight canvas, sidebar and workspace use white; subtle neutral surfaces distinguish groups. Dark mode uses the recorded dark canvas and surface values, with light text and visible boundaries. Success, warning and destructive states use semantic tokens from `src/admin/studio-precision-controls.css`.

## Typography

Use `--studio-font` for operational headings, body and controls. Headings use weight 600 and restrained negative tracking. Body defaults to 14px/1.55, controls to 13px/1.4. Mobile editable fields use at least 16px. Monetary figures and metrics use tabular numerals where implemented. Do not import public editorial typography into working forms.

## Layout

The desktop shell has a persistent sidebar and workspace header. The sidebar becomes a drawer on smaller screens; phone navigation provides primary destinations and More. Records use tables on desktop and compact labelled rows/cards on phones. Use the existing 4/8/12/16px rhythm and module layouts; prevent long names, dates and action groups from forcing overflow.

## Elevation & Depth

Shared working cards are flat with a subtle border. Dialogs, floating menus and the mobile dock use elevation to communicate layering. Keep existing coloured destination-tile highlights and signature overview effects; do not apply them to every action.

## Shapes

Canonical controls have 12px radii, smaller grouped controls 10px, and shared panels 16px. Standalone controls retain a 44px touch target. Round toolbar controls and the existing mobile dock remain intentional shell exceptions.

## Components

### Buttons

Primary actions use the blue accent with white labels. Secondary actions use a neutral surface and border; ghost controls have transparent backgrounds. Destructive actions use the destructive palette. Use clear focus rings and stable loading geometry. Transitions use 190ms with `cubic-bezier(.2,.7,.2,1)`.

### Inputs and selectors

Use the shared field surface, boundary and control geometry. Keep one visible selector trigger. Labels remain above fields; icon spacing must not overlap editable text. Mobile selectors retain keyboard access and the existing selection-sheet interaction.

### Navigation

Use the current SVG family and softly lit coloured destination tiles. Selection has a blue-tinted surrounding surface; toolbar actions remain familiar unboxed glyphs. Retain the original icon identity.

### Cards and charts

Use meaningful headings, visible units, readable chart labels and accessible data equivalents. Preserve real data and calculations. Dashboard hiding, reordering and reset controls remain available.

## Do's and Don'ts

- Do keep shared daylight backgrounds clean white.
- Do use dark gray, readable text and visible fields in dark mode.
- Do preserve workflow actions, permissions and existing signature animations.
- Do support keyboard, touch and reduced-motion preferences.
- Don't duplicate dropdown controls or primary actions.
- Don't invent data, connection status, success states or marketing claims.
- Don't replace the current identity during a refinement.
