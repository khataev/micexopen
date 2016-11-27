var api = {
    // Путь к API для получения курса доллара
    usd_rates_url: 'http://vmnet.herokuapp.com/api/v1/rates/usd.json',
    usd_rates_aux_url: 'http://7thheaven.myds.me:3000/api/v1/rates/usd.json',
    usd_rates_test_url: 'http://192.168.1.100:3000/api/v1/rates/usd.json',

    // Формирование полного URL для получения курса доллара за период времени
    getUSDRatesUrl: function (startMoment, endMoment) {
        return this.usd_rates_url + "?start_date=" + startMoment.format('YYYYMMDD') + "&end_date=" + endMoment.format('YYYYMMDD') + "&callback=?";
    },

    getUSDRatesJSON_: function (startMoment, endMoment, onComplete) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', this.getUSDRatesUrl(startMoment, endMoment));
        xhr.send();

        xhr.onreadystatechange = function () {
            if (xhr.readyState != 4) return;

            var result = {
                data: {},
                errors: []
            };

            if (xhr.status != 200) {
                // обработать ошибку
                result.errors.push(xhr.status + ': ' + xhr.statusText);
            } else {
                try {
                    result.data = JSON.parse(xhr.responseText);
                }
                catch (SyntaxError) {
                    result.errors.push("JSON parsing error");
                }
            }

            onComplete(result);
        }
    },

    getUSDRatesJSON: function (startMoment, endMoment, onComplete, onFail) {
        $.getJSON(this.getUSDRatesUrl(startMoment, endMoment), function (data) {
            onComplete(data);
        })
            .fail(onFail);
    },

    // Путь к API для получения курса USDRUB_TOM С ММВБ
    usdtom_rates_url: 'http://vmnet.herokuapp.com/api/v1/spot_rates/usdrub_tom.json',
    usdtom_rates_aux_url: 'http://7thheaven.myds.me:3000/api/v1/spot_rates/usdrub_tom.json',
    usdtom_rates_test_url: 'http://192.168.1.100:3000/api/v1/spot_rates/usdrub_tom.json',

    // Формирование полного URL для получения курса доллара за период времени
    getSpotUSDRatesUrl: function (startMoment, endMoment) {
        return this.usdtom_rates_url + "?start_date=" + startMoment.format('YYYYMMDD') + "&end_date=" + endMoment.format('YYYYMMDD') + "&callback=?";
    },

    getSpotUSDRatesJSON: function (startMoment, endMoment, onComplete, onFail) {
        $.getJSON(this.getSpotUSDRatesUrl(startMoment, endMoment), function (data) {
            onComplete(data);
        })
            .fail(onFail);
    }
};