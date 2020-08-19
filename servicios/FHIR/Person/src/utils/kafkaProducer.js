var kafka = require('kafka-node');

const {
	KAFKA_HOST
} = require('../constants');

/**
 * Función encargada de enviar el mensaje al Apache kafka de la suite al tópico especificado
 * @param {*} topic
 * @param {*} messages
 */
let sendMessage = function (messages) {
    var client = new kafka.KafkaClient({kafkaHost: KAFKA_HOST});


    var producer = new kafka.Producer(client, { requireAcks: 1 });

    producer.on('ready', function () {

    producer.send(messages, function (
        err,
        result
    ) {
        console.log(err || result);
    });
    });

}

module.exports = {
    sendMessage
}