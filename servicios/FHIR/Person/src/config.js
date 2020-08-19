const { VERSIONS } = require('@asymmetrik/node-fhir-server-core').constants;
const env = require('var');


/**
 * @name mongoConfig
 * @summary Configurations for our Mongo instance
 */
let mongoConfig = {
	connection: `mongodb://${env.MONGO_HOSTNAME}`,
	db_name: env.MONGO_DB_NAME,
	options: {
		auto_reconnect: true
	}
};



// Set up whitelist
let whitelist_env = env.WHITELIST && env.WHITELIST.split(',').map(host => host.trim()) || false;

// If no whitelist is present, disable cors
// If it's length is 1, set it to a string, so * works
// If there are multiple, keep them as an array
let whitelist = whitelist_env && whitelist_env.length === 1
	? whitelist_env[0]
	: whitelist_env;

/**
 * @name fhirServerConfig
 * @summary @asymmetrik/node-fhir-server-core configurations.
 */
let fhirServerConfig = {
	auth: {
		// This servers URI
		resourceServer: env.RESOURCE_SERVER,
		//
		// if you use this strategy, you need to add the corresponding env vars to docker-compose
		//
		// strategy: {
		// 	name: 'bearer',
		// 	useSession: false,
		// 	service: './src/strategies/bearer.strategy.js'
		// },
	},
	server: {
		/*
		ssl: {
			key: __dirname+'/ssl/privkey.pem',
			cert: __dirname+'/ssl/cert.pem'
		},
		*/
		// support various ENV that uses PORT vs SERVER_PORT
		port: env.PORT || env.SERVER_PORT,
		// allow Access-Control-Allow-Origin
		corsOptions: {
			maxAge: 86400,
			origin: whitelist,
			methods: 'HEAD,PUT,PATCH,POST,DELETE',
			preflightContinue: false,
			optionsSuccessStatus: 204,
			allowedHeaders: ['Content-Type', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Origin', 'cache-control', 'Authorization']
		}
	},
	logging: {
		level: env.LOGGING_LEVEL
	},
	//
	// If you want to set up conformance statement with security enabled
	// Uncomment the following block
	//
	security: [
		{
			url: 'authorize',
			valueUri: `${env.AUTH_SERVER_URI}/authorize`
		},
		{
			url: 'token',
			valueUri: `${env.AUTH_SERVER_URI}/token`
		}
		// optional - registration
	],
	//
	// Add any profiles you want to support.  Each profile can support multiple versions
	// if supported by core.  To support multiple versions, just add the versions to the array.
	//
	// Example:
	// Account: {
	//		service: './src/services/account/account.service.js',
	//		versions: [ VERSIONS['4_0_0'], VERSIONS['3_0_1'], VERSIONS['1_0_2'] ]
	// },
	//
	profiles: {
		Person: {
			service: './src/services/person/person.service.js',
			versions: [ VERSIONS['4_0_0'] ],
			operation: [
				{
					name: 'obj',
					route: '/obj',
					method: 'GET',
					reference: 'https://www.hl7.org/fhir/patient-operation-everything.html'
				},
				{
					name: 'obj-by-id',
					route: '/obj/:id',
					method: 'GET',
					reference: 'https://www.hl7.org/fhir/patient-operation-everything.html'
				},
				{
					name: 'create-to-minimal',
					route: '/minimal',
					method: 'POST',
					reference: 'https://www.hl7.org/fhir/patient-operation-everything.html'
				},
				{
					name: 'search-by-id-from-minimal',
					route: '/minimal/:id',
					method: 'GET',
					reference: 'https://www.hl7.org/fhir/patient-operation-everything.html'
				},
				{
					name: 'search-from-minimal',
					route: '/minimal',
					method: 'GET',
					reference: 'https://www.hl7.org/fhir/patient-operation-everything.html'
				}
			]
		},
	}
};

module.exports = {
	fhirServerConfig,
	mongoConfig
};
