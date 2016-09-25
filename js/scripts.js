'use strict';

var app = {
    getFeatureName: function (name, contractType) {
        var name = name;

        if (contractType == 'C')
            name = name.replace('Опцион', 'Опцион "колл"');

        if (contractType == 'P')
            name = name.replace('Опцион', 'Опцион "пут"');

        return name;
    },

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

    onCsvComplete: function (results) {
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

    loadMoexCsv: function (date, onComplete, onRender) {
        Papa.parse("http://moex.com/ru/derivatives/open-positions-csv.aspx?d=" + date + "&t=1", {
            delimiter: ",",
            download: true,
            header: true,
            dynamicTyping: true,
            // complete: onComplete
            /*complete: function (results) {
             app.onCsvComplete(results);
             }*/
            complete: function (results) {
                onComplete(results);
                onRender();
            }
        });


    },

    controls: {},

    initView: function () {
        app.controls.dropdown = $(".select-features-list").select2({
            placeholder: 'Выберите инструмент',
            data: app.featuresListRaw
        });

        $(".select-features-list").val('Si_F').trigger('change');

        $('#datepicker').datepicker({
            format: "dd.mm.yyyy",
            weekStart: 1,
            todayBtn: "linked",
            autoclose: true,
            todayHighlight: true,
            daysOfWeekDisabled: "0,6",
            language: 'ru'
        });

        $('#datepicker').datepicker('setDate', app.getPreviousTradingDay().toDate());
        $('#datepicker').datepicker('update');

        $('.position-details-table tbody tr').click(function () {
            // if ($(this).data('name'))
            console.log(this.model);
            // alert($(this).data('name'));
            // ChartMan.drawChart2(app.openPositions[key]);
        });
    },

    loadData: function (moment, renderFunction) {
        app.loadMoexCsv(moment.format('YYYYMMDD'), app.onCsvComplete, renderFunction);
    }
}


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
            //            console.log(feature.toJSON());
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
        // this.$el.children('tbody').html(this.template(
        //     {
        //         fiz_short: this.model.get('fiz').get('short').toJSON(),
        //         fiz_long: this.model.get('fiz').get('long').toJSON(),
        //         jur_short: this.model.get('jur').get('short').toJSON(),
        //         jur_long: this.model.get('jur').get('long').toJSON(),
        //         total: this.model.get('total').toJSON()
        //     }
        // ));

        var clickHandler = function (event) {
            var row_data = event.data.pos[$(this).data('name')];
            ChartMan.drawChart2(row_data);
        }

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
        return s.numberFormat(number*100, 2, ',', ' ');
    }
};

// Application
app.AppView = Backbone.View.extend({
    el: $('.container'),
    initialize: function () {
        this.showBtn = this.$('#show-btn')

    },
    events: {
        'click #show-btn': 'showOpenPositions'
    },
    showOpenPositions: function (e) {

        var onRender = function () {
            var key = app.controls.dropdown.val();


            new app.OpenPositionView({
                model: app.openPositions[key]
            }).render();

            var data = app.transformPositionsData(app.openPositions[key]);

            // ChartMan.drawChart(app.openPositions[key]);
            ChartMan.drawChart2(data.position);
        };

        app.loadData(moment($('#datepicker').val(), 'DD.MM.YYYY'), onRender);
    }
});

app.appView = new app.AppView();

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

    return day;
}

$(document).ready(
    // TODO: Load data on page load
    app.loadData(app.getPreviousTradingDay(), app.initView)
);