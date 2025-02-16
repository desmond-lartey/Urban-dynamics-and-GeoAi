// Load the FAO GAUL dataset for Lagos, Nigeria
var gaul_adm1 = ee.FeatureCollection("FAO/GAUL/2015/level1");

// Extract Lagos, Nigeria as the AOI
var lagos = gaul_adm1.filter(ee.Filter.and(
  ee.Filter.eq('ADM1_NAME', 'Lagos'),
  ee.Filter.eq('ADM0_NAME', 'Nigeria')
)).geometry();

// Assign Lagos AOI
var AOI = lagos;

// Center the map and visualize Lagos AOI
Map.centerObject(AOI, 10);
Map.addLayer(AOI, {color: 'blue'}, 'Lagos AOI', false);
print('Lagos AOI:', AOI);

// Function to Mask Clouds for Landsat 7
function maskL7sr(image) {
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  return image.updateMask(qaMask).updateMask(saturationMask);
}

// Function to Mask Clouds for Landsat 8
function maskL8sr(image) {
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  return image.updateMask(qaMask).updateMask(saturationMask);
}

// Function to Apply Scaling Factors for Reflectance & Thermal Bands
function scaleImage(image) {
  var opticalBands = image.select('SR_B.*').multiply(0.0000275).add(-0.2);
  
  // Check if ST_B6 (Landsat 7) or ST_B10 (Landsat 8) exists
  var thermalBand = ee.Algorithms.If(
    image.bandNames().contains('ST_B6'),
    image.select('ST_B6').multiply(0.00341802).add(149.0),  // Landsat 7 Thermal Scaling
    ee.Image(0) // Avoid errors in case ST_B6 does not exist
  );

  var thermalBandL8 = ee.Algorithms.If(
    image.bandNames().contains('ST_B10'),
    image.select('ST_B10').multiply(0.00341802).add(149.0),  // Landsat 8 Thermal Scaling
    ee.Image(0) // Avoid errors in case ST_B10 does not exist
  );

  return opticalBands
    .addBands(ee.Image(thermalBand)) // Add Landsat 7 thermal band if available
    .addBands(ee.Image(thermalBandL8)) // Add Landsat 8 thermal band if available
    .copyProperties(image, image.propertyNames());
}


// Function to fill gaps in Landsat 7 using focal mean & Gaussian smoothing
function fillGaps(image) {
  var filled1 = image.focal_mean(1, 'square', 'pixels', 5);
  var filled2 = image.focal_mean(2, 'square', 'pixels', 5);
  var filled3 = image.focal_mean(3, 'square', 'pixels', 5);
  
  // Apply Gaussian smoothing to improve gap-filling
  var smoothed = image.convolve(ee.Kernel.gaussian(5));
  
  // Combine the different scales of filling
  return image.unmask(filled1)
              .unmask(filled2)
              .unmask(filled3)
              .unmask(smoothed);
}

// Define visualization parameters for **true color**
var vis_params_l7 = {
  bands: ['SR_B3', 'SR_B2', 'SR_B1'],  // Landsat 7: Red, Green, Blue
  min: 0,
  max: 0.3,  // Adjust based on scaled reflectance values
  gamma: 1.3
};

var vis_params_l8 = {
  bands: ['SR_B4', 'SR_B3', 'SR_B2'],  // Landsat 8: Red, Green, Blue
  min: 0,
  max: 0.3,  // Adjust to lower reflectance values
  gamma: 1.3
};

// Process Landsat 7 (2000-2012) & Landsat 8 (2013-2024)
var startYear = 2000;
var endYear = 2024;

for (var year = startYear; year <= endYear; year++) {
  
    var startDate = ee.Date.fromYMD(year, 1, 1);
    var endDate = ee.Date.fromYMD(year, 12, 31);

    var final_composite;

    if (year <= 2012) {
        // Define start and end dates properly
        var startYearDate = ee.Date.fromYMD(year - 3, 1, 1);
        var endYearDate = ee.Date.fromYMD(year + 3, 12, 31);

        // Landsat 7: Apply Cloud Masking, Gap-Filling & Scaling
        var l7_collection = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
    .filterBounds(AOI)
    .filterDate(startYearDate, endYearDate)
    .filter(ee.Filter.lt('CLOUD_COVER', 20))
    .map(maskL7sr)  // Cloud Masking before scaling
    .map(scaleImage) // Apply scaling before median()
    .map(fillGaps);  // Gap-filling after scaling

var l7_composite = l7_collection.median().clip(AOI);


final_composite = l7_composite;


    } else {
        // Landsat 8: Apply Cloud Masking & Scaling (No Gap-Filling)
        var l8_collection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(AOI)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUD_COVER', 10))
    .map(maskL8sr)  // Cloud Masking before scaling
    .map(scaleImage); // Scaling before median()

var l8_composite = l8_collection.median().clip(AOI);


final_composite = l8_composite;

    }

    // Choose correct visualization bands for each year
    var vis_params = (year <= 2012) ? vis_params_l7 : vis_params_l8;

    // Add layer for visualization
    Map.addLayer(final_composite, vis_params, 'Gap-Filled Image ' + year, true);

    // Export each year's image to Google Drive
    Export.image.toDrive({
    image: (year <= 2012) ? 
        final_composite.select(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7', 'ST_B6']) :
        final_composite.select(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7', 'ST_B10']),
    description: 'Lagos_GapFilled_' + year,
    folder: 'modelling',
    scale: 30,
    region: AOI,
    fileDimensions: 7680,
    maxPixels: 1e9
});

}

// Print a confirmation message
print('Processing and exporting gap-filled images from 2000 to 2024.');