// Tower recipes. Each one lays blocks on a grid of cells (c = column from the left,
// r = row from the ground, w and h in cells). tier 1 is the weakest material (glass),
// 2 is wood, 3 is stone; the day's hit points for each tier are set in calibrate.js.
// key: true marks the one gold keystone (counts four times in the score).

function make(spec) {
  const blocks = [];
  const add = (c, r, w, h, tier, key = false) => blocks.push({ c, r, w, h, tier, key });
  spec(add);
  return blocks;
}

export const RECIPES = [
  {
    id: 'pyramid', name: 'The pyramid',
    blocks: make((add) => {
      for (let c = 0; c < 7; c++) add(c, 0, 1, 1, c === 0 || c === 6 ? 2 : 3);
      for (let c = 1; c < 6; c++) add(c, 1, 1, 1, c === 1 || c === 5 ? 1 : 2);
      for (let c = 2; c < 5; c++) add(c, 2, 1, 1, 1);
      add(3, 3, 1, 1, 1, true);
    }),
  },
  {
    id: 'skyscraper', name: 'The skyscraper',
    blocks: make((add) => {
      for (let r = 0; r < 7; r++) {
        const tier = r < 2 ? 3 : r < 5 ? 2 : 1;
        if (r % 2 === 0) { add(0, r, 1, 1, tier); add(1, r, 1, 1, tier); add(2, r, 1, 1, tier); }
        else { add(0, r, 2, 1, tier); add(2, r, 1, 1, tier); }
      }
      add(1, 7, 1, 1, 1, true);
    }),
  },
  {
    id: 'gate', name: 'The gate',
    blocks: make((add) => {
      add(0, 0, 2, 3, 3); add(3, 0, 2, 3, 3);
      add(0, 3, 5, 1, 2);
      add(1, 4, 1, 1, 1); add(2, 4, 1, 1, 2); add(3, 4, 1, 1, 1);
      add(1, 5, 3, 1, 2);
      add(2, 6, 1, 1, 1, true);
    }),
  },
  {
    id: 'mushroom', name: 'The mushroom',
    blocks: make((add) => {
      add(1, 0, 1, 3, 3); add(2, 0, 1, 3, 3); add(3, 0, 1, 3, 3);
      add(0, 3, 5, 1, 2);
      add(0, 4, 1, 1, 1); add(1, 4, 1, 1, 1); add(2, 4, 1, 2, 2);
      add(3, 4, 1, 1, 1); add(4, 4, 1, 1, 1);
      add(2, 6, 1, 1, 1, true);
    }),
  },
  {
    id: 'wall', name: 'The wall',
    blocks: make((add) => {
      add(0, 0, 2, 1, 3); add(2, 0, 2, 1, 3); add(4, 0, 2, 1, 3);
      add(0, 1, 1, 1, 3); add(1, 1, 2, 1, 2); add(3, 1, 2, 1, 2); add(5, 1, 1, 1, 3);
      add(0, 2, 2, 1, 2); add(2, 2, 2, 1, 2); add(4, 2, 2, 1, 2);
      add(0, 3, 1, 1, 1); add(1, 3, 2, 1, 1); add(3, 3, 2, 1, 1); add(5, 3, 1, 1, 1);
      add(2, 4, 2, 1, 1, true);
    }),
  },
  {
    id: 'stairs', name: 'The staircase',
    blocks: make((add) => {
      for (let i = 0; i < 5; i++) {
        for (let r = 0; r <= i; r++) {
          const top = r === i;
          add(i, r, 1, 1, r === 0 ? 3 : top ? 1 : 2, top && i === 4);
        }
      }
    }),
  },
  {
    id: 'bridge', name: 'The bridge',
    blocks: make((add) => {
      add(0, 0, 2, 2, 3); add(0, 2, 2, 2, 2);
      add(3, 0, 2, 2, 3); add(3, 2, 2, 2, 2);
      add(0, 4, 5, 1, 2);
      add(1, 5, 3, 1, 1); add(2, 6, 1, 1, 1, true);
      add(0, 5, 1, 1, 1); add(4, 5, 1, 1, 1);
    }),
  },
];

/** Footprint width of a recipe in cells. */
export function recipeWidth(blocks) {
  let w = 0;
  for (const b of blocks) if (b.c + b.w > w) w = b.c + b.w;
  return w;
}

/** Two recipes side by side with a one-column gap (the Sunday big build). */
export function doubleRecipe(a, b) {
  const wa = recipeWidth(a.blocks);
  return {
    id: `${a.id}+${b.id}`, name: `${a.name} and ${b.name.replace(/^The /, 'the ')}`,
    blocks: [...a.blocks, ...b.blocks.map((x) => ({ ...x, c: x.c + wa + 1 }))],
  };
}
