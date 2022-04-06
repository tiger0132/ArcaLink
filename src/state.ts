import chokidar from 'chokidar';
import yaml from 'js-yaml';
import fs from 'fs-extra';
import { z } from 'zod';
import path from 'path';

interface Store<T> {
	name: string;
	key: keyof State;
	schema: T;
};

const storeMap: Map<string, Store<z.AnyZodObject>> = new Map();
const state: State = {} as any;
async function loadStore<T extends z.AnyZodObject>(store: Store<T>, reload: boolean = false) {
	let file = path.join(config.data.store, store.name + '.yml');
	if (!fs.existsSync(file)) {
		logger.error(`Store "${store.name}" does not exist.`);
		process.exit(1);
	}
	let content = await fs.readFile(file, 'utf8');
	let data = yaml.load(content);
	let result = await store.schema.safeParseAsync(data);
	if (!result.success) {
		if (reload) {
			logger.warn(`Reload store "${store.name}" failed.`);
			return;
		}
		logger.error(`Load store "${store.name}" failed.`);
		process.exit(1);
	}
	storeMap.set(file, store);
	logger.info(`${reload ? 'Reload' : 'Load'} store "${store.name}".`);
	state[store.key] = result.data as State[typeof store.key];
	return;
}

const stores = [] as const;

await fs.mkdirp(config.data.store);
for (let store of stores)
	await loadStore(store);

if (storeMap.size)
	chokidar
		.watch([...storeMap.values()].map(x => path.join(config.data.store, x.name + '.yml')))
		.on('change', async file => {
			let store = storeMap.get(file);
			if (store)
				await loadStore(store, true);
			else
				logger.warn(`Store "${file}" not found.`);
		});

global.state = state;