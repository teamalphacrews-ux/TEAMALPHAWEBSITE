# Studio X OS commercial homepage

The owner selected **Prismatic light lab** on 8 November 2026 and requested a stronger composition after reviewing the first refinement. The latest request extends that approved world with a futuristic arrival, animation of the actual Studio X OS logo and headline, and a clearer path to plan selection. The commercial homepage combines a physical optical aperture, a pinned project table, a horizontal studio workbench and an opal client experience. The personal Team Alpha photography website, tenant identities and studio-owned document branding remain independent.

This document records the commercial homepage implementation and its boundaries. It does not replace the established personal `DESIGN.md`, `PRODUCT.md` or their design sidecar, and its page-specific motion is not a new system-wide rule.

## Visual system

The charcoal/blue/lavender identity remains. Headings use the locally served Manrope variable font; product demonstrations retain their working-interface typography. Navigation uses the supplied monochrome horizontal lockup, the hero uses the colour X symbol, the integration illustration uses the white X, and the footer closes with the white wordmark. WebP delivery derivatives preserve the source artwork's proportions and colour. Their source is the owner's StudioXOS-Logo-Pack; these homepage treatments do not replace the shared product/account branding component or a customer's logo.

The centered hero and its intentional gap before the dashboard reveal remain. The lower page changes composition through real sample product surfaces, rather than applying one repeated section entrance. Pricing, registration and provider readiness remain preview statements.

## Arrival and physical optical hero

`ProductHero.jsx` and `prismaticHero.css` animate the supplied colour X itself. Four clipped quadrants of the same artwork assemble from displaced, rotated depth positions over **1500 ms**, then resolve into the intact supplied asset. The animation does not generate a replacement logo or alter its final proportions. The four words of “Supercharge your photography business.” each arrive over **820 ms**, staggered at **80, 190, 300 and 410 ms**. The arrival state completes at **1800 ms**; the fully visible logo and headline remain after it. A keyboard-visible focus completes the arrival immediately so the entrance cannot hold up navigation.

`PrismaticField.jsx` renders the surrounding physical aperture in analytic WebGL: **four solid, curved annular surfaces**, an axial cavity and a polished reading platform. Curved cross-sections, reflected light, bevels and the supplied logo's floor reflection create the depth. This extends the existing charcoal/blue/lavender material world. Desktop pointer and scroll input adjust its optical field and depth without requiring a mesh, ray-march or post-processing pipeline.

The drawing buffer supports **DPR up to 2**, capped at **3072 pixels wide / 4.5 MP** on desktop and **2048 pixels wide / 2.4 MP** on static mobile paths. Animated rendering remains capped at **30 fps**. The render loop stops when its observed surface leaves the viewport, the document is hidden, the visitor pauses hero motion or the WebGL context is lost. GPU resources, animation frames, observers and listeners are cleaned up on unmount.

A `webglcontextlost` event switches to the static optical fallback. Context restoration reinitialises resources and resizes the drawing surface. A missing WebGL context also leaves the CSS optical treatment and supplied X visible. Coarse-pointer/mobile layouts retain the visible logo and headline arrival with a static GPU field instead of continuous GPU rendering; smaller screens reduce the logo fragments' travel. Reduced motion skips the spatial arrival and continuous motion, showing the intact logo, headline and static field directly. These budgets describe the implementation; they are not a claim of measured physical-device frame rate.

The hero has a keyboard-operable **Pause motion / Resume motion** button with an accessible name, pressed state and a minimum **44-pixel** target. It controls the hero's ongoing logo/light motion and WebGL rendering. Pausing completes any arrival so the copy and intact logo stay readable. Offscreen and document-hidden states also pause hero animation; reduced-motion preferences take priority and remove the now-unnecessary motion control. Live preference changes are handled without remounting the page. This is a hero control; lower-page scenes retain their own focus, visibility and reduced-motion safeguards.

`ProductHero.jsx` measures the stationary showcase stage rather than the transformed dashboard. Fine-pointer desktop layouts receive depth; keyboard focus opens and stabilises the showcase. The reveal gap is independent of the transformed frame.

## Project table and studio workbench

`ProductJourney.jsx` and `productProjectTable.css` turn the existing Anika & Rohan sample into a **340 svh desktop project table**. A stationary runway contains a sticky project identity and five existing enquiry, quotation, planning, payment and delivery plates. The plates travel approximately **46 vw** between positions, with restrained depth, while the active chapter copy remains readable. The project name, amounts, crew, milestone details and launch qualifications retain their existing meaning.

Chapter buttons and Home/End/arrow navigation select the corresponding scroll position. Explicit navigation retains its selection while scrolling settles; keyboard focus stabilises the composition. Inactive plates are inert and hidden from assistive technology. Existing workflow and chapter anchor IDs remain available. Every product plate is labelled as sample data.

`ProductWorkbench.jsx` and `productWorkbench.css` replace the alternating capability rows with a pinned horizontal rail of four larger product plates: people, the personal overview, studio branding and the private workspace. The rail's progress is measured from a stationary runway. Its controls retain keyboard focus and inactive plates cannot receive focus.

Both pinned compositions require a viewport **wider than 850 pixels and taller than 760 pixels**, with normal motion preferences. Compact, short-viewport and reduced-motion paths use normal document flow without a forced tall pin: the project table offers direct stage navigation and a readable active preview, while the capability workbench uses its linear layout. Spatial motion is not required to reach any content or control.

## Opal client Smart Link

The client chapter deliberately shifts from the studio's dark working surfaces to opal paper. Its existing quotation, invoice, payment and production views retain the same sample project and factual states.

Where `document.startViewTransition` is available, `ProductHome.jsx` uses a native same-document View Transition for the project title, amount and content surface. The implementation restores focus to the appropriate replacement control or panel after the view changes. Browsers without the API use the normal state update. Reduced motion bypasses the spatial transition, and a live change to reduced motion skips an active transition. The support panel keeps its existing Escape and focus-return behaviour.

## Shared motion lifecycle

`useProductMotion.js` coordinates nearby sections and local visual artifacts through one requestAnimationFrame scheduler with batched geometry reads and style writes. Scroll progress is written as CSS properties outside React. Separate observation of small loop islands pauses the Overview light/camera, demo ornaments and client-stage pseudo-elements even while their tall parent section remains visible. Conditional demo content is registered through batched child-list observation.

`productMotion.css` supplies supporting connection traces, local artifact reveals and the closing wordmark treatment. Document visibility, resize, focus, live reduced-motion changes and unmount cleanup are handled explicitly. Content has a visible fallback without these enhancements. Reduced motion removes spatial changes, including hover displacement, while retaining brief colour feedback for controls.

## Plan selection and conversion

The header and hero offer a direct **Explore plans** link to the existing plans section. `productReactor.css` presents Starter, Studio and Scale as readable comparison rows, with the existing member counts, features and pricing qualifications beside their actions. **Choose Starter**, **Choose Studio** and **Choose Scale** retain the selected plan through the existing signup link helper; this is selection intent rather than a checkout or subscription purchase. The closing action also returns visitors to plan choice, while the separate account and provider entry points keep their existing behaviour.

Monthly INR pricing remains **to be announced**. The page states that pricing will be published before paid subscriptions open, that the 14-day trial is planned, that registration is in preview and that no payment is collected here. There are no approved prices in this implementation, and the conversion treatment does not enable paid launch, bypass registration/provider gates or activate checkout.

## Boundaries and verification

No backend capability, account, payment or provider connection is implied or activated by these scenes. The product demonstrations remain illustrative sample data. Integration labels distinguish available workflows from planned per-studio setup; drawing a connection does not establish one.

Signup configuration recovery and selected-plan intent remain intact. Plan selection expresses interest; the existing backend provisions its Starter trial. Registration and provider sign-in remain controlled by the server's existing gates. These changes do not deploy a site, enable signup or alter personal Team Alpha data.

Verify at 320, 390, 768 and 1440 pixels, including logo/headline arrival, Pause/Resume and keyboard-completed arrival, both product-demo themes, forward/reverse scrolling, all project stages and capability plates, Home/End/arrow navigation, focus inside moving surfaces, offscreen/document-hidden pausing, WebGL context loss/restoration, static mobile GPU paths, live reduced-motion changes, readable labels, direct plan navigation, retained plan intent and signup recovery. This is a verification checklist, not a record of tests performed by this documentation update. Browser rendering budgets do not establish physical-device performance; compact devices receive the simpler path by design.

Font license: `frontend/public/assets/fonts/Manrope-OFL.txt`. Font and logo assets are served locally.

## Direction contract

**THESIS:** Extend the approved Prismatic light lab into a physical photography light engine: the supplied X assembles and the headline charges on arrival. The visitor should remember the moving identity and connected product, then explore a plan.

**OWN-WORLD:** Retain charcoal, blue and lavender, opal Manrope type and the exact supplied logo variants. Broad optical materials and a receding aperture provide depth; existing product illustrations remain truthful sample data.

**STORY:** Independent photographers and studio teams see one workspace for clients, crew, money and delivery, experience the working preview, and choose Starter, Studio or Scale. Pricing and registration qualifications remain visible.

**FIRST VIEWPORT:** A centered supplied X, 620 px on wide desktop and 350 px on phones, sits within the optical aperture. Four logo fragments cohere, four headline words settle in sequence, and the centered Explore plans action leads to the plan comparison. The secondary action reaches the workspace demo.

**FORM:** A code-led local extension of the already selected Prismatic light lab, preserving the centered hero and intentional dashboard gap. Seed: not applicable; no new world or open composition tournament. The user previously chose this world and existing logo variants, and explicitly requested stronger logo and headline animation.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. This ordinary commercial extension preserves the separate personal DESIGN.md and sidecar; this scoped document records its established commercial system. Existing raster origin records are retained. The optical hero creates no raster assets; the later product screen captures carry their own source and delivery manifest.

Cold commercial HTML preloads the local Manrope display font before the lazy homepage mounts; the personal HTML remains byte-identical. Header spacing uses contained padding so child margins do not shift the page on arrival. The arrival deadline starts in layout setup before passive WebGL work, and a document-level Tab capture settles the entrance even when the visitor enters through Skip to content.

## User-directed scroll sequence

The owner subsequently specified a spinning X, an expanding circle that fades away, and the existing headline entering sideways with a lightning effect. The implementation treats forward scroll as the hero moving up the screen; reverse scroll reverses the same sequence.

This remains an extension of the selected commercial world. A stationary runway and sticky hero keep the choreography visible while the exact supplied X turns and leaves, the physical aperture expands and dissolves, and the two headline lines enter from opposing sides. A short traced blue/white lightning accent accompanies the text; it is decorative line geometry, with no full-page flash, rapid strobe, sound or replacement logo. The visit entrance remains present.

Plan actions remain available throughout. Reduced motion and viewports shorter than 700 pixels receive a fully readable normal-flow scene. Manual pause and keyboard focus settle the mark and headline while preserving the runway geometry and control position, so pausing halfway through does not move the focused control offscreen. Existing audience links and the intentional gap before the dashboard reveal remain after the hero runway. Scroll progress is measured from the stationary runway, written outside React, and reused by the optical renderer so invisible rings do not continue drawing.

## Natural electrical discharge refinement

The owner rejected the first regular zigzag traces as artificial. The replacement uses a bounded procedural Canvas2D discharge: asymmetric irregular channels and fine tapered forks, a white-hot center, diffused blue/lavender corona and local illumination. It replaces the flat SVG linework while retaining the same spin, circle exit and sideways headline sequence. The electrical event has a finite return stroke and fading afterglow; it does not flicker indefinitely while the visitor stops scrolling. Manual pause, reduced motion, keyboard/static modes, document visibility and viewport suspension retain priority.

The owner identified visible rectangular side boundaries in the headline backdrop and during the discharge, and requested smoother motion. The hard headline backplate is removed; the electrical layer has an elliptical alpha falloff so branches and bloom fade before the canvas boundary. Hero scroll targets use a short time-correct eased follow with no React updates per frame; static and focus modes retain immediate readable poses.

The owner also identified rough aperture edges on a Retina Mac. The field now prefers high-precision fragment math with derivative-based coverage antialiasing (analytic footprint fallback), DPR up to 2, and bounded desktop 3072-pixel / 4.5 MP and static-mobile 2048-pixel / 2.4 MP buffers. Fine-pointer desktop expansion is re-rendered as native shader ray-space zoom rather than enlarging a low-resolution canvas texture. Scroll follow uses an 85 ms time constant and a 0.0001 rest threshold to reduce final-pose snapping; render work stops after settling. The lightning Canvas2D retains its separate 1280-pixel / DPR 1.5 budget.


## Updated product screen captures

The primary Overview, Finance and Production preview now uses viewport captures of the current admin interface instead of a separately drawn dashboard. Each view has daylight and dark versions, captured at 1440 × 960 CSS pixels / DPR 2, plus actual 390 × 844 phone layouts / DPR 2. Responsive pictures select the phone capture on narrow screens; desktop images have 1440- and 2880-pixel delivery variants. The lower “Your view” capability reuses the current dark Overview capture.

These are screen captures, not embedded live workspaces. Tabs, daylight/dark selection and full-size image links remain keyboard accessible. Captions and alternative text identify sample data. No admin control pictured inside an image performs an action. Native image dimensions reserve layout space; the images load lazily and do not add an animation loop.

All records belong to the fictional Frame & Field sample studio. Capture requests are isolated from a backend: API reads receive authored fixtures, writes are blocked, and the only external requests allowed are the application's existing public Google Fonts resources. Inter is confirmed loaded before capture. Finance shows its current “Due now” register. No live account, client data, payment or provider connection is accessed.

The assets are unmodified screenshots apart from resizing and WebP compression. Their paths, dimensions, raw and delivered hashes, source state, routes and provenance are recorded in `frontend/public/assets/studio-x-os/screens/20261109/manifest.json`. Hero motion, centered composition, intentional dashboard reveal gap, commercial palette and signup/plan qualifications remain as documented above.

## Studio features and integration story — 10 November 2026

The owner requested the integration heading “Powerful AI integrations & tools” and clearer benefits covering advanced UI/UX, a first-class experience, ease of operation, connected studio work and the client smart link. `ProductIntegrations.jsx` adds an editorial feature layout within the existing charcoal/blue/lavender integration chapter. The supplied connection diagram and existing integration availability remain intact. Feature links reach the existing workspace, client and mobile demonstrations.

The owner confirmed that Android and iOS apps are coming soon. The page presents that status explicitly and offers the existing mobile-browser workflow. Commercial assistant connections are also still planned: the current backend rejects assistant connections for commercial workspaces. The AI heading is accompanied by a visible “Coming soon” qualification. No provider, registration, payment or native-app capability is activated by this copy change.

The feature layout uses two columns on desktop and normal single-column flow on phones. Links retain 44px targets, keyboard focus and reduced-motion support. The existing hero and its intentional dashboard-reveal gap are outside this change. A scoped source review returned ship; desktop visual review, 390px/320px layout and keyboard checks, 327 frontend tests, lint and the commercial production build passed. The in-app browser's resized screenshot surface was blank, so desktop visual verification used the native Safari preview rather than interpreting that capture failure as product behavior.

The owner also supplied the origin story: collaboration with hundreds of Indian luxury wedding and international wedding photographers, with repeated testing and optimization. At the owner's request for a more dramatic voice, the early audience chapter now opens its copy with “For photographers who turn moments into legacies.” The supporting paragraph preserves those supplied collaboration and refinement claims. No customer names, endorsements, test metrics or performance guarantees were invented.
