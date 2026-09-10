/**
 * Run `task(item)` voor alle items met max `concurrency` parallel. Per-item
 * fouten worden gevangen en gerapporteerd in het resultaat ipv de hele run te
 * stoppen — zo houdt 1 kapotte regeling de overige 276 niet tegen.
 *
 * `onProgress` wordt na elke afgeronde call aangeroepen (success of failure)
 * voor lichte voortgangsindicatie in de console.
 */
export async function runConcurrent<TInput, TOutput>(
	items: TInput[],
	task: (item: TInput) => Promise<TOutput>,
	options: {
		concurrency?: number;
		onProgress?: (state: { done: number; total: number; failed: number }) => void;
	} = {},
): Promise<{
	successes: Array<{ input: TInput; output: TOutput }>;
	failures: Array<{ input: TInput; error: unknown }>;
}> {
	const concurrency = Math.max(1, options.concurrency ?? 10);
	const total = items.length;
	const successes: Array<{ input: TInput; output: TOutput }> = [];
	const failures: Array<{ input: TInput; error: unknown }> = [];

	let cursor = 0;
	let done = 0;

	async function worker() {
		while (cursor < items.length) {
			const myIndex = cursor++;
			const item = items[myIndex];
			try {
				const output = await task(item);
				successes.push({ input: item, output });
			} catch (error) {
				failures.push({ input: item, error });
			}
			done++;
			options.onProgress?.({ done, total, failed: failures.length });
		}
	}

	const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
	await Promise.all(workers);

	return { successes, failures };
}
