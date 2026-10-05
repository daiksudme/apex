export const site = {
  name: 'daiksud.me',
  description: 'A blog about experiments with technology, personal projects, and what I learn and think along the way.',
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
  bio: 'I’m exploring technology and creativity to build a better tomorrow.',
} as const;

// Global navigation uses canonical site routes.
export const navigation = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Posts', href: '/posts', icon: 'posts' },
  { label: 'Tags', href: '/tags', icon: 'tags' },
  { label: 'Profile', href: '/profile', icon: 'profile' },
] as const;
