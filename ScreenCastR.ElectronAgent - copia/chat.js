//"use strict";

//var connection = new signalR.HubConnectionBuilder().withUrl("https://localhost:5001/ScreenCastHub").build();

//Disable send button until connection is established
//document.getElementById("sendButton").disabled = true;

connection.on("ReceiveMessage", function (user, message) {
    if (message == "#image_01#") {
        var li = document.createElement("li");
        li.innerHTML = "<img height=\"30\" width=\"30\" src=\"https://localhost:5001/img/image_01.jpg\" />";
        var lastStatus = document.getElementById("lastStatus");
        lastStatus.innerHTML="<img height=\"90\" width=\"90\" src=\"https://localhost:5001/img/image_01.jpg\" />";
        document.getElementById("messagesList").appendChild(li);
    } else {
        var msg = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        var encodedMsg = user + " says " + msg;
        var li = document.createElement("li");
        li.textContent = encodedMsg;
        document.getElementById("messagesList").appendChild(li);
    }
});

connection.start().then(function () {
    document.getElementById("sendButton").disabled = false;
}).catch(function (err) {
    return console.error(err.toString());
});

document.getElementById("sendButton").addEventListener("click", function (event) {
    console.log("asda");
    var user = document.getElementById("agentName").value;
    var message = document.getElementById("messageInput").value;
    connection.invoke("SendMessage", user, message).catch(function (err) {
        return console.error(err.toString());
    });
    event.preventDefault();
});