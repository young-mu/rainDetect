'use strict';

$.ready(function (error) {
    if (error) {
        console.log(error);
        return;
    }

    $('#led-b').turnOn();
    $('#led-r').turnOff();
    $('#led-g').turnOff();

    var count = 0;
    var enableBell = 0;

    var attrs = {
        'hasRain': 0,
        'heatStart': 0,
        'heatEnd': 0,
        'enableBell': 0
    };

    var MQTT = require('tencent-iot-device-mqtt');
    var options = require('./device_info.json');
    var client = MQTT.createTencentIoTClient(options);
    console.log('connect successfully');

    var sendDataTopic = '$thing/up/property/' + options.productKey + '/' + options.deviceName;
    var recvDataTopic = '$thing/down/property/' + options.productKey + '/' + options.deviceName;

    client.subscribe(recvDataTopic);
    client.on('message', function (topic, message) {
        var msgObj = JSON.parse(message.toString());
        if (msgObj.method == 'report_reply') {
            if (msgObj.code != 0) {
                console.log('publish reply failed', msgObj.status);
            } else {
                console.log('publish reply successfully (clientToken', msgObj.clientToken + ')');
            }
        } else if (msgObj.method == 'control') {
            if (msgObj.params.hasRain != undefined) {
                console.log('change rain failed');
                // XXX: publish data immediately does NOT work, so delay 1s
                setTimeout(function () {
                    publishData(attrs);
                }, 1000);
            }

            if (msgObj.params.heatStart != undefined) {
                $('#rain').changeHeatStart(msgObj.params.heatStart, function (error) {
                    if (error) {
                        console.log('change heat start failed', error);
                        setTimeout(function () {
                            publishData(attrs);
                        }, 1000);
                        return;
                    }
                });
            }

            if (msgObj.params.heatEnd != undefined) {
                $('#rain').changeHeatEnd(msgObj.params.heatEnd, function (error) {
                    if (error) {
                        console.log('change heat end failed', error);
                        setTimeout(function () {
                            publishData(attrs);
                        }, 1000);
                        return;
                    }
                });
            }

            if (msgObj.params.enableBell != undefined) {
                enableBell = msgObj.params.enableBell;
                attrs.enableBell = enableBell;
                if (enableBell) {
                    $('#led-r').turnOn();
                } else {
                    $('#led-r').turnOff();
                }
            }
        }
    });

    function getPublishData (attrs, count) {
        var obj = {
            'method': 'report',
            'clientToken': count.toString(),
            'timestamp': Date.now() + (8 * 60 * 60 * 1000),
            'params': attrs
        };

        return JSON.stringify(obj);
    }

    function publishData (attrs) {
        var data = getPublishData(attrs, count++);
        client.publish(sendDataTopic, data, function (error) {
            if (error) {
                console.log('publish failed', error);
            }

            $('#led-g').flicker();
            console.log('publish successfully', data);
        });
    }

    function publishQuickly () {
        $('#rain').readRain(function (error, hasRain) {
            if (error) {
                console.log('read rain failed', error);
                return;
            }

            if (hasRain == 1 && attrs.hasRain == 0) {
                var rainAttr = { 'hasRain': 1 };
                publishData(rainAttr);
                if (enableBell) {
                    $('#bell').ring();
                }
            }

            console.log('hasRain', hasRain);
            attrs.hasRain = hasRain;
        });
    }

    function publishSlowly () {
        $('#rain').readHeat(function (error, heatStart, heatEnd) {
            if (error) {
                console.log('read heat failed', error);
                publishData(attrs);
                return;
            }

            attrs.heatStart = heatStart;
            attrs.heatEnd = heatEnd;

            var _date = new Date(Date.now() + (8 * 60 * 60 * 1000));
            var date = _date.toLocaleDateString();
            var time = _date.toLocaleTimeString();
            console.log('-----', date, time, '-----');
            console.log('雨雪:', attrs.hasRain);
            console.log('加热起始温度:', attrs.heatStart, ', 加热终止温度:', attrs.heatEnd);

            publishData(attrs);
        });
    }

    publishSlowly();

    setInterval(publishQuickly, 2000);
    setInterval(publishSlowly, 20000);

    $('#button-k3').on('release', function () {
        if ($('#led-r').isOn()) {
            $('#led-r').turnOff();
            enableBell = 0;
            attrs.enableBell = 0;
        } else {
            $('#led-r').turnOn();
            enableBell = 1;
            attrs.enableBell = 1;
        }
        publishData(attrs);
    });
});

$.end(function () {
    $('#led-b').turnOff();
    $('#led-r').turnOff();
    $('#led-g').turnOff();
});
