
var utilsDB = require('./utils');

var db = utilsDB.getDbConnection();
var usersCollection;

db.createCollection('users', function(err, collection){
    if(err){
        console.log('Error creating users collection');
    } else {
        usersCollection = collection;
        console.log('Collection created');
    }
})