// ============================================================
// WMS Google Apps Script Backend
// Paste this ENTIRE script into:
//   Your Google Sheet → Extensions → Apps Script
// Then click "Deploy" → "New Deployment" → "Web App"
//   Execute as: Me
//   Who has access: Anyone
// Copy the URL and paste it into .env.local as APPS_SCRIPT_URL
// ============================================================

const SPREADSHEET_ID = "14iW26B06PFTKr3nmdYT_3RmjqjGRww7J8atnU0rYiHA";

function doGet(e) {
  const action = e.parameter.action;
  if (action === "getCustomers") return getCustomers();
  if (action === "generateGrnId") return generateGrnId();
  if (action === "login") return loginUser(e.parameter.email, e.parameter.password);
  if (action === "getPendingGRNs") return getPendingGRNs();
  if (action === "getGRNDetails") return getGRNDetails(e.parameter.grnId);
  if (action === "getSKUs") return getSKUs();
  if (action === "getArrivedGRNs") return getArrivedGRNs();
  if (action === "getGRNsForPalletBuild") return getGRNsForPalletBuild();
  if (action === "generatePutawayId") return generatePutawayId();
  if (action === "generateDnId") return generateDnId();
  if (action === "generatePickId") return generatePickId(e.parameter.dnId);
  if (action === "getPickAssignmentData") return getPickAssignmentData(e.parameter.dnId, e.parameter.skuId);
  if (action === "getPicklistData") return getPicklistData(e.parameter.dnId);
  if (action === "getPalletDetails") return getPalletDetails(e.parameter.palletId);
  return jsonResponse({ status: "error", message: "Unknown action" });
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ status: "error", message: "Invalid JSON payload" });
  }
  const action = data.action;
  if (action === "signup") return signupUser(data);
  if (action === "vehicleEntry") return addVehicleEntry(data);
  if (action === "uploadFile") return uploadFileToDrive(data);
  if (action === "submitGRNEntry") return submitGRNEntry(data);
  if (action === "submitVehicleChecklist") return submitVehicleChecklist(data);
  if (action === "submitPalletBuild") return submitPalletBuild(data);
  if (action === "submitPalletBuildBulk") return submitPalletBuildBulk(data);
  if (action === "submitPutaway") return submitPutaway(data);
  if (action === "submitGrnIssue") return submitGrnIssue(data);
  if (action === "submitDnEntry") return submitDnEntry(data);
  if (action === "submitPickAssignment") return submitPickAssignment(data);
  if (action === "generatePicklistPDF") return generatePicklistPDF(data);
  if (action === "mergePallets") return mergePallets(data);
  return jsonResponse({ status: "error", message: "Unknown action" });
}

// ---- SIGNUP ----
function signupUser(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("USERS");
  if (!sheet) return jsonResponse({ status: "error", message: "Sheet 'USERS' not found." });
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][1] === data.email) return jsonResponse({ status: "error", message: "This email is already registered." });
  }
  const now = new Date();
  const timestamp = Utilities.formatDate(now, "GMT+5:30", "dd/MM/yyyy HH:mm:ss");

  sheet.appendRow([data.name, data.email, data.password, "PENDING", timestamp]);
  return jsonResponse({ status: "success" });
}

// ---- LOGIN ----
function loginUser(email, password) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("USERS");
  if (!sheet) return jsonResponse({ status: "error", message: "Sheet 'USERS' not found." });
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const sheetEmail = String(row[1]).trim().toLowerCase();
    const inputEmail = String(email).trim().toLowerCase();
    const sheetPassword = String(row[2]).trim();
    const inputPassword = String(password).trim();
    if (sheetEmail === inputEmail && sheetPassword === inputPassword) {
      return jsonResponse({ status: "success", name: row[0], email: row[1], access: String(row[3]).trim() });
    }
  }
  return jsonResponse({ status: "error", message: "Invalid email or password." });
}

// ---- GET CUSTOMERS ----
function getCustomers() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Customer_Master_01");
  if (!sheet) return jsonResponse({ status: "error", customers: [], message: "Sheet 'Customer_Master_01' not found." });
  const values = sheet.getRange("B2:B").getValues();
  const customers = values.map(row => row[0]).filter(v => v !== "");
  return jsonResponse({ status: "success", customers });
}

// ---- GENERATE GRN ID ----
function generateGrnId() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Vehicle_Entry_IB_1st");
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const yearMonth = `${year}${month}`;
  let newSeq = 1;
  if (sheet) {
    const values = sheet.getRange("A:A").getValues();
    const prefix = `GRN-DET-${yearMonth}-`;
    for (let i = values.length - 1; i >= 1; i--) {
      const id = values[i][0];
      if (id && id.startsWith(prefix)) {
        const seq = parseInt(id.replace(prefix, ""), 10);
        if (!isNaN(seq)) { newSeq = seq + 1; break; }
      }
    }
  }
  const grnId = `GRN-DET-${yearMonth}-${String(newSeq).padStart(4, "0")}`;
  return jsonResponse({ status: "success", grnId });
}

// ---- VEHICLE ENTRY ----
function addVehicleEntry(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Vehicle_Entry_IB_1st");
  if (!sheet) return jsonResponse({ status: "error", message: "Sheet 'Vehicle_Entry_IB_1st' not found." });
  sheet.appendRow([
    data.GRN_ID, data.Arrival_Time, data.Vehicle_Number, data.Driver_Name,
    data.Customer_Name, data.Invoice_Number, data.Invoice_Date, data.Invoice_URL || "",
    data.LR_Number, data.LR_Photo || "", data.Seal_Intact, data.Temp_Display_C || "",
    data.Created_By_Email
  ]);
  return jsonResponse({ status: "success" });
}

// ---- UPLOAD FILE TO GOOGLE DRIVE ----
function uploadFileToDrive(data) {
  try {
    const folder = DriveApp.getFolderById(data.folderId);
    const decoded = Utilities.base64Decode(data.base64Data);
    const blob = Utilities.newBlob(decoded, data.mimeType, data.fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return jsonResponse({ status: "success", url: file.getUrl(), id: file.getId() });
  } catch (err) {
    return jsonResponse({ status: "error", message: "File upload failed: " + err.message });
  }
}

// ---- GET PENDING GRNs (in Vehicle_Entry_IB_1st but NOT yet in GRN_Entry_IB_01) ----
function getPendingGRNs() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const vehicleSheet = ss.getSheetByName("Vehicle_Entry_IB_1st");
  const grnSheet = ss.getSheetByName("GRN_Entry_IB_01");
  if (!vehicleSheet) return jsonResponse({ status: "error", message: "Vehicle_Entry_IB_1st not found" });

  const vehicleValues = vehicleSheet.getRange("A2:M").getValues();
  // Get all GRN IDs already processed
  let processedIds = [];
  if (grnSheet) {
    const grnValues = grnSheet.getRange("A2:A").getValues();
    processedIds = grnValues.map(r => String(r[0]).trim()).filter(v => v !== "");
  }

  // Return only GRNs not yet in GRN_Entry_IB_01
  const pending = vehicleValues
    .filter(row => row[0] && !processedIds.includes(String(row[0]).trim()))
    .map(row => ({
      GRN_ID: row[0],
      Arrival_Time: row[1] ? new Date(row[1]).toLocaleString() : "",
      Vehicle_Number: row[2],
      Driver_Name: row[3],
      Customer_Name: row[4],
      Invoice_Number: row[5],
      Invoice_Date: row[6] ? Utilities.formatDate(new Date(row[6]), "Asia/Kolkata", "yyyy-MM-dd") : "",
      Invoice_URL: row[7],
      LR_Number: row[8],
      LR_Photo: row[9],
      Seal_Intact: row[10],
      Temp_Display_C: row[11],
      Created_By_Email: row[12],
    }));

  return jsonResponse({ status: "success", pending });
}

// ---- GET SKUs from SKU_Master_02 ----
// Columns: Customer_Name(A) | SKU_ID(B) | SKU_Description(C) | UOM | IsActive | ...
function getSKUs() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("SKU_Master_02");
  if (!sheet) return jsonResponse({ status: "error", skus: [], message: "SKU_Master_02 not found" });
  const values = sheet.getDataRange().getValues();
  const skus = [];
  for (let i = 1; i < values.length; i++) {
    const skuId = values[i][1]; // Column B = SKU_ID
    const skuDesc = values[i][2]; // Column C = SKU_Description
    if (skuId) {
      skus.push({ sku_id: String(skuId), description: String(skuDesc || "") });
    }
  }
  return jsonResponse({ status: "success", skus });
}

// ---- SUBMIT GRN ENTRY (writes to GRN_Entry_IB_01 and GRN_Detail_IB_02) ----
function submitGRNEntry(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Write header row to GRN_Entry_IB_01
  const grnSheet = ss.getSheetByName("GRN_Entry_IB_01");
  if (!grnSheet) return jsonResponse({ status: "error", message: "GRN_Entry_IB_01 not found. Please create the sheet." });

  grnSheet.appendRow([
    data.GRN_ID, data.Arrival_Time, data.Vehicle_Number, data.Driver_Name,
    data.Customer_Name, data.Invoice_Number, data.Invoice_Date,
    data.Invoice_URL || "", data.LR_Number, data.LR_Photo || "",
    data.Seal_Intact, data.Temp_Display_C || "", data.Created_By_Email,
    "Vehicle Arrived"  // Status
  ]);

  // 2. Write each SKU line to GRN_Detail_IB_02
  const detailSheet = ss.getSheetByName("GRN_Detail_IB_02");
  if (!detailSheet) return jsonResponse({ status: "error", message: "GRN_Detail_IB_02 not found. Please create the sheet." });

  const lines = data.lines || [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    detailSheet.appendRow([
      data.GRN_ID,
      line.Line_No,
      line.SKU_ID,
      line.SKU_Description,
      line.Invoice_Quantity,
      "",  // Actual_Quantity (filled later during putaway)
      "",  // Excess
      ""   // Shortage
    ]);
  }
  return jsonResponse({ status: "success" });
}

// ---- GET GRNs with Status = "Vehicle Arrived" from GRN_Entry_IB_01 ----
function getArrivedGRNs() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("GRN_Entry_IB_01");
  if (!sheet) return jsonResponse({ status: "error", grns: [], message: "GRN_Entry_IB_01 not found" });

  const values = sheet.getDataRange().getValues();
  // Columns: GRN_ID(A=0), Arrival_Time(1), Vehicle_Number(2), Driver_Name(3),
  //          Customer_Name(4), Invoice_Number(5), Invoice_Date(6), Invoice_URL(7),
  //          LR_Number(8), LR_Photo(9), Seal_Intact(10), Temp_Display_C(11),
  //          Created_By_Email(12), Status(13=N)
  const grns = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[13]).trim() === "Vehicle Arrived") {
      grns.push({
        GRN_ID: row[0],
        Vehicle_Number: row[2],
        Driver_Name: row[3],
        Customer_Name: row[4],
        Temp_Display_C: row[11],
      });
    }
  }
  return jsonResponse({ status: "success", grns });
}

// ---- SUBMIT VEHICLE CHECKLIST → write to Vehicle_Checklist_IB_03 & update GRN_Entry_IB_01 Status ----
function submitVehicleChecklist(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Append to Vehicle_Checklist_IB_03
  const clSheet = ss.getSheetByName("Vehicle_Checklist_IB_03");
  if (!clSheet) return jsonResponse({ status: "error", message: "Vehicle_Checklist_IB_03 not found. Please create the sheet." });

  clSheet.appendRow([
    data.GRN_ID,
    data.Checklist_GRN_ID,
    data.Vehicle_Number,
    data.Timestamp,
    data.Supervisor_Name,
    data.Temperature_at_Gate,
    data.Cleanliness,
    data.Foul_Smell,
    data.Proper_Arrangement,
    data.Damage_Description || "",
    data.Status,
    data.Photos_URL || "",
    data.Remarks || "",
    data.Dock_No || "",
  ]);

  // 2. Update GRN_Entry_IB_01 Status → "Vehicle Docked"
  const grnSheet = ss.getSheetByName("GRN_Entry_IB_01");
  if (grnSheet) {
    const values = grnSheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === String(data.GRN_ID).trim()) {
        grnSheet.getRange(i + 1, 14).setValue("Vehicle Docked"); // Column N = Status
        break;
      }
    }
  }

  return jsonResponse({ status: "success" });
}

// ---- GET GRNs for Pallet Build ----
function getGRNsForPalletBuild() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("GRN_Entry_IB_01");
  if (!sheet) return jsonResponse({ status: "error", grns: [], message: "GRN_Entry_IB_01 not found" });

  const values = sheet.getDataRange().getValues();
  const grns = [];
  for (let i = 1; i < values.length; i++) {
    const status = String(values[i][13]).trim();
    if (status === "Vehicle Docked" || status === "Unloading in Progress") {
      grns.push({
        GRN_ID: values[i][0],
        Vehicle_Number: values[i][2],
        LR_Number: values[i][8],
        Invoice_Number: values[i][5],
      });
    }
  }
  return jsonResponse({ status: "success", grns });
}

// ---- SUBMIT PALLET BUILD ----
function submitPalletBuild(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Append to Pallet_Build_IB_04
  const pbSheet = ss.getSheetByName("Pallet_Build_IB_04");
  if (!pbSheet) return jsonResponse({ status: "error", message: "Pallet_Build_IB_04 not found" });

  pbSheet.appendRow([
    data.GRN_ID,
    data.Vehicle_Number,
    data.Pallet_ID,
    data.Pallet_GRN,
    data.Line_No || "",
    data.Timestamp,
    data.Built_By,
    data.SKU_ID,
    data.SKU_Description,
    data.Batch_Number || "",
    data.Manufacturing_Date || "",
    data.Expiry_Date || "",
    data.Good_Box_Qty || 0,
    data.Damage_Box_Qty || 0,
    data.Total_Received_Qty_Boxes || 0,
    data.Wrapping || "",
    data.Photos_URL || "",
    data.Remarks || "",
    data.Vehicle_Completed ? "Yes" : "No"
  ]);

  // 2. Update GRN_Entry_IB_01 Status
  const grnSheet = ss.getSheetByName("GRN_Entry_IB_01");
  if (grnSheet) {
    const grnValues = grnSheet.getDataRange().getValues();
    for (let i = 1; i < grnValues.length; i++) {
      if (String(grnValues[i][0]).trim() === String(data.GRN_ID).trim()) {
        const currentStatus = String(grnValues[i][13]).trim();
        if (data.Vehicle_Completed) {
          grnSheet.getRange(i + 1, 14).setValue("Unloading Completed");
        } else if (currentStatus === "Vehicle Docked") {
          grnSheet.getRange(i + 1, 14).setValue("Unloading in Progress");
        }
        break;
      }
    }
  }

  return jsonResponse({ status: "success" });
}

// ---- SUBMIT MULTIPLE PALLET BUILD ----
function submitPalletBuildBulk(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Append to Pallet_Build_IB_04
  const pbSheet = ss.getSheetByName("Pallet_Build_IB_04");
  if (!pbSheet) return jsonResponse({ status: "error", message: "Pallet_Build_IB_04 not found" });

  if (data.pallets && Array.isArray(data.pallets)) {
    const totalPallets = data.pallets.length;
    data.pallets.forEach((p, index) => {
      // Only mark the LAST pallet in this batch as "Yes" if Vehicle_Completed is checked
      const isLastInBatch = index === totalPallets - 1;
      const vehicleCompletedForThisRow = (data.Vehicle_Completed && isLastInBatch) ? "Yes" : "No";

      pbSheet.appendRow([
        p.GRN_ID,
        p.Vehicle_Number,
        p.Pallet_ID,
        p.Pallet_GRN,
        p.Line_No || "",
        p.Timestamp,
        p.Built_By,
        p.SKU_ID,
        p.SKU_Description,
        p.Batch_Number || "",
        p.Manufacturing_Date || "",
        p.Expiry_Date || "",
        p.Good_Box_Qty || 0,
        p.Damage_Box_Qty || 0,
        p.Total_Received_Qty_Boxes || 0,
        p.Wrapping || "",
        p.Photos_URL || "",
        p.Remarks || "",
        vehicleCompletedForThisRow
      ]);
    });
  }

  // 2. Update GRN_Entry_IB_01 Status
  const grnSheet = ss.getSheetByName("GRN_Entry_IB_01");
  if (grnSheet) {
    const grnValues = grnSheet.getDataRange().getValues();
    for (let i = 1; i < grnValues.length; i++) {
      if (String(grnValues[i][0]).trim() === String(data.GRN_ID).trim()) {
        const currentStatus = String(grnValues[i][13]).trim();
        if (data.Vehicle_Completed) {
          grnSheet.getRange(i + 1, 14).setValue("Unloading Completed");
        } else if (currentStatus === "Vehicle Docked") {
          grnSheet.getRange(i + 1, 14).setValue("Unloading in Progress");
        }
        break;
      }
    }
  }

  return jsonResponse({ status: "success" });
}

// ---- PUTAWAY ID GENERATION ----
function generatePutawayId() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Putaway_Form_IB_05");
  if (!sheet) return jsonResponse({ status: "error", message: "Putaway_Form_IB_05 not found" });

  const values = sheet.getDataRange().getValues();
  let maxId = 0;
  for (let i = 1; i < values.length; i++) {
    const idStr = values[i][0];
    if (idStr && String(idStr).startsWith("PUT-")) {
      const num = parseInt(String(idStr).replace("PUT-", ""), 10);
      if (!isNaN(num) && num > maxId) {
        maxId = num;
      }
    }
  }
  const nextId = "PUT-" + String(maxId + 1).padStart(4, "0");
  return jsonResponse({ status: "success", nextId });
}

// ---- SUBMIT PUTAWAY ----
function submitPutaway(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Append to Putaway_Form_IB_05
  const pwSheet = ss.getSheetByName("Putaway_Form_IB_05");
  if (!pwSheet) return jsonResponse({ status: "error", message: "Putaway_Form_IB_05 not found" });

  pwSheet.appendRow([
    data.Putaway_ID,
    data.GRN_ID || "",
    data.Pallet_ID,
    data.Assigned_Location,
    data.Assigned_Aisle || "",
    data.Assigned_Bay || "",
    data.Assigned_Level || "",
    data.Assigned_Depth || "",
    data.Timestamp,
    data.Moved_By || "",
    data.Forklift_ID || "",
    data.Status || "Completed",
    data.Is_Putaway_Sent || "No"
  ]);

  // 2. Update GRN_Entry_IB_01 Status
  const grnSheet = ss.getSheetByName("GRN_Entry_IB_01");
  if (grnSheet && data.GRN_ID) {
    const grnValues = grnSheet.getDataRange().getValues();
    for (let i = 1; i < grnValues.length; i++) {
      if (String(grnValues[i][0]).trim() === String(data.GRN_ID).trim()) {
        grnSheet.getRange(i + 1, 14).setValue("Putaway Completed"); // Update status 
        break;
      }
    }
  }

  return jsonResponse({ status: "success" });
}

// ---- SUBMIT GRN ISSUE ----
function submitGrnIssue(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Append to GRN_Issue_IB_06
  const issueSheet = ss.getSheetByName("GRN_Issue_IB_06");
  if (!issueSheet) return jsonResponse({ status: "error", message: "GRN_Issue_IB_06 not found" });

  issueSheet.appendRow([
    data.GRN_ID,
    data.Invoice_Quatity,
    data.Actual_Quantity,
    data.Shortage,
    data.Remarks || "",
    data.GRN_Issued || "Yes"
  ]);

  // 2. (Optional) Update GRN_Entry_IB_01 Status?
  const grnSheet = ss.getSheetByName("GRN_Entry_IB_01");
  if (grnSheet) {
    const grnValues = grnSheet.getDataRange().getValues();
    for (let i = 1; i < grnValues.length; i++) {
      if (String(grnValues[i][0]).trim() === String(data.GRN_ID).trim()) {
        grnSheet.getRange(i + 1, 14).setValue("GRN Issued"); // Update status 
        break;
      }
    }
  }

  return jsonResponse({ status: "success" });
}

// ---- GENERATE DN ID ----
function generateDnId() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("DN_Entry_OB_01");
  if (!sheet) return jsonResponse({ status: "error", message: "DN_Entry_OB_01 not found" });

  const values = sheet.getDataRange().getValues();
  let maxId = 0;
  for (let i = 1; i < values.length; i++) {
    const idStr = String(values[i][0] || "");
    if (idStr.startsWith("DN-")) {
      const num = parseInt(idStr.replace("DN-", ""), 10);
      if (!isNaN(num) && num > maxId) maxId = num;
    }
  }
  const nextId = "DN-" + String(maxId + 1).padStart(4, "0");
  return jsonResponse({ status: "success", nextId });
}

// ---- SUBMIT DN ENTRY ----
function submitDnEntry(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Write header to DN_Entry_OB_01
  const dnSheet = ss.getSheetByName("DN_Entry_OB_01");
  if (!dnSheet) return jsonResponse({ status: "error", message: "DN_Entry_OB_01 not found" });

  const totalQty = (data.lines || []).reduce((sum, l) => sum + (parseFloat(l.Order_Quantity) || 0), 0);

  dnSheet.appendRow([
    data.DN_ID,
    data.Customer_Name,
    data.Order_Time,
    data.Order_Date,
    data.Order_Upload || "",
    totalQty,
    data.Created_By_Email,
    "Order Created"
  ]);

  // 2. Write each SKU line to DN_Detail_OB_02
  const detailSheet = ss.getSheetByName("DN_Detail_OB_02");
  if (!detailSheet) return jsonResponse({ status: "error", message: "DN_Detail_OB_02 not found" });

  const lines = data.lines || [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    detailSheet.appendRow([
      data.DN_ID,
      line.Line_No,
      line.SKU_ID,
      line.SKU_Description || "",
      line.Order_Quantity || 0,
      "",    // Dispatch_Quantity (filled later)
      ""     // Shortage (filled later)
    ]);
  }

  return jsonResponse({ status: "success" });
}

// ---- GENERATE PICK ID ----
// Returns the next per-DN pick sequence number
function generatePickId(dnId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Pick_Assignment_OB_03");
  if (!sheet) return jsonResponse({ status: "error", message: "Pick_Assignment_OB_03 not found" });
  const values = sheet.getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < values.length; i++) {
    // Only count rows for this DN (col A = DN_ID)
    if (dnId && String(values[i][0]).trim() !== String(dnId).trim()) continue;
    const idStr = String(values[i][1] || "").trim(); // Col B = Pick_ID
    // New format: DN-0046-PICK 03  → extract trailing number
    const newFmt = idStr.match(/-PICK\s*(\d+)$/i);
    if (newFmt) {
      const n = parseInt(newFmt[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
      continue;
    }
    // Old format: PICK-0001
    if (idStr.startsWith("PICK-")) {
      const n = parseInt(idStr.replace("PICK-", ""), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return jsonResponse({ status: "success", nextNum: maxNum + 1 });
}

// ---- GET PICK ASSIGNMENT DATA ----
function getPickAssignmentData(dnId, skuId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Get all DN IDs with status "Order Created" or "Picklist Generated"
  const dnSheet = ss.getSheetByName("DN_Entry_OB_01");
  const dnRows = dnSheet ? dnSheet.getDataRange().getValues() : [];
  const eligibleDns = [];
  for (let i = 1; i < dnRows.length; i++) {
    const status = String(dnRows[i][7] || "").trim();
    if (status === "Order Created" || status === "Picklist Generated") {
      eligibleDns.push({ DN_ID: String(dnRows[i][0]).trim(), Customer_Name: String(dnRows[i][1]).trim(), Status: status });
    }
  }

  // 2. Get SKUs in the selected DN
  let dnSkus = [];
  if (dnId) {
    const detailSheet = ss.getSheetByName("DN_Detail_OB_02");
    const detailRows = detailSheet ? detailSheet.getDataRange().getValues() : [];
    for (let i = 1; i < detailRows.length; i++) {
      if (String(detailRows[i][0]).trim() === String(dnId).trim()) {
        dnSkus.push({
          Line_No: detailRows[i][1],
          SKU_ID: String(detailRows[i][2]).trim(),
          SKU_Description: String(detailRows[i][3]).trim(),
          Order_Quantity: parseFloat(detailRows[i][4]) || 0
        });
      }
    }
  }

  // 3. Get pallet inventory for the selected SKU
  let pallets = [];
  if (skuId) {
    const invSheet = ss.getSheetByName("Pallet_Inventory_01");
    const invRows = invSheet ? invSheet.getDataRange().getValues() : [];
    // Cols: Pallet_ID(0) GRN_ID(1) SKU_ID(2) SKU_Description(3) Batch(4) Mfg_Date(5) Expiry_Date(6)
    //       Good_Box_Qty(7) Damage_Box_Qty(8) Current_Qty(9) Res_Good(10) Res_Damage(11)
    //       Free_Good(12) Free_Damage(13) Free_Total(14) Qty_Remaining(15)

    // First pass: build pallet-level total_qty and SKU count maps across ALL rows (not just this SKU)
    const palletTotalMap = {};    // Pallet_ID -> sum of Current_Qty across all rows
    const palletSkuSetMap = {};   // Pallet_ID -> Set of SKU_IDs
    for (let i = 1; i < invRows.length; i++) {
      const r = invRows[i];
      const pid = String(r[0] || "").trim();
      if (!pid) continue;
      palletTotalMap[pid] = (palletTotalMap[pid] || 0) + (parseFloat(r[9]) || 0);
      if (!palletSkuSetMap[pid]) palletSkuSetMap[pid] = new Set();
      palletSkuSetMap[pid].add(String(r[2] || "").trim());
    }

    // Second pass: filter rows for the requested SKU
    for (let i = 1; i < invRows.length; i++) {
      const row = invRows[i];
      if (String(row[2]).trim() !== String(skuId).trim()) continue;
      const freeTotal = parseFloat(row[14]) || 0;
      if (freeTotal <= 0) continue; // skip fully reserved/empty rows
      const expiryRaw = row[6];
      const mfgRaw = row[5];
      let expiryStr = "";
      let mfgStr = "";
      try { expiryStr = expiryRaw ? Utilities.formatDate(new Date(expiryRaw), "Asia/Kolkata", "dd/MM/yyyy") : ""; } catch (e) { expiryStr = String(expiryRaw || ""); }
      try { mfgStr = mfgRaw ? Utilities.formatDate(new Date(mfgRaw), "Asia/Kolkata", "dd/MM/yyyy") : ""; } catch (e) { mfgStr = String(mfgRaw || ""); }
      const palletId = String(row[0]).trim();
      const grnId = String(row[1]).trim();
      pallets.push({
        _key: palletId + "||" + grnId + "||" + i,   // unique per row
        Pallet_ID: palletId,
        GRN_ID: grnId,
        SKU_ID: String(row[2]).trim(),
        SKU_Description: String(row[3]).trim(),
        Batch_Number: String(row[4] || "").trim(),
        Manufacturing_Date: mfgStr,
        Expiry_Date: expiryStr,
        Expiry_Raw: expiryRaw ? new Date(expiryRaw).getTime() : 0,
        Location_ID: "",
        Free_Good_Box_Qty: parseFloat(row[12]) || 0,
        Free_Damage_Box_Qty: parseFloat(row[13]) || 0,
        Free_Total_Qty: freeTotal,
        Pallet_Total_Qty: palletTotalMap[palletId] || 0,
        SKU_Count_In_Pallet: palletSkuSetMap[palletId] ? palletSkuSetMap[palletId].size : 1
      });
    }

    // Fill Location_ID from Pallet_Status_02
    const palletStatusSheet = ss.getSheetByName("Pallet_Status_02");
    if (palletStatusSheet) {
      const psRows = palletStatusSheet.getDataRange().getValues();
      const locMap = {};
      // Try to also read Total_Qty from col D (index 3) if it exists
      const totalQtyFromStatus = {};
      for (let i = 1; i < psRows.length; i++) {
        const pid = String(psRows[i][0]).trim();
        locMap[pid] = String(psRows[i][2] || "").trim();
        if (psRows[i][3] !== undefined && psRows[i][3] !== "") {
          totalQtyFromStatus[pid] = parseFloat(psRows[i][3]) || 0;
        }
      }
      pallets.forEach(p => {
        p.Location_ID = locMap[p.Pallet_ID] || "";
        // Override Pallet_Total_Qty with Status sheet value if available
        if (totalQtyFromStatus[p.Pallet_ID]) p.Pallet_Total_Qty = totalQtyFromStatus[p.Pallet_ID];
      });
    }

    // Sort by Expiry FEFO (earliest first)
    pallets.sort((a, b) => (a.Expiry_Raw || 9999999999999) - (b.Expiry_Raw || 9999999999999));
  }

  return jsonResponse({ status: "success", eligibleDns, dnSkus, pallets });
}

// ---- SUBMIT PICK ASSIGNMENT ----
function submitPickAssignment(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Pick_Assignment_OB_03");
  if (!sheet) return jsonResponse({ status: "error", message: "Pick_Assignment_OB_03 not found" });

  const rows = data.rows || [];
  rows.forEach(r => {
    sheet.appendRow([
      r.DN_ID,
      r.Pick_ID,
      r.Pallet_ID,
      r.GRN_ID,
      r.SKU_ID,
      r.SKU_Description,
      r.Expiry_Date,
      r.Batch_Number,
      r.Location_ID,
      r.Free_Good_Box_Qty,
      r.Free_Damage_Box_Qty,
      r.Free_Total_Qty,
      r.Pick_Good_Box_Qty,
      r.Pick_Damage_Box_Qty,
      r.Pick_Total_Qty,
      r.Closing_of_SKU,
      r.Closing_of_Palet,
      "Pending",           // pick_item_sent_status
      r.Is_This_Last_Pallet_For_Pick_Assignment
    ]);
  });

  // If allSkusDone flag is set → update DN_Entry_OB_01 Status
  if (data.allSkusDone && data.DN_ID) {
    const dnSheet = ss.getSheetByName("DN_Entry_OB_01");
    if (dnSheet) {
      const dnVals = dnSheet.getDataRange().getValues();
      for (let i = 1; i < dnVals.length; i++) {
        if (String(dnVals[i][0]).trim() === String(data.DN_ID).trim()) {
          dnSheet.getRange(i + 1, 8).setValue("Picklist Generated");
          break;
        }
      }
    }
  }

  // ── Update Pallet_Inventory_01: Reserved_Good += Pick_Good, Reserved_Damage += Pick_Damage
  //    Match by Pallet_ID (col A = index 0) + GRN_ID (col B = index 1) for the exact row
  const invSheet = ss.getSheetByName("Pallet_Inventory_01");
  if (invSheet && rows.length > 0) {
    const invData = invSheet.getDataRange().getValues();
    rows.forEach(function (r) {
      const pickGood = parseFloat(r.Pick_Good_Box_Qty) || 0;
      const pickDmg = parseFloat(r.Pick_Damage_Box_Qty) || 0;
      if (pickGood === 0 && pickDmg === 0) return;
      for (var i = 1; i < invData.length; i++) {
        var pid = String(invData[i][0] || "").trim();
        var gid = String(invData[i][1] || "").trim();
        if (pid === String(r.Pallet_ID || "").trim() && gid === String(r.GRN_ID || "").trim()) {
          // Col K (1-indexed = 11) = Reserved_Good_Box_Qty  (array index 10)
          var curResGood = parseFloat(invData[i][10]) || 0;
          invSheet.getRange(i + 1, 11).setValue(curResGood + pickGood);
          // Col L (1-indexed = 12) = Reserved_Damage_Box_Qty (array index 11)
          var curResDmg = parseFloat(invData[i][11]) || 0;
          invSheet.getRange(i + 1, 12).setValue(curResDmg + pickDmg);
          break;
        }
      }
    });
  }

  return jsonResponse({ status: "success" });
}

// ---- GET PALLET DETAILS (inventory rows for one pallet) ----
function getPalletDetails(palletId) {
  if (!palletId) return jsonResponse({ status: "error", message: "palletId required" });
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const invSheet = ss.getSheetByName("Pallet_Inventory_01");
  const stsSheet = ss.getSheetByName("Pallet_Status_02");
  if (!invSheet) return jsonResponse({ status: "error", message: "Pallet_Inventory_01 not found" });

  const invData = invSheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < invData.length; i++) {
    if (String(invData[i][0] || "").trim() !== String(palletId).trim()) continue;
    const mfgRaw = invData[i][5], expRaw = invData[i][6];
    let mfgStr = "", expStr = "";
    try { mfgStr = mfgRaw ? Utilities.formatDate(new Date(mfgRaw), "Asia/Kolkata", "dd/MM/yyyy") : ""; } catch(e) { mfgStr = String(mfgRaw || ""); }
    try { expStr = expRaw ? Utilities.formatDate(new Date(expRaw), "Asia/Kolkata", "dd/MM/yyyy") : ""; } catch(e) { expStr = String(expRaw || ""); }
    rows.push({
      GRN_ID:           String(invData[i][1] || ""),
      SKU_ID:           String(invData[i][2] || ""),
      SKU_Description:  String(invData[i][3] || ""),
      Batch_Number:     String(invData[i][4] || ""),
      Manufacturing_Date: mfgStr,
      Expiry_Date:      expStr,
      Good_Box_Qty:     parseFloat(invData[i][7])  || 0,
      Damage_Box_Qty:   parseFloat(invData[i][8])  || 0,
      Current_Qty:      parseFloat(invData[i][9])  || 0,
      Free_Total_Qty:   parseFloat(invData[i][14]) || 0,
    });
  }

  // Pallet status
  let location = "", occupancy = "", assignment = "";
  if (stsSheet) {
    const stsData = stsSheet.getDataRange().getValues();
    for (let i = 1; i < stsData.length; i++) {
      if (String(stsData[i][0] || "").trim() === String(palletId).trim()) {
        occupancy  = String(stsData[i][1] || "");
        location   = String(stsData[i][2] || "");
        assignment = String(stsData[i][3] || "");
        break;
      }
    }
  }

  return jsonResponse({ status: "success", palletId, rows, location, occupancy, assignment });
}

// ---- MERGE PALLETS ----
// mergePallet: moves all inventory rows from sourcePalletId into destinationPalletId
function mergePallets(data) {
  const srcId = String(data.sourcePalletId || "").trim();
  const dstId = String(data.destinationPalletId || "").trim();
  if (!srcId || !dstId) return jsonResponse({ status: "error", message: "Both sourcePalletId and destinationPalletId are required" });
  if (srcId === dstId) return jsonResponse({ status: "error", message: "Source and destination pallets must be different" });

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const invSheet = ss.getSheetByName("Pallet_Inventory_01");
  const stsSheet = ss.getSheetByName("Pallet_Status_02");
  if (!invSheet) return jsonResponse({ status: "error", message: "Pallet_Inventory_01 not found" });

  try {
    // ── STEP 1: Read all inventory rows for source and destination
    const invData = invSheet.getDataRange().getValues();
    // {rowIdx (0-based), data[]}
    const srcRows = [], dstRows = [];
    for (let i = 1; i < invData.length; i++) {
      const pid = String(invData[i][0] || "").trim();
      if (pid === srcId) srcRows.push({ rowIdx: i, data: invData[i].slice() });
      if (pid === dstId) dstRows.push({ rowIdx: i, data: invData[i].slice() });
    }
    if (srcRows.length === 0) return jsonResponse({ status: "error", message: "Source pallet '" + srcId + "' has no inventory rows" });

    const log = [];
    // Make a mutable copy of dstRows for in-loop matching
    const activeDst = dstRows.slice();

    // ── STEP 2 & 3: For each source row, match or create in destination
    srcRows.forEach(function(src) {
      // Match key: GRN_ID(1), SKU_ID(2), SKU_Description(3), Batch_Number(4), Mfg_Date(5), Expiry_Date(6)
      const keyOf = function(row) {
        return [row[1],row[2],row[3],row[4],String(row[5]),String(row[6])].map(function(v){return String(v||'').trim();}).join('||');
      };
      const srcKey = keyOf(src.data);
      let matched = null;
      for (let d = 0; d < activeDst.length; d++) {
        if (keyOf(activeDst[d].data) === srcKey) { matched = activeDst[d]; break; }
      }

      if (matched) {
        // ── STEP 2: Matching SKU → add quantities into destination row
        const newGood    = (parseFloat(matched.data[7]) || 0) + (parseFloat(src.data[7]) || 0);
        const newDamage  = (parseFloat(matched.data[8]) || 0) + (parseFloat(src.data[8]) || 0);
        const newCurrent = (parseFloat(matched.data[9]) || 0) + (parseFloat(src.data[9]) || 0);
        invSheet.getRange(matched.rowIdx + 1, 8).setValue(newGood);    // Good_Box_Qty
        invSheet.getRange(matched.rowIdx + 1, 9).setValue(newDamage);  // Damage_Box_Qty
        invSheet.getRange(matched.rowIdx + 1, 10).setValue(newCurrent);// Current_Qty
        // Also recalculate Free_Good, Free_Damage, Free_Total (col 13,14,15 = 1-indexed)
        const resGood = parseFloat(matched.data[10]) || 0;
        const resDmg  = parseFloat(matched.data[11]) || 0;
        invSheet.getRange(matched.rowIdx + 1, 13).setValue(Math.max(0, newGood   - resGood));
        invSheet.getRange(matched.rowIdx + 1, 14).setValue(Math.max(0, newDamage - resDmg));
        invSheet.getRange(matched.rowIdx + 1, 15).setValue(Math.max(0, newGood - resGood) + Math.max(0, newDamage - resDmg));
        // Update in-memory so further matches in this loop are correct
        matched.data[7] = newGood; matched.data[8] = newDamage; matched.data[9] = newCurrent;
        log.push("Merged SKU " + src.data[2] + " (Good:+" + src.data[7] + ", Dmg:+" + src.data[8] + ") into " + dstId);
      } else {
        // ── STEP 3: No matching SKU → create new row in destination
        var newRow = src.data.slice();
        newRow[0] = dstId; // Change Pallet_ID to destination
        invSheet.appendRow(newRow);
        // Add to activeDst so it can be matched by subsequent source rows if needed
        activeDst.push({ rowIdx: -1, data: newRow }); // rowIdx -1 = newly added, skip deletion safety
        log.push("Added new SKU row " + src.data[2] + " to " + dstId);
      }
    });

    // ── STEP 4: Delete source rows in reverse order to preserve sheet indices
    const srcIndices = srcRows.map(function(r) { return r.rowIdx; }).sort(function(a,b){return b-a;});
    srcIndices.forEach(function(ri) {
      invSheet.deleteRow(ri + 1); // convert 0-based to 1-based sheet row
      log.push("Deleted source row " + (ri+1) + " from Pallet_Inventory_01");
    });

    // ── STEP 5: Check if source pallet has any remaining rows
    const refreshed = invSheet.getDataRange().getValues();
    let srcStillHasRows = false;
    for (let i = 1; i < refreshed.length; i++) {
      if (String(refreshed[i][0] || "").trim() === srcId) { srcStillHasRows = true; break; }
    }

    if (!srcStillHasRows && stsSheet) {
      const stsData = stsSheet.getDataRange().getValues();
      for (let i = 1; i < stsData.length; i++) {
        if (String(stsData[i][0] || "").trim() === srcId) {
          stsSheet.getRange(i + 1, 2).setValue("\u274C Unoccupied"); // Occupancy_Status col B
          stsSheet.getRange(i + 1, 3).setValue("");                  // Location_ID col C
          stsSheet.getRange(i + 1, 4).setValue("");                  // Assignment_Status col D
          log.push("Source pallet " + srcId + " marked as Unoccupied in Pallet_Status_02");
          break;
        }
      }
    }

    return jsonResponse({
      status: "success",
      message: "Pallet " + srcId + " successfully merged into " + dstId,
      mergedRows: srcRows.length,
      log: log
    });

  } catch(err) {
    return jsonResponse({ status: "error", message: err.message || String(err) });
  }
}

// ---- GET PICKLIST DATA (for PDF generation) ----
function getPicklistData(dnId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Get DN header info from DN_Entry_OB_01
  let customerName = "", orderDate = "", dnStatus = "";
  const dnSheet = ss.getSheetByName("DN_Entry_OB_01");
  if (dnSheet) {
    const dnRows = dnSheet.getDataRange().getValues();
    for (let i = 1; i < dnRows.length; i++) {
      if (String(dnRows[i][0]).trim() === String(dnId).trim()) {
        customerName = String(dnRows[i][1] || "").trim();
        orderDate = dnRows[i][3] ? Utilities.formatDate(new Date(dnRows[i][3]), "Asia/Kolkata", "dd/MM/yyyy") : "";
        dnStatus = String(dnRows[i][7] || "").trim();
        break;
      }
    }
  }

  // 2. Get all pick rows from Pick_Assignment_OB_03 for this DN
  const pickSheet = ss.getSheetByName("Pick_Assignment_OB_03");
  if (!pickSheet) return jsonResponse({ status: "error", message: "Pick_Assignment_OB_03 not found" });
  const values = pickSheet.getDataRange().getValues();
  // Cols: DN_ID(0) Pick_ID(1) Pallet_ID(2) GRN_ID(3) SKU_ID(4) SKU_Description(5)
  //       Expiry_Date(6) Batch_Number(7) Location_ID(8)
  //       Free_Good(9) Free_Damage(10) Free_Total(11)
  //       Pick_Good(12) Pick_Damage(13) Pick_Total(14)
  //       Closing_SKU(15) Closing_Palet(16) Status(17) Is_Last(18)
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() !== String(dnId).trim()) continue;
    rows.push({
      Pick_ID: String(values[i][1] || ""),
      Pallet_ID: String(values[i][2] || ""),
      GRN_ID: String(values[i][3] || ""),
      SKU_ID: String(values[i][4] || ""),
      SKU_Description: String(values[i][5] || ""),
      Expiry_Date: String(values[i][6] || ""),
      Batch_Number: String(values[i][7] || ""),
      Location_ID: String(values[i][8] || ""),
      Free_Good_Box_Qty: parseFloat(values[i][9]) || 0,
      Free_Damage_Box_Qty: parseFloat(values[i][10]) || 0,
      Free_Total_Qty: parseFloat(values[i][11]) || 0,
      Pick_Good_Box_Qty: parseFloat(values[i][12]) || 0,
      Pick_Damage_Box_Qty: parseFloat(values[i][13]) || 0,
      Pick_Total_Qty: parseFloat(values[i][14]) || 0,
      Closing_of_SKU: parseFloat(values[i][15]) || 0,
      Closing_of_Palet: parseFloat(values[i][16]) || 0,
      Status: String(values[i][17] || "Pending"),
      Is_Last_Pallet: String(values[i][18] || "No"),
    });
  }

  return jsonResponse({ status: "success", dnId, customerName, orderDate, dnStatus, rows });
}

// ---- GENERATE PICKLIST PDF & UPLOAD TO DRIVE ----
function generatePicklistPDF(data) {
  var dnId = String(data.dnId || "");
  var customerName = String(data.customerName || "");
  var orderDate = String(data.orderDate || "");
  var rows = data.rows || [];
  var PICKLIST_FOLDER = "1jEPWXAdsFo0P3ruI_hsxi3qbU3IM2uoc";

  try {
    // 1. Create a temporary Google Doc
    var doc = DocumentApp.create("Picklist-" + dnId + "-TEMP");
    var body = doc.getBody();
    body.setMarginTop(28).setMarginBottom(28).setMarginLeft(36).setMarginRight(36);

    // Title
    var titleStyle = {};
    titleStyle[DocumentApp.Attribute.BOLD] = true;
    titleStyle[DocumentApp.Attribute.FONT_SIZE] = 16;
    titleStyle[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT] = DocumentApp.HorizontalAlignment.CENTER;
    var titleP = body.appendParagraph("PICKLIST \u2013 " + dnId);
    titleP.setAttributes(titleStyle);

    // Meta line
    var now = Utilities.formatDate(new Date(), "Asia/Kolkata", "dd/MM/yyyy HH:mm");
    var metaStyle = {};
    metaStyle[DocumentApp.Attribute.FONT_SIZE] = 9;
    metaStyle[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT] = DocumentApp.HorizontalAlignment.CENTER;
    var metaP = body.appendParagraph(
      "Customer: " + customerName + "   \u2502   Order Date: " + orderDate + "   \u2502   Generated: " + now
    );
    metaP.setAttributes(metaStyle);
    body.appendParagraph("");

    // 2. Build table data
    var headers = [
      "Pick ID", "Pallet", "GRN", "SKU", "Description", "Batch", "Expiry",
      "Location", "Free Good", "Free Dmg", "Free Total",
      "Pick Good", "Pick Dmg", "Pick Total", "Closing Pallet", "Closing SKU", "Last?"
    ];
    var tableData = [headers];
    rows.forEach(function (r) {
      tableData.push([
        String(r.Pick_ID || ""),
        String(r.Pallet_ID || ""),
        String(r.GRN_ID || ""),
        String(r.SKU_ID || ""),
        String(r.SKU_Description || ""),
        String(r.Batch_Number || ""),
        String(r.Expiry_Date || ""),
        String(r.Location_ID || ""),
        String(r.Free_Good_Box_Qty || 0),
        String(r.Free_Damage_Box_Qty || 0),
        String(r.Free_Total_Qty || 0),
        String(r.Pick_Good_Box_Qty || 0),
        String(r.Pick_Damage_Box_Qty || 0),
        String(r.Pick_Total_Qty || 0),
        String(r.Closing_of_Palet || 0),
        String(r.Closing_of_SKU || 0),
        String(r.Is_Last_Pallet || "No")
      ]);
    });

    var table = body.appendTable(tableData);

    // Style header row: dark bg, white bold text, font 8
    var hdrRow = table.getRow(0);
    for (var c = 0; c < headers.length; c++) {
      var hCell = hdrRow.getCell(c);
      hCell.setBackgroundColor("#1e293b");
      hCell.getParagraphs()[0].editAsText()
        .setBold(true).setFontSize(8).setForegroundColor("#ffffff");
    }
    // Style data rows: alternating bg, font 8
    for (var ri = 1; ri < table.getNumRows(); ri++) {
      var row = table.getRow(ri);
      for (var ci = 0; ci < row.getNumCells(); ci++) {
        row.getCell(ci).getParagraphs()[0].editAsText().setFontSize(8);
        if (ri % 2 === 0) row.getCell(ci).setBackgroundColor("#f1f5f9");
      }
    }
    // Totals row
    var totFree = 0, totGood = 0, totDmg = 0, totQty = 0;
    rows.forEach(function (r) {
      totFree += Number(r.Free_Total_Qty) || 0;
      totGood += Number(r.Pick_Good_Box_Qty) || 0;
      totDmg += Number(r.Pick_Damage_Box_Qty) || 0;
      totQty += Number(r.Pick_Total_Qty) || 0;
    });
    var totalsData = [
      "TOTALS (" + rows.length + " lines)", "", "", "", "", "", "", "",
      "", "", String(totFree), String(totGood), String(totDmg), String(totQty), "\u2014", "\u2014", "\u2014"
    ];
    var totRow = table.appendTableRow();
    totalsData.forEach(function (val) {
      var tc = totRow.appendTableCell(val);
      tc.setBackgroundColor("#334155");
      tc.getParagraphs()[0].editAsText().setBold(true).setFontSize(8).setForegroundColor("#ffffff");
    });

    // Signature block
    body.appendParagraph("");
    var sigHeaders = ["Picker", "Supervisor", "Warehouse Manager"];
    var sigTable = body.appendTable([["Picker Signature", "Supervisor Signature", "Warehouse Manager"]]);
    for (var sc = 0; sc < 3; sc++) {
      sigTable.getRow(0).getCell(sc).setMinimumHeight(50);
    }

    doc.saveAndClose();

    // 3. Export Google Doc as PDF blob
    var docFile = DriveApp.getFileById(doc.getId());
    var pdfBlob = docFile.getAs(MimeType.PDF);
    var stamp = Utilities.formatDate(new Date(), "Asia/Kolkata", "dd-MM-yyyy_HHmm");
    pdfBlob.setName("Picklist-" + dnId + "-" + stamp + ".pdf");

    // 4. Save PDF to target Drive folder
    var folder = DriveApp.getFolderById(PICKLIST_FOLDER);
    var pdfFile = folder.createFile(pdfBlob);
    pdfFile.setName("Picklist-" + dnId + "-" + stamp + ".pdf");
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // 5. Delete temp Google Doc
    docFile.setTrashed(true);

    var fileId = pdfFile.getId();
    var viewUrl = "https://drive.google.com/file/d/" + fileId + "/view";
    return jsonResponse({ status: "success", fileUrl: viewUrl, fileId: fileId });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.message || String(err) });
  }
}

// ---- AUTHORIZE DRIVE (run once to grant Drive permissions) ----
function authorizeDrive() {
  const folder = DriveApp.getFolderById("1YkfrxizeZWGDXakb5-MVfSKEdIK5Y6TO");
  Logger.log("Drive authorized! Folder: " + folder.getName());
}

// ---- HELPER ----
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
