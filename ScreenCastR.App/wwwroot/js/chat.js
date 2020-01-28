"use strict";

var connection = new signalR.HubConnectionBuilder().withUrl("https://localhost:5001/ScreenCastHub").build();
const user = "Motivador";
const message = document.getElementById("messageInput");
//Disable send button until connection is established
document.getElementById("sendButton").disabled = true;

connection.on("ReceiveMessage", function (user, message) {
    var li = document.createElement("li");
    var image;
    switch (message) {
        case "#image_01#":
            image = "image_01.jpg"
            break;
        case "#image_02#":
            image = "image_02.jpg"
            break;
        case "#image_03#":
            image = "image_03.jpg"
            break;
        case "#image_04#":
            image = "image_04.jpg"
            break;
        case "#image_05#":
            image = "image_05.jpg"
            break;
        default:
            var msg = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            var encodedMsg = new Date().toLocaleString() + " - <b>" + user + ": </b>" + msg;
            li.innerHTML = encodedMsg;
            break;
    }

    if (message == "#image_01#" || message == "#image_02#" ||
        message == "#image_03#" || message == "#image_04#" ||
        message == "#image_05#") {
        li.innerHTML = new Date().toLocaleString() + " - <img height=\"30\" width=\"30\" src=\"https://localhost:5001/img/" + image + "\" />";
    }
    document.getElementById("messagesList").appendChild(li);
    li.scrollIntoView();
});

connection.start().then(function () {
    document.getElementById("sendButton").disabled = false;
}).catch(function (err) {
    return console.error(err.toString());
});

document.getElementById("sendButton").addEventListener("click", (event) => {
    console.log(event);
    sendMessage(event);
});

document.getElementById("messageInput").addEventListener("keypress", (event) => {
    if (event.keyCode == 13) {
        sendMessage(event);
    }
});

function sendMessage(event) {
    connection.invoke("SendMessage", user, message.value).catch(function (err) {
        return console.error(err.toString());
    });
    message.value = "";
}
document.getElementById("image_01").addEventListener("click", function (event) {
    message.value = "#image_01#";
    sendMessage(event);
});

document.getElementById("image_02").addEventListener("click", function (event) {
    message.value = "#image_02#";
    sendMessage(event);
});

document.getElementById("image_03").addEventListener("click", function (event) {
    message.value = "#image_03#";
    sendMessage(event);
});

document.getElementById("image_04").addEventListener("click", function (event) {
    message.value = "#image_04#";
    sendMessage(event);
});

document.getElementById("image_05").addEventListener("click", function (event) {
    message.value = "#image_05#";
    sendMessage(event);
});