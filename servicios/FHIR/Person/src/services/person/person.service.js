/*eslint no-unused-vars: "warn"*/

const { VERSIONS } = require('@asymmetrik/node-fhir-server-core').constants;
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { COLLECTION, CLIENT_DB, KAFKA } = require('../../constants');
const moment = require('moment-timezone');
const globals = require('../../globals');
const jsonpatch = require('fast-json-patch');

const { getUuid } = require('../../utils/uid.util');

const logger = require('@asymmetrik/node-fhir-server-core').loggers.get();

const{ sendMessage } = require("../../utils/kafkaProducer");

let getPerson = (base_version) => {
	return require(resolveSchema(base_version, 'Person'));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

/**
 *
 * @param {*} args
 * @param {*} context
 * @param {*} logger
 */
module.exports.search = (args, { req }) => new Promise((resolve, reject) => {
	logger.info('Person >>> search');


	let { base_version } = args;
	let query = {};

	if (base_version === VERSIONS['4_0_0']) {
		query = req.query;
	}

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PERSON}_${base_version}`);
	let Person = getPerson(base_version);


	// Query our collection for this observation
	collection.find(query, (err, data) => {
		if (err) {
			logger.error('Error with Person.search: ', err);
			return reject(err);
		}

		// Patient is a patient cursor, pull documents out before resolving
		data.toArray().then((persons) => {
			persons.forEach(function(element, i, returnArray) {
				returnArray[i] = new Person(element);
			});
			resolve(persons);
		});
	});
});

module.exports.searchById = (args) => new Promise((resolve, reject) => {
	logger.info('Person >>> searchById');

	let { base_version, id } = args;
	let Person = getPerson(base_version);

	if(id.startsWith("Person-")){
		id = id.split('-')[1];
		console.log("El prefijo de la referencia ha sido eliminado");
	}

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PERSON}_${base_version}`);
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, person) => {
		if (err) {
			logger.error('Error with Patient.searchById: ', err);
			return reject(err);
		}
		if (person) {
			resolve(new Person(person));
		}
		resolve();
	});
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info('Person >>> create');

	let resource = req.body;

	// Check if the resourceType of the message is correct
	if(resource.resourceType != "Person"){
		return reject(new Error("ERROR: JSON doesn't below to a Person -> ResourceType of message: " + resource.resourceType))
	}

	let { base_version } = args;

	// Grab an instance of our DB and collection (by version)
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PERSON}_${base_version}`);

	// Get current record
	let Person = getPerson(base_version);
	let person = new Person(resource);

	// If no resource ID was provided, generate one.
	let id = getUuid(person);

	// Create the resource's metadata
	let Meta = getMeta(base_version);
	person.meta = new Meta({versionId: '1', lastUpdated: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ')});

	// Create the document to be inserted into Mongo
	let doc = JSON.parse(JSON.stringify(person.toJSON()));
	Object.assign(doc, {id: id});

	// Create a clone of the object without the _id parameter before assigning a value to
	// the _id parameter in the original document
	let history_doc = Object.assign({}, doc);
	Object.assign(doc, {_id: id});

	// Insert our person record
	collection.insertOne(doc, (err) => {
		if (err) {
			logger.error('Error with Person.create: ', err);
			return reject(err);
		}

		// Save the resource to history
		let history_collection = db.collection(`${COLLECTION.PERSON}_${base_version}_History`);

		// Insert our person record to history but don't assign _id
		return history_collection.insertOne(history_doc, (err2) => {
			if (err2) {
				logger.error('Error with PersonHistory.create: ', err2);
				return reject(err2);
			}
			return resolve({ id: doc.id, resource_version: doc.meta.versionId });
		});
	});


});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info('Person >>> update');

	let resource = req.body;

	// Check if the resourceType of the message is correct
	if(resource.resourceType != "Person"){
		return reject(new Error("ERROR: JSON doesn't below to a Person -> ResourceType of message: " + resource.resourceType))
	}

	let { base_version, id } = args;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PERSON}_${base_version}`);

	// Get current record
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, data) => {
		if (err) {
			logger.error('Error with Person.searchById: ', err);
			return reject(err);
		}

		let Person = getPerson(base_version);
		let person = new Person(resource);

		if (data && data.meta) {
			let foundPerson = new Person(data);
			let meta = foundPerson.meta;
			meta.versionId = `${parseInt(foundPerson.meta.versionId) + 1}`;
			person.meta = meta;
		} else {
			let Meta = getMeta(base_version);
			person.meta = new Meta({versionId: '1', lastUpdated: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ')});
		}

		let cleaned = JSON.parse(JSON.stringify(person));
		let doc = Object.assign(cleaned, { _id: id });

		// Insert/update our person record
		collection.findOneAndUpdate({ id: id }, { $set: doc }, { upsert: true }, (err2, res) => {
			if (err2) {
				logger.error('Error with Person.update: ', err2);
				return reject(err2);
			}

			// save to history
			let history_collection = db.collection(`${COLLECTION.PERSON}_${base_version}_History`);

			let history_person = Object.assign(cleaned, { id: id });

			// Insert our person record to history but don't assign _id
			return history_collection.insertOne(history_person, (err3) => {
				if (err3) {
					logger.error('Error with PersonHistory.create: ', err3);
					return reject(err3);
				}

				return resolve({ id: id, created: res.lastErrorObject && !res.lastErrorObject.updatedExisting, resource_version: doc.meta.versionId });
			});

		});
	});
});

module.exports.remove = (args, context) => new Promise((resolve, reject) => {
	logger.info('Person >>> remove');

	let { base_version, id } = args;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PERSON}_${base_version}`);
	// Delete our peson record
	collection.deleteOne({ id: id }, (err, _) => {
		if (err) {
			logger.error('Error with Person.remove');
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
		let history_collection = db.collection(`${COLLECTION.PERSON}_${base_version}_History`);
		return history_collection.deleteMany({ id: id }, (err2) => {
			if (err2) {
				logger.error('Error with Person.remove');
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
	logger.info('Person >>> searchByVersionId');

	let { base_version, id, version_id } = args;

	let Person = getPerson(base_version);

	let db = globals.get(CLIENT_DB);
	let history_collection = db.collection(`${COLLECTION.PERSON}_${base_version}_History`);

	// Query our collection for this observation
	history_collection.findOne({ id: id.toString(), 'meta.versionId': `${version_id}` }, (err, patient) => {
		if (err) {
			logger.error('Error with Person.searchByVersionId: ', err);
			return reject(err);
		}

		if (person) {
			resolve(new Person(person));
		}

		resolve();

	});
});

module.exports.history = (args, { req }, context) => new Promise((resolve, reject) => {
	logger.info('Person >>> history');

	// Common search params
	let { base_version } = args;

	let query = {};

	if (base_version === VERSIONS['4_0_0']) {
		query = req.query;
	}

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let history_collection = db.collection(`${COLLECTION.PERSON}_${base_version}_History`);
	let Person = getPerson(base_version);

	// Query our collection for this observation
	history_collection.find(query, (err, data) => {
		if (err) {
			logger.error('Error with Person.history: ', err);
			return reject(err);
		}

		// Person is a person cursor, pull documents out before resolving
		data.toArray().then((persons) => {
			persons.forEach(function(element, i, returnArray) {
				returnArray[i] = new Person(element);
			});
			resolve(persons);
		});
	});

});

module.exports.historyById = (args, { req }, context) => new Promise((resolve, reject) => {
	logger.info('Person >>> historyById');

	let { base_version, id } = args;
	let query = {};

	if (base_version === VERSIONS['4_0_0']) {
		query = req.query;
	}

	query.id = `${id}`;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let history_collection = db.collection(`${COLLECTION.PERSON}_${base_version}_History`);
	let Person = getPerson(base_version);

	// Query our collection for this observation
	history_collection.find(query, (err, data) => {
		if (err) {
			logger.error('Error with Person.historyById: ', err);
			return reject(err);
		}

		// Person is a person cursor, pull documents out before resolving
		data.toArray().then((persons) => {
			persons.forEach(function(element, i, returnArray) {
				returnArray[i] = new Person(element);
			});
			resolve(persons);
		});
	});
});


module.exports.patch = (args, context) => new Promise((resolve, reject) => {
	logger.info('Person >>> patch'); // Should this say update (instead of patch) because the end result is that of an update, not a patch

	let { base_version, id, patchContent } = args;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PERSON}_${base_version}`);

	// Get current record
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, data) => {
		if (err) {
			logger.error('Error with Person.searchById: ', err);
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

		let Person = getPerson(base_version);
		let person = new Person(resource);

		if (data && data.meta) {
			let foundPerson = new Person(data);
			let meta = foundPerson.meta;
			meta.versionId = `${parseInt(foundPerson.meta.versionId) + 1}`;
			person.meta = meta;
		} else {
			return reject('Unable to patch resource. Missing either data or metadata.');
		}

		// Same as update from this point on
		let cleaned = JSON.parse(JSON.stringify(person));
		let doc = Object.assign(cleaned, { _id: id });

		// Insert/update our person record
		collection.findOneAndUpdate({ id: id }, { $set: doc }, { upsert: true }, (err2, res) => {
			if (err2) {
				logger.error('Error with Person.update: ', err2);
				return reject(err2);
			}

			// Save to history
			let history_collection = db.collection(`${COLLECTION.PERSON}_${base_version}_History`);
			let history_person = Object.assign(cleaned, { _id: id + cleaned.meta.versionId });

			// Insert our person record to history but don't assign _id
			return history_collection.insertOne(history_person, (err3) => {
				if (err3) {
					logger.error('Error with PersonHistory.create: ', err3);
					return reject(err3);
				}

				return resolve({ id: doc.id, created: res.lastErrorObject && !res.lastErrorObject.updatedExisting, resource_version: doc.meta.versionId });
			});
		});
	});
});

module.exports.obj = (args, { req }) => {
logger.info('Running Patient obj operation');
return new Promise((resolve, reject) => {
	// execute whatever custom operation you want.

	this.search(args,{req}).then(
		(response) => {
			
			let list = new Array(response.length);

			for (let index = 0; index < list.length; index++) {
				let obj = {
					id:response[index].id,
					gender:response[index].gender,
					birthDate:response[index].birthDate
				}
				list[index] = obj;		
			}
			
			resolve(list);
		},
		(error) => {
			reject(error);
		}
	);

	
	});
};

module.exports.objById = (args) => {
logger.info(`Running Patient /:id/objById`)
return new Promise((resolve, reject) => {
	this.searchById(args).then(
		(response) => {
			
			let obj = {
				id:response.id,
				gender:response.gender,
				birthDate:response.birthDate
			}
			
			resolve(obj);
		},
		(error) => {
			reject(error);
		}
	);
});
}

// Stores Obj, returns FHIR
module.exports.searchFromMinimal = (args, { req }) => new Promise((resolve, reject) => {

	logger.info('Person >>> searchFromMinimal');

	let { base_version } = args;
	let query = {};

	if (base_version === VERSIONS['4_0_0']) {
		query = req.query;
	}

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PERSON}_Minimal`);
	let Person = getPerson(base_version);

	// Query our collection for this observation
	collection.find(query, (err, data) => {
		if (err) {
			logger.error('Error with Person.searchMinimal: ', err);
			return reject(err);
		}

		// Patient is a patient cursor, pull documents out before resolving
		data.toArray().then((persons) => {
			persons.forEach(function(element, i, returnArray) {
				returnArray[i] = new Person(fromObjToFhir(element));
			});
			resolve(persons);
		});
	});
});

// Stores Obj, returns FHIR
module.exports.searchByIdFromMinimal = (args) => new Promise((resolve, reject) => {
	logger.info('Person >>> searchByIdFromMinimal');

	let { base_version, id } = args;
	let Person = getPerson(base_version);

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PERSON}_Minimal`);
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, person) => {
		if (err) {
			logger.error('Error with Patient.searchMinimalById: ', err);
			return reject(err);
		}
		if (person) {
			resolve(new Person(fromObjToFhir(person)));
		}
		resolve();
	});
});

// Receives FHIR, stores Obj
module.exports.createToMinimal = (args, { req }) => new Promise((resolve, reject) => {
	logger.info('Person >>> createToMinimal');

	let resource = req.body;

	// Check if the resourceType of the message is correct
	if(resource.resourceType != "Person"){
		return reject(new Error("ERROR: JSON doesn't below to a Person -> ResourceType of message: " + resource.resourceType))
	}

	let { base_version } = args;

	// Grab an instance of our DB and collection (by version)
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.PERSON}_Minimal`);

	// Get current record
	let Person = getPerson(base_version);

	let person = new Person(resource);

	// If no resource ID was provided, generate one.
	let id = getUuid(person);
	person.id = id;

	// Create the resource's metadata
	let Meta = getMeta(base_version);
	person.meta = new Meta({versionId: '1', lastUpdated: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ')});

	person = fromFhirToObj(person);

	// Create the document to be inserted into Mongo
	let doc = JSON.parse(JSON.stringify(person));
	Object.assign(doc, {id: id});

	// Create a clone of the object without the _id parameter before assigning a value to
	// the _id parameter in the original document
	let history_doc = Object.assign({}, doc);
	Object.assign(doc, {_id: id});

	// Insert our person record
	collection.insertOne(doc, (err) => {
		if (err) {
			logger.error('Error with Person.createMinimal: ', err);
			return reject(err);
		}

		// Save the resource to history
		let history_collection = db.collection(`${COLLECTION.PERSON}_Minimal_History`);

		// Insert our person record to history but don't assign _id
		return history_collection.insertOne(history_doc, (err2) => {
			if (err2) {
				logger.error('Error with PersonHistory.createMinimal: ', err2);
				return reject(err2);
			}
			return resolve({ id: doc.id, resource_version: doc.meta.versionId });
		});
	});
});

fromFhirToObj = (FhirPerson) => {

    let p = {};

	p.id = FhirPerson.id;
	
	// NEW
	p.meta = FhirPerson.meta;

    p.birthDate = new Date(FhirPerson.birthDate);
    
    p.email = "-";
    for (let index = 0; index < FhirPerson.telecom.length; index++) {
      if (FhirPerson.telecom[index].system == "email"){
        p.email = FhirPerson.telecom[index].value;
      }
    }

    p.firstName = "";
    for (let index = 0; index < FhirPerson.name[0].given.length; index++) {
      if (index > 0) p.firstName += " ";
      p.firstName += FhirPerson.name[0].given[index];
    }

    p.lastName = FhirPerson.name[0].family;
    
    switch(FhirPerson.gender){
      case 'male':
        p.gender = 'Hombre';
      break;
      case 'female':
        p.gender = 'Mujer';
      break;
      case 'unknown':
        p.gender = 'Desconocido';
      break;
      default:
        p.gender = 'Otro';
      break
    }

    if (FhirPerson.address && FhirPerson.address.length > 0){
      p.address = FhirPerson.address[0].text;
	}

    return p;
  }
  
  fromObjToFhir = (persona) => {
    let p = {resourceType:'Person'};

	p.id = persona.id;
	
	// NEW
	p.meta = persona.meta;

    let givenName = persona.firstName.split(' '); // 'José Manuel' => ['José', 'Manuel']

    let humanName = {
      use : 'official',
      given : givenName,
      family : persona.lastName
    };

    p.name = [];
    p.name.push(humanName);

    let phoneContactPoint = {
      use : 'mobile',
      system : 'phone',
      value : persona.phone
    }

    let emailContactPoint = {
      use : 'home',
      system : 'email',
      value : persona.email
    }

    p.telecom = [];
    p.telecom.push(phoneContactPoint);
    p.telecom.push(emailContactPoint);

    p.birthDate = persona.birthDate.toString();

    if (persona.gender != null){
      switch(persona.gender.toLowerCase()){
        case 'man' || 'male' || 'hombre' || 'varon':
          p.gender = 'male';
        break;
        case 'woman' || 'female' || 'mujer' || 'hembra':
          p.gender = 'female';
        break;
        case '' || 'unknown' || 'desconocido':
          p.gender = 'unknown';
        break;
        default:
          p.gender = 'other';
        break
      }
    }

    // ADDRESS (TO DO)
    let tempAddress = {};
    tempAddress.country = "País feliz";
    tempAddress.text = "Calle de la piruleta, Casa de gominola";

    p.address = [];
    p.address.push(tempAddress);

    return p;
}
