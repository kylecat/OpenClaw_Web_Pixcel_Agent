# Office World Layout

Grid: **22 cols x 12 rows** (col 0-21, row 0-11) | Tile: 64x64 px

## ASCII Grid Map

```
     00 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21
  00  .  B  B  B  B  B  .  .  D  D  D  D  D  .  .  .  .  E  E  |  P  P
  01  .  B  B  B  B  B  .  .  D  D  D  D  D  .  |  .  .  .  .  |  .  .
  02  .  .  .  .  .  .  .  .  .  .  .  .  .  .  |  .  .  .  .  .  .  .
  03  .  .  .  .  .  .  .  .  .  .  .  .  .  .  |  V  V  .  .  .  .  W
  04  S  S  S  S  .  .  .  K  K  K  K  .  .  .  |  V  V  .  .  .  .  W
  05  S  S  S  S  .  .  .  K  K  K  K  .  .  .  |  V  V  .  .  .  .  F
  06  .  .  .  .  .  .  G  .  .  .  .  .  .  .  |  .  .  .  .  .  .  F
  07  .  .  .  .  .  .  .  .  .  .  .  .  .  .  |  .  .  .  .  .  .  .
  08  S  S  S  S  .  .  .  S  S  S  S  .  .  .  |  .  .  3  3  .  .  .
  09  S  S  S  S  .  .  .  S  S  S  S  .  .  .  .  .  .  3  3  .  .  .
  10  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  1  T  T  2  .  |
  11  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  1  T  T  2  .  |
```

### Legend

| Symbol | Meaning        | Walkable |
|--------|----------------|----------|
| `.`    | Floor          | YES      |
| `B`    | Bulletin Board | NO       |
| `D`    | Dashboard      | NO       |
| `E`    | Exit Door      | NO       |
| `P`    | Portal         | NO       |
| `S`    | Shelf          | NO       |
| `K`    | PC Desk        | NO       |
| `V`    | Vending Machine| NO       |
| `W`    | Water Dispenser| NO       |
| `F`    | Fridge         | NO       |
| `3`    | Black Sofa     | NO       |
| `1`    | Pink Sofa (L)  | NO       |
| `2`    | Pink Sofa (R)  | NO       |
| `T`    | Tea Table      | NO       |
| `\|`   | Pot (divider)  | NO       |
| `G`    | Gaia Home      | walkable |

---

## Decoration Table

| Item             | Kind             | Position (col, row) | Size (tiles W x H) | Blocked Tiles            |
|------------------|------------------|---------------------|---------------------|--------------------------|
| Bulletin Board   | (wall-mounted)   | (1, 0)              | 5 x 2               | cols 1-5, rows 0-1       |
| Dashboard        | (wall-mounted)   | (8, 0)              | 5 x 2               | cols 8-12, rows 0-1      |
| Exit Door        | (wall-mounted)   | (17, 0)             | 2 x 2               | cols 17-18, row 0        |
| Wall Pot         | pot1             | (19, 0)             | 1 x 2               | col 19, rows 0-1         |
| Portal           | portal           | (20, 0)             | 2 x 2               | **walkable** (floor deco)|
| Shelf 1 (TASK)   | shelf1           | (0, 4)              | 4 x 2               | cols 0-3, rows 4-5       |
| PC Desk (left)   | pcDesk           | (7, 4)              | 2 x 1.5             | cols 7-8, rows 4-5       |
| PC Desk (right)  | pcDesk           | (9, 4)              | 2 x 1.5             | cols 9-10, rows 4-5      |
| Shelf 3          | shelf3           | (0, 8)              | 4 x 2               | cols 0-3, rows 8-9       |
| Shelf 2 (SKILL)  | shelf2           | (7, 8)              | 4 x 2               | cols 7-10, rows 8-9      |
| Pot Divider      | pot1             | (14, 1)             | 1 x 2               | col 14, rows 1-2         |
| Pot Divider      | pot2             | (14, 3)             | 1 x 2               | col 14, rows 3-4         |
| Pot Divider      | pot1             | (14, 5)             | 1 x 2               | col 14, rows 5-6         |
| Pot Divider      | pot2             | (14, 7)             | 1 x 2               | col 14, rows 7-8         |
| Vending Machine  | vendingMachine   | (15, 3)             | 2 x 2.5             | cols 15-16, rows 3-5     |
| Water Dispenser  | waterDispenser   | (21, 3)             | 1 x 2               | col 21, rows 3-4         |
| Fridge           | fridge           | (21, 5)             | 1 x 2               | col 21, rows 5-6         |
| Black Sofa       | sofa3            | (17, 8)             | 2 x 2               | cols 17-18, rows 8-9     |
| Tea Table        | squareTable      | (17, 10)            | 2 x 2               | cols 17-18, rows 10-11   |
| Pink Sofa (L)    | sofa1            | (16, 10)            | 1 x 2               | col 16, rows 10-11       |
| Pink Sofa (R)    | sofa2            | (19, 10)            | 1 x 2               | col 19, rows 10-11       |
| Corner Pot       | pot1             | (21, 10)            | 1 x 2               | col 21, rows 10-11       |

---

## Zone Layout

### Left Zone (cols 0-13) -- Work Area

```
  Row 0-1 : [Bulletin Board cols 1-5] [gap] [Dashboard cols 8-12]
  Row 2-3 : open walkway
  Row 4-5 : [Shelf1 cols 0-3] [gap] [pcDesk cols 7-8] [pcDesk cols 9-10]
  Row 6-7 : open walkway (Gaia home at col 6, row 6)
  Row 8-9 : [Shelf3 cols 0-3] [gap] [Shelf2 cols 7-10]
  Row 10-11: open walkway
```

### Vertical Divider (col 14)

Continuous pot wall from row 1 to row 8. **Walkway gap at rows 0, 9-11** for cross-zone movement.

### Right Zone (cols 15-21) -- Lounge / Break Area

```
  Row 0   : [Exit Door cols 17-18] [Pot col 19] [Portal cols 20-21]
  Row 2   : open walkway
  Row 3-5 : [Vending Machine cols 15-16] ... [Water Dispenser col 21] [Fridge col 21]
  Row 6-7 : open walkway (Astraea home at col 18, row 5)
  Row 8-9 : [Black Sofa cols 17-18]
  Row 10-11: [Pink Sofa L col 16] [Tea Table cols 17-18] [Pink Sofa R col 19] ... [Corner Pot col 21]
```

---

## Key Locations for Agent Navigation

| Location         | Walk Target (col, row) | Description                     |
|------------------|------------------------|---------------------------------|
| Bulletin Board   | (3, 2)                 | Stand below board centre        |
| Dashboard        | (10, 2)                | Stand below dashboard centre    |
| Exit Door        | (17, 2)                | Stand in front of exit          |
| Portal           | (20, 2)                | Stand in front of portal        |
| Gaia Home        | (6, 6)                 | Gaia idle position (left zone)  |
| Astraea Home     | (18, 5)                | Astraea idle position (right zone)|

---

## Main Walkable Corridors

1. **Top corridor** (row 2): full width cols 0-21, connects all wall-mounted items
2. **Left mid corridor** (rows 6-7, cols 0-13): between shelf1/desks and shelf3/shelf2
3. **Right mid corridor** (rows 6-7, cols 15-21): between vending machines area and lounge
4. **Bottom corridor** (rows 9-11, cols 0-15): south side, connects to right zone via pot gap
5. **Cross-zone passage** (col 14, rows 9-11): gap in pot divider wall for left-right movement
