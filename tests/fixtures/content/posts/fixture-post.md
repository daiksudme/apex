---
title: フィクスチャーの記事
description: 生成HTMLを検証するための記事。
publishedAt: 2026-01-04
tags:
  - development
  - essay
  - fixture-tag
---

## フィクスチャー本文

公開記事とは独立した検証用データです。

```text
const fixture = 42;
```

| Feature | Result |
| --- | --- |
| Markdown | Generated HTML |

![Fixture diagram](/images/fixture-diagram.svg)

[Fixture reference](https://example.com/fixture-reference)

[Second fixture article](/second-post)

## Reading to the end

This longer fixture lets a reader move past the article header, outline, code, table, and image before reaching the post index. It is test content only and does not describe a real project or person. The navigation should remain after the complete article rather than interrupting its final section.

The reader may arrive directly at this page from a bookmark or an external link. Returning to the post index must not depend on an earlier visit to the Home page, browser history, or JavaScript. The same action should remain available after a short article and the shared Profile entry.

<div>Final article content remains above the post index link.</div>
