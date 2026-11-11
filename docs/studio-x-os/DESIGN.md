---
name: Studio X OS commercial homepage
description: Prismatic light and precise product surfaces for the business behind photography.
colors:
  charcoal-paper: "#090b12"
  opal-ink: "#f4f5fb"
  muted-ink: "#a9b2ca"
  secondary-ink: "#aeb8d0"
  heading-ink: "#f1f4fc"
  studio-line: "#2a3043"
  lavender-focus: "#c3d1ff"
  action-opal: "#e9edff"
  action-ink: "#111727"
  action-hover: "#cdd9ff"
  raised-charcoal: "#121824"
  raised-hover: "#24304b"
  raised-ink: "#e1e8fc"
  raised-line: "#485575"
  raised-line-hover: "#7f94c8"
  client-opal: "#edf2f9"
  client-paper: "#ffffff"
  client-ink: "#203759"
  client-secondary: "#52698b"
  client-focus: "#385e9b"
  client-line: "#b9c7dc"
  client-action: "#2d4f82"
  client-action-ink: "#f7f9ff"
  preview-daylight: "#f6f8fc"
  preview-dark: "#101728"
  preview-daylight-ink: "#384b6a"
  preview-dark-ink: "#bdcde8"
  preview-daylight-focus: "#2354c4"
  preview-dark-focus: "#bfcaff"
typography:
  display:
    fontFamily: "Studio Manrope, Inter, sans-serif"
    fontSize: "clamp(64px, 6.7vw, 96px)"
    fontWeight: 550
    lineHeight: 1.025
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Studio Manrope, Inter, sans-serif"
    fontSize: "clamp(40px, 4.4vw, 64px)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Inter, -apple-system, system-ui, Segoe UI, sans-serif"
    fontSize: "16px"
    lineHeight: 1.8
  label:
    fontFamily: "Inter, -apple-system, system-ui, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  control: "10px"
  preview: "16px"
  client: "18px"
spacing:
  small: "8px"
  control-gap: "16px"
  group: "24px"
  chapter-gap: "64px"
components:
  button-primary:
    backgroundColor: "{colors.action-opal}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.control}"
    padding: "13px 20px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.action-ink}"
  button-secondary:
    backgroundColor: "{colors.raised-charcoal}"
    textColor: "{colors.raised-ink}"
    rounded: "{rounded.control}"
    padding: "13px 20px"
  button-secondary-hover:
    backgroundColor: "{colors.raised-hover}"
    textColor: "{colors.raised-ink}"
  client-preview:
    backgroundColor: "{colors.client-paper}"
    textColor: "{colors.client-ink}"
    rounded: "{rounded.client}"
    padding: "26px"
  screenshot-daylight:
    backgroundColor: "{colors.preview-daylight}"
    textColor: "{colors.preview-daylight-ink}"
    rounded: "{rounded.preview}"
  screenshot-dark:
    backgroundColor: "{colors.preview-dark}"
    textColor: "{colors.preview-dark-ink}"
    rounded: "{rounded.preview}"
---

# Design System: Studio X OS commercial homepage

## Overview

**Creative North Star: "Prismatic light lab"**

Studio X OS brings photography's physical light, optical depth and considered composition into a commercial software introduction. Charcoal working surfaces, blue/lavender light and opal display type carry the supplied Studio X OS marks. The personality is futuristic and confident, with the real product remaining legible beneath the spectacle.

This is the commercial homepage's scoped visual authority. It does not replace, merge into or redefine the personal Team Alpha system in [`frontend/DESIGN.md`](../../frontend/DESIGN.md) or its product context. The homepage's Persuade strategy, centered composition, intentional hero-to-dashboard gap and detailed scene choreography remain in the [surface brief](../STUDIO_X_OS_HOMEPAGE_MOTION.md). This document records reusable visual decisions; it does not turn one page's arrangement into a rule for every Studio X OS screen.

**Key Characteristics:**

- Physical optical materials around the exact supplied X artwork.
- Distinct display and working-interface typography.
- Open editorial chapters interrupted by truthful sample product surfaces.
- Responsive and keyboard-stable alternatives to cinematic motion.
- Clear preview, sample-data and coming-soon qualifications.

## Colors

The palette pairs charcoal and opal with blue/lavender light. Frontmatter values describe the implemented semantic materials and their reused local recipes. The CSS source of these roles is [`productTokens.css`](../../frontend/src/saas/productTokens.css), scoped to the commercial product root; decorative optical gradients are intentional local artwork rather than a second token palette. The sidecar's synthesized tonal ramps are reference metadata, not extra colours shipped to the interface.

### Primary

- **Lavender Focus** (`lavender-focus`): visible keyboard focus on dark studio surfaces.
- **Action Opal** (`action-opal`, `action-ink`, `action-hover`): the primary commercial action, with a distinct hover surface.

### Secondary

- **Raised Charcoal** (`raised-charcoal`, `raised-hover`, `raised-ink`, `raised-line`, `raised-line-hover`): secondary controls that remain readable over the dark studio material.
- **Client Blue** (`client-action`, `client-action-ink`, `client-focus`): the action and focus vocabulary on the opal client chapter.

### Neutral

- **Charcoal Paper** (`charcoal-paper`, `studio-line`): the marketing canvas and restrained studio boundaries.
- **Opal Ink** (`opal-ink`, `heading-ink`, `secondary-ink`, `muted-ink`): primary hierarchy and supporting copy on the dark canvas.
- **Client Opal** (`client-opal`, `client-paper`, `client-ink`, `client-secondary`, `client-line`): a deliberately lighter client-facing material, rather than a global light-theme switch.
- **Preview Materials** (`preview-daylight`, `preview-dark`, their ink and focus roles): chrome and captions around the actual daylight/dark screenshots. Changing this preview does not recolour the surrounding homepage.

**The Material Roles Rule.** Resolve text, controls, boundaries and focus through the semantic recipe for the surface they sit on. Do not copy the dark studio focus or muted ink into the opal client material without checking contrast.

## Typography

**Display Font:** locally hosted Studio Manrope, with Inter and sans-serif fallbacks.

**Body Font:** locally hosted Inter, with platform sans-serif fallbacks. Commercial HTML declares normal variable weights 100–900, Latin and Latin Extended subsets, with `font-display: swap`; its font paths and provenance live under `frontend/public/assets/fonts/`. Manrope and Inter retain their respective SIL Open Font Licenses there. The commercial transform removes the personal Google Fonts stylesheet while leaving personal deployment HTML unchanged. Product screenshots preserve the typography of their captured interface; they are not rebuilt as marketing text.

The display voice is broad, smooth and closely set. Inter keeps supporting explanations, tabs, sample data and controls familiar. Headings use balanced wrapping, while paragraphs use natural wrapping and a comfortable line height.

### Hierarchy

- **Display:** the frontmatter display recipe describes the wide hero; the established small-screen recipe reduces it without clipping its words.
- **Headline:** the frontmatter headline recipe anchors editorial sections; larger audience/workbench headings are deliberate local variations.
- **Body:** explanations generally use the frontmatter body recipe. Short desktop supporting copy can reach 17px; text blocks usually stay around 35–54 characters because they sit beside product surfaces. Long-form text should use a readable measure rather than inherit a narrow caption column.
- **Label:** controls and secondary descriptions follow the label role; essential mobile copy remains readable. Sample-document labels may retain the denser, explicitly illustrative interface hierarchy.

**The Display Pairing Rule.** Use Manrope for commercial display hierarchy and Inter for working controls. Do not introduce the personal site's Playfair Display as a commercial heading face.

## Layout

The principal content container is capped at 1320px with 56px side gutters on wide screens, changing to 32px at 1100px and 20px at 600px. The floating header has its own 1400px cap and contained padding. Chapter spacing is deliberately generous: common dark chapters use 132px vertical padding, while phone chapters reduce toward 75–80px. These are observed defaults, not a mandate to add empty space inside controls.

Desktop layouts use unequal columns to let product surfaces and editorial copy alternate in emphasis. At 850px, major pairings become single-column. At 600px, tabs and actions reflow for touch instead of shrinking the desktop composition. Plan comparison rows move from four columns to a three-column arrangement with a shared action row, then to a compact two-column identity/seats arrangement with full-width details and actions.

The project table and workbench pin only when the viewport is wider than 850px and taller than 760px, with normal motion preferences. Short, narrow and reduced-motion viewports use ordinary document flow or direct stage selection; the compact workbench shows one selected capability through its four tabs. The hero's scroll runway additionally requires enough height for its measured message, actions and scroll cue below the fixed header. Expanded text or a narrow viewport switches to normal flow when that content cannot fit. Keep the approved empty interval before the dashboard reveal; reducing it changes the intended pacing.

Interactive controls use a minimum 44px touch target. Readability and focus take priority over transformed depth: a focused product surface settles into a stable pose, and inactive scene panels are inert. Fragment destinations account for the fixed header. Intrinsic image dimensions reserve screenshot space; desktop screenshots are 3:2, with separate 390:844 phone captures.

## Elevation & Depth

Depth is a hybrid of tonal layering, physical optical shading and soft, offset shadows. The broad aperture and floor reflection establish the signature scene; ordinary controls use restrained surface shifts. The client chapter switches to opal paper with a soft blue-grey shadow, making its different audience and material immediately understandable.

Observed shadows include the primary action's shallow ambient lift (`0 6px 20px #080c2c24`), the dark product stage (`0 35px 70px #02040c55`) and the client preview (`0 35px 70px #314f7c2b`). The sidecar records these full recipes because the frontmatter component schema does not represent shadows.

**The Optical Priority Rule.** Spend the strongest depth on the identity and real product demonstrations. Do not add a competing blur, particle field or halo around every section.

## Shapes

Controls have gently curved corners using the control radius; screenshot frames use the preview radius, while the opal client preview uses its larger client radius. Editorial plan comparisons and audience tabs are open rows with dividers rather than another layer of equal-sized cards. Pills belong to small status labels, not paragraph containers.

The X, horizontal lockup and footer wordmark come from the supplied logo variants. Preserve their proportions and colour. The optical aperture is a separate physical material around the symbol; it is not a substitute logo. Canvas masks fade bloom and discharge before their rectangular bounds so the light does not reveal a hard box.

## Components

### Buttons and links

Primary controls use action opal on charcoal with the frontmatter padding and control radius. Secondary controls use raised charcoal and a clear boundary. Hover raises the primary action by 2px only when motion is appropriate; reduced motion keeps colour feedback without displacement. Keyboard focus uses a visible 3px ring with 4px offset. Text links use a consistent underline offset and retain generous hit areas.

### Navigation

The header holds the supplied monochrome lockup, concise section links, sign-in and a direct plan action. Its dark translucent material belongs to the optical world. On narrow screens, a named menu button exposes expanded state and opens a contained navigation region; Escape closes it and returns focus. Section links remain available on touch and keyboard.

### Tabs and sample product surfaces

Audience, screenshot, project, mobile and client controls identify a selected state beyond colour alone and use roving keyboard focus with arrow/Home/End navigation. Each selected control names its corresponding panel. Hidden desktop plates are inert. Sample data stays labelled, and image previews identify the current screen and theme through their alternative text and caption.

Screenshot tabs change between current Overview, Finance and Production captures. The daylight/dark control changes screenshot material, not the brand world. Full-size image links remain real links. Captured controls inside an image do not become interactive product controls.

The mobile-browser chapter places its four existing HTML workflow illustrations inside the owner's downloaded MobileFIRST iPhone 18 Pro front frame. Preserve the asset's pixels, 389:800 proportion and measured transparent aperture; the frame supplies the camera island. Its standard-resolution PNG is displayed at 346 CSS pixels wide or less, without inventing high-density source detail. Source, license and hash are recorded in [`devices/README.md`](../../frontend/public/assets/studio-x-os/devices/README.md). The fixed physical viewport scrolls instead of reducing the established readable labels. It has native keyboard scrolling, a visible focus treatment, a conditional scroll cue and no wheel interception. Selecting a workflow resets its sample scroll position. Narrow layouts retain the island's safe area while omitting decorative browser/app chrome; focus and reduced motion settle the device. A failed decorative frame is removed cleanly while the sample stays usable. The illustrations and native-app coming-soon status remain distinct.

The requested capture is decoded before replacing the current one. A short camera-shutter View Transition closes the old image over 150ms and opens the decoded image over 360ms after a 60ms offset. This is a response to a meaningful screen selection, not an idle flourish. A truthful “Opening screen” status explains loading; a bounded image failure offers retry while retaining the existing capture. Stale requests cannot replace a more recent selection. Reduced motion and unsupported browsers use a direct swap without spatial effects.

### Client Smart Link

The opal preview preserves one sample project across quotation, invoice, payment and production states. The supplied stage colours distinguish those four subjects; they do not assert live provider integration. Where supported, native View Transitions maintain continuity of the project, amount and content surface. Unsupported and reduced-motion paths update immediately. Replacement panels preserve focus, and sample support closes with Escape and returns focus to its trigger.

### Plans and readiness

Starter, Studio and Scale are comparison rows with maximum member capacity, included capabilities and direct status-check links. Checking a plan preserves intent through signup; it does not collect payment. The commercial preview notice sits beside the hero actions, and the closing actions reach the real screen captures or registration status rather than imply immediate provider access. Pricing remains to be announced, the trial remains planned and registration remains controlled by backend readiness gates. Android/iOS and commercial AI connections retain their visible coming-soon status. These are product-truth boundaries, not decorative status chips to remove for conversion.

### Signature optical identity

The supplied colour X assembles on arrival, then participates in the approved spin/aperture-expansion/headline sequence. A finite, irregular blue-white electrical discharge accompanies the sideways headline. It has no sound, full-page flash or endless idle strobe. The visible logo and message survive without WebGL.

The reactive aperture keeps one analytic render pass. Thickness-dependent transmission of the scene behind each curved ring, restrained wavelength separation, Fresnel clearcoat, broad specular shoulders and dark contact edges give the blue/lavender material its volume. A deeper cavity and one phase-linked floor caustic share the same light; bounded desktop pointer input shifts that light and a subtle masked illumination on the exact supplied X. Do not add another canvas, image, post-processing stack or unrelated glow to reproduce this treatment. The floor reflection follows the existing logo spin/scale and fades over hero progress `.10–.30`, preventing an intact reflection after dissolution. Its CSS fallback has an elliptical alpha falloff, with no projected rectangular perimeter. Arrival suppresses the extra masked light until the fragments cohere.

During the scroll exit, the clean supplied X fades into an attached, source-coloured point representation. Those points release in small, irregular groups throughout the actual artwork, without leaving opaque holes in a flat image. Their rotation and opacity remain continuous at detachment. Brighter grains initially carry the original logo colours, then separate quickly and scatter independently in all directions with varied speed, blue/lavender light, layered depth, sparse independently timed star glints and soft distant particles before fading; reverse scroll reconstructs the mark. The local layer uses up to 12,000 points on desktop or 4,000 on compact layouts, a 1.5MP buffer, DPR 1.5 and a 1300ms dust settling period and a separate finite 4200ms glitter afterglow. Keep this part of the single optical identity sequence rather than adding dust to unrelated controls or chapters. An extra sparse pass draws up to 96 desktop or 32 compact detached sparkles with bright white/lavender cores and tapered rays. Their independent light clock keeps them visible after the fine dust fades; shared scroll-driven trajectories prevent jumps when scrolling resumes. All rendering stops after the finite afterglow. The effect yields immediately to pause, focus, reduced motion and graphics failure.

The optical renderer caps DPR at 2, desktop width at 3072px and pixel area at 4.5MP; static mobile uses at most 2048px and 2.4MP. Animated drawing is capped at 30 draws/s. These are code budgets, not measured frame-rate promises. The existing lightning canvas uses its separate 1280px / DPR 1.5 budget. Keyboard focus neutralises the pointer pose, draws one stable frame and stops recurring optical rendering. Hidden, offscreen, paused and context-lost states stop rendering; context restoration reinitialises the field and unmount cleans up resources. Reduced motion shows the intact identity and readable message without spatial travel. A named Pause/Resume control completes arrival and stabilises the scene.

## Do's and Don'ts

### Do:

- **Do** preserve the supplied marks, charcoal/blue/lavender identity and intentional opal client material.
- **Do** use the semantic roles belonging to the current material and verify normal-text, control and focus contrast.
- **Do** keep plan intent, honest readiness labels, sample-data descriptions and recovery paths intact.
- **Do** make every cinematic scene readable and operable with keyboard, touch, reduced motion and a static fallback.
- **Do** treat rendering limits as implementation budgets and distinguish them from physical-device measurements.

### Don't:

- **Don't** merge this commercial visual system into the personal Team Alpha design files or tenant-owned branding.
- **Don't** replace the supplied X with a generated mark, distort its proportions or crop its artwork to imitate depth.
- **Don't** collapse the approved hero-to-dashboard gap or introduce competing extraordinary moments across every chapter.
- **Don't** hide required copy or controls until an animation completes.
- **Don't** invent prices, testimonials, app-store availability, AI readiness or live actions inside sample screenshots.
