/*eslint no-unused-vars: "warn"*/

const { VERSIONS } = require('@asymmetrik/node-fhir-server-core').constants;
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { COLLECTION, CLIENT_DB } = require('../../constants');
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


let getPractitioner = (base_version) => {
	return require(resolveSchema(base_version, 'Practitioner'));};

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
	logger.info('Practitioner >>> search');

	let { base_version } = args;
	let query = {};

	if (base_version === VERSIONS['4_0_0']) {
		query = req.query;
	}


	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}`);
	let Practitioner = getPractitioner(base_version);

	// Query our collection for this observation
	collection.find(query, (err, data) => {
		if (err) {
			logger.error('Error with Practitioner.search: ', err);
			return reject(err);
		}

		// Practitioner is a practitioner cursor, pull documents out before resolving
		data.toArray().then((practitioners) => {
			practitioners.forEach(function(element, i, returnArray) {
				returnArray[i] = new Practitioner(element);
			});
			resolve(practitioners);
		});
	});
});

module.exports.searchById = (args) => new Promise((resolve, reject) => {
	logger.info('Practitioner >>> searchById');

	let { base_version, id } = args;
	let Practitioner = getPractitioner(base_version);

	if(id.startsWith("Practitioner-")){
		id = id.split('-')[1];
		console.log("El prefijo de la referencia ha sido eliminado");
	}

	console.log("SearchById: " + id);

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}`);
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, practitioner) => {
		if (err) {
			logger.error('Error with Practitioner.searchById: ', err);
			return reject(err);
		}
		if (practitioner) {
			resolve(new Practitioner(practitioner));
		}
		resolve();
	});
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info('Practitioner >>> create');

	let resource = req.body;

	// Check if the resourceType of the message is correct
	if(resource.resourceType != "Practitioner"){
		return reject(new Error("ERROR: JSON doesn't below to a Practitioner -> ResourceType of message: " + resource.resourceType))
	}

	let { base_version } = args;

	// Grab an instance of our DB and collection (by version)
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}`);

	// Get current record
	let Practitioner = getPractitioner(base_version);
	let practitioner = new Practitioner(resource);

	// If no resource ID was provided, generate one.
	let id = getUuid(practitioner);

	// Create the resource's metadata
	let Meta = getMeta(base_version);
	practitioner.meta = new Meta({versionId: '1', lastUpdated: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ')});

	// Create the document to be inserted into Mongo
	let doc = JSON.parse(JSON.stringify(practitioner.toJSON()));
	Object.assign(doc, {id: id});

	// Create a clone of the object without the _id parameter before assigning a value to
	// the _id parameter in the original document
	let history_doc = Object.assign({}, doc);
	Object.assign(doc, {_id: id});
	
	try{
	/*
	doc.StatusKafka = 'CheckPerson-Practitioner';
	// Notificación de que se va a crear un paciente nuevo
	var messages = [{
		topic: 'createdPractitioner',
		messages: [JSON.stringify(doc)], // multi messages should be a array, single message can be just a string or a KeyedMessage instance
		//key: 'theKey', // string or buffer, only needed when using keyed partitioner
		partition: 0, // default 0
		attributes: 0, // default: 0
		timestamp: Date.now() // <-- defaults to Date.now() (only available with kafka v0.10+)
	}]

	sendMessage(messages);

	var client = new kafka.KafkaClient({ kafkaHost: KAFKA_HOST });
	var topics = [{ topic: 'createdPractitioner', partitions: 1 }, { topic: 'createdPractitioner', partitions: 0 }];
	var options = { autoCommit: false, fetchMaxWaitMs: 1000, fetchMaxBytes: 1024 * 1024 };

	var consumer = new kafka.Consumer(client, topics, options);

	consumer.on('message', function (message) {
		if(message.topic == 'createdPractitioner'){
			var messageJSON = JSON.parse(message.value);
			if (messageJSON.StatusKafka == 'CheckedPerson-Person' && messageJSON.id == doc.id){
				console.log("OK - Se va a crear el paciente pedido");
				setTimeout(() => {
					consumer.commit((error, data) => {
						delete doc.StatusKafka;
						*/
						// Insert our practitioner record
						collection.insertOne(doc, (err) => {

							if (err) {
								logger.error('Error with Practitioner.create: ', err);
								return reject(err);
								/*
								var funcion = function () {}
								consumer.close(funcion);
								*/
							}

							// Save the resource to history
							let history_collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}_History`);

							// Insert our practitioner record to history but don't assign _id
							return history_collection.insertOne(history_doc, (err2) => {
								if (err2) {
									logger.error('Error with PractitionerHistory.create: ', err2);
									return reject(err2);
								}

								return resolve({ id: doc.id, resource_version: doc.meta.versionId });
							});
							/*
							var funcion = function () {return history_collection.insertOne(history_doc, (err2) => {
								if (err2) {
									logger.error('Error with PractitionerHistory.create: ', err2);
									return reject(err2);

									var funcion = function () {return reject(err2);}
									consumer.close(funcion);
								}

								return resolve({ id: doc.id, resource_version: doc.meta.versionId });
							});}
							consumer.close(funcion);
							*/
						});
						// Here the commit will work as expected

						/*
					});
				}, 0);
			} else if (messageJSON.StatusKafka == 'NotCheckedPerson-Person' && messageJSON.id == doc.id){
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
	logger.info('Practitioner >>> update');

	let resource = req.body;

	// Check if the resourceType of the message is correct
	if(resource.resourceType != "Practitioner"){
		return reject(new Error("ERROR: JSON doesn't below to a Practitioner -> ResourceType of message: " + resource.resourceType))
	}

	let { base_version, id } = args;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}`);

	// Get current record
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, data) => {
		if (err) {
			logger.error('Error with Practitioner.searchById: ', err);
			return reject(err);
		}

		let Practitioner = getPractitioner(base_version);
		let practitioner = new Practitioner(resource);

		if (data && data.meta) {
			let foundPractitioner = new Practitioner(data);
			let meta = foundPractitioner.meta;
			meta.versionId = `${parseInt(foundPractitioner.meta.versionId) + 1}`;
			practitioner.meta = meta;
		} else {
			let Meta = getMeta(base_version);
			practitioner.meta = new Meta({versionId: '1', lastUpdated: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ')});
		}

		let cleaned = JSON.parse(JSON.stringify(practitioner));
		let doc = Object.assign(cleaned, { _id: id });

		// Insert/update our practitioner record
		collection.findOneAndUpdate({ id: id }, { $set: doc }, { upsert: true }, (err2, res) => {
			if (err2) {
				logger.error('Error with Practitioner.update: ', err2);
				return reject(err2);
			}

			// save to history
			let history_collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}_History`);

			let history_practitioner = Object.assign(cleaned, { id: id });

			// Insert our practitioner record to history but don't assign _id
			return history_collection.insertOne(history_practitioner, (err3) => {
				if (err3) {
					logger.error('Error with PractitionerHistory.create: ', err3);
					return reject(err3);
				}

				return resolve({ id: id, created: res.lastErrorObject && !res.lastErrorObject.updatedExisting, resource_version: doc.meta.versionId });
			});

		});
	});
});

module.exports.remove = (args, context) => new Promise((resolve, reject) => {
	logger.info('Practitioner >>> remove');

	let { base_version, id } = args;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}`);
	// Delete our practitioner record
	collection.deleteOne({ id: id }, (err, _) => {
		if (err) {
			logger.error('Error with Practitioner.remove');
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
		let history_collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}_History`);
		return history_collection.deleteMany({ id: id }, (err2) => {
			if (err2) {
				logger.error('Error with Practitioner.remove');
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
	logger.info('Practitioner >>> searchByVersionId');

	let { base_version, id, version_id } = args;

	let Practitioner = getPractitioner(base_version);

	let db = globals.get(CLIENT_DB);
	let history_collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}_History`);

	// Query our collection for this observation
	history_collection.findOne({ id: id.toString(), 'meta.versionId': `${version_id}` }, (err, practitioner) => {
		if (err) {
			logger.error('Error with Practitioner.searchByVersionId: ', err);
			return reject(err);
		}

		if (practitioner) {
			resolve(new Practitioner(practitioner));
		}

		resolve();

	});
});

module.exports.history = (args, { req }, context) => new Promise((resolve, reject) => {
	logger.info('Practitioner >>> history');

	// Common search params
	let { base_version } = args;

	let query = {};

	if (base_version === VERSIONS['4_0_0']) {
		query = req.query;
	}

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let history_collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}_History`);
	let Practitioner = getPractitioner(base_version);

	// Query our collection for this observation
	history_collection.find(query, (err, data) => {
		if (err) {
			logger.error('Error with Practitioner.history: ', err);
			return reject(err);
		}

		// Practitioner is a practitioner cursor, pull documents out before resolving
		data.toArray().then((practitioners) => {
			practitioners.forEach(function(element, i, returnArray) {
				returnArray[i] = new Practitioner(element);
			});
			resolve(practitioners);
		});
	});
});

module.exports.historyById = (args, { req }, context) => new Promise((resolve, reject) => {
	logger.info('Practitioner >>> historyById');

	let { base_version, id } = args;
	let query = {};

	if (base_version === VERSIONS['4_0_0']) {
		query = req.query;
	}

	query.id = `${id}`;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let history_collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}_History`);
	let Practitioner = getPractitioner(base_version);

	// Query our collection for this observation
	history_collection.find(query, (err, data) => {
		if (err) {
			logger.error('Error with Practitioner.historyById: ', err);
			return reject(err);
		}

		// Practitioner is a practitioner cursor, pull documents out before resolving
		data.toArray().then((practitioners) => {
			practitioners.forEach(function(element, i, returnArray) {
				returnArray[i] = new Practitioner(element);
			});
			resolve(practitioners);
		});
	});
});

module.exports.patch = (args, context) => new Promise((resolve, reject) => {
	logger.info('Practitioner >>> patch'); // Should this say update (instead of patch) because the end result is that of an update, not a patch

	let { base_version, id, patchContent } = args;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}`);

	// Get current record
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, data) => {
		if (err) {
			logger.error('Error with Practitioner.searchById: ', err);
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

		let Practitioner = getPractitioner(base_version);
		let practitioner = new Practitioner(resource);

		if (data && data.meta) {
			let foundPractitioner = new Practitioner(data);
			let meta = foundPractitioner.meta;
			meta.versionId = `${parseInt(foundPractitioner.meta.versionId) + 1}`;
			practitioner.meta = meta;
		} else {
			return reject('Unable to patch resource. Missing either data or metadata.');
		}

		// Same as update from this point on
		let cleaned = JSON.parse(JSON.stringify(practitioner));
		let doc = Object.assign(cleaned, { _id: id });

		// Insert/update our practitioner record
		collection.findOneAndUpdate({ id: id }, { $set: doc }, { upsert: true }, (err2, res) => {
			if (err2) {
				logger.error('Error with Practitioner.update: ', err2);
				return reject(err2);
			}

			// Save to history
			let history_collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}_History`);
			let history_practitioner = Object.assign(cleaned, { _id: id + cleaned.meta.versionId });

			// Insert our practitioner record to history but don't assign _id
			return history_collection.insertOne(history_practitioner, (err3) => {
				if (err3) {
					logger.error('Error with PractitionerHistory.create: ', err3);
					return reject(err3);
				}

				return resolve({ id: doc.id, created: res.lastErrorObject && !res.lastErrorObject.updatedExisting, resource_version: doc.meta.versionId });
			});
		});
	});
});

module.exports.displayById = (args) => new Promise((resolve, reject) => {
	logger.info('Practitioner >>> displayById');

	let { base_version, id } = args;
	let Practitioner = getPractitioner(base_version);

	if(id.startsWith("Practitioner-")){
		id = id.split('-')[1];
		console.log("El prefijo de la referencia ha sido eliminado");
	}

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}`);
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, practitioner) => {
		if (err) {
			logger.error('Error with Practitioner.displayById: ', err);
			return reject(err);
		}
		if (practitioner) {

			let fullName = "";
			if (practitioner.name.length > 0){
				if (practitioner.name[0].given.length > 0) fullName += practitioner.name[0].given.join(" ") + " ";
				if (practitioner.name[0].family) fullName += practitioner.name[0].family;
			}

			resolve({
				id : practitioner.id,
				display : fullName
			});
		}
		resolve();
	});
});


module.exports.displayByList = (args) => new Promise((resolve, reject) => {
	logger.info('Practitioner >>> displayById');

	let { base_version } = args;
	let idList = JSON.parse(args.id); // args.id esperado: "[Practitioner-111,Practitioner-222,...,Practitioner-nnn]"
	let Practitioner = getPractitioner(base_version);

	for (let index = 0; index < idList.length; index++) {
		if(idList[index].startsWith("Practitioner-")){
			idList[index] = idList[index].split('-')[1];
			console.log("El prefijo de una de las referencias ha sido eliminado");
		}
	}

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PRACTITIONER}_${base_version}`);
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