
const fx = require('fs-extra');
const path = require('path');
const keyPaths = require('keypaths');

const config = require('./config');
const myRedis = require('./__lib/myRedis');

const defaultDestFolder = './lib/services';

const parseArgs = (args) => {
	let options, folder, names;

	args.forEach(arg => {
		const type = typeof arg;
		if (Array.isArray(arg)) {
			names = arg;
		}
		else if (type === 'string') {
			folder = arg;
		}
		else if (type === 'object') {
			options = arg;
		}
	});

	folder = folder || defaultDestFolder;
	options = options || {};
	names = names || [];

	return [options, folder, names];
};

const createFiles = (destFolderPath) => {
	const lastIndex = destFolderPath.lastIndexOf('/');
	const parentPath = destFolderPath.substr(0, lastIndex);
	fx.mkdirsSync(parentPath);

	const sourceFolderPath = path.resolve(__dirname, './omg/services');
	fx.copySync(sourceFolderPath, destFolderPath);
};

const getServicesInfos = async (options, names) => {
	const {redisConfig} = config.getAllConfigurations([options]);
	myRedis.init(redisConfig);

	if (!names || !names.length) {
		names = await myRedis.getAllServiceNames();
	}

	const infos = {};
	for (let i = 0; i < names.length; i ++) {
		const name = names[i];
		const info = await myRedis.getServiceData(name);
		infos[name] = info;
	}

	myRedis.disconnect();
	return infos;
};

const getServicesApis = (infos) => {
	const data = {};
	const names = Object.keys(infos);

	for (let i = 0; i < names.length; i ++) {
		const name = names[i];
		const info = infos[name];
		const {apis} = info;
		const obj = keyPaths.toObject(apis);
		data[name] = obj;
	}

	return data;
};

const writeToDataFile = (destFolder, infos, apis) => {
	const filePath = destFolder + '/data.js';
	const content = fx.readFileSync(filePath, 'utf-8');

	// Only need host and port of info
	const names = Object.keys(infos);
	for (let i = 0; i < names.length; i ++) {
		const name = names[i];
		const info = infos[name];
		const {host, port} = info;
		infos[name] = {host, port};
	}

	const newContent = content
		.replace('`{servicesInfos}`', JSON.stringify(infos, null, 4))
		.replace('`{servicesApis}`', JSON.stringify(apis, null, 4))
	;

	fx.writeFileSync(filePath, newContent, 'utf-8');
};

const getNodeModulesPath = (destFolder) => {
	let p = destFolder;

	while (p !== '/') {
		const dest = p + '/node_modules';
		if (fx.existsSync(dest)) {
			return dest;
		}
		p = path.resolve(p, '..');
	}
};

const fixNodeModulesPath = (destFolder) => {
	const nodeModulesPath = getNodeModulesPath(destFolder);

	const arr = [
		{
			file: '/index.js',
			pkg: 'keypaths',
		},

		{
			file: '/booms/call.js',
			pkg: 'grpc',
		}
	];

	arr.forEach(item => {
		const {file, pkg} = item;
		const filePath = destFolder + file;
		const parentFolder = path.resolve(filePath, '..');
		const relativePath = path.relative(parentFolder, nodeModulesPath);

		const content = fx.readFileSync(filePath, 'utf-8');
		const newContent = content.replace(`require('${pkg}')`, `require('${relativePath}/${pkg}')`);
		fx.writeFileSync(filePath, newContent, 'utf-8');
	});
};

const me = {
	async do(caller, ...args) {
		const [options, folder, names] = parseArgs(args);

		const destRoot = path.resolve(caller, '..');
		const destFolderPath = path.resolve(destRoot, folder);
		createFiles(destFolderPath);

		const servicesInfos = await getServicesInfos(options, names);
		const servicesApis = getServicesApis(servicesInfos);

		writeToDataFile(destFolderPath, servicesInfos, servicesApis);
		fixNodeModulesPath(destFolderPath);

		console.log('Booms remote services definitions have been saved to ' + folder);
	}
};

module.exports = me;
