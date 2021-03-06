# openeo-earthengine-driver
Back-end driver for [Google Earth Engine](https://earthengine.google.com/) (proof of concept).

## Configuration / Authentication

The server needs to authenticate with a service account using private key or a user account using OAuth. Both accounts need to have access rights for earth engine. Open the file storage/gee-auth.json and set the method to either `ServiceAccount` or `OAuth`.

For [service accounts](https://developers.google.com/earth-engine/service_account) you need to place your private key file into the storage folder and specify the file name of the private key in the property `privateKeyFile`. 

For OAuth based authentication fill in the `clientId` and the `clientSecret` properties. When running the server for the first time you will be asked to allow the server access to Google Earth Engine with your Google account. The server will explain the steps you need to take to authenticate.

More information about authentication can be found in the [Earth Engine documentation](https://developers.google.com/earth-engine/app_engine_intro).

## Usage

After configuration, the server can be started. Run `npm install` to install the dependencies and  `npm run start` to start the server. 

Afterwards you can use the [openEO API](https://open-eo.github.io/openeo-api/apireference/index.html) to communicate with Google Earth Engine.

Currently, use case 1 of the proof of concept is supported. An exemplary process graph looks like this: 

``````
{
    "process_graph":{
        "process_id":"stretch_colors",
        "args":{
            "imagery":{
                "process_id":"min_time",
                "args":{
                    "imagery":{
                        "process_id":"NDVI",
                        "args":{
                            "imagery":{
                                "process_id":"filter_daterange",
                                "args":{
                                    "imagery":{
                                        "process_id":"filter_bbox",
                                        "args":{
                                            "imagery":{
                                                "product_id":"COPERNICUS/S2"
                                            },
                                            "left":9.0,
                                            "right":9.1,
                                            "top":12.1,
                                            "bottom":12.0,
                                            "srs":"EPSG:4326"
                                        }
                                    },
                                    "from":"2017-01-01",
                                    "to":"2017-01-31"
                                }
                            },
                            "red":"B4",
                            "nir":"B8"
                        }
                    }
                }
            },
            "min": -1,
            "max": 1
        }
    },
    "output":{
        "format":"png"
    }
}
``````

Alternatively, you can use the [openEO Web Editor](https://github.com/Open-EO/openeo-web-editor) to execute the same process graph:

```
OpenEO.Editor.ProcessGraph = OpenEO.ImageCollection.create("COPERNICUS/S2")
	.filter_bbox(9.0, 12.1, 9.1, 12.0, "EPSG:4326")
	.filter_daterange("2017-01-01", "2017-01-31")
	.NDVI("B4", "B8")
	.min_time()
	.process("stretch_colors", {min: -1, max: 1}, "imagery");
```

This translates into the following [Google Earth Engine Playground](https://code.earthengine.google.com/) Script:
```
// create image collection
var img = ee.ImageCollection('COPERNICUS/S2');

// filter_bbox
var geom = ee.Geometry.Rectangle([9,12,9.1,12.1], "EPSG:4326");
img = img.filterBounds(geom);

// filter_daterange
img = img.filterDate("2017-01-01", "2017-01-31");

// ndvi
img = img.map(function(image) {
  return image.normalizedDifference(['B4', 'B8']);
});

// min_time
img = img.reduce('min');

// stretch_color and mapping
Map.addLayer(img, {min: -1, max: 1, palette: ['black', 'white']});
```
