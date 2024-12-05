import { parseJson } from "@/lib/object";

export const DEFAULT_CORS_OPTIONS: Pick<Request, "mode" | "credentials"> = {
	mode: "same-origin",
	credentials: "same-origin",
};

type Config = Omit<RequestInit, "body"> & {
	body?: Record<string, unknown> | null;
};

export const simpleFetch = async (
	url: string,
	config: Config = {},
): Promise<Response> => {
	const { headers, body, ...requestInit } = config;

	// process body
	const { headers: extraHeaders, serializedBody } = serializeBody(body);

	// default request headers
	const defaultHeaders: HeadersInit = {};

	// let corsOptions = DEFAULT_CORS_OPTIONS;
	// if (baseUrl && baseUrl !== window?.location.origin) corsOptions = { credentials: "include", mode: "cors" };

	// request config
	const _requestInit: RequestInit = Object.assign(
		{},
		/*corsOptions,*/ requestInit,
		{
			headers: Object.assign({}, defaultHeaders, extraHeaders, headers),
			body: serializedBody,
		},
	);

	// request promise
	return fetch(url, _requestInit);
};

function isFlatObject(obj: unknown): boolean {
	// Check if the input is an object and is not null
	if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
		return false;
	}

	// Check each key's value in the object
	for (const value of Object.values(obj)) {
		// If the value is an object (excluding File and FileList) or if it is null, a boolean, return false
		if (
			(typeof value === "object" &&
				value !== null &&
				!(value instanceof File) &&
				!(value instanceof FileList)) ||
			typeof value === "boolean" ||
			value === null
		) {
			return false;
		}
	}

	// If all values pass the test, return true
	return true;
}

function hasFiles(object: Record<string, unknown>) {
	return Object.values(object).some(
		(value) => value instanceof File || value instanceof FileList,
	);
}

function serializeBody(data: Config["body"]): {
	headers: HeadersInit;
	serializedBody: string | FormData | URLSearchParams | undefined;
} {
	if (!data) return { headers: {}, serializedBody: undefined };
	if (data instanceof FormData) return { headers: {}, serializedBody: data };
	if (isFlatObject(data)) {
		if (hasFiles(data)) {
			const formData = new FormData();
			for (const [key, value] of Object.entries(data)) {
				if (value instanceof FileList) {
					Array.from(value).forEach((file, index) =>
						formData.append(`${key}[${index}]`, file),
					);
					continue;
				}
				formData.append(key, value as string);
			}

			return {
				headers: {},
				serializedBody: formData,
			};
		}
		return {
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			serializedBody: new URLSearchParams(
				data as unknown as Record<string, string>,
			),
		};
	}
	return {
		serializedBody: JSON.stringify(data),
		headers: { "Content-Type": "application/json" },
	};
}

/** This is not baked into simpleFetch, to keep the parseing capablities open as per request basis, there could be
 * multiple parsers for response as requred by the applicaiton.
 *
 * For example one of the parser could have serialization or extraction logic depending on BE/API response structure.
 */
export async function parseResponse(response: Response): Promise<any> {
	const text = await response.text();
	const { data: json, error } = parseJson(text);

	let result = json;
	if (error) {
		result = text;
	}

	if (response.ok) {
		return result;
	}

	throw result;
}
