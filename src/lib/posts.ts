import { getCollection } from 'astro:content';
import { publicPosts } from '../domain/posts';

export async function getPublicPosts() {
  return publicPosts(await getCollection('posts'));
}
