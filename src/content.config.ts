import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORIES, DEFAULT_CATEGORY } from './consts';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			// 목록에 없는 값을 적으면 빌드가 실패한다. 오타로 분류가 조용히
			// 갈라지는 것보다 그 편이 낫다.
			category: z.enum(CATEGORIES).default(DEFAULT_CATEGORY),
		}),
});

export const collections = { blog };
