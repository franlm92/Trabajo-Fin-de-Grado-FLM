const FHIRServer = require('@asymmetrik/node-fhir-server-core');
const asyncHandler = require('./lib/async-handler');
const mongoClient = require('./lib/mongo');
const globals = require('./globals');

var kafka = require('kafka-node');
const jsonpatch = require('fast-json-patch');
// var https = require("https");
var http = require("http");
const{ sendMessage } = require("./utils/kafkaProducer");

const { FindReferences } = require('./utils/reference.utils');

const {
	fhirServerConfig,
	mongoConfig
} = require('./config');

const {
	CLIENT,
	CLIENT_DB,
	KAFKA_HOST,
	KAFKA,
	DEFAULT_OPTIONS,
	COLLECTION
} = require('./constants');

let main_fhir = async function () {

	// Connect to mongo and pass any options here
	let [ mongoErr, client ] = await asyncHandler(
		mongoClient(mongoConfig.connection, mongoConfig.options)
	);

	if (mongoErr) {
		console.error(mongoErr.message);
		console.error(mongoConfig.connection);
		process.exit(1);
	}

	// Save the client in another module so I can use it in my services
	globals.set(CLIENT, client);
	globals.set(CLIENT_DB, client.db(mongoConfig.db_name));


	// Start our FHIR server
	let server = FHIRServer.initialize(fhirServerConfig);
	server.listen(fhirServerConfig.server.port, () => server.logger.verbose(COLLECTION.PERSON + ' Server is up and running!'));
};

let main_kafka = async function () {
	
	var client = new kafka.KafkaClient({ kafkaHost: KAFKA_HOST });
	var topics = [
		{ topic: KAFKA.TOPIC_CREATED_PATIENT, partitions: 1 }, { topic: KAFKA.TOPIC_CREATED_PATIENT, partitions: 0 },
		{ topic: KAFKA.TOPIC_CREATED_PRACTITIONER, partitions: 1 }, { topic: KAFKA.TOPIC_CREATED_PRACTITIONER, partitions: 0 },
		{ topic: KAFKA.TOPIC_GET_LINKS, partitions: 1 }, { topic: KAFKA.TOPIC_GET_LINKS, partitions: 0 }
	];
	var options = { autoCommit: false, fetchMaxWaitMs: 1000, fetchMaxBytes: 1024 * 1024 };

	var consumer = new kafka.Consumer(client, topics, options);

	
	consumer.on('message', function (message) {
		try{
			var messageJSON = JSON.parse(message.value);

			switch (message.topic) {
				case KAFKA.TOPIC_CREATED_PATIENT:
					if (messageJSON.StatusKafka == KAFKA.STATUS_CHECK_PERSON_FROM_PATIENT){
						setTimeout(() => {
							consumer.commit((error, data) => {
								
							});
						}, 0);
						kafka_checkPerson(messageJSON,message.topic);
					}
					break;
				case KAFKA.TOPIC_CREATED_PRACTITIONER:
					if (messageJSON.StatusKafka == KAFKA.STATUS_CHECK_PERSON_FROM_PRACTITIONER){
						setTimeout(() => {
							consumer.commit((error, data) => {
								
							});
						}, 0);
						kafka_checkPerson(messageJSON,message.topic);
					}
					break;
				case KAFKA.TOPIC_GET_LINKS:
					if (messageJSON.StatusKafka == KAFKA.STATUS_GET_LINKS_FROM_CAREPLAN){
						setTimeout(() => {
							consumer.commit((error, data) => {
								
							});
						}, 0);
						kafka_getLinks(messageJSON,message.topic);
					}
					break;
			}
		}catch(e){
			console.log(e);
		}
	});
	
	consumer.on('error', function (err) {
		console.log('error', err);
	});
	
};

let kafka_checkPerson = function (messageJSON, topic) {
	var options = DEFAULT_OPTIONS;
	
	// Se comprueba si existe el practicante especificado
	switch (topic){
		case KAFKA.TOPIC_CREATED_PATIENT:
			options.path = "/4_0_0/Person?link.target.reference=Patient-" + messageJSON.id;
			break;
		case KAFKA.TOPIC_CREATED_PRACTITIONER:
			options.path = "/4_0_0/Person?link.target.reference=Practitioner-" + messageJSON.id;
			break;
		default:
			console.log("[Person - index.js] Topic escuchado no coincide con el esperado");
			break;
	}

	var responseString = "";
	//https.get(options, function (res) {
	http.get(options, function (res) {

		
		res.on("data", function (data) {
			responseString += data;
		});
		res.on("end", function () {
			// Si no existe el paciente, se elimina el CarePlan del sistema
			if (responseString == ""){
				console.log("[" + topic +"] No existe la persona, se comunicará al servicio");

				messageJSON.StatusKafka = KAFKA.STATUS_NOT_CHECKED_PERSON;
				// Aviso para CarePlan
				var messages = [{
					topic: topic,
					messages: [JSON.stringify(messageJSON)], // multi messages should be a array, single message can be just a string or a KeyedMessage instance
					//key: 'theKey', // string or buffer, only needed when using keyed partitioner
					partition: 0, // default 0
					attributes: 0, // default: 0
					timestamp: Date.now() // <-- defaults to Date.now() (only available with kafka v0.10+)
				}]

				sendMessage(messages);

			// Si existe el paciente asociado a la condición, se notifica por consola
			} else{
				console.log("[" + topic +"] Existe la persona");

				messageJSON.StatusKafka = KAFKA.STATUS_CHECKED_PERSON;
				// Aviso para CarePlan
				var messages = [{
					topic: topic,
					messages: [JSON.stringify(messageJSON)], // multi messages should be a array, single message can be just a string or a KeyedMessage instance
					//key: 'theKey', // string or buffer, only needed when using keyed partitioner
					partition: 0, // default 0
					attributes: 0, // default: 0
					timestamp: Date.now() // <-- defaults to Date.now() (only available with kafka v0.10+)
				}]

				sendMessage(messages);
			}


		});

		res.on("error", function (data) {
			console.log("[" + topic +"] ERROR: no se ha podido hacer la petición de chequear si la persona existe para el servicio");

			messageJSON.StatusKafka = KAFKA.STATUS_NOT_CHECKED_PERSON;
			// Aviso para condition
			var messages = [{
				topic: topic,
				messages: [JSON.stringify(messageJSON)], // multi messages should be a array, single message can be just a string or a KeyedMessage instance
				//key: 'theKey', // string or buffer, only needed when using keyed partitioner
				partition: 0, // default 0
				attributes: 0, // default: 0
				timestamp: Date.now() // <-- defaults to Date.now() (only available with kafka v0.10+)
			}]

			sendMessage(messages);
		});
	});
}

let kafka_getLinks = function (messageJSON, topic) {
	var options = DEFAULT_OPTIONS;
	
	// Se comprueba si existe el practicante especificado
	switch (topic){
		case KAFKA.TOPIC_GET_LINKS:
			options.path = "/4_0_0/Person/" + messageJSON.id;
			break;
		default:
			console.log("[Person - index.js] Topic escuchado no coincide con el esperado");
			break;
	}

	var responseString = "";
	//https.get(options, function (res) {
	http.get(options, function (res) {
	
		res.on("data", function (data) {
			responseString += data;
		});

		res.on("end", function () {
			// Si no existe el paciente, se elimina el CarePlan del sistema
			if (responseString == ""){
				console.log("[" + topic +"] No existe la persona, se comunicará al servicio");

				messageJSON.StatusKafka = KAFKA.STATUS_GET_LINKS_ERROR;
				// Aviso para CarePlan
				var messages = [{
					topic: topic,
					messages: [JSON.stringify(messageJSON)], // multi messages should be a array, single message can be just a string or a KeyedMessage instance
					//key: 'theKey', // string or buffer, only needed when using keyed partitioner
					partition: 0, // default 0
					attributes: 0, // default: 0
					timestamp: Date.now() // <-- defaults to Date.now() (only available with kafka v0.10+)
				}]

				sendMessage(messages);

			// Si existe el paciente asociado a la condición, se notifica por consola
			} else{

				let retrievedPerson = JSON.parse(responseString); // Renombrado para mejorar la legibilidad del código
				
				console.log("[" + topic +"] Existe la persona",retrievedPerson.link);
				
				let referencesFound = new Array();
				FindReferences(retrievedPerson.link, referencesFound);

				console.log("Sus links son:", referencesFound);
				console.log("Contenido de messageJSON antes de ser cambiado:", messageJSON);

				messageJSON = {
					id : messageJSON.id,
					//resourceType: retrievedPerson.resourceType,
					StatusKafka : KAFKA.STATUS_GET_LINKS_SUCCESS,
					links : referencesFound
				}

				// Aviso para CarePlan
				var messages = [{
					topic: topic,
					messages: [JSON.stringify(messageJSON)], // multi messages should be a array, single message can be just a string or a KeyedMessage instance
					//key: 'theKey', // string or buffer, only needed when using keyed partitioner
					partition: 0, // default 0
					attributes: 0, // default: 0
					timestamp: Date.now() // <-- defaults to Date.now() (only available with kafka v0.10+)
				}]
				
				sendMessage(messages);
			}


		});

		res.on("error", function (data) {
			console.log("[" + topic +"] ERROR: no se ha podido hacer la petición de chequear si la persona existe para el servicio");

			messageJSON.StatusKafka = KAFKA.STATUS_GET_LINKS_ERROR;
			// Aviso para condition
			var messages = [{
				topic: topic,
				messages: [JSON.stringify(messageJSON)], // multi messages should be a array, single message can be just a string or a KeyedMessage instance
				//key: 'theKey', // string or buffer, only needed when using keyed partitioner
				partition: 0, // default 0
				attributes: 0, // default: 0
				timestamp: Date.now() // <-- defaults to Date.now() (only available with kafka v0.10+)
			}]

			sendMessage(messages);
		});
	});
}

main_fhir();
main_kafka();