const bcrypt = require("bcrypt");
const express = require("express");
const jsforce = require("jsforce");
const multer = require("multer");
require("dotenv").config();
const { addJewelryModel } = require("./addjewlery");
const chrome = require('@puppeteer/browsers');
const {submitOrder} = require("./submitOrder");
const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage });
const fs = require('fs');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer-core');
const cors = require('cors');
const axios = require('axios'); // Import axios
var bodyParser = require('body-parser')

app.use(bodyParser.json({ limit: '100mb' }));  // Adjust as needed
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

//cors

app.use(cors({
  origin: [
    "app://-",
    "http://localhost:3000", // Localhost for development
    "http://localhost:3001",
    "https://atmalogicerp.vercel.app" // Replace with your actual Vercel frontend URL
  ],
  credentials: true, // Allow credentials (cookies, authorization headers)
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allowed HTTP methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
}));
// Middlew
app.use(express.json());

// Salesforce Connection
let conn;
let isConnected = false;

// Initialize Salesforce Connection
async function initializeSalesforceConnection() {
  try {
    conn = new jsforce.Connection({
      loginUrl: process.env.SALESFORCE_LOGIN_URL,
    });
    await conn.login(process.env.SALESFORCE_USERNAME, process.env.SALESFORCE_PASSWORD);
    isConnected = true;
    console.log("Connected to Salesforce");
  } catch (error) {
    console.error("Failed to connect to Salesforce:", error.message || error);
    process.exit(1);
  }
}
initializeSalesforceConnection();

// Middleware to check Salesforce connection
function checkSalesforceConnection(req, res, next) {
  if (!isConnected) {
    return res.status(500).json({ success: false, error: "Salesforce connection not established." });
  }
  next();
}

/** ----------------- User Authentication ------------------ **/

// Login Endpoint
app.post("/login", checkSalesforceConnection, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password are required." });
    }

    const query = `
      SELECT Id, Username_c__c, Password_c__c, 	Status_c__c
      FROM CustomUser_c__c
      WHERE Username_c__c = '${username}' LIMIT 1
    `;
    const result = await conn.query(query);

    if (result.records.length === 0) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    const user = result.records[0];
    if (user.Status_c__c !== "Active") {
      return res.status(403).json({ success: false, error: "User is inactive." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.Password_c__c);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: "Invalid password." });
    }

    res.json({ success: true, message: "Login successful", userId: user.Id });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
});

/** ----------------- Item Groups Management ------------------ **/

// Create Item Group
app.post("/add-item-group", checkSalesforceConnection, async (req, res) => {
  try {
    const { itemGroupName } = req.body;

    if (!itemGroupName) {
      return res.status(400).json({ success: false, error: "Item group name is required." });
    }

    const result = await conn.sobject("ItemGroup__c").create({ ItemGroupName__c: itemGroupName });
    if (result.success) {
      res.json({ success: true, message: "Item group created.", id: result.id });
    } else {
      res.status(500).json({ success: false, error: "Failed to create item group.", details: result.errors });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch Item Groups
app.get("/item-groups", checkSalesforceConnection, async (req, res) => {
  try {
    const query = `
      SELECT Id, ItemGroupName__c
      FROM ItemGroup__c
      ORDER BY ItemGroupName__c
    `;
    const result = await conn.query(query);

    if (result.records.length === 0) {
      return res.status(404).json({ success: false, message: "No item groups found." });
    }

    res.json({ success: true, data: result.records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** ----------------- Product Groups Management ------------------ **/

// Create Product Group
app.post("/add-product-group", checkSalesforceConnection, async (req, res) => {
  try {
    const { productGroupName } = req.body;

    if (!productGroupName) {
      return res.status(400).json({ success: false, error: "Product group name is required." });
    }

    const result = await conn.sobject("Product_Group__c").create({
      Name: productGroupName, // Assign productGroupName to the Name field
      ProductGroupName__c: productGroupName, // Assign productGroupName to the custom field
    });;
    if (result.success) {
      res.json({ success: true, message: "Product group created.", id: result.id });
    } else {
      res.status(500).json({ success: false, error: "Failed to create product group.", details: result.errors });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch Product Groups
app.get("/product-groups", checkSalesforceConnection, async (req, res) => {
  try {
    const query = `
      SELECT Id, ProductGroupName__c
      FROM Product_Group__c
      ORDER BY ProductGroupName__c
    `;
    const result = await conn.query(query);

    if (result.records.length === 0) {
      return res.status(404).json({ success: false, message: "No product groups found." });
    }

    res.json({ success: true, data: result.records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** ----------------- Size Groups Management ------------------ **/

// Create Size Group
app.post("/add-size-group", checkSalesforceConnection, async (req, res) => {
  try {
    const { sizeGroupName } = req.body;

    if (!sizeGroupName) {
      return res.status(400).json({ success: false, error: "Size group name is required." });
    }

    const result = await conn.sobject("jewlerysize__c").create({ Size__c: sizeGroupName });
    if (result.success) {
      res.json({ success: true, message: "Size group created.", id: result.id });
    } else {
      res.status(500).json({ success: false, error: "Failed to create size group.", details: result.errors });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch Size Groups
app.get("/size-groups", checkSalesforceConnection, async (req, res) => {
  try {
    const query = `
      SELECT Id, Size__c
      FROM jewlerySize__c
      ORDER BY Size__c
    `;
    const result = await conn.query(query);

    if (result.records.length === 0) {
      return res.status(404).json({ success: false, message: "No size groups found." });
    }

    res.json({ success: true, data: result.records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** ----------------- Jewelry Category Management ------------------ **/


app.post("/add-jewelry-category", checkSalesforceConnection, async (req, res) => {
    try {
      const {
        itemGroup = null,
        categoryName = null,
        categoryCode = null,
        productGroup = null,
        rate = null,
        hsn = null,
        maxOrderQty = null,
        size = null,
        color = null,
      } = req.body;
  
      // Validate mandatory fields (adjust based on your requirements)
      if (!categoryName || !categoryCode) {
        return res.status(400).json({
          success: false,
          error: "Category Name and Category Code are required fields.",
        });
      }
  
      // Create new JewelryCategory__c record
      const result = await conn.sobject("Jewelry_Category__c").create({
        ItemGroup__c: itemGroup,
        Name: categoryName,
        Category_Code__c: categoryCode,
        Product_Group__c: productGroup,
        Rate__c: rate,
        HSN__c: hsn,
        Max_Order_Qty__c: maxOrderQty,
        Size__c: size,
        Color__c: color,
      });
  
      if (result.success) {
        res.status(200).json({
          success: true,
          message: "Jewelry category added successfully",
          id: result.id,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to create jewelry category",
          details: result.errors,
        });
      }
    } catch (error) {
      console.error("Error adding jewelry category:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        details: error.message,
      });
    }
  });

  app.get("/Category-groups", checkSalesforceConnection, async (req, res) => {
    try {
      const query = `
        SELECT Name
        FROM Jewelry_Category__c
        ORDER BY Name
      `;
      const result = await conn.query(query);
  
      if (result.records.length === 0) {
        return res.status(404).json({ success: false, message: "No Category groups found." });
      }
  
      res.json({ success: true, data: result.records });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

/** ----------------- Jewelry Model Management ------------------ **/

// Add Jewelry Model
app.post("/api/add-jewelry", upload.single("item-image"), async (req, res) => {
  try {
    console.log("Received a request to add a jewelry model");

    // Parse the request body
    let jewelryModelData, stoneDetailsData;
    try {
      jewelryModelData = JSON.parse(req.body.jewelryModel); // Parse jewelry model data
      stoneDetailsData = JSON.parse(req.body.stoneDetails); // Parse stone details data
      console.log("Parsed request body successfully:", { jewelryModelData, stoneDetailsData });
    } catch (parseError) {
      console.error("Error parsing request body:", parseError.message);
      return res.status(400).json({
        success: false,
        message: "Invalid request body. Failed to parse JSON.",
        error: parseError.message,
      });
    }

    // Validate the jewelry model data
    if (!jewelryModelData || Object.keys(jewelryModelData).length === 0) {
      console.error("Jewelry model data is missing or empty.");
      return res.status(400).json({
        success: false,
        message: "Jewelry model data is required.",
      });
    }

    console.log("Adding jewelry model:", jewelryModelData);

    // Add jewelry model to Salesforce with attachment
    const jewelryModelResult = await addJewelryModel(conn, jewelryModelData, req.file);

    if (!jewelryModelResult.success) {
      console.error("Failed to create Jewelry Model:", jewelryModelResult);
      return res.status(500).json({
        success: false,
        message: "Failed to create Jewelry Model",
        details: jewelryModelResult,
      });
    }

    const jewelryModelId = jewelryModelResult.recordId;
    console.log("Jewelry Model created successfully with ID:", jewelryModelId);

    // Process stone details
    if (Array.isArray(stoneDetailsData) && stoneDetailsData.length > 0) {
      console.log("Processing stone details:", stoneDetailsData);

      // Ensure required fields for stone details
      const requiredStoneFields = ["name", "type", "color", "size", "Quantity"];
      const invalidStones = stoneDetailsData.filter((stone) =>
        requiredStoneFields.some((field) => !stone[field])
      );

      if (invalidStones.length > 0) {
        console.error("Some stone details are invalid:", invalidStones);
        return res.status(400).json({
          success: false,
          message: "Some stone details are invalid. Missing required fields.",
          invalidStones,
        });
      }

      const stoneRecords = stoneDetailsData.map((stone) => ({
        Name: stone.name,
        Stone_Type__c: stone.type,
        Color__c: stone.color,
        Stone_Size__c: stone.size,
        Quantity__c: stone.Quantity,
        JewelryModel__c: jewelryModelId,
      }));

      console.log("Prepared stone records for insertion:", stoneRecords);

      // Insert stone details
      const stoneDetailsResult = await conn.sobject("Stone_Details__c").insert(stoneRecords);
      const failedStones = stoneDetailsResult.filter((result) => !result.success);

      if (failedStones.length > 0) {
        console.error("Some stone details failed to insert:", JSON.stringify(failedStones, null, 2));
        return res.status(500).json({
          success: false,
          message: "Failed to add some stone details",
          failedStones,
        });
      }

      console.log("All stone details added successfully.");
    } else {
      console.warn("No stone details provided or invalid data format.");
    }

    // Success response
    res.status(200).json({
      success: true,
      message: "Jewelry model and stone details added successfully",
      jewelryModelId,
      imageUrl: jewelryModelResult.imageUrl, // Get imageUrl from the jewelry model result
    });
  } catch (error) {
    console.error("Error processing request:", error.message);
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred",
      error: error.message,
    });
  }
});

// Fetch jewelry models with an optional category filter
app.get("/api/jewelry-models", checkSalesforceConnection, async (req, res) => {
  try {
    console.log("Fetching jewelry models...");
    const { Category } = req.query;

    // First get the jewelry models
    let jewelryQuery = `
      SELECT Id, Name, Category__c, Material__c, Style__c, Color__c, Purity__c, 
             Master_Weight__c, Net_Weight__c, Stone_Weight__c, Rate__c, Image_URL__c, Size__c,Gross_Weight__c
      FROM Jewlery_Model__c
    `;

    if (Category) {
      jewelryQuery += ` WHERE Category__c = '${Category}'`;
    }
    jewelryQuery += ` ORDER BY Name`;

    const result = await conn.query(jewelryQuery);

    if (result.records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No jewelry models found.",
      });
    }

    // Format the response data and pass the image URLs directly
    const responseData = result.records.map((model) => ({
      Id: model.Id,
      Name: model.Name,
      Category: model.Category__c,
      Material: model.Material__c,
      Style: model.Style__c,
      Color: model.Color__c,
      Purity: model.Purity__c,
      MasterWeight: model.Master_Weight__c,
      NetWeight: model.Net_Weight__c,
      StoneWeight: model.Stone_Weight__c,
      Rate: model.Rate__c,
      GrossWeight: model.Gross_Weight__c,
      Size :model.Size__c	,
      
      // Pass through the full distribution URL
      ImageURL: model.Image_URL__c || null
    }));

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching jewelry models:", error.message);
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred.",
      error: error.message,
    });
  }
});

// Fetch customer Groups
app.get("/customer-groups", checkSalesforceConnection, async (req, res) => {
  try {
    const query = `
      SELECT Id,Party_Code__c
      FROM Party_Ledger__c
      ORDER BY Party_Code__c
    `;
    const result = await conn.query(query);

    if (result.records.length === 0) {
      return res.status(404).json({ success: false, message: "No customer groups found." });
    }

    res.json({ success: true, data: result.records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


/**----------------------Order Management---------------**/
app.post('/api/orders', upload.single('pdfFile'), async (req, res) => {
  try {
      const orderData = JSON.parse(req.body.orderData);
      const result = await submitOrder(conn, orderData, req.file);
      
      res.json({
          success: true,
          message: 'Order saved successfully',
          data: result
      });

  } catch (error) {
      console.error('Error saving order:', error);
      res.status(500).json({
          success: false,
          message: 'Error saving order',
          error: error.message
      });
  }
});


async function uploadFileToSalesforce(file) {
  try {
      const fileData = file.buffer;
      const fileName = `Order_${Date.now()}.pdf`;

      // Create ContentVersion
      const contentVersion = await conn.sobject('ContentVersion').create({
          Title: fileName,
          PathOnClient: fileName,
          VersionData: fileData.toString('base64'),
          IsMajorVersion: true
      });

      // Get ContentDocumentId
      const versionDetails = await conn.sobject('ContentVersion')
          .select('Id, ContentDocumentId')
          .where({ Id: contentVersion.id })
          .execute();

      return {
          id: contentVersion.id,
          contentDocumentId: versionDetails[0].ContentDocumentId
      };
  } catch (error) {
      console.error('Error uploading to Salesforce:', error);
      throw error;
  }
}

/*-------Fetch order number--------*/

app.get('/api/getLastOrderNumber', checkSalesforceConnection, async (req, res) => {
  const { partyLedgerValue } = req.query;

  if (!partyLedgerValue) {
      return res.status(400).json({
          success: false,
          message: 'partyLedgerValue is required'
      });
  }

  try {
      // Query to fetch the latest order for the given PartyLedger
      const query = `
          SELECT Order_Id__c 
          FROM Order__c
          WHERE Party_Ledger__c IN (
              SELECT Id 
              FROM Party_Ledger__c 
              WHERE Party_Code__c = '${partyLedgerValue}'
          )
          ORDER BY CreatedDate DESC
          LIMIT 1
      `;

      const result = await conn.query(query);
      console.log('Query result:', result); // Debug log

      if (result.records.length === 0) {
          // No previous orders found, return null to let frontend start from 0001
          return res.json({
              success: true,
              lastOrderNumber: null  // Changed from '${partyLedgerValue}/0000'
          });
      }

      const lastOrderNumber = result.records[0].Order_Id__c;
      console.log('Last order number:', lastOrderNumber); // Debug log

      res.json({
          success: true,
          lastOrderNumber
      });

  } catch (error) {
      console.error('Salesforce Query Error:', error);
      res.status(500).json({
          success: false,
          message: 'Error fetching order number',
          error: error.message
      });
  }
});

/*------------------Order Mangement----------*/

app.get("/api/orders", async (req, res) => {
  try {
    const query = `
      SELECT Order_Id__c, Name, Party_Name__c, Delivery_Date__c, Advance_Metal__c, 
             Status__c, Pdf__c, Purity__c,	Remarks__c,	Created_By__c,	Created_Date__c
      FROM Order__c
    `;

    const result = await conn.query(query);

    const orders = result.records.map(order => ({
      id: order.Order_Id__c,
      partyName: order.Party_Name__c,
      deliveryDate: order.Delivery_Date__c,
      advanceMetal: order.Advance_Metal__c,
      status: order.Status__c,
      pdfUrl: `/api/download-file?url=${encodeURIComponent(order.Pdf__c)}`,
      purity : order.Purity__c,
      remarks : order.Remarks__c,
      created_by : order.Created_By__c,
      created_date : order.Created_Date__c


       // Proxy PDF URL
    }));

    res.json({ success: true, data: orders });

  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ success: false, error: "Failed to fetch orders from Salesforce" });
  }
});

// Proxy Endpoint for Fetching PDFs
app.get("/api/download-file", async (req, res) => {
  try {
    const fileUrl = req.query.url;
    console.log("File URL:", fileUrl); // Log the URL for debugging
    if (!fileUrl) {
      return res.status(400).json({ success: false, error: "File URL is required" });
    }

    const response = await axios.get(fileUrl, {
      headers: {
        "Authorization": `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`, // Ensure you have a valid token
      },
      responseType: 'stream', // Important for streaming the response
    });

    // Set headers and stream the file to the frontend
    res.setHeader("Content-Type", response.headers['content-type']);
    res.setHeader("Content-Disposition", response.headers['content-disposition']);
    response.data.pipe(res);

  } catch (error) {
    console.error("Error fetching file:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.post("/api/update-model", async (req, res) => {
  try {
    const { orderId, models, detailedPdf, imagesPdf } = req.body;

    if (!orderId || !models || !Array.isArray(models) || models.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data"
      });
    }

    // First, update the Order object's Department__c field to "Wax"
    try {
      await conn.sobject('Order__c').update({
        Department__c: 'Wax'
      });
      console.log('Successfully updated Order Department to Wax');
    } catch (error) {
      console.error('Error updating Order Department:', error);
      throw new Error('Failed to update Order Department');
    }

    // Continue with the rest of your existing code...
    const regularModels = models.filter(model => !model.isCanceled);
    const canceledModels = models.filter(model => model.isCanceled);

    let regularResponses = [];
    let canceledResponses = [];
    let regularPdfData = {};
    let canceledPdfData = {};

    // First verify if Order exists
    const orderQuery = await conn.query(
      `SELECT Id FROM Order__c WHERE Order_Id__c = '${orderId}' LIMIT 1`
    );

    if (!orderQuery.records || orderQuery.records.length === 0) {
      throw new Error(`Order not found with Order ID: ${orderId}`);
    }

    const salesforceOrderId = orderQuery.records[0].Id;

    // Helper function for content distribution
    const createContentDistribution = async (contentVersionId, title) => {
      try {
        const contentDistribution = await conn.sobject('ContentDistribution').create({
          Name: title,
          ContentVersionId: contentVersionId,
          PreferencesAllowViewInBrowser: true,
          PreferencesLinkLatestVersion: true,
          PreferencesNotifyOnVisit: false,
          PreferencesPasswordRequired: false,
          PreferencesAllowOriginalDownload: true
        });

        const distributionQuery = await conn.query(
          `SELECT DistributionPublicUrl FROM ContentDistribution WHERE Id = '${contentDistribution.id}'`
        );

        return distributionQuery.records[0].DistributionPublicUrl;
      } catch (error) {
        console.error('Error creating content distribution:', error);
        throw error;
      }
    };

    // Create regular models if any
    const createRegularModels = async () => {
      if (regularModels.length === 0) {
        console.log("No regular models to create");
        return [];
      }

      const modelRecords = regularModels.map(model => ({
        Name: model.item,
        Category__c: model.category,
        Purity__c: model.purity,
        Size__c: model.size,
        Color__c: model.color,
        Quantity__c: parseFloat(model.quantity) || 0,
        Gross_Weight__c: parseFloat(model.grossWeight) || 0,
        Stone_Weight__c: parseFloat(model.stoneWeight) || 0,
        Net_Weight__c: parseFloat(model.netWeight) || 0,
        Remarks__c: model.remarks,
        Order__c: salesforceOrderId
      }));

      try {
        const modelResponses = await conn.sobject('Order_Models__c').create(modelRecords);
        
        if (Array.isArray(modelResponses)) {
          const failures = modelResponses.filter(result => !result.success);
          if (failures.length > 0) {
            throw new Error(`Failed to create ${failures.length} regular models: ${JSON.stringify(failures.map(f => f.errors))}`);
          }
        }
        return modelResponses;
      } catch (error) {
        console.error('Error creating regular models:', error);
        throw error;
      }
    };

    // Create canceled models if any
    const createCanceledModels = async () => {
      if (canceledModels.length === 0) {
        console.log("No canceled models to create");
        return [];
      }

      const canceledRecords = canceledModels.map(model => ({
        Name: model.item,
        Category__c: model.category,
        Purity__c: model.purity,
        Size__c: model.size,
        Color__c: model.color,
        Quantity__c: parseFloat(model.quantity) || 0,
        Gross_Weight__c: parseFloat(model.grossWeight) || 0,
        Stone_Weight__c: parseFloat(model.stoneWeight) || 0,
        Net_Weight__c: parseFloat(model.netWeight) || 0,
        Remarks__c: model.remarks,
        Order__c: salesforceOrderId,
        //Cancellation_Date__c: new Date().toISOString()
      }));

      try {
        const canceledResponses = await conn.sobject('Order_Models_Canceled__c').create(canceledRecords);
        
        if (Array.isArray(canceledResponses)) {
          const failures = canceledResponses.filter(result => !result.success);
          if (failures.length > 0) {
            throw new Error(`Failed to create ${failures.length} canceled models: ${JSON.stringify(failures.map(f => f.errors))}`);
          }
        }
        return canceledResponses;
      } catch (error) {
        console.error('Error creating canceled models:', error);
        throw error;
      }
    };

    // Handle PDF creation for either type
    const createPDFs = async (modelId, isCanceled) => {
      try {
        const suffix = isCanceled ? 'Canceled_' : '';
        
        const detailedPdfResponse = await conn.sobject('ContentVersion').create({
          Title: `Order_${orderId}_${suffix}Detailed.pdf`,
          PathOnClient: `Order_${orderId}_${suffix}Detailed.pdf`,
          VersionData: detailedPdf
        });

        const imagesPdfResponse = await conn.sobject('ContentVersion').create({
          Title: `Order_${orderId}_${suffix}Images.pdf`,
          PathOnClient: `Order_${orderId}_${suffix}Images.pdf`,
          VersionData: imagesPdf
        });

        const detailedPdfUrl = await createContentDistribution(
          detailedPdfResponse.id,
          `Order_${orderId}_${suffix}Detailed.pdf`
        );

        const imagesPdfUrl = await createContentDistribution(
          imagesPdfResponse.id,
          `Order_${orderId}_${suffix}Images.pdf`
        );

        // Update the appropriate object
        const objectName = isCanceled ? 'Order_Models_Canceled__c' : 'Order_Models__c';
        await conn.sobject(objectName).update({
          Id: modelId,
          Order_sheet__c: detailedPdfUrl,
          Order_Image_sheet__c: imagesPdfUrl
        });

        return { detailedPdfUrl, imagesPdfUrl };
      } catch (error) {
        console.error('Error creating PDFs:', error);
        throw error;
      }
    };

    // Execute model creation
    if (regularModels.length > 0) {
      regularResponses = await createRegularModels();
      if (regularResponses.length > 0 && detailedPdf && imagesPdf) {
        regularPdfData = await createPDFs(regularResponses[0].id, false);
      }
    }

    if (canceledModels.length > 0) {
      canceledResponses = await createCanceledModels();
      if (canceledResponses.length > 0 && detailedPdf && imagesPdf) {
        canceledPdfData = await createPDFs(canceledResponses[0].id, true);
      }
    }

    res.json({
      success: true,
      message: "Models and PDFs processed successfully",
      data: {
        regularModels: regularResponses,
        canceledModels: canceledResponses,
        regularPdfs: regularPdfData,
        canceledPdfs: canceledPdfData
      }
    });

  } catch (error) {
    console.error("Error in update-model endpoint:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process models and PDFs"
    });
  }
});


/**------------Order and model fetching----------------- */
app.get("/api/order-details", async (req, res) => {
  try {
    const orderId = req.query.orderId;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    // First, get the order details
    const orderQuery = `
      SELECT 
        Id,
        Order_Id__c,
        Party_Name__c,
        Delivery_Date__c,
        Advance_Metal__c,
        Status__c,
        Purity__c,
        Remarks__c,
        Created_By__c,
        Created_Date__c,
        Pdf__c
      FROM Order__c
      WHERE Order_Id__c = '${orderId}'
      LIMIT 1
    `;

    const orderResult = await conn.query(orderQuery);

    if (!orderResult.records || orderResult.records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const orderDetails = orderResult.records[0];

    // Get regular models
    const modelsQuery = `
      SELECT 
        Id,
        Name,
        Category__c,
        Purity__c,
        Size__c,
        Color__c,
        Quantity__c,
        Gross_Weight__c,
        Stone_Weight__c,
        Net_Weight__c,
        Batch_No__c,
        Tree_No__c,
        Remarks__c,
        Order_sheet__c,
        Order_Image_sheet__c,
        Order__c
      FROM Order_Models__c
      WHERE Order__c = '${orderDetails.Id}'
    `;

    // Get canceled models
    const canceledModelsQuery = `
      SELECT 
        Id,
        Name,
        Category__c,
        Purity__c,
        Size__c,
        Color__c,
        Quantity__c,
        Gross_Weight__c,
        Stone_Weight__c,
        Net_Weight__c,
        Batch_No__c,
        Tree_No__c,
        Remarks__c,
        Order_sheet__c,
        Order_Image_sheet__c,
        Order__c
      FROM Order_Models_Canceled__c
      WHERE Order__c = '${orderDetails.Id}'
    `;

    // Execute both queries in parallel
    const [modelsResult, canceledModelsResult] = await Promise.all([
      conn.query(modelsQuery),
      conn.query(canceledModelsQuery)
    ]);

    // Format the response
    const response = {
      orderDetails: {
        orderId: orderDetails.Order_Id__c,
        partyName: orderDetails.Party_Name__c,
        deliveryDate: orderDetails.Delivery_Date__c,
        advanceMetal: orderDetails.Advance_Metal__c,
        status: orderDetails.Status__c,
        purity: orderDetails.Purity__c,
        remarks: orderDetails.Remarks__c,
        createdBy: orderDetails.Created_By__c,
        createdDate: orderDetails.Created_Date__c,
        pdf: orderDetails.Pdf__c
      },
      regularModels: modelsResult.records.map(model => ({
        id: model.Id,
        name: model.Name,
        category: model.Category__c,
        purity: model.Purity__c,
        size: model.Size__c,
        color: model.Color__c,
        quantity: model.Quantity__c,
        grossWeight: model.Gross_Weight__c,
        stoneWeight: model.Stone_Weight__c,
        netWeight: model.Net_Weight__c,
        batchNo: model.Batch_No__c,
        treeNo: model.Tree_No__c,
        remarks: model.Remarks__c,
        orderSheet: model.Order_sheet__c,
        orderImageSheet: model.Order_Image_sheet__c
      })),
      canceledModels: canceledModelsResult.records.map(model => ({
        id: model.Id,
        name: model.Name,
        category: model.Category__c,
        purity: model.Purity__c,
        size: model.Size__c,
        color: model.Color__c,
        quantity: model.Quantity__c,
        grossWeight: model.Gross_Weight__c,
        stoneWeight: model.Stone_Weight__c,
        netWeight: model.Net_Weight__c,
        batchNo: model.Batch_No__c,
        treeNo: model.Tree_No__c,
        remarks: model.Remarks__c,
        orderSheet: model.Order_sheet__c,
        orderImageSheet: model.Order_Image_sheet__c,
      }))
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch order details"
    });
  }
});

/**-----------------Ordrer status------------------- */
app.post("/api/update-order-status", async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    // First get the Salesforce record ID for the order
    const orderQuery = await conn.query(
      `SELECT Id FROM Order__c WHERE Order_Id__c = '${orderId}' LIMIT 1`
    );

    if (!orderQuery.records || orderQuery.records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Update the order status
    const updateResult = await conn.sobject('Order__c').update({
      Id: orderQuery.records[0].Id,
      Status__c: 'Finished'
    });

    if (!updateResult.success) {
      throw new Error('Failed to update order status');
    }

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: {
        orderId,
        status: 'Finished'
      }
    });

  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update order status"
    });
  }
});


/**------------------- Inventory Management-------------------- */

app.post("/update-inventory", async (req, res) => {
  try {
    const { itemName, purity, availableWeight, unitOfMeasure } = req.body;

    // Validate required fields
    if (!itemName || !purity || !availableWeight || !unitOfMeasure) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // First, check if the item already exists
    const existingItem = await conn.query(
      `SELECT Id FROM Inventory_ledger__c 
       WHERE Item_Name__c = '${itemName}' 
       AND Purity__c = '${purity}'`
    );

    let result;
    
    if (existingItem.records.length > 0) {
      // Update existing record
      result = await conn.sobject('Inventory_ledger__c').update({
        Id: existingItem.records[0].Id,
        Available_Weight__c: parseFloat(availableWeight),
        Unit_of_Measure__c: unitOfMeasure,
        Last_Updated__c: new Date().toISOString()
      });
    } else {
      // Create new record
      result = await conn.sobject('Inventory_ledger__c').create({
        Name: itemName,
        Item_Name__c: itemName,
        Purity__c: purity,
        Available_Weight__c: parseFloat(availableWeight),
        Unit_of_Measure__c: unitOfMeasure,
        Last_Updated__c: new Date().toISOString()
      });
    }

    if (!result.success) {
      throw new Error('Failed to update inventory');
    }

    res.status(200).json({
      success: true,
      message: "Inventory updated successfully",
      data: result
    });

  } catch (error) {
    console.error("Error updating inventory:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update inventory"
    });
  }
});


app.get("/get-inventory", async (req, res) => {
  try {
    // Query to fetch inventory items with their names and available weights
    const query = `
      SELECT 
        Name,
        Item_Name__c,
        Available_weight__c,
        Purity__c
      FROM Inventory_ledger__c
      ORDER BY Name ASC
    `;

    const result = await conn.query(query);

    if (!result.records) {
      return res.status(404).json({
        success: false,
        message: "No inventory items found"
      });
    }

    // Format the response data
    const inventoryItems = result.records.map(item => ({
      name: item.Item_Name__c,
      availableWeight: item.Available_weight__c,
      purity: item.Purity__c
    }));

    res.status(200).json({
      success: true,
      message: "Inventory items fetched successfully",
      data: inventoryItems
    });

  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch inventory items"
    });
  }
});

/**--------------------------Casting Management---------- **/

app.post("/api/casting", async (req, res) => {
  try {
    const {
      castingNumber,
      date,
      orders,
      waxTreeWeight,
      purity,
      calculatedWeight,
      purityPercentages,
      requiredMetals,
      issuedItems,
      totalIssued
    } = req.body;

    // Format date for Salesforce
    const formatSalesforceDate = (dateStr) => {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };

    const formattedDate = formatSalesforceDate(date);

    // Validate required fields
    if (!castingNumber || !date || !orders || orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing"
      });
    }

    // 1. Create Casting Record
    const castingResult = await conn.sobject('Casting_dept__c').create({
      Name: castingNumber,
      Issued_Date__c: formattedDate,
      Wax_Tree_Weight__c: waxTreeWeight,
      Required_Purity__c: purity,
      Gold_Tree_Weight__c: calculatedWeight,
      Required_Pure_Metal_Casting__c: requiredMetals.pureGold,
      Required_Alloy_for_Casting__c: requiredMetals.alloy,
      Issud_weight__c: totalIssued,
      status__c: "Pending"
    });

    if (!castingResult.success) {
      throw new Error('Failed to create casting record');
    }

    //2
    const orderQuery = await conn.query(
      `SELECT Id,Order_Id__c FROM Order__c WHERE Order_Id__c IN ('${orders.join("','")}')`
    );
    
    if (!orderQuery.records || orderQuery.records.length !== orders.length) {
      throw new Error('Some orders were not found');
    }
    
    // Log the orders we found
    console.log('Found orders:', orderQuery.records);
    
    // Update all orders at once
    const orderUpdates = orderQuery.records.map(order => ({
      Id: order.Id,   
      //Id__c: order.Id__c,              // Changed from Id_c to Id__c to match query
      Order_Id__c: order.Order_Id__c,
      Casting__c: castingResult.id,
      Casting_Id__c: castingNumber              // Changed from Casting_Id__c to id__c
    }));
    
    console.log('Attempting to update orders with:', orderUpdates);
    
    const updateResults = await conn.sobject('Order__c').update(orderUpdates);
    
    console.log('Update results:', updateResults);
    
    if (!Array.isArray(updateResults)) {
      throw new Error('Failed to update orders: Not an array response');
    }
    
    const failedUpdates = updateResults.filter(result => !result.success);
    if (failedUpdates.length > 0) {
      console.log('Failed updates:', failedUpdates);
      throw new Error(`Failed to update ${failedUpdates.length} orders. Errors: ${JSON.stringify(failedUpdates)}`);
    }

    // 3. Create Inventory Issued Records
    const inventoryIssuedPromises = issuedItems.map(async (item) => {
      const result = await conn.sobject('Issued_inventory__c').create({
        Casting__c: castingResult.id,
        Name: item.itemName,
        Issued_Date__c: formattedDate,
        Purity__c: item.purity,
        Issue_Weight__c: item.issueWeight,
        Pure_Metal_weight__c: item.issuedGold,
        Alloy_Weight__c: item.issuedAlloy
      });

      if (!result.success) {
        throw new Error(`Failed to create inventory issued record for ${item.itemName}`);
      }

      return result;
    });

    await Promise.all(inventoryIssuedPromises);

 

    // All operations successful
    res.json({
      success: true,
      message: "Casting process completed successfully",
      data: {
        castingId: castingResult.id,
        castingNumber: castingNumber,
        totalIssuedWeight: totalIssued
      }
    });

  } catch (error) {
    console.error("Error in casting process:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to complete casting process"
    });
  }
});


app.get("/api/casting", async (req, res) => {
  try {
    const query = `
      SELECT Name, Issud_weight__c, Weight_Received__c,	Received_Date__c,Issued_Date__c,status__c,Casting_Loss__c
      FROM Casting_dept__c
    `;

    const result = await conn.query(query);

    const orders = result.records.map(order => ({
      Name: order.Name,
      Issued_weight: order.Issud_weight__c,
      Received_Weight: order.Weight_Received__c,
      Issued_Date: order.Issued_Date__c,
      Received_Date:order.Received_Date__c,
      status: order.status__c,
      Casting_Loss:order.Casting_Loss__c


    }));

    res.json({ success: true, data: orders });

  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ success: false, error: "Failed to fetch orders from Salesforce" });
  }
});

/**--------FETCHING CASTING DATA FROM SALESFORCE --------- */
app.get("/api/casting/:date/:month/:year/:number", async (req, res) => {
  try {
    const { date, month, year, number } = req.params;
    const castingId = `${date}/${month}/${year}/${number}`;

    // Validate input
    if (!castingId) {
      return res.status(400).json({
        success: false,
        message: "Casting ID is required"
      });
    }

    // 1. Get Casting details
    const castingQuery = await conn.query(
      `SELECT 
        Id,
        Name,
        Issued_Date__c,
        Wax_Tree_Weight__c,
        Required_Purity__c,
        Gold_Tree_Weight__c,
        Required_Pure_Metal_Casting__c,
        Required_Alloy_for_Casting__c,
        Issud_weight__c
       FROM Casting_dept__c
       WHERE Name = '${castingId}'`
    );

    if (!castingQuery.records || castingQuery.records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Casting not found"
      });

    }

    const casting = castingQuery.records[0];
    console.log('Found casting record:', casting);


    // 2. Get Related Orders
    const ordersQuery = await conn.query(
      `SELECT 
        Id,
        Order_Id__c,
        id__c,
        Casting__c
       FROM Order__c 
       WHERE Casting__c = '${casting.Id}'`
    );

    // 3. Get Related Inventory Items
    const inventoryQuery = await conn.query(
      `SELECT 
        Name,
        Issued_Date__c,
        Purity__c,
        Issue_Weight__c,
        Pure_Metal_weight__c,
        Alloy_Weight__c,
        Casting__c
       FROM Issued_inventory__c 
       WHERE Casting__c = '${casting.Id}'`
    );

    // 4. Prepare response
    const response = {
      success: true,
      data: {
        casting: castingQuery.records[0],
        orders: ordersQuery.records || [],
        inventoryItems: inventoryQuery.records || []
      },
      summary: {
        totalOrders: ordersQuery.records?.length || 0,
        totalInventoryItems: inventoryQuery.records?.length || 0,
        totalIssuedWeight: inventoryQuery.records?.reduce((sum, item) => 
          sum + (item.Issue_Weight__c || 0), 0) || 0,
        totalPureMetalWeight: inventoryQuery.records?.reduce((sum, item) => 
          sum + (item.Pure_Metal_weight__c || 0), 0) || 0,
        totalAlloyWeight: inventoryQuery.records?.reduce((sum, item) => 
          sum + (item.Alloy_Weight__c || 0), 0) || 0
      }
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching casting details:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch casting details"
    });
  }
});

/**-----------------Update Casting Received Weight ----------------- */
app.post("/api/casting/update/:date/:month/:year/:number", async (req, res) => {
  try {
    const { date, month, year, number } = req.params;
    const { receivedDate, receivedWeight, castingLoss } = req.body;
    const castingNumber = `${date}/${month}/${year}/${number}`;

    console.log('Looking for casting number:', castingNumber);
    console.log('Update data:', { receivedDate, receivedWeight, castingLoss });

    // First get the Casting record
    const castingQuery = await conn.query(
      `SELECT Id, Name FROM Casting_dept__c WHERE Name = '${castingNumber}'`
    );

    console.log('Casting query result:', castingQuery.records);

    if (!castingQuery.records || castingQuery.records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Casting not found"
      });
    }

    const casting = castingQuery.records[0];
    console.log('Found casting:', casting);

    // Update the casting record
    const updateData = {
      Id: casting.Id,
      Received_Date__c: receivedDate,
      Weight_Received__c: receivedWeight,
      Casting_Loss__c: castingLoss
    };

    console.log('Attempting to update with:', updateData);

    const updateResult = await conn.sobject('Casting_dept__c').update(updateData);

    console.log('Update result:', updateResult);

    if (!updateResult.success) {
      throw new Error('Failed to update casting record');
    }

    res.json({
      success: true,
      message: "Casting updated successfully",
      data: {
        castingNumber,
        receivedDate,
        receivedWeight,
        castingLoss
      }
    });

  } catch (error) {
    console.error("Error updating casting:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update casting"
    });
  }
});


/**-----------------Get all Casting Details  ----------------- */
app.get("/api/casting/all/:year/:month/:date/:number", async (req, res) => {
  try {
    const { date, month, year, number } = req.params;
    const castingId = `${date}/${month}/${year}/${number}`;

    // Validate input
    if (!castingId) {
      return res.status(400).json({
        success: false,
        message: "Casting ID is required"
      });
    }

    // 1. Get Casting details
    const castingQuery = await conn.query(
      `SELECT 
        Id,
        Name,
        Issued_Date__c,
        Wax_Tree_Weight__c,
        Required_Purity__c,
        Gold_Tree_Weight__c,
        Required_Pure_Metal_Casting__c,
        Required_Alloy_for_Casting__c,
        Issud_weight__c,
        Received_Date__c,
        Weight_Received__c,
        Casting_Loss__c
       FROM Casting_dept__c
       WHERE Name = '${castingId}'`
    );

    if (!castingQuery.records || castingQuery.records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Casting not found"
      });

    }

    const casting = castingQuery.records[0];
    console.log('Found casting record:', casting);


    // 2. Get Related Orders
    const ordersQuery = await conn.query(
      `SELECT 
        Id,
        Order_Id__c,
        id__c,
        Casting__c
       FROM Order__c 
       WHERE Casting__c = '${casting.Id}'`
    );

    // 3. Get Related Inventory Items
    const inventoryQuery = await conn.query(
      `SELECT 
        Name,
        Issued_Date__c,
        Purity__c,
        Issue_Weight__c,
        Pure_Metal_weight__c,
        Alloy_Weight__c,
        Casting__c
       FROM Issued_inventory__c 
       WHERE Casting__c = '${casting.Id}'`
    );

    // 4. Prepare response
    const response = {
      success: true,
      data: {
        casting: castingQuery.records[0],
        orders: ordersQuery.records || [],
        inventoryItems: inventoryQuery.records || []
      },
      summary: {
        totalOrders: ordersQuery.records?.length || 0,
        totalInventoryItems: inventoryQuery.records?.length || 0,
        totalIssuedWeight: inventoryQuery.records?.reduce((sum, item) => 
          sum + (item.Issue_Weight__c || 0), 0) || 0,
        totalPureMetalWeight: inventoryQuery.records?.reduce((sum, item) => 
          sum + (item.Pure_Metal_weight__c || 0), 0) || 0,
        totalAlloyWeight: inventoryQuery.records?.reduce((sum, item) => 
          sum + (item.Alloy_Weight__c || 0), 0) || 0
      }
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching casting details:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch casting details"
    });
  }
});


app.put("/api/update-inventoryweights", async (req, res) => {
  try {
    const { name, availableWeight } = req.body;

    // Validate required fields
    if (!name || availableWeight === undefined) {
      return res.status(400).json({
        success: false,
        message: "Item name and available weight are required"
      });
    }

    // Find the inventory item by name
    const queryResult = await conn.query(
      `SELECT Id FROM Inventory_ledger__c WHERE Name = '${name}'`
    );

    if (!queryResult.records || queryResult.records.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Inventory item '${name}' not found`
      });
    }

    // Update the inventory record with new weight
    const updateResult = await conn.sobject('Inventory_ledger__c').update({
      Id: queryResult.records[0].Id,
      Available_Weight__c: availableWeight,
      Last_Updated__c: new Date().toISOString()
    });

    if (!updateResult.success) {
      throw new Error(`Failed to update inventory for item: ${name}`);
    }

    res.json({
      success: true,
      message: "Inventory weight updated successfully",
      data: {
        itemName: name,
        newWeight: availableWeight
      }
    });

  } catch (error) {
    console.error("Error updating inventory weight:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update inventory weight"
    });
  }
});


/** ----------------- Start the Server ------------------ **/

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));







