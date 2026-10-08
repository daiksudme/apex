import assert from 'node:assert/strict';

export async function checkHomeGeometry(page, width) {
  await page.evaluate(() => document.fonts.ready);
  const names = ['Welcome', 'About', 'Latest Posts', 'Tags', 'Recent Commits'];
  const boxes = {};
  for (const name of names) {
    const region = page.getByRole('region', { name, exact: true });
    assert.ok(await region.isVisible(), `${name} is visible`);
    boxes[name] = await region.evaluate((element) => {
      const { top, bottom, height } = element.getBoundingClientRect();
      return { top, bottom, height };
    });
    assert.ok(await region.evaluate((element) => element.scrollHeight <= element.clientHeight + 1), `${name} content is not clipped`);
  }
  if (width > 960) {
    for (const [left, right] of [['Welcome', 'About'], ['Latest Posts', 'Tags']]) {
      assert.ok(Math.abs(boxes[left].top - boxes[right].top) <= 1 && Math.abs(boxes[left].bottom - boxes[right].bottom) <= 1,
        `${left}/${right} row edges at ${width}px`);
    }
  } else {
    for (let i = 1; i < names.length; i++) {
      assert.ok(boxes[names[i]].top >= boxes[names[i - 1]].bottom, `Mobile reading order without overlap at ${width}px`);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow at ${width}px`);
  }
  return { width, boxes };
}
