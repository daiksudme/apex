import { site } from './site';

export function getPageTitle(title?: string): string {
  return title ? `${title} | ${site.name}` : site.name;
}
