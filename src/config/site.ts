export const site = {
  name: 'daiksud.me',
  description: '技術の実験や個人プロジェクト、そこから学んだこと・考えたことを綴るブログです。',
  tagline: 'つくる。学ぶ。書く。繰り返す。',
  repositoryUrl: 'https://github.com/daiksudme/apex',
  commitsUrl: 'https://github.com/daiksudme/apex/commits/main/',
} as const;

export const profile = {
  name: 'daiksud',
  host: 'kawasaki',
  location: 'Kawasaki, Japan',
  role: 'ソフトウェア開発・ものづくり・執筆',
  githubUrl: 'https://github.com/daiksud',
  githubLabel: 'github.com/daiksud',
  xUrl: 'https://x.com/daiksud',
  xLabel: 'x.com/daiksud',
  zennUrl: 'https://zenn.dev/daiksud',
  zennLabel: 'zenn.dev/daiksud',
  avatarUrl: 'https://avatars.githubusercontent.com/u/155234749?v=4&s=320',
  bio: 'よりよい明日をつくるために、技術と創造性の可能性を探っています。',
} as const;

// 共通ナビゲーションには各ページの正規のパスを使う。
export const navigation = [
  { label: 'ホーム', href: '/', icon: 'home' },
  { label: '記事一覧', href: '/posts', icon: 'posts' },
  { label: 'タグ一覧', href: '/tags', icon: 'tags' },
  { label: 'プロフィール', href: '/profile', icon: 'profile' },
] as const;
