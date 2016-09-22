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
            //        console.log(isinkey);

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

                if (isinkey == 'Si_F')
                {
                    var a = 1;
                }

                this[isinkey].set('total', new app.DirectionPositions({
                    change_prev_week_abs:   fiz_long.change_prev_week_abs   + fiz_short.change_prev_week_abs    + jur_long.change_prev_week_abs    + jur_short.change_prev_week_abs,
                    change_prev_week_perc:  fiz_long.change_prev_week_perc  + fiz_short.change_prev_week_perc   + jur_long.change_prev_week_perc   + jur_short.change_prev_week_perc,
                    clients:                fiz_long.clients                + fiz_short.clients                 + jur_long.clients                 + jur_short.clients,
                    position:               fiz_long.position               + fiz_short.position                + jur_long.position                + jur_short.position
                }));
            }
        };
    },

    openPositions: null,

    onCsvComplete: function (results) {
        app.openPositions = new app.OpenPositions();


        _.each(results.data, function (elem) {
            //        features.push(elem);
            //            console.log(elem);
            app.openPositions.addPosition(elem);
        });

        for (var key in app.openPositions) {
            if (typeof (app.openPositions[key]) !== 'function') {
                // console.log(app.openPositions[key].toJSON());

                app.featuresListRaw.push({
                    id: key,
                    text: app.openPositions[key].toJSON().name
                });
                //                app.featuresList.push({
                //                    name: app.openPositions[key].name,
                //                    value: app.openPositions[key].isin
                //                });
                //                console.log({
                //                    name: app.openPositions[key].name,
                //                    value: app.openPositions[key].isin
                //                });
                //                app.featuresList.push(app.openPositions[key]);
            }
        }

        //app.featuresListView.render();
        app.renderView();
    },

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


    },

    controls: {},

    renderView: function () {
        app.controls.dropdown = $(".select-features-list").select2({
            placeholder: 'Выберите инструмент',
            data: app.featuresListRaw
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

    initialize: function(attributes, options) {
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

//app.featuresListView = new app.FeaturesListView();

// Table
app.OpenPositionView = Backbone.View.extend({
    el: $('.position-details-table'),
    initialize: function () {
        this.template = _.template($('.position-details').html());
    },
    render: function () {
        //        var self = this;
        // console.log(this.model);
        // console.log(this.model.toJSON());
        // this.$el.append(this.template(this.model.toJSON()));
        this.$el.children('tbody').empty();
        this.$el.children('tbody').html(this.template(
            {
                fiz_short: this.model.get('fiz').get('short').toJSON(),
                fiz_long: this.model.get('fiz').get('long').toJSON(),
                jur_short: this.model.get('jur').get('short').toJSON(),
                jur_long: this.model.get('jur').get('long').toJSON(),
                total: this.model.get('total').toJSON()
            }
        ));
        return this;
    }
});

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
        var key = app.controls.dropdown.val();
        // console.log(key);
        //        alert(moment().format('YYYYMMDD'));
        console.log(app.openPositions);
        // console.log(app.openPositions[key]);
        new app.OpenPositionView({
            model: app.openPositions[key]
        }).render();
    }
});

app.appView = new app.AppView();

$(document).ready(
    app.loadData()
    //    app.renderView()
);