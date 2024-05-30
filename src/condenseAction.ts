/**
 * Utility function to wrap an asynchronous action with condensed execution behavior.
 * If the action is called multiple times while it's still running, only the last call will be executed post completion.
 * Handles function parameters, error logging, and maintains original return values.
 */
export function condenseAction<T extends (...args: any[]) => Promise<any>>(fn: T): T {
	let actionInProgress = false;
	let actionRequested = false;

	return new Proxy(fn, {
		async apply(target, thisArg, args) {
			if (actionInProgress) {
				actionRequested = true;
				return;
			}

			do {
				actionInProgress = true;
				actionRequested = false;

				try {
					const result = await Reflect.apply(target, thisArg, args);
					return result;
				} catch (err) {
					console.error('Error in condensed action:', err);
				} finally {
					actionInProgress = false;
				}
			} while (actionRequested);
		},
	}) as T;
}
