import { ok, err, type Result } from 'neverthrow';

export const SUPPORTED_DECADES = [1940, 1950, 1960, 1970, 1980, 1990, 2000] as const;
export type Decade = (typeof SUPPORTED_DECADES)[number];

export const decadeStyleMap: Record<Decade, string> = {
	1940: 'sepia-toned, vintage 1940s aesthetic, wartime era, soft grain, nostalgic film photography style',
	1950: '1950s retro style, pastel colors, mid-century modern aesthetic, Kodachrome film look',
	1960: '1960s pop art influence, vibrant colors, mod aesthetic, psychedelic undertones',
	1970: '1970s warm tones, earthy colors, disco era glow, vintage film grain, golden hour lighting',
	1980: '1980s neon aesthetic, synthwave colors, VHS style, bright contrasts, retro-futuristic',
	1990: '1990s grunge aesthetic, muted tones, film photography style, candid snapshot feel',
	2000: 'early 2000s digital camera aesthetic, slightly oversaturated, millennial nostalgia'
};

/**
 * Extract decade from text. Looks for patterns like "1970", "70er", "seventies", etc.
 * Returns the first matching decade in supported range.
 */
export function extractDecade(text: string): Result<Decade, string> {
	const normalized = text.toLowerCase();

	// Direct year patterns: 1940, 1975, 1970er, 1970ern, 1970s, etc.
	const yearMatch = normalized.match(/\b(19[4-9]\d|200\d)/);
	if (yearMatch) {
		const year = parseInt(yearMatch[1], 10);
		const decade = (Math.floor(year / 10) * 10) as Decade;
		if (SUPPORTED_DECADES.includes(decade)) {
			return ok(decade);
		}
	}

	// German patterns: 70er, 80er Jahre
	const germanMatch = normalized.match(/\b([4-9]0|00)er\b/);
	if (germanMatch) {
		const num = parseInt(germanMatch[1], 10);
		const decade = (num === 0 ? 2000 : 1900 + num) as Decade;
		if (SUPPORTED_DECADES.includes(decade)) {
			return ok(decade);
		}
	}

	// German + English patterns via regex
	const patterns: [RegExp, Decade][] = [
		// German: vierzig*, fünfzig*, sechzig*, siebzig*, achtzig*, neunzig*
		[/vierzig/, 1940],
		[/f(ü|u)nfzig/, 1950],
		[/sechzig/, 1960],
		[/siebzig/, 1970],
		[/achtzig/, 1980],
		[/neunzig/, 1990],
		[/zweitausend/, 2000],
		// English
		[/fort(y|ies)/, 1940],
		[/fift(y|ies)/, 1950],
		[/sixt(y|ies)/, 1960],
		[/sevent(y|ies)/, 1970],
		[/eight(y|ies)/, 1980],
		[/ninet(y|ies)/, 1990],
		[/two\s*thousand|2000s/, 2000]
	];

	for (const [pattern, decade] of patterns) {
		if (pattern.test(normalized)) {
			return ok(decade);
		}
	}

	return err(
		`Could not detect decade from text. Please mention a year or decade (1940-2000). Transcript: "${text}"`
	);
}
