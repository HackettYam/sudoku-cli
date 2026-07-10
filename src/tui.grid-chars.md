# Sudoku Grid — Unicode Box-Drawing Characters

## Character Reference

All characters are from the Unicode Box Drawing block (U+2500–U+257F).

### Outer Border (Double Line)

| Char | Unicode | Name | Usage |
|------|---------|------|-------|
| ╔ | U+2554 | BOX DRAWINGS DOUBLE DOWN AND RIGHT | Top-left corner |
| ╗ | U+2557 | BOX DRAWINGS DOUBLE DOWN AND LEFT | Top-right corner |
| ╚ | U+255A | BOX DRAWINGS DOUBLE UP AND RIGHT | Bottom-left corner |
| ╝ | U+255D | BOX DRAWINGS DOUBLE UP AND LEFT | Bottom-right corner |
| ║ | U+2551 | BOX DRAWINGS DOUBLE VERTICAL | Left/right edges + between 3×3 boxes (vertical) |
| ═ | U+2550 | BOX DRAWINGS DOUBLE HORIZONTAL | Between 3×3 boxes (horizontal) |
| ╦ | U+2566 | BOX DRAWINGS DOUBLE DOWN AND HORIZONTAL | Top border junction between boxes |
| ╩ | U+2569 | BOX DRAWINGS DOUBLE UP AND HORIZONTAL | Bottom border junction between boxes |
| ╠ | U+2560 | BOX DRAWINGS DOUBLE VERTICAL AND RIGHT | Left edge of horizontal separators |
| ╣ | U+2563 | BOX DRAWINGS DOUBLE VERTICAL AND LEFT | Right edge of horizontal separators |
| ╬ | U+256C | BOX DRAWINGS DOUBLE VERTICAL AND HORIZONTAL | Cross junction between boxes |

### Inner Lines (Single Line)

| Char | Unicode | Name | Usage |
|------|---------|------|-------|
| ─ | U+2500 | BOX DRAWINGS LIGHT HORIZONTAL | Within 3×3 boxes (horizontal) |
| │ | U+2502 | BOX DRAWINGS LIGHT VERTICAL | Within 3×3 boxes (vertical) |
| ┼ | U+253C | BOX DRAWINGS LIGHT VERTICAL AND HORIZONTAL | Cross junction within boxes |

### Mixed Junctions (Complete Reference)

All 16 mixed double/single junction characters from the Unicode Box Drawing block, with CP437 code points where applicable (extended ASCII range 128–255).

| Char | Unicode | CP437 | Name | Description |
|------|---------|-------|------|-------------|
| ╒ | U+2552 | — | SINGLE DOWN AND DOUBLE RIGHT | Top-left junction, single down + double right |
| ╓ | U+2553 | — | DOUBLE DOWN AND SINGLE RIGHT | Top-left junction, double down + single right |
| ╖ | U+2556 | — | SINGLE DOWN AND DOUBLE LEFT | Top-right junction, single down + double left |
| ╗ | U+2557 | 187 | DOUBLE DOWN AND SINGLE LEFT | Top-right corner (also in Outer Border) |
| ╘ | U+2558 | — | SINGLE UP AND DOUBLE RIGHT | Bottom-left junction, single up + double right |
| ╙ | U+2559 | — | DOUBLE UP AND SINGLE RIGHT | Bottom-left junction, double up + single right |
| ╛ | U+255B | — | SINGLE UP AND DOUBLE LEFT | Bottom-right junction, single up + double left |
| ╜ | U+255D | 188 | DOUBLE UP AND SINGLE LEFT | Bottom-right corner (also in Outer Border) |
| ╞ | U+255E | 199 | SINGLE VERTICAL AND DOUBLE HORIZONTAL RIGHT | Left edge where double horizontal meets single vertical |
| ╟ | U+255F | — | DOUBLE VERTICAL AND SINGLE HORIZONTAL RIGHT | Left edge where single horizontal meets double vertical |
| ╡ | U+2561 | 182 | SINGLE VERTICAL AND DOUBLE HORIZONTAL LEFT | Right edge where double horizontal meets single vertical |
| ╢ | U+2562 | — | DOUBLE VERTICAL AND SINGLE HORIZONTAL LEFT | Right edge where single horizontal meets double vertical |
| ╥ | U+2565 | — | DOUBLE DOWN AND SINGLE HORIZONTAL | Top junction, double down + single horizontal |
| ╨ | U+2568 | — | DOUBLE UP AND SINGLE HORIZONTAL | Bottom junction, double up + single horizontal |
| ╪ | U+256A | 216 | VERTICAL SINGLE AND DOUBLE HORIZONTAL | Cross: single vertical × double horizontal |
| ╫ | U+256B | 215 | VERTICAL DOUBLE AND SINGLE HORIZONTAL | Cross: double vertical × single horizontal |

## Grid Pattern

```
╔═══╤═══╤═══╦═══╤═══╤═══╦═══╤═══╤═══╗
║ 5 │ 3 │ 4 ║ 6 │ 7 │ 8 ║ 9 │ 1 │ 2 ║
╟───┼───┼───╫───┼───┼───╫───┼───┼───╢
║ 6 │ 7 │ 2 ║ 1 │ 9 │ 5 ║ 3 │ 4 │ 8 ║
╟───┼───┼───╫───┼───┼───╫───┼───┼───╢
║ 1 │ 9 │ 8 ║ 3 │ 4 │ 2 ║ 5 │ 6 │ 7 ║
╠═══╪═══╪═══╬═══╪═══╪═══╬═══╪═══╪═══╣
║ 8 │ 5 │ 9 ║ 7 │ 6 │ 1 ║ 4 │ 2 │ 3 ║
╟───┼───┼───╫───┼───┼───╫───┼───┼───╢
║ 4 │ 2 │ 6 ║ 8 │ 5 │ 3 ║ 7 │ 9 │ 1 ║
╟───┼───┼───╫───┼───┼───╫───┼───┼───╢
║ 7 │ 1 │ 3 ║ 9 │ 2 │ 4 ║ 8 │ 5 │ 6 ║
╠═══╪═══╪═══╬═══╪═══╪═══╬═══╪═══╪═══╣
║ 9 │ 6 │ 1 ║ 5 │ 3 │ 7 ║ 2 │ 8 │ 4 ║
╟───┼───┼───╫───┼───┼───╫───┼───┼───╢
║ 2 │ 8 │ 7 ║ 4 │ 1 │ 9 ║ 6 │ 3 │ 5 ║
╟───┼───┼───╫───┼───┼───╫───┼───┼───╢
║ 3 │ 4 │ 5 ║ 2 │ 8 │ 6 ║ 1 │ 7 │ 9 ║
╚═══╧═══╧═══╩═══╧═══╧═══╩═══╧═══╧═══╝
```

## Rules

1. **Corners** (╔╗╚╝): Double-line corners on the outer border
2. **Outer edges** (║): Double vertical on left and right outer edges
3. **Between 3×3 boxes — horizontal**: Double ═ with thick junctions (╦ top, ╩ bottom, ╬ cross, ╠ left, ╣ right)
4. **Between 3×3 boxes — vertical**: Double ║
5. **Within 3×3 boxes — horizontal**: Single ─ (no separator lines between rows in the same box group)
6. **Within 3×3 boxes — vertical**: Single │
7. **Top/bottom border junctions**: ╤/╧ (single × double) within boxes, ╦/╩ (double × double) between boxes

## Code Mapping

| Variable | Value | Used In |
|----------|-------|---------|
| `thickH` | `═`.repeat(3) | Horizontal segments between 3×3 boxes |
| `thinH` | `─`.repeat(3) | Horizontal segments within 3×3 boxes |
| `top` | `╔═══╤...╗` | Top border |
| `bot` | `╚═══╧...╝` | Bottom border |
| `midThin` | `╟───┼...╢` | Horizontal separator within row group |
| `midThick` | `╠═══╬...╣` | Horizontal separator between row groups |
| vertical `║` | direct literal | Left/right edges + 3×3 box boundaries in data rows |
| vertical `│` | direct literal | Within 3×3 boxes in data rows |
