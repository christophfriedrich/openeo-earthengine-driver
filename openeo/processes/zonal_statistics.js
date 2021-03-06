const Files = require('../files');
const Utils = require('../utils');

var zonal_statistics = {
	process_id: "zonal_statistics",
	description: "Calculates statistics for each zone specified in a file.",
	args: {
		imagery: {
			description: "image or image collection"
		},
		regions: {
			description: "GeoJSON or a path to a GeoJSON file containing the regions. For paths you must specify the path to a user-uploaded file without the user id in the path."
		},
		func: {
			description: "Statistical function to calculate for the specified zones. Allowed values: min, max, mean, median, mode"
		},
		scale: {
			description: "A nominal scale in meters of the projection to work in. Defaults to 1000."
		}, 
		interval: {
			description: "Interval to group the time series. Allowed values: day, wee, month, year. Defaults to day."
		}
	},
	eeCode(args, req) {
		// Convert to an Image
		var imagery = args.imagery instanceof ee.Image ? ee.ImageCollection(args.imagery) : args.imagery;

		// Group the images by date
		imagery = this._groupImageCollectionByInterval(imagery, args.interval);

		// Read and parse GeoJSON file
		var geojson = null;
		if (typeof args.regions === 'string') {
			var contents = Files.getFileContentsSync(req.user._id, args.regions);
			geojson = JSON.parse(contents);
		}
		else if (typeof args.regions.type === 'string') { // Only a rough check for GeoJSON
			geojson = args.regions;
		}
		else {
			throw 400;
		}

		// Convert GeoJSON to a GEE FeatureCollection
		var features = Utils.geoJsonToFeatureCollection(geojson);

		// Calculate the zonal statistics
		var results = this._calculateStatistics(imagery, features, args);

		// Transform results into the openEO format
		var data = {
			results: results.getInfo()
		};
		return data;
	},

	_groupImageCollectionByInterval(imagery, interval) {
		interval = (interval == 'day' || interval == 'week' || interval == 'month' || interval == 'year') ? interval : 'day';
		var sortedImagery = imagery.sort('system:time_start').toList(imagery.size());
		var firstImage = ee.Image(sortedImagery.get(0));
		var start = ee.Date(firstImage.get('system:time_start'));
		var lastImage = ee.Image(sortedImagery.reverse().get(0));
		var end = ee.Date(lastImage.get('system:time_start'));
		var diff = end.difference(start, interval);
		var range = ee.List.sequence(0, diff.subtract(1)).map(day => { return start.advance(day, interval); });
		var mosaics = (date, newlist) => {
			date = ee.Date(date);
			newlist = ee.List(newlist);
			var filtered = imagery.filterDate(date, date.advance(1, interval));
			var image = ee.Image(filtered.mosaic());
			image = image.set({date: date.format()});
			return ee.List(ee.Algorithms.If(filtered.size(), newlist.add(image), newlist));
		}
		return ee.ImageCollection(ee.List(range.iterate(mosaics, ee.List([]))));
	},

	_createReducerByName(name) {
		var reducer = null;
		switch(name) {
			case 'min':
				reducer = ee.Reducer.min();
				break;
			case 'max':
				reducer = ee.Reducer.max();
				break;
			case 'mean':
				reducer = ee.Reducer.mean();
				break;
			case 'median':
				reducer = ee.Reducer.median();
				break;
			case 'mode':
				reducer = ee.Reducer.mode();
				break;
		}
		return reducer;
	},

	_calculateStatistics(imagery, features, args) {
		var scale = args.scale ? args.scale : 1000;

		var reducer = this._createReducerByName(args.func);
		if (reducer === null) {
			throw 400;
		}

		var multiRegionCalculator = function(image, list) {
			var result = image.reduceRegions({
				reducer: reducer,
				collection: features,
				scale: scale
			});
			// ToDo: Don't reduce, but create a result for each input feature individually
			var value = result.reduceColumns(reducer, ee.List([args.func])).get(args.func);
			return ee.List(list).add(ee.Dictionary({
				date: ee.Date(image.get('date')).format('y-MM-DD'),
				result: {
					totalCount: null,
					validCount: null,
					value: value
				}
			}));
		};

		var data = ee.List([]);
		return imagery.iterate(multiRegionCalculator, data);
	}
};

module.exports = zonal_statistics;