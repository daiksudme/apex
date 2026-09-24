import { site } from '../config/site';

export function getPageTitle(title?: string): string {
  return title ? `${title} | ${site.name}` : site.name;
}
