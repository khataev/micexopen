'use strict';

var app = {

    Position: function (change_prev_week_abs, change_prev_week_perc, clients, position) {
        this.change_prev_week_abs = change_prev_week_abs;
        this.change_prev_week_perc = change_prev_week_perc;
        this.clients = clients;
        this.position = position;
    },

    ClientOpenPositions: function (data) {
        //    this.name = data.name;
        //    this.moment = data.moment;
        this.short = new app.Position(
            data.change_prev_week_short_abs,
            data.change_prev_week_short_perc,
            data.clients_in_short,
            data.short_position
        );
        this.long = new app.Position(
            data.change_prev_week_long_abs,
            data.change_prev_week_long_perc,
            data.clients_in_long,
            data.long_position
        );
    },

    getFeatureName: function (name, contractType) {
        var name = name;

        if (contractType == 'C')
            name = name.replace('Опцион', 'Опцион "колл"');

        if (contractType == 'P')
            name = name.replace('Опцион', 'Опцион "пут"');

        return name;
    },

    OpenPositionsCtr: function () {
        this.addPosition = function (position) {
            var isinkey = position.isin + '_' + position.contract_type;
            //        console.log(isinkey);

            if (this[isinkey] == null) {
                this[isinkey] = {
                    isin: position.isin,
                    name: app.getFeatureName(position.name, position.contract_type),
                    moment: position.moment,
                    fiz: null,
                    jur: null,
                    total: null
                };
            }

            if (position.iz_fiz == 1) {
                this[isinkey].fiz = new app.ClientOpenPositions(position);
            } else {
                this[isinkey].jur = new app.ClientOpenPositions(position);
            }

            if (this[isinkey].fiz && this[isinkey].jur) {
                var fiz = this[isinkey].fiz;
                var jur = this[isinkey].jur;

                this[isinkey].total = new app.Position(
                    fiz.long.change_prev_week_abs + fiz.short.change_prev_week_abs + jur.short.change_prev_week_abs + jur.short.change_prev_week_abs,

                    fiz.long.change_prev_week_perc + fiz.short.change_prev_week_perc + jur.short.change_prev_week_perc + jur.short.change_prev_week_perc,

                    fiz.long.clients + fiz.short.clients + jur.short.clients + jur.short.clients,

                    fiz.long.position + fiz.short.position + jur.short.position + jur.short.position
                );

                //            console.log(this[isinkey]);
            }
        };
    },

    openPositions: null,

    onCsvComplete: function (results) {
        app.openPositions = new app.OpenPositionsCtr();

        _.each(results.data, function (elem) {
            //        features.push(elem);
            //        console.log(elem);
            app.openPositions.addPosition(elem);
        });

        for (var key in app.openPositions) {
            if (typeof (app.openPositions[key]) == 'function') {

            } else {
                app.featuresList.push({
                    name: app.openPositions[key].name
                });
                //                console.log(app.openPositions[key]);
                //                app.featuresList.push(app.openPositions[key]);
            }
        }

        app.featuresListView.render();
    },

    /*onCsvComplete1: function (results) {

        _.each(results.data, function (elem) {
            app.featuresList.push(elem);
            console.log(elem);
        });

        featuresListView.render();
    }*/

    loadMoexCsv: function (date, onComplete) {
        Papa.parse("http://moex.com/ru/derivatives/open-positions-csv.aspx?d=" + date + "&t=1", {
            delimiter: ",",
            download: true,
            header: true,
            dynamicTyping: true,
            //            complete: onComplete(results)
            /*complete: function (results) {
                app.onCsvComplete(results);
            }*/
            complete: function (results) {
                onComplete(results);
            }
        });

        app.renderView();
    },

    renderView: function () {
        $(".select-features-list").select2({
            placeholder: 'Выберите инструмент'
        });

        $('#sandbox-container input').datepicker({
            format: "dd.mm.yyyy",
            weekStart: 1,
            todayBtn: "linked",
            autoclose: true,
            todayHighlight: true,
            daysOfWeekDisabled: "0,6",
            language: 'ru'
        });
    },

    loadData: function () {
        // Initial dropdown fill
        app.loadMoexCsv(moment().subtract(1, 'days').format('YYYYMMDD'), app.onCsvComplete);
    }
}

app.FeatureListItem = Backbone.Model.extend({
    defaults: {
        name: ''
    }
});

/*var FeatureListItem = Backbone.Model.extend({
    defaults: {
        isinkey: '',
        isin: '',
        name: '',
        moment: Date.now(),
        fiz: {},
        jur: {},
        total: {}
    }
});*/

app.FeaturesList = Backbone.Collection.extend({});

app.featuresList = new app.FeaturesList();

app.FeatureListItemView = Backbone.View.extend({
    model: new app.FeatureListItem(),
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
        //        console.log(this.el);
        var self = this;
        //this.model.on('add', this.render, this);
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

app.featuresListView = new app.FeaturesListView();

app.AppView = Backbone.View.extend({
    el: $('.container'),
    initialize: function () {
        this.showBtn = this.$('#show-btn')
    },
    events: {
        'click #show-btn': 'showOpenPositions'
    },
    showOpenPositions: function (e) {
        alert(moment().format('YYYYMMDD'));

    }
});

app.appView = new app.AppView();

$(document).ready(
    app.loadData()
);