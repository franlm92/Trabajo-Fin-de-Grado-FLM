const FHIRServer = require('@asymmetrik/node-fhir-server-core');
const asyncHandler = require('./lib/async-handler');
const mongoClient = require('./lib/mongo');
const globals = require('./globals');

var kafka = require('kafka-node');
const jsonpatch = require('fast-json-patch');
var http = require("http");
//var https = require("https");
const{ sendMessage } = require("./utils/kafkaProducer");

const {
	fhirServerConfig,
	mongoConfig
} = require('./config');

const {
	CLIENT,
	CLIENT_DB,
	KAFKA_HOST,
	KAFKA,
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
	server.listen(fhirServerConfig.server.port, () => server.logger.verbose(COLLECTION.PRACTITIONER + ' Server is up and running!'));
};

let main_kafka = async function () {
	
	var client = new kafka.KafkaClient({ kafkaHost: KAFKA_HOST });
	var topics = [{ topic: KAFKA.TOPIC_CREATED_CARETEAM, partitions: 1 }, { topic: KAFKA.TOPIC_CREATED_CARETEAM, partitions: 0 },
		{ topic: KAFKA.TOPIC_CREATED_CAREPLAN, partitions: 1 }, { topic: KAFKA.TOPIC_CREATED_CAREPLAN, partitions: 0 }];
	var options = { autoCommit: false, fetchMaxWaitMs: 1000, fetchMaxBytes: 1024 * 1024 };

	var consumer = new kafka.Consumer(client, topics, options);

	consumer.on('message', function (message) {
		try{
			if(message.topic == KAFKA.TOPIC_CREATED_CARETEAM){
				var messageJSON = JSON.parse(message.value);
				if (messageJSON.StatusKafka == KAFKA.STATUS_CHECK_PRACTITIONER_FOR_CARETEAM){
					setTimeout(() => {
						consumer.commit((error, data) => {
							// Here the commit will work as expected
						});
					}, 0);
					kafka_checkPractitioner(messageJSON,message.topic);
				}
			}
			if(message.topic == KAFKA.TOPIC_CREATED_CAREPLAN){
				var messageJSON = JSON.parse(message.value);
				if (messageJSON.StatusKafka == KAFKA.STATUS_CHECK_PRACTITIONER_FOR_CAREPLAN){
					setTimeout(() => {
						consumer.commit((error, data) => {
							// Here the commit will work as expected
						});
					}, 0);
					kafka_checkPractitioner(messageJSON,message.topic);
				}
			}
		}catch(e){
			console.log(e);
		}
	});
	
	consumer.on('error', function (err) {
		console.log('error', err);
	});
	
};

let kafka_checkPractitioner = function (messageJSON, topic) {
	var options = {
		host: "127.0.0.1",
		port: "3014",
		headers: {
			"Content-Type": "application/fhir+json",
			"Cache-Control": "no-cache"
		}
	};
	
	// Se comprueba si existe el practicante especificado
	switch (topic){
		case KAFKA.TOPIC_CREATED_CARETEAM:
			options.path = "/4_0_0/Practitioner/" + messageJSON.ReferencePositionKafka.member.reference.split("-")[1];
			break;
		case KAFKA.TOPIC_CREATED_CAREPLAN:
			options.path = "/4_0_0/Practitioner/" + messageJSON["reference"].split("-")[1];
			break;
		default:
			console.log("[Practitioner - index.js] Topic escuchado no coincide con el esperado");
			break;
	}

	var responseString1 = "";
	// https.get(options, function (res) {
	http.get(options, function (res) {	
	
		res.on("data", function (data) {
			responseString1 += data;
		}).on("end", function () {
			// Si no existe el practicante, se elimina el CarePlan del sistema
			if (responseString1 == ""){
				console.log("[" + topic +"] No existe el practicante asociado, se comunicará al servicio");

				messageJSON.StatusKafka = KAFKA.STATUS_NOT_CHECKED_PRACTITIONER;
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

			// Si existe el practicante asociado a la condición, se notifica por consola
			} else{
				console.log("[" + topic +"] Existe el practicante asociado");

				messageJSON.StatusKafka = KAFKA.STATUS_CHECKED_PRACTITIONER;
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


		}).on("error", function (data) {
			console.log("[" + topic +"] ERROR: no se ha podido hacer la petición de chequear si el practicante existe para el servicio");

			messageJSON.StatusKafka = KAFKA.STATUS_NOT_CHECKED_PRACTITIONER;
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
	}).on("error", function (error) {
		console.log("---------------------------THIS IS THE END",error);
	});
}

main_fhir();
main_kafka();