// Load Urban Heat Island Intensity (UHII) datasets
var datasets = [
  {collection: ee.ImageCollection("projects/sat-io/open-datasets/UHII/AMOD2"), name: "UHII_AMOD2"},
  {collection: ee.ImageCollection("projects/sat-io/open-datasets/UHII/MOD1"), name: "UHII_MOD1"},
  {collection: ee.ImageCollection("projects/sat-io/open-datasets/UHII/MOD2"), name: "UHII_MOD2"},
  {collection: ee.ImageCollection("projects/sat-io/open-datasets/UHII/MYD1"), name: "UHII_MYD1"},
  {collection: ee.ImageCollection("projects/sat-io/open-datasets/UHII/MYD2"), name: "UHII_MYD2"},
  {collection: ee.ImageCollection("projects/sat-io/open-datasets/UHII/SAT"), name: "UHII_SAT"},
  {collection: ee.ImageCollection("projects/sat-io/open-datasets/UHII/SMOD2"), name: "UHII_SMOD2"},
  {collection: ee.ImageCollection("projects/sat-io/open-datasets/UHII/SMYD1"), name: "UHII_SMYD1"}
];

// Load the FAO GAUL dataset (Admin Level 1)
var gaul_adm1 = ee.FeatureCollection("FAO/GAUL/2015/level1");

// Define the four representative cities with their respective ADM1 regions
var cities = [
  {name: "Lagos", country: "Nigeria", adm1_name: "Lagos"},
  {name: "Nairobi", country: "Kenya", adm1_name: "Nairobi"},
  {name: "Johannesburg", country: "South Africa", adm1_name: "Gauteng"},
  {name: "Kinshasa", country: "Democratic Republic of the Congo", adm1_name: "Kinshasa"}
];

// Function to get city boundary from GAUL dataset
function getCityBoundary(city) {
  var boundary = gaul_adm1
    .filter(ee.Filter.eq("ADM0_NAME", city.country))
    .filter(ee.Filter.eq("ADM1_NAME", city.adm1_name))
    .geometry();
  
  return ee.Feature(boundary, {city: city.name, country: city.country, adm1: city.adm1_name});
}

// Create FeatureCollection of city boundaries
var cityCollection = ee.FeatureCollection(cities.map(getCityBoundary));

// Visualization parameters
var visParams = {
  min: 1,
  max: 25,
  palette: ["#000004", "#1f0c48", "#550f6d", "#88226a", "#b63655", "#de4968", "#f87c51", "#fea844"]
};

// Function to visualize UHII data
function visualizeUHII(dataset, city) {
  var image = dataset.collection.median()
    .clip(city.geometry().bounds()) // Ensure valid clipping
    .mask(dataset.collection.median().gt(0));

  Map.addLayer(image, visParams, dataset.name + " - " + city.get("city"));
}


// Apply visualization for each dataset and city
cityCollection.evaluate(function(cityList) {
  cityList.features.forEach(function(cityFeature) {
    var city = ee.Feature(cityFeature);
    datasets.forEach(function(dataset) {
      visualizeUHII(dataset, city);
    });
  });
});

// Center map on an average location
Map.centerObject(cityCollection, 4);
Map.addLayer(cityCollection.style({color: 'black', width: 2}), {}, "City Boundaries");

// Function to compute statistics for each dataset and city
function computeStatistics(dataset, city) {
  var image = dataset.collection.median().clip(city.geometry());

  var stats = image.reduceRegion({
    reducer: ee.Reducer.mean()
      .combine(ee.Reducer.min(), "min", true)
      .combine(ee.Reducer.max(), "max", true)
      .combine(ee.Reducer.stdDev(), "stdDev", true),
    geometry: city.geometry(),
    scale: 30,
    maxPixels: 1e13
  });

  return ee.Feature(null, stats.set("Dataset", dataset.name).set("City", city.get("city")));
}


// Compute UHII statistics for each dataset and city
var statistics = cityCollection.map(function(city) {
  return ee.FeatureCollection(datasets.map(function(dataset) {
    return computeStatistics(dataset, city);
  }));
}).flatten();

// Print statistics
print("UHII Statistics for Selected Cities", statistics);

// === EXPORT DATA ===
// 1. Export statistics as CSV
Export.table.toDrive({
  collection: statistics,
  description: "UHII_Statistics_Cities",
  folder: "modelling",
  fileFormat: "CSV"
});

// Function to format names properly
function formatName(name) {
  return name.replace(/\s+/g, "_").toLowerCase(); // Replace spaces with underscores & lowercase
}

// 2. Export raster layers as GeoTIFF for each city and dataset
cityCollection.evaluate(function(cityList) {
  cityList.features.forEach(function(cityFeature) {
    var city = ee.Feature(cityFeature);
    var cityName = formatName(cityFeature.properties.city);  // Extract city name correctly
    
    datasets.forEach(function(dataset) {
      var datasetName = formatName(dataset.name); // Format dataset name
      var image = dataset.collection.median().clip(city.geometry());

      // Construct a clean and readable export description (fixing ES5 syntax issue)
      var exportName = "UHII_" + datasetName + "_" + cityName;
      
      Export.image.toDrive({
        image: image,
        description: exportName,  // Clean task name
        folder: "modelling",
        scale: 30,
        region: city.geometry(),
        fileFormat: "GeoTIFF",
        maxPixels: 1e13
      });
    });
  });
});

