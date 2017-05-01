'use strict';

var app = {
    // Наименование инструмента
    getFeatureName: function (name, contractType) {
        var name = name;

        if (contractType == 'C')
            name = name.replace('Опцион', 'Опцион "колл"');

        if (contractType == 'P')
            name = name.replace('Опцион', 'Опцион "пут"');

        return name;
    },

    // Открытые позиции на дату
    OpenPositions: function () {
        this.addPosition = function (position) {
            var isinkey = position.isin + '_' + position.contract_type;

            if (this[isinkey] == null) {

                this[isinkey] = new app.FeatureOpenPositions({
                    isin: position.isin,
                    name: app.getFeatureName(position.name, position.contract_type),
                    moment: position.moment
                });
            }


            if (position.iz_fiz == 1) {
                this[isinkey].set('fiz', new app.ClientsPositions({}, position));
            } else {
                this[isinkey].set('jur', new app.ClientsPositions({}, position));
            }

            if (this[isinkey].get('fiz').get('filled') && this[isinkey].get('jur').get('filled')) {
                var fiz = this[isinkey].get('fiz');
                var jur = this[isinkey].get('jur');

                var fiz_long = fiz.get('long').toJSON();
                var jur_long = jur.get('long').toJSON();
                var fiz_short = fiz.get('short').toJSON();
                var jur_short = jur.get('short').toJSON();

                if (isinkey == 'Si_F') {
                    var a = 1;
                }

                this[isinkey].set('total', new app.DirectionPositions({
                    change_prev_week_abs: fiz_long.change_prev_week_abs + fiz_short.change_prev_week_abs + jur_long.change_prev_week_abs + jur_short.change_prev_week_abs,
                    change_prev_week_perc: fiz_long.change_prev_week_perc + fiz_short.change_prev_week_perc + jur_long.change_prev_week_perc + jur_short.change_prev_week_perc,
                    clients: fiz_long.clients + fiz_short.clients + jur_long.clients + jur_short.clients,
                    position: fiz_long.position + fiz_short.position + jur_long.position + jur_short.position
                }));
            }
        };
    },

    openPositions: null,
    openPositionsDynamics: null,
    // Массив обработанных дней в периоде - необходим для синхронизации асинхронных потоков загрузки csv с основным
    workingPeriodSync: null,

    // Коллбек после загрузки csv файла
    onCsvComplete: function (results) {
        // загружаем данные из файла в объект OpenPositions
        app.openPositions = new app.OpenPositions();


        _.each(results.data, function (elem) {
            app.openPositions.addPosition(elem);
        });

        for (var key in app.openPositions) {
            if (typeof (app.openPositions[key]) !== 'function') {
                // console.log(app.openPositions[key].toJSON());

                app.featuresListRaw.push({
                    id: key,
                    text: app.openPositions[key].toJSON().name
                });
            }
        }
    },

    // Функция загрузки csv с открытыми позициями по инструментам
    // date - дата в виде строки ГГГГММДД
    // onComplete - коллбек по окончанию загрузки csv
    // onRender - функция по обновлению интерфейса (если требуется)
    loadMoexCsv: function (date, onComplete, onRender) {
        var direct_url = "http://moex.com/ru/derivatives/open-positions-csv.aspx?d=" + date + "&t=1";
        var proxy_url = "http://vmnet.herokuapp.com/open_positions/" + date;
        var proxy_aux_url = "http://7thheaven.myds.me:3000/open_positions/" + date;

        var showError = function(message) {
            var sel = $('.error-area');
            sel.html(message);
            sel.show();
        };

        Papa.parse(proxy_url, {
            delimiter: ",",
            download: true,
            header: true,
            dynamicTyping: true,
            complete: function (results) {
                if (onComplete)
                    if (results.data[0].errorcode == 500) {
                        showError('Сервер ММВБ перегружен. Пожалуйста повторите свою попытку позднее');
                    } else {
                        onComplete(results);
                    }
                if (onRender)
                    onRender();
            },
            error: function (err, file, inputElem, reason) {
                showError('Произошла ошибка при доступе к сервису ММВБ. Я изучаю данный момент. А пока попробуйте перезагрузить страницу или зайдите позднее');
            }
        });


    },

    // Функция аккумулирования загруженных на дату открытых позиций в хэш-массиве
    accumulateCsv: function (results) {
        app.onCsvComplete(results);

        // структурированные данные из объекта на дату добавляем в хэш-массив
        if (results.data[0].moment !== "") {
            app.openPositionsDynamics[results.data[0].moment] = app.openPositions;

            app.renderDynamicDataPortion(app.openPositions);

            // отметим день, который обработали
            app.workingPeriodSync.pop();
            // if (app.workingPeriodSync.length == 0)
            //     app.renderDynamics();
        }
    },

    // Функция загрузки курса валюты на дату
    loadUsdRate: function (momentFrom, momentTo) {
        var resultCallback = function (result) {
            app.renderRates(result);
        };

        var resultSpotCallback = function (result) {
            app.renderSpotRates(result);
        };
        app.clearRatesError();
        charts.ChartMan.drawCurrencyRatesChart();
        api.getUSDRatesJSON(momentFrom, momentTo, resultCallback, app.renderRatesError);
        api.getSpotUSDRatesJSON(momentFrom, momentTo, resultSpotCallback, app.renderRatesError);
    },

    // Функция отрисовки для "динамики"
    renderDynamicDataPortion: function (openPositions) {
        var key = app.controls.dropdown.val();
        var data = app.transformPositionsData(openPositions[key]);
        charts.ChartMan.updatePeriodChartWithDataPortion(openPositions[key].get('moment'), data);
    },

    // функция для отрисовки данных Курса ЦБ
    // TODO: отрефакторить - убрать параметр с данными?
    renderRates: function (data) {
        charts.ChartMan.updateRatesChartWithDataset(data,0);
    },

    // для второго набора данных (от ММВБ)
    renderSpotRates: function (data) {
        charts.ChartMan.updateRatesChartWithDataset(data,1);
    },

    // Очистка области с ошибками загрузки курса доллара
    clearRatesError: function () {
        $('.rates-error-border').hide();
    },

    // Отображение ошибки загрузки курса доллара
    renderRatesError: function () {
        $('.rates-error-border').show();
    },

    controls: {},

    // Инициация DatePicker с указанным именем, указанной датой (moment)
    initDatePicker: function (pickerId, defaultMoment) {
        $(pickerId).datepicker({
            format: "dd.mm.yyyy",
            weekStart: 1,
            todayBtn: "linked",
            autoclose: true,
            todayHighlight: true,
            daysOfWeekDisabled: "0,6",
            language: 'ru'
            // TODO: Разобраться, как проинициализировать датапикер пограничной датой (endDate)
            // ,endDate: '04.11.2016'
            // ,endDate: app.getPreviousTradingDay().format('DD.MM.YYYY')
        });

        $(pickerId).datepicker('setDate', defaultMoment.toDate());
        $(pickerId).datepicker('update');
    },

    // инициализация интерфейса
    initView: function () {
        app.controls.dropdown = $(".select-features-list").select2({
            placeholder: 'Выберите инструмент',
            data: app.featuresListRaw
        });

        $(".select-features-list").val('Si_F').trigger('change');

        app.initDatePicker('#datepicker', app.getPreviousTradingDay());
        // app.initDatePicker('#datepickerFrom', app.getFirstDayOfMonth());
        app.initDatePicker('#datepickerFrom', app.getPreviousTradingDay());
        app.initDatePicker('#datepickerTo', app.getPreviousTradingDay());

    },

    // Загрузка данных на дату и отображение на странице
    loadData: function (moment, renderFunction) {
        app.loadMoexCsv(moment.format('YYYYMMDD'), app.onCsvComplete, renderFunction);
    },

    // Загрузка данных за период и отображение на странице
    loadDataPeriod: function (momentFrom, momentTo) {
        var currentMoment = moment(momentFrom);

        app.openPositionsDynamics = {};
        // Отрисовываем пустой график
        charts.ChartMan.drawOpenPositionsDynamicsChart();
        charts.ChartMan.drawOpenPositionsDynamicsChart2();

        // Заполнение массива для синхронизации потоков
        app.workingPeriodSync = [];
        var currentMomentDup = moment(momentFrom);
        while (currentMomentDup.isBefore(momentTo, 'day') || currentMomentDup.isSame(momentTo, 'day')) {
            if (currentMomentDup.day() > 0 && currentMomentDup.day() < 7) {
                app.workingPeriodSync.push(currentMomentDup.format('YYYYMMDD'));
            }
            currentMomentDup.add(1, 'day');
        }

        // загрузка данных с ММВБ по открытым позициям за период
        while (currentMoment.isBefore(momentTo, 'day') || currentMoment.isSame(momentTo, 'day')) {
            if (currentMoment.day() > 0 && currentMoment.day() < 6) {
                app.loadMoexCsv(currentMoment.format('YYYYMMDD'), app.accumulateCsv, null /*app.renderDynamics*/);
            }
            currentMoment.add(1, 'day');
        }

        // загрузка курсов USD за период
        // TODO: разнести загрузку и отображение
        app.loadUsdRate(momentFrom, momentTo);
    }
};


//--------------
// Models
//--------------

// Dropdown
app.FeatureListItem = Backbone.Model.extend({
    defaults: {
        value: '',
        name: ''
    }
});

// Short or Long positions
app.DirectionPositions = Backbone.Model.extend({
    defaults: {
        change_prev_week_abs: 0,
        change_prev_week_perc: 0,
        clients: 0,
        position: 0
    }
});

app.ClientsPositions = Backbone.Model.extend({
    defaults: {
        filled: false,
        long: new app.DirectionPositions(),
        short: new app.DirectionPositions()
    },

    initialize: function (attributes, options) {
        if (options) {
            // console.log(options.change_prev_week_short_abs);
            this.set('short', new app.DirectionPositions({
                change_prev_week_abs: options.change_prev_week_short_abs,
                change_prev_week_perc: options.change_prev_week_short_perc,
                clients: options.clients_in_lshort,
                position: options.short_position
            }));
            this.set('long', new app.DirectionPositions({
                change_prev_week_abs: options.change_prev_week_long_abs,
                change_prev_week_perc: options.change_prev_week_long_perc,
                clients: options.clients_in_long,
                position: options.long_position
            }));
            this.set('filled', true);
        }
    }
});

// Table
app.FeatureOpenPositions = Backbone.Model.extend({
    defaults: {
        isin: '',
        name: '',
        moment: Date.now(),
        fiz: new app.ClientsPositions(),
        jur: new app.ClientsPositions(),
        total: new app.DirectionPositions()
    }

});

//--------------
// Collections
//--------------

// Dropdown
app.FeaturesList = Backbone.Collection.extend({});
app.featuresList = new app.FeaturesList();

app.featuresListRaw = [];

//--------------
// Views
//--------------

// Dropdown
app.FeatureListItemView = Backbone.View.extend({
    //    model: new app.FeatureListItem(),
    tagName: 'option',
    initialize: function () {
        this.template = _.template($('.feature-item-template-select').html());
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
    }
});

app.FeaturesListView = Backbone.View.extend({
    model: app.featuresList,
    el: $('.select-features-list'),
    initialize: function () {
        var self = this;
    },
    render: function () {
        var self = this;
        this.$el.html('');
        _.each(this.model.toArray(), function (feature) {
            var newEl = (new app.FeatureListItemView({
                model: feature
            })).render().$el;
            self.$el.append(newEl);
        });
        return this;
    }
});

// Transforms FeatureOpenPositions into table's row like data
app.transformPositionsData = function (positionsModel) {
    var fiz_short = positionsModel.get('fiz').get('short').toJSON();
    var fiz_long = positionsModel.get('fiz').get('long').toJSON();
    var jur_short = positionsModel.get('jur').get('short').toJSON();
    var jur_long = positionsModel.get('jur').get('long').toJSON();
    var total = positionsModel.get('total').toJSON();

    var data = {};

    function makeRow(fiz_long, fiz_short, jur_long, jur_short) {
        return {
            fiz_long: fiz_long,
            fiz_short: fiz_short,
            jur_long: jur_long,
            jur_short: jur_short,
            total: fiz_long + fiz_short + jur_long + jur_short
        }
    }

    data.position = makeRow(fiz_long.position, fiz_short.position, jur_long.position, jur_short.position);
    data.change_prev_week_abs = makeRow(fiz_long.change_prev_week_abs, fiz_short.change_prev_week_abs, jur_long.change_prev_week_abs, jur_short.change_prev_week_abs);
    data.change_prev_week_perc = makeRow(fiz_long.change_prev_week_perc, fiz_short.change_prev_week_perc, jur_long.change_prev_week_perc, jur_short.change_prev_week_perc);
    data.clients = makeRow(fiz_long.clients, fiz_short.clients, jur_long.clients, jur_short.clients);

    return data;
};

// Table
app.OpenPositionView = Backbone.View.extend({
    el: $('.position-details-table'),
    initialize: function () {
        this.template = _.template($('.position-details').html());
    },
    render: function () {

        var data = app.transformPositionsData(this.model);

        var mdata = _.extend({pos: data}, app.viewHelpers);
        this.$el.children('tbody').empty();
        // this.$el.children('tbody').html(this.template({pos: data}));
        this.$el.children('tbody').html(this.template(mdata));

        var clickHandler = function (event) {
            var row_data = event.data.pos[$(this).data('name')];
            charts.ChartMan.drawChart2(row_data);
        };

        // Binds handler on table's row click
        $('.position-details-table tbody tr').on('click', {pos: data}, clickHandler);
        return this;
    }
});

// Helpers for View
app.viewHelpers = {
    numberFormat: function (number) {
        return s.numberFormat(number, 0, ',', ' ');
    },
    numberFormat2: function (number) {
        return s.numberFormat(number, 2, ',', ' ');
    },
    numberFormatPerc: function (number) {
        return s.numberFormat(number * 100, 2, ',', ' ');
    }
};

// Application
app.AppView = Backbone.View.extend({
    el: $('.container'),
    initialize: function () {
        // this.showStaticBtn = this.$('#show-static-btn');
        // this.showDynamicBtn = this.$('#show-dynamic-btn')

    },
    events: {
        'click #show-static-btn': 'showOpenPositions',
        'click #show-dynamics-btn': 'showPositionsDynamic'
    },
    // обработчик клика по кнопке Показать на дату
    showOpenPositions: function (e) {

        $('.error-area').html();
        $('.error-area').hide();

        var onRender = function () {
            var key = app.controls.dropdown.val();

            new app.OpenPositionView({
                model: app.openPositions[key]
            }).render();

            var data = app.transformPositionsData(app.openPositions[key]);

            // ChartMan.drawChart(app.openPositions[key]);
            charts.ChartMan.drawChart2(data.position);
        };

        app.loadData(moment($('#datepicker').val(), 'DD.MM.YYYY'), onRender);
    },

    // обработчик клика по кнопке Показать за период
    showPositionsDynamic: function (e) {
        app.loadDataPeriod(moment($('#datepickerFrom').val(), 'DD.MM.YYYY'), moment($('#datepickerTo').val(), 'DD.MM.YYYY'));
    }

});

app.appView = new app.AppView();

app.getForHoliday = function(mnt) {

    if (mnt.isSame('2016-11-06', 'day')) {
        return moment('2016-11-03');
    }
    if (mnt.isSame('2016-11-07', 'day')) {
        return moment('2016-11-03');
    }
    if (mnt.isSame('2017-01-03', 'day')) {
        return moment('2016-12-30');
    }
    if (mnt.isSame('2017-02-24', 'day')) {
        return moment('2017-02-22');
    }
    if (mnt.isSame('2017-03-09', 'day')) {
        return moment('2017-03-07');
    }
    if (mnt.isSame('2017-05-02', 'day')) {
        return moment('2017-04-28');
    }
    if (mnt.isSame('2017-05-09', 'day')) {
        return moment('2017-05-05');
    }
    if (mnt.isSame('2017-05-10', 'day')) {
        return moment('2017-05-05');
    }
    if (mnt.isSame('2017-06-13', 'day')) {
        return moment('2017-06-09');
    }
    if (mnt.isSame('2017-11-07', 'day')) {
        return moment('2017-11-03');
    }
    return undefined;
};

app.getPreviousTradingDay = function () {
    var day;
    switch (moment().day()) {
        case 0:
            day = moment().subtract(2, 'days');
            break;
        case 1:
            day = moment().subtract(3, 'days');
            break;
        default:
            day = moment().subtract(1, 'days');
            break;
    }

    var forHoliday = app.getForHoliday(moment());

    return forHoliday === undefined ? day : forHoliday;
};

app.getFirstDayOfMonth = function () {
    // TODO: Доработать
    return moment().set('date', 4);
};

$(document).ready(
    // TODO: Load data on page load
    function() {
        $(".select-features-list").select2({
            placeholder: ' Загрузка...',
            data: app.featuresListRaw
        });
        app.loadData(app.getPreviousTradingDay(), app.initView);
    }
);
