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

`tenants/metheim/config.env` currently ships `VITE_LOGO_MODE=text`. To switch the
apps to these assets, host them (or reference their raw paths) and set
`VITE_LOGO_URL` / `VITE_LOGO_MARK_URL` / `VITE_FAVICON` accordingly, then flip
`VITE_LOGO_MODE` off `text`.
