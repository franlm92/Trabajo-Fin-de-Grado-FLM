/*eslint no-unused-vars: "warn"*/

const { VERSIONS } = require('@asymmetrik/node-fhir-server-core').constants;
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { COLLECTION, CLIENT_DB, KAFKA } = require('../../constants');
const moment = require('moment-timezone');
const globals = require('../../globals');
const jsonpatch = require('fast-json-patch');

const { getUuid } = require('../../utils/uid.util');

const logger = require('@asymmetrik/node-fhir-server-core').loggers.get();

const { stringQueryBuilder,
	tokenQueryBuilder,
	referenceQueryBuilder,
	addressQueryBuilder,
	nameQueryBuilder,
	dateQueryBuilder } = require('../../utils/querybuilder.util');


let getPatient = (base_version) => {
	return require(resolveSchema(base_version, 'Patient'));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};


const { sendMessage } = require('../../utils/kafkaProducer');


/**
 *
 * @param {*} args
 * @param {*} context
 * @param {*} logger
 */
module.exports.search = (args, { req }) => new Promise((resolve, reject) => {
	logger.info('Patient >>> search');

	let { base_version } = args;
	let query = {};

	if (base_version === VERSIONS['4_0_0']) {
		query = req.query;
	}


	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PATIENT}_${base_version}`);
	let Patient = getPatient(base_version);

	// Query our collection for this observation
	collection.find(query, (err, data) => {
		if (err) {
			logger.error('Error with Patient.search: ', err);
			return reject(err);
		}

		// Patient is a patient cursor, pull documents out before resolving
		data.toArray().then((patients) => {
			patients.forEach(function(element, i, returnArray) {
				returnArray[i] = new Patient(element);
			});
			resolve(patients);
		});
	});
});

module.exports.searchById = (args) => new Promise((resolve, reject) => {
	logger.info('Patient >>> searchById');

	let { base_version, id } = args;
	let Patient = getPatient(base_version);

	if(id.startsWith("Patient-")){
		id = id.split('-')[1];
		console.log("El prefijo de la referencia ha sido eliminado");
	}

	console.log("SearchById: " + id);

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PATIENT}_${base_version}`);
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, patient) => {
		if (err) {
			logger.error('Error with Patient.searchById: ', err);
			return reject(err);
		}
		if (patient) {
			resolve(new Patient(patient));
		}
		resolve();
	});
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info('Patient >>> create');

	let resource = req.body;

	// Check if the resourceType of the message is correct
	if(resource.resourceType != "Patient"){
		return reject(new Error("ERROR: JSON doesn't below to a Patient -> ResourceType of message: " + resource.resourceType))
	}

	let { base_version } = args;

	// Grab an instance of our DB and collection (by version)
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PATIENT}_${base_version}`);

	// Get current record
	let Patient = getPatient(base_version);
	let patient = new Patient(resource);

	// If no resource ID was provided, generate one.
	let id = getUuid(patient);

	// Create the resource's metadata
	let Meta = getMeta(base_version);
	patient.meta = new Meta({versionId: '1', lastUpdated: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ')});

	// Create the document to be inserted into Mongo
	let doc = JSON.parse(JSON.stringify(patient.toJSON()));
	Object.assign(doc, {id: id});

	// Create a clone of the object without the _id parameter before assigning a value to
	// the _id parameter in the original document
	let history_doc = Object.assign({}, doc);
	Object.assign(doc, {_id: id});
	
	try{

	/*
	// Verificación Patient
	doc.StatusKafka = KAFKA.STATUS_CHECK_PERSON;
	var messages = [{
		topic: KAFKA.TOPIC_CREATED_PATIENT,
		messages: [JSON.stringify(doc)], // multi messages should be a array, single message can be just a string or a KeyedMessage instance
		//key: 'theKey', // string or buffer, only needed when using keyed partitioner
		partition: 0, // default 0
		attributes: 0, // default: 0
		timestamp: Date.now() // <-- defaults to Date.now() (only available with kafka v0.10+)
	}];
	sendMessage(messages);


	var client = new kafka.KafkaClient({ kafkaHost: KAFKA_HOST });
	var topics = [{ topic: KAFKA.TOPIC_CREATED_PATIENT, partitions: 1 }, { topic: KAFKA.TOPIC_CREATED_PATIENT, partitions: 0 }];
	var options = { autoCommit: false, fetchMaxWaitMs: 1000, fetchMaxBytes: 1024 * 1024 };

	var consumer = new kafka.Consumer(client, topics, options);

	consumer.on('message', function (message) {
		if(message.topic == KAFKA.TOPIC_CREATED_PATIENT){
			var messageJSON = JSON.parse(message.value);
			if (messageJSON.StatusKafka == KAFKA.STATUS_CHECKED_PERSON && messageJSON.id == doc.id){
				console.log("OK - Se va a crear el paciente pedido");
				setTimeout(() => {
					consumer.commit((error, data) => {
						delete doc.StatusKafka;
						// Insert our patient record
						*/
						collection.insertOne(doc, (err) => {
							if (err) {
								logger.error('Error with Patient.create: ', err);
								return reject(err);
								//consumer.close(funcion);
							}

							// Save the resource to history
							let history_collection = db.collection(`${COLLECTION.PATIENT}_${base_version}_History`);

							// Insert our patient record to history but don't assign _id
							history_collection.insertOne(history_doc, (err2) => {
								if (err2) {
									logger.error('Error with PatientHistory.create: ', err2);
									return reject(err2);
									//consumer.close(funcion);
								}

								return resolve({ id: doc.id, resource_version: doc.meta.versionId });
							});
							//consumer.close(funcion);
						});
						// Here the commit will work as expected

						/*
					});
				}, 0);
			} else if (messageJSON.StatusKafka == KAFKA.STATUS_NOT_CHECKED_PERSON && messageJSON.id == doc.id){
				console.log("ERROR: paciente ya existente o servicio FHIR Person caido");
				var funcion = function () {return reject();}
				consumer.close(funcion);
			}
		}
	});
	
	consumer.on('error', function (err) {
		return reject(err);
	});

	*/
	}catch(e){
		return reject(e)
	}


});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info('Patient >>> update');

	let resource = req.body;

	// Check if the resourceType of the message is correct
	if(resource.resourceType != "Patient"){
		return reject(new Error("ERROR: JSON doesn't below to a Patient -> ResourceType of message: " + resource.resourceType))
	}

	let { base_version, id } = args;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PATIENT}_${base_version}`);

	// Get current record
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, data) => {
		if (err) {
			logger.error('Error with Patient.searchById: ', err);
			return reject(err);
		}

		let Patient = getPatient(base_version);
		let patient = new Patient(resource);

		if (data && data.meta) {
			let foundPatient = new Patient(data);
			let meta = foundPatient.meta;
			meta.versionId = `${parseInt(foundPatient.meta.versionId) + 1}`;
			patient.meta = meta;
		} else {
			let Meta = getMeta(base_version);
			patient.meta = new Meta({versionId: '1', lastUpdated: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ')});
		}

		let cleaned = JSON.parse(JSON.stringify(patient));
		let doc = Object.assign(cleaned, { _id: id });

		// Insert/update our patient record
		collection.findOneAndUpdate({ id: id }, { $set: doc }, { upsert: true }, (err2, res) => {
			if (err2) {
				logger.error('Error with Patient.update: ', err2);
				return reject(err2);
			}

			// save to history
			let history_collection = db.collection(`${COLLECTION.PATIENT}_${base_version}_History`);

			let history_patient = Object.assign(cleaned, { id: id });

			// Insert our patient record to history but don't assign _id
			return history_collection.insertOne(history_patient, (err3) => {
				if (err3) {
					logger.error('Error with PatientHistory.create: ', err3);
					return reject(err3);
				}

				return resolve({ id: id, created: res.lastErrorObject && !res.lastErrorObject.updatedExisting, resource_version: doc.meta.versionId });
			});

		});
	});
});

module.exports.remove = (args, context) => new Promise((resolve, reject) => {
	logger.info('Patient >>> remove');

	let { base_version, id } = args;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PATIENT}_${base_version}`);
	// Delete our patient record
	collection.deleteOne({ id: id }, (err, _) => {
		if (err) {
			logger.error('Error with Patient.remove');
			return reject({
				// Must be 405 (Method Not Allowed) or 409 (Conflict)
				// 405 if you do not want to allow the delete
				// 409 if you can't delete because of referential
				// integrity or some other reason
				code: 409,
				message: err.message
			});
		}

		// delete history as well.  You can chose to save history.  Up to you
		let history_collection = db.collection(`${COLLECTION.PATIENT}_${base_version}_History`);
		return history_collection.deleteMany({ id: id }, (err2) => {
			if (err2) {
				logger.error('Error with Patient.remove');
				return reject({
					// Must be 405 (Method Not Allowed) or 409 (Conflict)
					// 405 if you do not want to allow the delete
					// 409 if you can't delete because of referential
					// integrity or some other reason
					code: 409,
					message: err2.message
				});
			}

			return resolve({ deleted: _.result && _.result.n });
		});

	});
});

module.exports.searchByVersionId = (args, context) => new Promise((resolve, reject) => {
	logger.info('Patient >>> searchByVersionId');

	let { base_version, id, version_id } = args;

	let Patient = getPatient(base_version);

	let db = globals.get(CLIENT_DB);
	let history_collection = db.collection(`${COLLECTION.PATIENT}_${base_version}_History`);

	// Query our collection for this observation
	history_collection.findOne({ id: id.toString(), 'meta.versionId': `${version_id}` }, (err, patient) => {
		if (err) {
			logger.error('Error with Patient.searchByVersionId: ', err);
			return reject(err);
		}

		if (patient) {
			resolve(new Patient(patient));
		}

		resolve();

	});
});

module.exports.history = (args, { req }, context) => new Promise((resolve, reject) => {
	logger.info('Patient >>> history');

	// Common search params
	let { base_version } = args;

	let query = {};

	if (base_version === VERSIONS['4_0_0']) {
		query = req.query;
	}

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let history_collection = db.collection(`${COLLECTION.PATIENT}_${base_version}_History`);
	let Patient = getPatient(base_version);

	// Query our collection for this observation
	history_collection.find(query, (err, data) => {
		if (err) {
			logger.error('Error with Patient.history: ', err);
			return reject(err);
		}

		// Patient is a patient cursor, pull documents out before resolving
		data.toArray().then((patients) => {
			patients.forEach(function(element, i, returnArray) {
				returnArray[i] = new Patient(element);
			});
			resolve(patients);
		});
	});
});

module.exports.historyById = (args, { req }, context) => new Promise((resolve, reject) => {
	logger.info('Patient >>> historyById');

	let { base_version, id } = args;
	let query = {};

	if (base_version === VERSIONS['4_0_0']) {
		query = req.query;
	}

	query.id = `${id}`;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let history_collection = db.collection(`${COLLECTION.PATIENT}_${base_version}_History`);
	let Patient = getPatient(base_version);

	// Query our collection for this observation
	history_collection.find(query, (err, data) => {
		if (err) {
			logger.error('Error with Patient.historyById: ', err);
			return reject(err);
		}

		// Patient is a patient cursor, pull documents out before resolving
		data.toArray().then((patients) => {
			patients.forEach(function(element, i, returnArray) {
				returnArray[i] = new Patient(element);
			});
			resolve(patients);
		});
	});
});

module.exports.patch = (args, context) => new Promise((resolve, reject) => {
	logger.info('Patient >>> patch'); // Should this say update (instead of patch) because the end result is that of an update, not a patch

	let { base_version, id, patchContent } = args;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PATIENT}_${base_version}`);

	// Get current record
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, data) => {
		if (err) {
			logger.error('Error with Patient.searchById: ', err);
			return reject(err);
		}

		// Validate the patch
		let errors = jsonpatch.validate(patchContent, data);
		if (errors && Object.keys(errors).length > 0) {
			logger.error('Error with patch contents');
			return reject(errors);
		}
		// Make the changes indicated in the patch
		let resource = jsonpatch.applyPatch(data, patchContent).newDocument;

		let Patient = getPatient(base_version);
		let patient = new Patient(resource);

		if (data && data.meta) {
			let foundPatient = new Patient(data);
			let meta = foundPatient.meta;
			meta.versionId = `${parseInt(foundPatient.meta.versionId) + 1}`;
			patient.meta = meta;
		} else {
			return reject('Unable to patch resource. Missing either data or metadata.');
		}

		// Same as update from this point on
		let cleaned = JSON.parse(JSON.stringify(patient));
		let doc = Object.assign(cleaned, { _id: id });

		// Insert/update our patient record
		collection.findOneAndUpdate({ id: id }, { $set: doc }, { upsert: true }, (err2, res) => {
			if (err2) {
				logger.error('Error with Patient.update: ', err2);
				return reject(err2);
			}

			// Save to history
			let history_collection = db.collection(`${COLLECTION.PATIENT}_${base_version}_History`);
			let history_patient = Object.assign(cleaned, { _id: id + cleaned.meta.versionId });

			// Insert our patient record to history but don't assign _id
			return history_collection.insertOne(history_patient, (err3) => {
				if (err3) {
					logger.error('Error with PatientHistory.create: ', err3);
					return reject(err3);
				}

				return resolve({ id: doc.id, created: res.lastErrorObject && !res.lastErrorObject.updatedExisting, resource_version: doc.meta.versionId });
			});
		});
	});
});

module.exports.displayById = (args) => new Promise((resolve, reject) => {
	logger.info('Patient >>> displayById');

	let { base_version, id } = args;
	let Patient = getPatient(base_version);

	if(id.startsWith("Patient-")){
		id = id.split('-')[1];
		console.log("El prefijo de la referencia ha sido eliminado");
	}

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PATIENT}_${base_version}`);
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, patient) => {
		if (err) {
			logger.error('Error with Patient.displayById: ', err);
			return reject(err);
		}
		if (patient) {

			let fullName = "";
			if (patient.name.length > 0){
				if (patient.name[0].given.length > 0) fullName += patient.name[0].given.join(' ') + " ";
				if (patient.name[0].family) fullName += patient.name[0].family;
			}

			resolve({
				id : patient.id,
				display : fullName
			});
		}
		resolve();
	});
});

module.exports.displayByList = (args) => new Promise((resolve, reject) => {
	logger.info('Patient >>> displayById');

	let { base_version } = args;
	let idList = JSON.parse(args.id); // args.id esperado: "[Patient-111,Patient-222,...,Patient-nnn]"
	let Patient = getPatient(base_version);

	for (let index = 0; index < idList.length; index++) {
		if(idList[index].startsWith("Patient-")){
			idList[index] = idList[index].split('-')[1];
			console.log("El prefijo de una de las referencias ha sido eliminado");
		}
	}

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PATIENT}_${base_version}`);
	// Query our collection for this observation
	
	console.log(idList);

	
	collection.find({id : {$in: idList}}).toArray().then((docs) => {
		let displayList = [];

		for (let index = 0; index < docs.length; index++) {

			let fullName = "";
			if (docs[index].name.length > 0){
				if (docs[index].name[0].given.length > 0) fullName += docs[index].name[0].given.join(' ') + " ";
				if (docs[index].name[0].family) fullName += docs[index].name[0].family;
			}

			displayList.push({
				id: docs[index].id,
				display: fullName
			});
		}

		resolve(displayList);
	});

});


