import assert from 'node:assert/strict';

export async function checkSharedPreview(page, base) {
  const response = await page.request.get(new URL('/profile?shared=1#preview', base).href);
  assert.equal(response.status(), 200, 'OG-01 shared article response');
  const metadata = await page.evaluate((html) => {
    const head = new DOMParser().parseFromString(html, 'text/html').head;
    const values = (property) => [...head.querySelectorAll(`meta[property="${property}"]`)].map((node) => node.content);
    return { urls: values('og:url'), images: values('og:image'), alternatives: values('og:image:alt') };
  }, await response.text());
  assert.deepEqual(metadata.urls, ['https://daiksud.me/profile'], 'OG-01 production URL excludes query, fragment and serving origin');
  assert.deepEqual(metadata.images, ['https://daiksud.me/og-image.png'], 'OG-02 shared production image URL');
  assert.deepEqual(metadata.alternatives, ['暗い背景のターミナル風ウィンドウに青いカーソルと daiksud.me、つくる。学ぶ。書く。繰り返す。の文字を配置した画像。'], 'OG-02 descriptive image alternative');
  const image = await page.request.get(new URL('/og-image.png', base).href);
  assert.equal(image.status(), 200, 'OG-02 shared image is served');
  if (new URL(base).protocol === 'https:') {
    assert.match(image.headers()['content-type'], /^image\/png(?:;|$)/i, 'OG-02 hosted PNG media type');
    assert.match(response.headers()['x-robots-tag'], /\bnoindex\b/i, 'OG-01 hosting preserves noindex');
  }
  const dimensions = await page.evaluate(async (bytes) => {
    const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    return [image.width, image.height];
  }, [...await image.body()]);
  assert.deepEqual(dimensions, [1536, 864], 'OG-02 hosted image decodes at its intended size');
}
