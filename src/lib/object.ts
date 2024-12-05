const EMPTY_JSON = {};
export function parseJson<D = unknown>(text?: unknown) {
	if (!text) {
		return { data: EMPTY_JSON as D, error: null };
	}

	// Throw error if not of type string
	if (typeof text !== "string") {
		return {
			data: null,
			error: new Error(`Expected string to parse, got ${typeof text} instead}`),
		};
	}

	// Optionally, can handle it silently without throwing an error
	/* if (typeof text !== "string") {
		return {
			data: EMPTY_JSON as D,
			error: null,
		};
	} */

	try {
		return { data: JSON.parse(text) as D, error: null };
	} catch (error) {
		return { data: null, error };
	}
}
