const { desktopCapturer } = require('electron')
const signalR = require('@microsoft/signalr')

let connection;
let subject;
let screenCastTimer;
let isStreaming = false;
const framepersecond = 24;
const screenWidth = 1280;
const screenHeight = 800;


async function initializeSignalR() {
    connection = new signalR.HubConnectionBuilder()
        .withUrl("https://localhost:5001/ScreenCastHub")
        .configureLogging(signalR.LogLevel.Information)
        .build();

    connection.on("NewViewer", function() {
        if (isStreaming === false)
            startStreamCast()
    });

    connection.on("NoViewer", function() {
        if (isStreaming === true)
            stopStreamCast()
    });

    await connection.start().then(function() {
        console.log("connected");
    });

    return connection;
}

initializeSignalR();

function CaptureScreen() {
    return new Promise(function(resolve, reject) {
        desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: screenWidth, height: screenHeight } },
            (error, sources) => {
                if (error) console.error(error);
                for (const source of sources) {
                    if (source.name === 'Entire screen') {
                        resolve(source.thumbnail.toDataURL())
                    }
                }
            })
    })
}

const agentName = document.getElementById('agentName');
const agentPass = document.getElementById('agentPass');
const searchBtn = document.getElementById('searchAgent');
const startCastBtn = document.getElementById('startCast');
//const stopCastBtn = document.getElementById('stopCast');
const messageInput = document.getElementById('messageInput');
const login = document.getElementById('login');
const chat = document.getElementById('chat');

startCastBtn.setAttribute("disabled", "disabled");
searchBtn.setAttribute("disabled", "disabled");
//stopCastBtn.setAttribute("disabled", "disabled");



startCastBtn.onclick = function() {
    startCastBtn.setAttribute("disabled", "disabled");
    login.style.display = 'none';
    chat.style.display = 'unset';
    //stopCastBtn.removeAttribute("disabled");
    connection.send("AddScreenCastAgent", agentName.value);
};

function startStreamCast() {
    isStreaming = true;
    subject = new signalR.Subject();
    connection.send("StreamCastData", subject, agentName.value);
    screenCastTimer = setInterval(function() {
        try {
            CaptureScreen().then(function(data) {
                subject.next(data);
            });

        } catch (e) {
            console.log(e);
        }
    }, Math.round(1000 / framepersecond));
}

function stopStreamCast() {

    if (isStreaming === true) {
        clearInterval(screenCastTimer);
        subject.complete();
        isStreaming = false;
    }
}

/*stopCastBtn.onclick = function() {
    stopCastBtn.setAttribute("disabled", "disabled");
    startCastBtn.removeAttribute("disabled");
    stopStreamCast();
    connection.send("RemoveScreenCastAgent", agentName.value);
};
*/
//Disable send button until connection is established


connection.on("ReceiveMessage", function(user, message) {
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
            var encodedMsg = "<b>" + user + ": </b>" + msg;
            li.innerHTML = encodedMsg;
            break;
    }

    if (message == "#image_01#" || message == "#image_02#" ||
        message == "#image_03#" || message == "#image_04#" ||
        message == "#image_05#") {
        li.innerHTML =
            "<img style=\"vertical-align:middle\" height=\"30\" width=\"30\" src=\"https://localhost:5001/img/" + image + "\" />";

        document.getElementById("lastStatus").innerHTML =
            "<img height=\"90\" width=\"90\" src=\"https://localhost:5001/img/big/" + image + "\" />";
    }
    document.getElementById("messagesList").appendChild(li);
    li.scrollIntoView();
});

connection.start().then(function() {
    document.getElementById("sendButton").disabled = false;
}).catch(function(err) {
    return console.error(err.toString());
});

sendButton.onclick = function() {
    var message = document.getElementById("messageInput").value;
    connection.invoke("SendMessage", agentName.value, message).catch(function(err) {
        return console.error(err.toString());
    });
    messageInput.value = "";
};

messageInput.onkeypress = (event) => {
    if (event.keyCode == 13) {
        var message = document.getElementById("messageInput").value;
        connection.invoke("SendMessage", agentName.value, message).catch(function(err) {
            return console.error(err.toString());
        });
        messageInput.value = "";
    }
}

messageInput.setAttribute("disabled", "disabled");

agentName.onkeyup = () => {
    if (agentName.value != "" && agentPass.value != "") {
        searchBtn.removeAttribute("disabled");
        messageInput.disabled = false;
    } else {
        searchBtn.setAttribute("disabled", "disabled");
        messageInput.disabled = true;
    }
}

agentPass.onkeyup = () => {
    if (agentName.value != "" && agentPass.value != "") {
        searchBtn.removeAttribute("disabled");
        messageInput.disabled = false;
    } else {
        searchBtn.setAttribute("disabled", "disabled");
        messageInput.disabled = true;
    }
}