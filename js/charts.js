var data = {
    labels: ["January", "February", "March", "April", "May", "June", "July"],
    datasets: [
        {
            label: "My First dataset",
            fill: false,
            lineTension: 0.1,
            backgroundColor: "rgba(75,192,192,0.4)",
            borderColor: "rgba(75,192,192,1)",
            borderCapStyle: 'butt',
            borderDash: [],
            borderDashOffset: 0.0,
            borderJoinStyle: 'miter',
            pointBorderColor: "rgba(75,192,192,1)",
            pointBackgroundColor: "#fff",
            pointBorderWidth: 1,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: "rgba(75,192,192,1)",
            pointHoverBorderColor: "rgba(220,220,220,1)",
            pointHoverBorderWidth: 2,
            pointRadius: 1,
            pointHitRadius: 10,
            data: [65, 59, 80, 81, 56, 55, 40],
            spanGaps: false,
        }
    ]
};


var getPieData = function (long, short) {
    return {
        labels: [
            "Длинные позиции",
            "Короткие позиции"
        ],
        datasets: [
            {
                label: 'Физические лица',
                data: [long, short],
                backgroundColor: [
                    "#FF6384",
                    "#36A2EB"
                ],
                hoverBackgroundColor: [
                    "#FF6384",
                    "#36A2EB"
                ]
            }]
    }
};


var ChartMan = {

    // Chart Drawing Area
    fizPositionCtx: $("#fizPositionChart"),
    jurPositionCtx: $("#jurPositionChart"),

    // Drawing function
    drawChart: function (featureData) {
        if (featureData) {

            var fiz_short = featureData.get('fiz').get('short').toJSON();
            var fiz_long = featureData.get('fiz').get('long').toJSON();
            var jur_short = featureData.get('jur').get('short').toJSON();
            var jur_long = featureData.get('jur').get('long').toJSON();

            var fizChart = new Chart(this.fizPositionCtx, {
                type: 'pie',
                data: getPieData(fiz_long.position, fiz_short.position)
            });

            var jurChart = new Chart(this.jurPositionCtx, {
                type: 'pie',
                data: getPieData(jur_long.position, jur_short.position)
            });
        }
    }
}