'use strict';


angular.module('highcharts-ng', [])
  .directive('highchart', function () {
    return {
      restrict: 'EAC',
      replace: true,
      template: '<div></div>',
      scope: {
        config: '='
      },
      link: function (scope, element) {

        //IE8 support
        function indexOf(arr, find, i /*opt*/) {
          if (i === undefined) i = 0;
          if (i < 0) i += arr.length;
          if (i < 0) i = 0;
          for (var n = arr.length; i < n; i++)
            if (i in arr && arr[i] === find)
              return i;
          return -1;
        }

        function deepExtend(destination, source) {
          for (var property in source) {
            //noinspection JSUnfilteredForInLoop
            if (source[property] && source[property].constructor &&
              source[property].constructor === Object) {
              //noinspection JSUnfilteredForInLoop
              destination[property] = destination[property] || {};
              //noinspection JSUnfilteredForInLoop
              deepExtend(destination[property], source[property]);
            } else {
              //noinspection JSUnfilteredForInLoop
              destination[property] = source[property];
            }
          }
          return destination;
        }

        var seriesId = 0;

        function ensureIds(series) {
          angular.forEach(series, function (s) {
            if (!angular.isDefined(s.id)) {
              s.id = 'series-' + seriesId++;
            }
          });
        }

        var axisNames = [ 'xAxis', 'yAxis' ];

        function getMergedOptions(element, config) {
          var mergedOptions = {};

          var defaultOptions = {
            chart: {
              events: {}
            },
            title: {},
            subtitle: {},
            series: [],
            credits: {},
            plotOptions: {},
            navigator: {enabled: false}
          };

          if (config.options) {
            mergedOptions = deepExtend(defaultOptions, config.options);
          } else {
            mergedOptions = defaultOptions;
          }
          mergedOptions.chart.renderTo = element[0];
          angular.forEach(axisNames, function (axisName) {
            if (config[axisName]) {
              mergedOptions[axisName] = angular.copy(config[axisName]);
            }
          });

          if (config.title) {
            mergedOptions.title = config.title;
          }
          if (config.subtitle) {
            mergedOptions.subtitle = config.subtitle;
          }
          if (config.credits) {
            mergedOptions.credits = config.credits;
          }
          return mergedOptions;
        }

        function updateZoom(axis, modelAxis) {
          var extremes = axis.getExtremes();
          if (modelAxis.currentMin !== extremes.dataMin || modelAxis.currentMax !== extremes.dataMax) {
            axis.setExtremes(modelAxis.currentMin, modelAxis.currentMax, false);
          }
        }

        function processExtremes(chart, axis, axisName) {
          if (axis.currentMin || axis.currentMax) {
            chart[axisName][0].setExtremes(axis.currentMin, axis.currentMax, true);
          }
        }

        function chartOptionsWithoutEasyOptions(options) {
          return angular.extend({}, options, {data: null, visible: null});
        }

        var prevOptions = {};

        function processSeries(chart, series) {
          var ids = [];
          appliedSeries = series;
          if (series) {
            ensureIds(series);

            //Find series to add or update
            angular.forEach(series, function (s) {
              ids.push(s.id);
              var chartSeries = chart.get(s.id);
              if (chartSeries) {
                if (!angular.equals(prevOptions[s.id], chartOptionsWithoutEasyOptions(s))) {
                  chartSeries.update(angular.copy(s), false);
                } else {
                  if (s.visible !== undefined && chartSeries.visible !== s.visible) {
                    chartSeries.setVisible(s.visible, false);
                  }
                  if (chartSeries.options.data !== s.data) {
                    chartSeries.setData(angular.copy(s.data), false);
                  }
                }
              } else {
                chart.addSeries(angular.copy(s), false);
              }
              prevOptions[s.id] = chartOptionsWithoutEasyOptions(s);
            });
          }

          //Now remove any missing series
          for (var i = chart.series.length - 1; i >= 0; i--) {
            var s = chart.series[i];
            if (indexOf(ids, s.options.id) < 0) {
              s.remove(false);
            }
          }

        }

        function initialiseChart(element, config) {
          config = config || {};
          var mergedOptions = getMergedOptions(element, config);
          var chart = new Highcharts.Chart(mergedOptions);
          for (var i = 0; i < axisNames.length; i++) {
            if (config[axisNames[i]]) {
              processExtremes(chart, config[axisNames[i]], axisNames[i]);
            }
          }
          processSeries(chart, config.series);
          if (config.loading) {
            chart.showLoading(config.loading !== true ? config.loading : null);
          }
          chart.redraw();
          chart.reflow();
          return chart;
        }

        var chart = false;
        var appliedSeries;

        function initChart() {
          if (chart) chart.destroy();
          chart = initialiseChart(element, scope.config);
        }

        initChart();

        scope.$watch('config.series', function (newSeries) {
          //do nothing when called on registration
          if (!chart)
            return;
          if (newSeries === appliedSeries) return;
          processSeries(chart, newSeries);
          chart.exportSVGElements
            && chart.exportSVGElements.length > 0
            && chart.exportSVGElements[0].menuClassName == "highcharts-contextmenu"
          && chart.exportSVGElements[0].toFront();
          chart.redraw();
          chart.reflow();
        }, true);

        scope.$watch('config.title', function (newTitle) {
          chart.setTitle(newTitle, true);
        }, true);

        scope.$watch('config.subtitle', function (newSubtitle) {
          chart.setTitle(true, newSubtitle);
        }, true);

        scope.$watch('config.loading', function (loading) {
          if (loading) {
            chart.showLoading(loading !== true ? loading : null);
          } else {
            chart.hideLoading();
          }
        });

        scope.$watch('config.credits.enabled', function (enabled) {
          if (enabled) {
            chart.credits.show();
          } else if (chart.credits) {
            chart.credits.hide();
          }
        });

        angular.forEach(axisNames, function (axisName) {
          scope.$watch('config.' + axisName, function (newAxes, oldAxes) {
            if (newAxes === oldAxes) return;
            if (newAxes) {
              chart[axisName][0].update(newAxes, false);
              updateZoom(chart[axisName][0], angular.copy(newAxes));
              chart.redraw();
            }
          }, true);
        });
        scope.$watch('config.options', function (newOptions, oldOptions) {
          //do nothing when called on registration
          if (newOptions === oldOptions) return;
          initChart();
        }, true);

        scope.$on('$destroy', function () {
          if (chart) {
            chart.destroy();
            chart = false;
          }
          element.remove();
        });
      }
    };
  });
