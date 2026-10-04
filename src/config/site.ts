export const site = {
  name: 'daiksud.me',
  description: '技術の試行錯誤、個人開発、学んだこと、考えたことを書き残すためのブログです。',
  tagline: 'Build. Learn. Write. Repeat.',
  repositoryUrl: 'https://github.com/daiksudme/apex',
  commitsUrl: 'https://github.com/daiksudme/apex/commits/main/',
} as const;

export const profile = {
  name: 'daiksud',
  host: 'kawasaki',
  location: 'Kawasaki, Japan',
  role: 'Developer / Builder / Writer',
  githubUrl: 'https://github.com/daiksud',
  githubLabel: 'github.com/daiksud',
  xUrl: 'https://x.com/daiksud',
  xLabel: 'x.com/daiksud',
  zennUrl: 'https://zenn.dev/daiksud',
  zennLabel: 'zenn.dev/daiksud',
  avatarUrl: 'https://avatars.githubusercontent.com/u/155234749?v=4&s=320',
  bio: 'よりよい明日をつくるために、技術と創造の力を探求しています。',
} as const;

// Navigation uses canonical page routes and external destinations.
export const navigation = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Posts', href: '/posts', icon: 'posts' },
  { label: 'Tags', href: '/tags', icon: 'tags' },
  { label: 'Profile', href: '/profile', icon: 'profile' },
  { label: 'GitHub', href: profile.githubUrl, icon: 'github' },
  { label: 'X', href: profile.xUrl, icon: 'x' },
  { label: 'Zenn', href: profile.zennUrl, icon: 'link' },
] as const;
