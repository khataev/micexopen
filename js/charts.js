var charts = {
    // Формирование данных для графика открытых позиций на дату
    getPieData: function (long, short) {
        long = Math.abs(long);
        short = Math.abs(short);
        long_perc = Math.round(long/(long+short)*100);
        short_perc = Math.round(short/(long+short)*100);
        return {
            labels: [
                "Длинные позиции: " + long_perc + '%',
                "Короткие позиции: " + short_perc + '%'
            ],
            datasets: [
                {
                    label: 'Физические лица',
                    data: [Math.abs(long), Math.abs(short)],
                    backgroundColor: [
                        "#4deb5a",
                        "#eb5342"

                    ],
                    hoverBackgroundColor: [
                        "#28eb24",
                        "#eb2d22"

                    ]
                }]
        }
    },

    // Настройки для графика открытых позиций на дату
    pieOptions: function () {
        return {
            title: {
                display: true,
                text: ''
            }
        }
    },

    ChartMan: {

        // Ссылки на рабочие области графиков
        fizPositionCtx: $("#fizPositionChart"),
        jurPositionCtx: $("#jurPositionChart"),
        currencyRatesCtx: $("#currencyRatesChart"),
        openPositionsDynamicsCtx: $("#openPositionsDynamicsChart"),
        openPositionsDynamics2Ctx: $("#openPositionsDynamicsChart2"),

        // Ссылки на объекты графиков
        fizChart: null,
        jurChart: null,
        currencyRatesChart: null,
        openPositionsDynamicsChart: null, // 1-я диаграмма динамики
        openPositionsDynamics2Chart: null, // 2-я диаграма динамики

        // Изначальные данные для графика за период
        dynamicDatasets: [
            {
                label: 'Контракты физлиц',
                borderColor: "rgba(75,192,192,1)",
                backgroundColor: "rgba(75,235,230,0.1)",
                data: []
            },
            {
                label: 'Контракты юрлиц',
                borderColor: "rgba(24,240,60,1)",
                backgroundColor: "rgba(180,232,167,0.1)",
                data: []
            },
            {
                label: 'Контракты итого',
                borderColor: "rgba(219,11,157,1)",
                backgroundColor: "rgba(229,167,232,0.1)",
                data: []
            }
        ],

        dynamicDatasets2: [
            {
                label: 'Количество физлиц',
                borderColor: "rgba(28,133,133,1)",
                backgroundColor: "rgba(75,235,230,0.1)",
                data: []
            },
            {
                label: 'Количество юрлиц',
                borderColor: "rgba(0,209,35,1)",
                backgroundColor: "rgba(180,232,167,0.1)",
                data: []
            },
            {
                label: 'Количество итого',
                borderColor: "rgba(191,8,137,1)",
                backgroundColor: "rgba(229,167,232,0.1)",
                data: []
            }
        ],


        // Изначальные данные для графика курса доллара
        ratesDatasets: [
            {
                label: 'Курс USD ЦБ РФ',
                borderColor: "rgba(219,11,94,1)",
                backgroundColor: "rgba(229,167,232,0.1)",
                data: []
            },
            {
                label: 'Курс USDRUB_TOM (CLOSE)',
                borderColor: "rgba(75,192,192,1)",
                backgroundColor: "rgba(75,235,230,0.1)",
                data: []
            }
        ],

        // Функции построения графика на дату

        // Входные данные - модель FeatureOpenPositions
        drawChart: function (featureData) {
            if (featureData) {

                var fiz_short = featureData.get('fiz').get('short').toJSON();
                var fiz_long = featureData.get('fiz').get('long').toJSON();
                var jur_short = featureData.get('jur').get('short').toJSON();
                var jur_long = featureData.get('jur').get('long').toJSON();

                new Chart(this.fizPositionCtx, {
                    type: 'pie',
                    data: getPieData(fiz_long.position, fiz_short.position),
                    options: {
                        title: {
                            display: true,
                            text: 'Физические лица'
                        }
                    }
                });

                new Chart(this.jurPositionCtx, {
                    type: 'pie',
                    data: getPieData(jur_long.position, jur_short.position),
                    options: {
                        title: {
                            display: true,
                            text: 'Юридические лица'
                        }
                    }
                });
            }
        },

        // Входные данные - данные строки таблицы
        drawChart2: function (row_data) {
            if (row_data) {

                if (this.fizChart)
                    this.fizChart.destroy();

                if (this.jurChart)
                    this.jurChart.destroy();

                var fiz_options = charts.pieOptions();
                fiz_options.title.text = 'Физические лица, %';

                var jur_options = charts.pieOptions();
                jur_options.title.text = 'Юридические лица, %';

                this.fizChart = new Chart(this.fizPositionCtx, {
                    type: 'pie',
                    data: charts.getPieData(row_data.fiz_long, row_data.fiz_short),
                    options: fiz_options
                });

                this.jurChart = new Chart(this.jurPositionCtx, {
                    type: 'pie',
                    data: charts.getPieData(row_data.jur_long, row_data.jur_short),
                    options: jur_options
                });
            }
        },

        // Функция преобразования данных в виде обхекта вида "2016-01-11": 72.9299 в формат  charts.js {x: "2016-01-11":, y: 72.9299}
        // data - данные от API за период
        prepareRatesData: function (data) {
            var chartData = [];
            if (data && data.rates) {
                for (var key in data.rates) {
                    // TODO: Подумать над тем, как быть с нулем из-за несуществующего дня в данных от ММВБ (почему не возвращается последний торговый день?)
                    if (data.rates[key] > 0) {
                        chartData.push({
                            x: key,
                            y: data.rates[key]
                        });
                    }
                }
            }
            return chartData;
        },

        // Функция отображения на графике динамики открытых позиций новой порции данных (открытые позиции за новый день)
        updatePeriodChartWithDataPortion: function (moment, openPositions) {
            // Рассчитываем данные
            // ОТНОСИТЕЛЬНЫЕ КОНТРАКТЫ
            var fiz_long_perc = openPositions.position.fiz_long / (openPositions.position.fiz_long + openPositions.position.fiz_short) * 100;
            var jur_long_perc = openPositions.position.jur_long / (openPositions.position.jur_long + openPositions.position.jur_short) * 100;
            var total_long_perc = (openPositions.position.fiz_long + openPositions.position.jur_long) / (openPositions.position.fiz_long + openPositions.position.fiz_short + openPositions.position.jur_long + openPositions.position.jur_short) * 100;

            // АБСОЛЮТНЫЕ ЛОНГОВЫЕ КОНТРАКТЫ
            var fiz_long = openPositions.clients.fiz_long;
            var jur_long = openPositions.clients.jur_long;
            var total_long = openPositions.clients.fiz_long + openPositions.clients.jur_long;

            // Добавляем данные в соответствующие массивы
            // ОТНОСИТЕЛЬНЫЕ КОНТРАКТЫ
            this.dynamicDatasets[0].data.push({
                x: moment,
                y: fiz_long_perc
            });

            this.dynamicDatasets[1].data.push({
                x: moment,
                y: jur_long_perc
            });

            this.dynamicDatasets[2].data.push({
                x: moment,
                y: total_long_perc
            });

            // АБСОЛЮТНЫЕ КОНТРАКТЫ
            this.dynamicDatasets2[0].data.push({
                x: moment,
                y: fiz_long
            });

            this.dynamicDatasets2[1].data.push({
                x: moment,
                y: jur_long
            });

            this.dynamicDatasets2[2].data.push({
                x: moment,
                y: total_long
            });

            // Которые затем пересортировываем
            // ОТНОСИТЕЛЬНЫЕ КОНТРАКТЫ
            this.dynamicDatasets[0].data = _.sortBy(this.dynamicDatasets[0].data, 'x');
            this.dynamicDatasets[1].data = _.sortBy(this.dynamicDatasets[1].data, 'x');
            this.dynamicDatasets[2].data = _.sortBy(this.dynamicDatasets[2].data, 'x');

            // АБСОЛЮТНЫЕ КОНТРАКТЫ
            this.dynamicDatasets2[0].data = _.sortBy(this.dynamicDatasets2[0].data, 'x');
            this.dynamicDatasets2[1].data = _.sortBy(this.dynamicDatasets2[1].data, 'x');
            this.dynamicDatasets2[2].data = _.sortBy(this.dynamicDatasets2[2].data, 'x');

            // Обновляем график
            if (this.openPositionsDynamicsChart) {
                this.openPositionsDynamicsChart.options.scales.xAxes[0].time.min = this.dynamicDatasets[0].data[0].x;
                this.openPositionsDynamicsChart.options.scales.xAxes[0].time.max = this.dynamicDatasets[0].data[this.dynamicDatasets[0].data.length - 1].x;
                this.openPositionsDynamicsChart.update();
            }
            // 2-й
            if (this.openPositionsDynamicsChart2) {
                this.openPositionsDynamicsChart2.options.scales.xAxes[0].time.min = this.dynamicDatasets2[0].data[0].x;
                this.openPositionsDynamicsChart2.options.scales.xAxes[0].time.max = this.dynamicDatasets2[0].data[this.dynamicDatasets2[0].data.length - 1].x;
                this.openPositionsDynamicsChart2.update();
            }
        },

        // Получить максимальную дату из всех курсов
        getMinMaxDates: function (data) {
            var result = {};
            if (data && data.rates) {
                for (var key in data.rates) {
                    if (!result.max || moment(result.max) < moment(key))
                        result.max = key;
                    if (!result.min || moment(result.min) > moment(key))
                        result.min = key;
                }
            }
            return result;
        },

        // отображаем диаграмму с курсами валют
        drawCurrencyRatesChart: function () {
            if (this.currencyRatesChart)
                this.currencyRatesChart.destroy();

            // Reinitialize datasets on consequential loads
            this.ratesDatasets[0].data = [];
            this.ratesDatasets[1].data = [];

            this.currencyRatesChart = new Chart(this.currencyRatesCtx, {
                type: 'line',
                data: {
                    datasets: this.ratesDatasets
                },
                options: {
                    scales: {
                        xAxes: [{
                            type: 'time',
                            time: {
                                unit: 'week'
                            }
                        }]
                    }
                }
            });
        },

        updateRatesChartWithDataset: function (data, type) {
            // Обновляем график
            if (this.currencyRatesChart) {
                periodBoundaries = charts.ChartMan.getMinMaxDates(data);

                this.ratesDatasets[type].data = this.prepareRatesData(data);

                if (this.currencyRatesChart) {
                    this.currencyRatesChart.options.scales.xAxes[0].time.min = periodBoundaries.min;
                    this.currencyRatesChart.options.scales.xAxes[0].time.max = periodBoundaries.max;

                    this.currencyRatesChart.update();
                }
            }
        },

        // начальная отрисовка диаграммы открытых позиций в динамике
        drawOpenPositionsDynamicsChart: function () {
            if (this.openPositionsDynamicsChart)
                this.openPositionsDynamicsChart.destroy();

            _.each(this.dynamicDatasets, function (dataset) {
                dataset.data = [];
            });

            this.dynamicDatasets[0].data = [];

            this.openPositionsDynamicsChart = new Chart(this.openPositionsDynamicsCtx, {
                type: 'line',
                data: {
                    datasets: this.dynamicDatasets
                },
                options: {
                    title: {
                        display: true,
                        text: 'Доля лонгов в общем количестве КОНТРАКТОВ, %'
                    },
                    scales: {
                        xAxes: [{
                            type: 'time',
                            time: {
                                unit: 'week'
                            }
                        }],
                        yAxes: [{
                            ticks: {
                                beginAtZero: true
                            }
                        }]
                    }
                }
            })

        },

        drawOpenPositionsDynamicsChart2: function () {
            if (this.openPositionsDynamicsChart2)
                this.openPositionsDynamicsChart2.destroy();

            _.each(this.dynamicDatasets2, function (dataset) {
                dataset.data = [];
            });

            this.dynamicDatasets2[0].data = [];

            this.openPositionsDynamicsChart2 = new Chart(this.openPositionsDynamics2Ctx, {
                type: 'line',
                data: {
                    datasets: this.dynamicDatasets2
                },
                options: {
                    title: {
                        display: true,
                        text: 'Количество лонговых контрактов, шт.'
                    },
                    scales: {
                        xAxes: [{
                            type: 'time',
                            time: {
                                unit: 'week'
                            }
                        }],
                        yAxes: [{
                            ticks: {
                                beginAtZero: true
                            }
                        }]
                    }
                }
            })

        }
    }
};