
// Note:
// 		Please run ./boomsInit.js first to
// 		create services file before run this file

const {s1, s2} = require('./lib/services');

const main = async () => {
	let result;

	result = await s1.about();
	console.log(result); // "Microservices #1"

	result = await s2.about();
	console.log(result); // "Microservices #2"

	result = await s1.say.hi('owen', 100);
	console.log(result); // { msg: 'Hi, I am owen, 100 years old.' }
};

main();
