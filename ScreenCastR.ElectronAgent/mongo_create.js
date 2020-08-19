var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27021";

const saveBtn = document.getElementById("saveAgent");
const backBtn = document.getElementById("goBack");

// Create user
saveBtn.onclick = function createNewUser() {

    let allAreFilled = true;
    document.getElementById("myForm").querySelectorAll("[required]").forEach(function(i) {
        if (!allAreFilled) return;
        if (!i.value) allAreFilled = false;
    })
    if (!allAreFilled) {
        alert('Por favor, rellene todos los campos.');
    } else {
        MongoClient.connect(url, function(err, db) {

            window.newSurname = document.getElementById("newSurname").value;
            window.newName = document.getElementById("newName").value;
            window.newPhone = document.getElementById("newPhone").value;
            window.newGender = document.getElementById("newGender").value;
            window.newBirthDate = document.getElementById("newBirthDate").value;
            window.newPass = document.getElementById("newPass").value;

            var newUser = {
                "resourceType": "Patient",
                "name": [{
                        "use": "official",
                        "family": newSurname,
                        "given": [
                            newName
                        ]
                    },
                    {
                        "use": "usual",
                        "given": [
                            newName
                        ]
                    }
                ],
                "telecom": [{
                    "system": "phone",
                    "value": newPhone,
                    "use": "mobile",
                    "rank": 2
                }],
                "gender": newGender,
                "birthDate": newBirthDate,
                "pass": newPass
            }

            if (err) throw err;
            var dbo = db.db("fhir");
            dbo.collection("Patient_4_0_0").insertOne(newUser, function(err, result) {
                if (err) throw err;
                if (result != null && result != "") {
                    alert("¡Usuario creado con éxito!");
                    window.location.replace("index.html");
                }
                db.close();
            });
        });
    }
}

backBtn.onclick = function backToLogin() {
    window.location.replace("index.html");
};