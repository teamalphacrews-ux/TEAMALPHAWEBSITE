# Studio X OS branding

The owner supplied the **StudioXOS-Logo-Pack** on 4 November 2026. It is the authoritative source for current product branding and future Studio X OS development, replacing the earlier extracted logo artwork.

## Supplied variants

| Use | Committed asset in `frontend/public/assets/studio-x-os/` |
| --- | --- |
| Complete logo on light surfaces | `logo-light-pack-20261104.png` |
| Complete logo on dark surfaces | `logo-dark-pack-20261104.png` |
| Compact navigation and workspace icon | `mark-pack-20261104.png` |
| Browser favicon | `favicon-pack-20261104.png` |
| Apple home-screen icon | `apple-touch-pack-20261104.png` |
| Native app launcher master | `app-master-pack-20261104.png` |
| Product-only monochrome document artwork | `logo-monochrome-black-pack-20261104.png`, `logo-monochrome-white-pack-20261104.png` |

Use the shared `StudioProductBrand` component for product headers, authentication, navigation, workspace switching and product previews. Select the supplied light/dark artwork; preserve the complete horizontal logo's 2048 × 683 aspect ratio and its clear space. Use the square X icon in compact slots. Do not recolour, reconstruct, stretch or generate replacement marks.

The pack's `START-HERE.txt` and complete `ASSET-INDEX.csv` are preserved beside the selected implementation assets. The original full pack remains in the owner's `Downloads/StudioXOS-Logo-Pack/` directory, with horizontal, square, symbol-only and wordmark variants. Those local files are design resources, not runtime dependencies.

## Identity boundaries

Studio X OS is the software product. Each studio's business identity remains independent. Preserve Team Alpha's photography website branding, tenant profile images, quotation and invoice issuer logos, generated PDFs and client Smart Link branding. Use Studio X OS monochrome artwork only for product-owned material, never as a replacement for a customer's issuer logo.

The supplied assets are raster PNG/JPEG exports, not an editable SVG/vector master or a font. Prefer the provided app/web sizes over loading large artwork for small icons. Updating web assets does not replace the icon of an already installed native app; use the supplied 1024 px master when packaging a future native release.
