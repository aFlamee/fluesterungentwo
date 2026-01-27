import { ok, err, type Result } from 'neverthrow';

export const SUPPORTED_DECADES = [1940, 1950, 1960, 1970, 1980, 1990, 2000] as const;
export type Decade = (typeof SUPPORTED_DECADES)[number];

export const decadeStyleMap: Record<Decade, string> = {
	1940: 'authentic 1940s black-and-white photography, period-accurate clothing and settings, natural soft lighting, documentary style, slight film grain',
	1950: 'authentic 1950s Kodachrome photography, period-accurate fashion and interiors, natural daylight, realistic colors typical of the era',
	1960: 'authentic 1960s photography, period-accurate fashion and settings, natural lighting, realistic documentary style, slight color shift typical of era film stock',
	1970: 'authentic 1970s photography, warm color temperature, period-accurate fashion and interiors, natural lighting, realistic Kodak film look',
	1980: 'authentic 1980s photography, period-accurate fashion and settings, natural lighting, realistic film photography style, candid documentary feel',
	1990: 'authentic 1990s photography, period-accurate fashion and technology, natural lighting, realistic film or early digital camera look, candid snapshot style',
	2000: 'authentic early 2000s photography, period-accurate fashion and technology, natural lighting, realistic digital camera quality of the era'
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
