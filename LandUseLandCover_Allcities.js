
/*ESRI Classes interested for our anlysis:

1: Water
5: Built Area
2, 4, 9: Vegetation
6: Bare Ground
*/

var classCodes = [1, 2, 4, 5, 6, 9]; // Only selecting relevant pixel values

// Define a dictionary which will be used to make legend and visualize image on map
var dict = {
  "names": [
    "Water",
    "Trees",
    "Flooded Vegetation",
    "Crops",
    "Built Area",
    "Bare Ground",
    "Snow/Ice",
    "Clouds",
    "Rangeland"
  ],
  "colors": [
    "#1A5BAB",
    "#358221",
    "#87D19E",
    "#FFDB5C",
    "#ED022A",
    "#EDE9E4",
    "#F2FAFF",
    "#C8C8C8",
    "#C6AD8D"
  ]};
  
// Function to remap and filter only selected pixel values
function remapper(image){
    var remapped = image.remap(classCodes, classCodes, 0).selfMask(); // Ensure unwanted values are masked
    return remapped;
}

// This palette has '#000000' for non-selected values
var palette = [
    "#1A5BAB",
    "#358221",
    "#000000",
    "#87D19E",
    "#FFDB5C",
    "#000000",
    "#ED022A",
    "#EDE9E4",
    "#F2FAFF",
    "#C8C8C8",
    "#C6AD8D",
  ];

// Create a panel to hold the legend widget
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});

// Function to generate the legend
function addCategoricalLegend(panel, dict, title) {
  
  // Create and add the legend title.
  var legendTitle = ui.Label({
    value: title,
    style: {
      fontWeight: 'bold',
      fontSize: '18px',
      margin: '0 0 4px 0',
      padding: '0'
    }
  });
  panel.add(legendTitle);
  
  var loading = ui.Label('Loading legend...', {margin: '2px 0 4px 0'});
  panel.add(loading);
  
  // Creates and styles 1 row of the legend.
  var makeRow = function(color, name) {
    // Create the label that is actually the colored box.
    var colorBox = ui.Label({
      style: {
        backgroundColor: color,
        // Use padding to give the box height and width.
        padding: '8px',
        margin: '0 0 4px 0'
      }
    });
  
    // Create the label filled with the description text.
    var description = ui.Label({
      value: name,
      style: {margin: '0 0 4px 6px'}
    });
  
    return ui.Panel({
      widgets: [colorBox, description],
      layout: ui.Panel.Layout.Flow('horizontal')
    });
  };
  
  // Get the list of palette colors and class names from the image.
  var palette = dict['colors'];
  var names = dict['names'];
  loading.style().set('shown', false);
  
  for (var i = 0; i < names.length; i++) {
    panel.add(makeRow(palette[i], names[i]));
  }
  
  Map.add(panel);
  
}


// Define administrative boundaries for the cities of interest
var gaul_adm1 = ee.FeatureCollection("FAO/GAUL/2015/level1");

// List of cities and their respective ADM1 names
var cities = [
  {name: "Lagos", country: "Nigeria", adm1_name: "Lagos"},
  {name: "Nairobi", country: "Kenya", adm1_name: "Nairobi"},
  {name: "Johannesburg", country: "South Africa", adm1_name: "Gauteng"},
  {name: "Kinshasa", country: "Democratic Republic of the Congo", adm1_name: "Kinshasa"}
];

// Function to extract and visualize LULC data for each city and export
// Function to extract and visualize LULC data for each city and export
function getLULCLayer(startDate, endDate, year, city) {
  var region = gaul_adm1
    .filter(ee.Filter.eq("ADM0_NAME", city.country))
    .filter(ee.Filter.eq("ADM1_NAME", city.adm1_name))
    .geometry();

  var collection = esri_lulc10.filterDate(startDate, endDate);
  if (collection.size().getInfo() > 0) {
    var mosaic = collection.mosaic();
    var clipped = mosaic.clip(region);
    var remapped = remapper(clipped);
    
    // Ensure a valid task name
    var validTaskName = (city.name + '_' + year)
      .replace(/\s+/g, '_')  // Replace spaces with underscores
      .replace(/_+/g, '_');   // Remove duplicate underscores
    
    Map.addLayer(remapped, {min: 1, max: 9, palette: dict['colors']}, validTaskName);

    // Export image to Google Drive
    Export.image.toDrive({
      image: remapped,
      description: validTaskName,
      folder: "modelling",
      fileNamePrefix: validTaskName,
      scale: 30,
      region: region,
      maxPixels: 1e13
    });
  } else {
    print('No ESRI LULC data available for ' + city.name + ' ' + year);
  }
}



// Loop through cities and add layers and export
cities.forEach(function(city) {
  getLULCLayer('2017-01-01', '2017-12-31', '2017 LULC 10m', city);
  getLULCLayer('2018-01-01', '2018-12-31', '2018 LULC 10m', city);
  getLULCLayer('2019-01-01', '2019-12-31', '2019 LULC 10m', city);
  getLULCLayer('2020-01-01', '2020-12-31', '2020 LULC 10m', city);
  getLULCLayer('2021-01-01', '2021-12-31', '2021 LULC 10m', city);
  getLULCLayer('2022-01-01', '2022-12-31', '2022 LULC 10m', city);
  getLULCLayer('2023-01-01', '2023-12-31', '2023 LULC 10m', city);
});
