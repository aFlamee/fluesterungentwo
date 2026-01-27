import { type Decade, decadeStyleMap } from './decade';

/**
 * Build image generation prompt from user memory and detected decade.
 */
export function buildImagePrompt(memory: string, decade: Decade) {
	const style = decadeStyleMap[decade];
	return `A nostalgic scene depicting: ${memory}. Style: ${style}. High quality, detailed, evocative of personal memories.`;
}
