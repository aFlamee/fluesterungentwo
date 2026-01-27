import { type Decade, decadeStyleMap } from './decade';

/**
 * Build image generation prompt from user memory and detected decade.
 */
export function buildImagePrompt(memory: string, decade: Decade) {
	const style = decadeStyleMap[decade];
	return `Create a photorealistic image of this scene: ${memory}

CRITICAL: Do NOT include any text, words, letters, numbers, captions, titles, watermarks, or typography anywhere in the image. The image must be purely visual with no written elements.

Visual style: ${style}

The image should look like an authentic photograph from the ${decade}s era. Keep it hyper realism!`;
}
