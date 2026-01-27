import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fromPromise } from 'neverthrow';
import { extractDecade } from '$lib/decade';
import { buildImagePrompt } from '$lib/prompt';
import { env } from '$env/dynamic/private';

const WHISPER_BASE_URL = env.WHISPER_BASE_URL || 'http://127.0.0.1:8000';
const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;

interface OpenRouterImageResponse {
	choices: Array<{
		message: {
			images?: Array<{
				image_url: { url: string };
			}>;
		};
	}>;
}

export const POST: RequestHandler = async ({ request }) => {
	// 1. Parse audio from form data
	const formData = await request.formData();
	const audioFile = formData.get('audio');

	if (!audioFile || !(audioFile instanceof File)) {
		error(400, { message: 'Missing audio file' });
	}

	// 2. Forward to Whisper service
	const whisperForm = new FormData();
	whisperForm.append('audio', audioFile);

	const transcriptResult = await fromPromise(
		fetch(`${WHISPER_BASE_URL}/transcribe`, {
			method: 'POST',
			body: whisperForm
		}).then(async (res) => {
			if (!res.ok) {
				const text = await res.text();
				throw new Error(`Whisper error: ${text}`);
			}
			return res.json() as Promise<{ text: string; language: string }>;
		}),
		(e) => (e instanceof Error ? e.message : 'Whisper request failed')
	);

	if (transcriptResult.isErr()) {
		error(502, { message: transcriptResult.error });
	}

	const { text: transcript } = transcriptResult.value;

	// 3. Extract decade from transcript
	const decadeResult = extractDecade(transcript);
	if (decadeResult.isErr()) {
		error(422, { message: decadeResult.error });
	}
	const decade = decadeResult.value;

	// 4. Build prompt and generate image
	const prompt = buildImagePrompt(transcript, decade);

	if (!OPENROUTER_API_KEY) {
		error(500, { message: 'OPENROUTER_API_KEY not configured' });
	}

	// OpenRouter requires using chat/completions with modalities for image generation
	const imageResult = await fromPromise(
		fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${OPENROUTER_API_KEY}`
			},
			body: JSON.stringify({
				model: 'google/gemini-3-pro-image-preview',
				messages: [{ role: 'user', content: prompt }],
				modalities: ['image', 'text']
			})
		}).then(async (res) => {
			if (!res.ok) {
				const text = await res.text();
				throw new Error(`OpenRouter error (${res.status}): ${text}`);
			}
			return res.json() as Promise<OpenRouterImageResponse>;
		}),
		(e) => (e instanceof Error ? e.message : 'Image generation failed')
	);

	if (imageResult.isErr()) {
		error(502, { message: imageResult.error });
	}

	const imageData = imageResult.value.choices[0]?.message?.images?.[0]?.image_url?.url;
	if (!imageData) {
		error(502, { message: 'No image returned from OpenRouter' });
	}

	// Parse base64 from data URL (format: "data:image/png;base64,...")
	const [header, base64Data] = imageData.split(',');
	const mimeMatch = header?.match(/data:([^;]+)/);
	const mimeType = mimeMatch?.[1] || 'image/png';

	// 5. Return result
	return json({
		transcript,
		decade,
		prompt,
		imageBase64: base64Data,
		mediaType: mimeType
	});
};
