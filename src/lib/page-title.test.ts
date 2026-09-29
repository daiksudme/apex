import { describe, expect, it } from 'vitest';
import { site } from '../config/site';
import { getPageTitle } from './page-title';

describe('getPageTitle', () => {
  it('uses the site name when no page title is provided', () => {
    expect(getPageTitle()).toBe(site.name);
  });

  it('combines a page title with the site name', () => {
    expect(getPageTitle('記事')).toBe(`記事 | ${site.name}`);
  });

  it('uses the site name when the page title is empty', () => {
    expect(getPageTitle('')).toBe(site.name);
  });
});
