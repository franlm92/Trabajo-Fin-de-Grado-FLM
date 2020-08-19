var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27021";

const searchBtn = document.getElementById("searchAgent");

// Search user
searchBtn.onclick = function findUser() {
    MongoClient.connect(url, function(err, db) {

        window.agentName = document.getElementById("agentName").value
        window.agentPass = document.getElementById("agentPass").value;

        var query = { "name.given": agentName, "pass": agentPass };

        if (err) throw err;
        var dbo = db.db("fhir");
        dbo.collection("Patient_4_0_0").findOne(query, function(err, result) {
            if (err) throw err;
            if (result != null && result != "") {
                alert("¡Bienvenido " + agentName + "!");
                document.getElementById("startCast").removeAttribute("disabled");
                document.getElementById("searchAgent").setAttribute("disabled", "disabled");
                document.getElementById("agentName").setAttribute("disabled", "disabled");
                document.getElementById("agentPass").setAttribute("disabled", "disabled");
            }
            db.close();
        });

    });
}