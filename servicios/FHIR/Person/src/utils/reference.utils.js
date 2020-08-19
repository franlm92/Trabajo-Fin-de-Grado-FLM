const { VALIDABLE_RESOURCES } = require('../constants');

module.exports = {
    FindReferences,
    HasTheseRefs
}

// var referencesFound = [];

// Recursiva
function FindReferences(data, referencesFound) {

    if (Array.isArray(data)) {

        //console.log("It's an array");

        // It is array
        var count;
        for (count = 0; count < data.length; count++) {
            FindReferences(data[count], referencesFound)
        }
    }
    else if (data !== null && typeof (data) === 'object') {

        //console.log("It's an object");

        // It is object
        for (var k in data) {
            FindReferences(data[k], referencesFound)
        }

    } else if (typeof (data) === 'string') {

        //console.log("It's a value! -> " + data);

        // It is a strig
        if (isReference(data)) {
            //console.log("\tHay que validar una referencia a " + data.split('-')[0]);
            referencesFound.push(data);
        }

    }
}

function isReference(value) {

    //console.log("Is " + value + " a reference?");

    // Assuming a reference always will folow this format: Resource/id
    if (VALIDABLE_RESOURCES.includes(value.split("-")[0]) && value.split("-")[1] != null && value.split("-")[2] == null) return true;
    else return false;

}

// Filter a list of objects with only the ones that contains at least one of the given references
function HasTheseRefs(obj,refs){
    console.log("Se va a comprobar si en el objeto aparecen las referencias ", refs);
    let referencesFound = new Array();
    FindReferences(obj,referencesFound);

    for (let i = 0; i < refs.length; i++) {
        if (referencesFound.includes(refs[i])){
            console.log("El objeto incluye la referencia " + refs[i]);
            return true;
        }
    }

    console.log("Ninguna de esas referencias aparece en el objeto");
    return false;
}