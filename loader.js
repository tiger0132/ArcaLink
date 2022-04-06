import { resolve as resolveTs } from 'ts-node/esm';
import * as tsConfigPaths from 'tsconfig-paths';
import { pathToFileURL } from 'url';

const { absoluteBaseUrl, paths } = tsConfigPaths.loadConfig();
const matchPath = tsConfigPaths.createMatchPath(absoluteBaseUrl, paths);

export function resolve(specifier, ctx, defaultResolver) {
	const match = matchPath(specifier);
	return match
		? resolveTs(pathToFileURL(`${match}`).href, ctx, defaultResolver)
		: resolveTs(specifier, ctx, defaultResolver);
}

export { load, transformSource } from 'ts-node/esm';