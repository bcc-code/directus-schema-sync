import { access } from 'fs/promises';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

export const ADMIN_ACCOUNTABILITY = { role: '', admin: true };

export function nodeImport(dir: string, file: string) {
	return import(pathToFileURL(resolve(dir, file)).href);
}

export async function fileExists(path: string) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export function deepEqual(obj1: any, obj2: any): boolean {
	if (obj1 === obj2) return true;

	if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
		return false;
	}

	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	if (keys1.length !== keys2.length) return false;

	for (let key of keys1) {
		if (!keys2.includes(key)) return false;
		if (!deepEqual(obj1[key], obj2[key])) return false;
	}

	return true;
}

export function getDiff(newObj: Record<any, any>, oldObj: any) {
	if (!oldObj) return newObj;

	const result: Record<any, any> = {};
	let isDifferent = false;
	Object.keys(newObj).forEach(key => {
		if (!deepEqual(newObj[key], oldObj[key])) {
			result[key] = newObj[key];
			isDifferent = true;
		}
	});
	return isDifferent ? result : null;
}

export function sortObject<T extends Record<string, any>>(obj: T): T;
export function sortObject<T>(obj: T[]): T[];
export function sortObject<T extends Record<string, any> | T[]>(obj: T): T {
	if (typeof obj !== 'object' || obj === null) {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map(sortObject) as unknown as T;
	}

	const sortedObj: Record<string, any> = {};
	Object.keys(obj)
		.sort()
		.forEach(key => {
			sortedObj[key] = sortObject((obj as Record<string, any>)[key]);
		});
	return sortedObj as T;
}