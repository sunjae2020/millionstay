# MetHeim — logo assets

Brand logos for the **MetHeim** white-label instance (pilot 2nd tenant).
Palette: Deep Teal `#005F73` (primary), Champagne `#E6D5B8` (symbol on dark),
White `#FFFFFF` (reverse). See [../config.env](../config.env).

| File | Use |
| --- | --- |
| `favicon.svg` | Teal rounded-square app/browser icon (512×512), champagne symbol. |
| `metheim-symbol-teal.svg` | Symbol mark only, teal — on light backgrounds. |
| `metheim-symbol-champagne.svg` | Symbol mark only, champagne — on teal/dark backgrounds. |
| `metheim-logo-horizontal-teal.svg` | Horizontal lockup (symbol + METHEIM / YEOSU / tagline), teal — on light. |
| `metheim-logo-horizontal-white.svg` | Horizontal lockup, all-white — on teal/photo backgrounds. |

Wordmark: **METHEIM** / **YEOSU** / _PREMIUM URBAN SMALL APARTMENT_.

> The vertical stacked lockup was supplied only as a rendered raster preview
> (no SVG source), so it is not committed here — re-export it as SVG to add it.

## Wiring into the tenant

`tenants/metheim/config.env` ships `VITE_LOGO_MODE=image` with these assets
hosted on Cloudinary (`metheim/logos/`): `VITE_LOGO_URL` → horizontal-teal,
`VITE_LOGO_MARK_URL` → symbol-teal, `VITE_FAVICON` → favicon. Re-upload to a
MetHeim-owned Cloudinary once provisioned and update the URLs. For the dark admin
sidebar, upload `metheim-logo-horizontal-white.svg` and set the branding row's
`logo_dark_url` (see [../branding-settings.seed.sql](../branding-settings.seed.sql)).

See [../brand-guidelines.md](../brand-guidelines.md) for the full brand spec
(palette, type, components).
