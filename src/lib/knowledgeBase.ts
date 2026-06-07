import type { CaseGroup } from "@/types/db";

/*
  Knowledge base content (brief §6), translated HE + EN from the company process handbook
  (VM_Robotics_Document_Flow). Faithful to the source: the five processes, their step logic,
  required documents, and the key cross-linking / finance / withholding notes. Hebrew document
  terms (rashimon, חשבונית מס …) are preserved as-is.
*/

export interface Bilingual {
  he: string;
  en: string;
}

export interface KbStep {
  stage: Bilingual;
  docs: Bilingual;
}

export interface KbDoc {
  name: Bilingual;
  issuedBy: Bilingual;
  issuedTo: Bilingual;
  example: Bilingual;
  notes?: Bilingual;
}

export interface KbProcess {
  id: string;
  group: CaseGroup;
  title: Bilingual;
  intro: Bilingual;
  steps: KbStep[];
  documents: KbDoc[];
  notes: { title: Bilingual; body: Bilingual }[];
}

export const KB_PROCESSES: KbProcess[] = [
  {
    id: "import",
    group: "import",
    title: { he: "1. ייבוא טובין מסין", en: "1. Importing goods from China" },
    intro: {
      he: "VM Robotics מייבאת באופן קבוע ציוד ורכיבים מסין דרך מובילים שונים — DSV, FedEx, Gaash Worldwide ודואר ישראל. כל משלוח עובר שחרור מהמכס שמייצר סט מסמכים אופייני.",
      en: "VM Robotics regularly imports equipment and components from China through several carriers — DSV, FedEx, Gaash Worldwide and Israel Post. Every shipment goes through customs clearance, which produces a characteristic set of documents.",
    },
    steps: [
      { stage: { he: "סיכום מול הספק — מוצר, כמות ומחיר. הספק מנפיק פרופורמה או חשבונית מסחרית.", en: "Agree product, quantity and price with the supplier. The supplier issues a proforma or commercial invoice." }, docs: { he: "Proforma / Commercial Invoice", en: "Proforma / Commercial Invoice" } },
      { stage: { he: "תשלום לספק — בדרך כלל 100% מראש (T/T) לחשבון הספק.", en: "Pay the supplier — usually 100% upfront (T/T) to the supplier's account." }, docs: { he: "הוראת תשלום / דף בנק", en: "Payment order / bank statement" } },
      { stage: { he: "משלוח מסין — הספק מכין רשימת אריזה ומוסר את הסחורה למוביל.", en: "Shipment from China — the supplier prepares a packing list and hands the goods to the carrier." }, docs: { he: "Packing List", en: "Packing List" } },
      { stage: { he: "קבלת מספר מעקב — המוביל מקצה מספר משלוח (HD… ב-DSV, מספרי ב-FedEx).", en: "Tracking number assigned — the carrier issues a shipment number (HD… for DSV, numeric for FedEx)." }, docs: { he: "מספר מעקב HD / AWB", en: "Tracking number HD / AWB" } },
      { stage: { he: "שחרור מהמכס בישראל — העמיל (DSV / FedEx / Gaash / דואר) מגיש הצהרה למכס, שמנפיק רשימון.", en: "Customs clearance in Israel — the broker (DSV / FedEx / Gaash / Post) files the declaration; customs issues a rashimon." }, docs: { he: "הצהרת יבוא (רשימון)", en: "Import declaration (Rashimon)" } },
      { stage: { he: "תשלום מסי יבוא — מע\"מ יבוא (17-18%), מכס (אם יש), אגרת נמל ואגרת טיפול.", en: "Pay import charges — import VAT (17-18%), duty (if any), airport fee and handling fee." }, docs: { he: "שובר 184 / קבלת מוביל", en: "Voucher 184 / carrier receipt" } },
      { stage: { he: "קבלת קבלה מהמוביל — המוביל מנפיק חשבונית מס קבלה עבור שירותי השחרור.", en: "Receipt from the carrier — the carrier issues a tax-invoice/receipt for the clearance service." }, docs: { he: "חשבונית מס קבלה", en: "Tax invoice / receipt" } },
      { stage: { he: "מסירת הסחורה — לאחר תשלום כל החיובים הסחורה נמסרת לנמען.", en: "Delivery of the goods — once all charges are paid the goods are released to the recipient." }, docs: { he: "תעודת קבלה", en: "Delivery note" } },
    ],
    documents: [
      { name: { he: "Proforma Invoice", en: "Proforma Invoice" }, issuedBy: { he: "ספק (סין)", en: "Supplier (China)" }, issuedTo: { he: "VM Robotics", en: "VM Robotics" }, example: { he: "LC20260529 — Xinlichuan, $287", en: "LC20260529 — Xinlichuan, $287" } },
      { name: { he: "Commercial Invoice", en: "Commercial Invoice" }, issuedBy: { he: "ספק (סין)", en: "Supplier (China)" }, issuedTo: { he: "VM Robotics", en: "VM Robotics" }, example: { he: "20250518PY — Yongkang JMST, $4,240", en: "20250518PY — Yongkang JMST, $4,240" } },
      { name: { he: "Packing List", en: "Packing List" }, issuedBy: { he: "ספק (סין)", en: "Supplier (China)" }, issuedTo: { he: "VM Robotics / מכס", en: "VM Robotics / customs" }, example: { he: "LYX202602IL35 — Lavichip", en: "LYX202602IL35 — Lavichip" } },
      { name: { he: "הצהרת יבוא (רשימון)", en: "Import declaration (Rashimon)" }, issuedBy: { he: "מכס ישראל", en: "Israel Customs" }, issuedTo: { he: "עמיל / VM Robotics", en: "Broker / VM Robotics" }, example: { he: "26044509966869, 26044509300291", en: "26044509966869, 26044509300291" } },
      { name: { he: "קבלת מוביל", en: "Carrier receipt" }, issuedBy: { he: "DSV / FedEx / Gaash / דואר", en: "DSV / FedEx / Gaash / Post" }, issuedTo: { he: "VM Robotics", en: "VM Robotics" }, example: { he: "DSV №4187732; FedEx №504527071; Gaash №0135380", en: "DSV #4187732; FedEx #504527071; Gaash #0135380" } },
      { name: { he: "שובר מכס 184", en: "Customs voucher 184" }, issuedBy: { he: "מכס (דרך העמיל)", en: "Customs (via broker)" }, issuedTo: { he: "VM Robotics", en: "VM Robotics" }, example: { he: "הוראת תשלום №498686483, ₪73", en: "Payment order #498686483, ₪73" } },
    ],
    notes: [
      {
        title: { he: "הקשר בין המסמכים", en: "How the documents link together" },
        body: {
          he: "מספר המעקב (…HD / AWB) הוא המזהה הסודר המרכזי של המשלוח. הוא מופיע גם בקבלת המוביל (מספר מעקב) וגם ברשימון (מספר שט\"מ בלדר). דוגמה: HD001118886 → קבלת DSV №4187732 → רשימון 26044509181543. דוגמה: Y0034571736RN → קבלת דואר №354703 → שובר 184 №498686483. מספר הרשימון (…26044) הוא המספר הרשמי במערכת המכס.",
          en: "The tracking number (HD… / AWB) is the master identifier of the shipment. It appears both in the carrier receipt (מספר מעקב) and in the rashimon (מספר שט\"מ בלדר). Example: HD001118886 → DSV receipt #4187732 → rashimon 26044509181543. Example: Y0034571736RN → Post receipt #354703 → voucher 184 #498686483. The rashimon number (26044…) is the official ID in the customs system.",
        },
      },
      {
        title: { he: "המובילים של VM Robotics", en: "VM Robotics' carriers" },
        body: {
          he: "DSV E-Commerce — שליח מסין, מעקב …HD. FedEx Israel — אקספרס, AutoPay בכרטיס. Gaash Worldwide — אקספרס, שט\"ם בלדר …GH. דואר ישראל — חסכוני, מעקב …Y, תשלום דרך האתר.",
          en: "DSV E-Commerce — courier from China, HD… tracking. FedEx Israel — express, AutoPay by card. Gaash Worldwide — express, GH… courier ID. Israel Post — economy, Y… tracking, paid via the website.",
        },
      },
    ],
  },
  {
    id: "sale_service",
    group: "sale_service",
    title: { he: "2. מכירות ושירות", en: "2. Sales & Service" },
    intro: {
      he: "VM Robotics מספקת שירותי תחזוקה, תיקון ושדרוג לציוד תעשייתי. לקוחות טיפוסיים הם מפעלי ייצור. התהליך נמשך מהגעת הטכנאי ועד קבלת התשלום.",
      en: "VM Robotics provides maintenance, repair and upgrade services for industrial equipment. Typical clients are manufacturing plants. The process runs from the technician's visit to receiving payment.",
    },
    steps: [
      { stage: { he: "פניית לקוח — תיקון, תחזוקה או שדרוג ציוד.", en: "Client request — repair, maintenance or equipment upgrade." }, docs: { he: "בקשה בע\"פ / בכתב", en: "Verbal / written request" } },
      { stage: { he: "יציאת טכנאי — הטכנאי מגיע לאתר, מאבחן ומבצע את העבודה.", en: "Technician dispatch — the technician comes on site, diagnoses and performs the work." }, docs: { he: "—", en: "—" } },
      { stage: { he: "תעודת משלוח (דוח עבודה) — תיעוד מה בוצע, שעות עבודה, חלקים ונסיעה. על בסיס הדוח מונפקת תעודת המשלוח.", en: "Delivery note (Report) — records what was done, work hours, parts and travel. The delivery note is issued based on the signed work report." }, docs: { he: "תעודת משלוח", en: "Delivery note (Report)" } },
      { stage: { he: "חשבונית מס — על בסיס תעודת המשלוח מונפקת חשבונית מס ללקוח עם מע\"מ 18%. לעיתים קרובות החשבונית היא מרוכזת (חשבונית מרוכזת) הכוללת מספר תעודות משלוח מאותו חודש.", en: "Tax invoice — based on the delivery note, a tax invoice with 18% VAT is issued. Often issued as a consolidated invoice (חשבונית מרוכזת) collecting several delivery notes from the same month." }, docs: { he: "חשבונית מס", en: "Tax invoice" } },
      { stage: { he: "תשלום הלקוח — העברה בנקאית או כרטיס.", en: "Client payment — bank transfer or card." }, docs: { he: "קבלה", en: "Receipt" } },
      { stage: { he: "חשבונית זיכוי — במקרה של תיקון/הנחה מונפקת חשבונית מס זיכוי.", en: "Credit note — for a correction/discount, a credit note is issued." }, docs: { he: "חשבונית מס זיכוי", en: "Credit note" } },
    ],
    documents: [
      { name: { he: "תעודת משלוח (דוח עבודה)", en: "Delivery note (Report)" }, issuedBy: { he: "VM Robotics", en: "VM Robotics" }, issuedTo: { he: "לקוח", en: "Client" }, example: { he: "№10060 — מוצרי שלם; №10172 — אילה פלסט", en: "#10060 — Mutsrey Shalem; #10172 — Ayala Plast" }, notes: { he: "מבוסס על דוח העבודה החתום. חשבונית מרוכזת יכולה לכסות מספר תעודות מאותו חודש.", en: "Based on the signed work report. A consolidated invoice (חשבונית מרוכזת) may cover several delivery notes from the same month." } },
      { name: { he: "חשבונית מס", en: "Tax invoice" }, issuedBy: { he: "VM Robotics", en: "VM Robotics" }, issuedTo: { he: "לקוח", en: "Client" }, example: { he: "№10064 — גרין פלסטיק (₪2,773)", en: "#10064 — Green Plastic (₪2,773)" } },
      { name: { he: "קבלה", en: "Receipt" }, issuedBy: { he: "VM Robotics", en: "VM Robotics" }, issuedTo: { he: "לקוח", en: "Client" }, example: { he: "№30037 — גרין פלסטיק, ₪2,773 (28/05/26)", en: "#30037 — Green Plastic, ₪2,773 (28/05/26)" } },
      { name: { he: "חשבונית מס זיכוי", en: "Credit note" }, issuedBy: { he: "VM Robotics", en: "VM Robotics" }, issuedTo: { he: "לקוח", en: "Client" }, example: { he: "№50008 — גרין פלסטיק, ‎-₪2,124", en: "#50008 — Green Plastic, -₪2,124" } },
    ],
    notes: [
      {
        title: { he: "מבנה תעודת המשלוח", en: "Structure of the delivery note" },
        body: {
          he: "כולל: מספר ותאריך, ח.פ הלקוח, תיאור העבודות, שעות עבודה ונסיעה. תעריף VM Robotics: ₪350 לשעת עבודה, ₪300 לשעת נסיעה, סה\"כ + מע\"מ 18%. דוגמה (תעודה №10172): 2.5ש × ₪350 + 1ש × ₪300 = ₪1,387 כולל מע\"מ.",
          en: "Includes: number and date, client tax ID, description of work, work and travel hours. VM Robotics rates: ₪350/work hour, ₪300/travel hour, total + 18% VAT. Example (note #10172): 2.5h × ₪350 + 1h × ₪300 = ₪1,387 incl. VAT.",
        },
      },
    ],
  },
  {
    id: "procurement",
    group: "procurement",
    title: { he: "3. רכש מקומי בישראל", en: "3. Local procurement in Israel" },
    intro: {
      he: "VM Robotics רוכשת חומרים מתכלים ורכיבים מספקים מקומיים בכרמיאל והאזור: חשמל, כבלים, מהדקים, מתכת, כלי עבודה. התהליך פשוט בהרבה מייבוא.",
      en: "VM Robotics buys consumables and components from local suppliers in Karmiel and the region: electrical parts, cables, terminals, metalwork, tools. The process is much simpler than importing.",
    },
    steps: [
      { stage: { he: "הגדרת צורך — רשימת חומרים לפרויקט או למלאי שוטף.", en: "Define the need — a materials list for a project or stock." }, docs: { he: "רשימה / הזמנה בע\"פ", en: "List / verbal order" } },
      { stage: { he: "הזמנה מהספק — טלפונית או בביקור.", en: "Order from supplier — by phone or in person." }, docs: { he: "הזמנה בע\"פ / email", en: "Verbal order / email" } },
      { stage: { he: "קבלת הסחורה — הספק מנפיק תעודת משלוח.", en: "Receive the goods — the supplier issues a delivery note." }, docs: { he: "תעודת משלוח של הספק", en: "Supplier delivery note" } },
      { stage: { he: "חשבונית מס — לרוב משולבת עם תעודת המשלוח.", en: "Tax invoice — usually combined with the delivery note." }, docs: { he: "חשבונית מס (נכנסת)", en: "Tax invoice (incoming)" } },
      { stage: { he: "תשלום — במקום (כרטיס) או מאוחר יותר לפי סיכום.", en: "Payment — on the spot (card) or later by agreement." }, docs: { he: "קבלה / דף בנק", en: "Receipt / bank statement" } },
    ],
    documents: [
      { name: { he: "ח.מ.חשמל ח'וליו", en: "H.M. Hashmal Julio" }, issuedBy: { he: "ספק", en: "Supplier" }, issuedTo: { he: "חשמל, כבלים, ארונות", en: "Electrical, cables, cabinets" }, example: { he: "חשבונית 01/037919 — ₪2,503", en: "Invoice 01/037919 — ₪2,503" } },
      { name: { he: "מ.ג הצפון", en: "M.G. HaTzafon" }, issuedBy: { he: "ספק", en: "Supplier" }, issuedTo: { he: "אספקה טכנית, כלים", en: "Technical supplies, tools" }, example: { he: "חשבונית 01/053242 — ₪286", en: "Invoice 01/053242 — ₪286" } },
      { name: { he: "מסגריית דוד כהן", en: "David Cohen Metalworks" }, issuedBy: { he: "ספק", en: "Supplier" }, issuedTo: { he: "מוצרי מתכת, זוויתנים", en: "Metalwork, angles" }, example: { he: "חשבונית 17919 — ₪230", en: "Invoice 17919 — ₪230" } },
    ],
    notes: [],
  },
  {
    id: "project",
    group: "project",
    title: { he: "4. פרויקטים ומכרזים", en: "4. Projects & tenders" },
    intro: {
      he: "כיוון הליבה של VM Robotics — אספקה ואינטגרציה של מערכות רובוטיות למפעלים גדולים. הלקוח המרכזי כיום הוא Keter. התהליך ארוך וכולל שלבי רכש בסין (ראו תהליך 1) — לרוב תיק אב עם תיקי-בן של ייבוא.",
      en: "VM Robotics' core line of business — supplying and integrating robotic systems for large industrial plants. The main client today is Keter. The process is long and includes China procurement stages (see process 1) — usually a parent case with import child cases.",
    },
    steps: [
      { stage: { he: "בקשה מהלקוח (RFQ) — לעיתים דרך מכרז.", en: "Client request (RFQ) — sometimes via a tender." }, docs: { he: "מכתב / בקשה בע\"פ", en: "Letter / verbal request" } },
      { stage: { he: "הצעת מחיר — מפרט טכני ומחיר מפורט.", en: "Quote — detailed technical spec and price." }, docs: { he: "הצעת מחיר", en: "Quote" } },
      { stage: { he: "הזמנת רכש (PO מהלקוח) — עם מספר PO רשמי.", en: "Purchase order (PO from the client) — with an official PO number." }, docs: { he: "הזמנת רכש", en: "Purchase order" } },
      { stage: { he: "פתיחת ספק אצל הלקוח — לקוחות גדולים (Keter, Amiad) דורשים טופס פתיחת ספק + מסמכי חברה.", en: "Vendor onboarding at the client — large clients (Keter, Amiad) require a vendor-onboarding form + company documents." }, docs: { he: "פתיחת ספק חדש", en: "Vendor onboarding" } },
      { stage: { he: "רכש ציוד בסין — הזמנה מהיצרן הסיני (ראו תהליך 1).", en: "Procure equipment in China — order from the Chinese manufacturer (see process 1)." }, docs: { he: "Commercial Invoice, Packing List, רשימון", en: "Commercial Invoice, Packing List, rashimon" } },
      { stage: { he: "מקדמה מהלקוח (30%) — חשבונית ראשונה לאחר ה-PO.", en: "Advance from client (30%) — first invoice after the PO." }, docs: { he: "חשבונית מס (30%)", en: "Tax invoice (30%)" } },
      { stage: { he: "משלוח הציוד — ימי/אווירי, שחרור מהמכס.", en: "Shipment of equipment — sea/air, customs clearance." }, docs: { he: "BoL / AWB, רשימון", en: "BoL / AWB, rashimon" } },
      { stage: { he: "חשבונית בעת השילוח (50%).", en: "Invoice on shipment (50%)." }, docs: { he: "חשבונית מס (50%)", en: "Tax invoice (50%)" } },
      { stage: { he: "התקנה והרצה אצל הלקוח.", en: "Installation and commissioning at the client." }, docs: { he: "תעודת משלוח (אקט)", en: "Delivery note (acceptance)" } },
      { stage: { he: "חשבונית סופית (20%) לאחר הרצה מוצלחת.", en: "Final invoice (20%) after successful commissioning." }, docs: { he: "חשבונית מס (20%) + קבלה", en: "Tax invoice (20%) + receipt" } },
    ],
    documents: [
      { name: { he: "הצעת מחיר", en: "Quote" }, issuedBy: { he: "VM Robotics", en: "VM Robotics" }, issuedTo: { he: "לקוח", en: "Client" }, example: { he: "№120101 → Keter: 2× עמדת קובוט, $85,500", en: "#120101 → Keter: 2× cobot station, $85,500" } },
      { name: { he: "הזמנת רכש (PO)", en: "Purchase order (PO)" }, issuedBy: { he: "לקוח", en: "Client" }, issuedTo: { he: "VM Robotics", en: "VM Robotics" }, example: { he: "PO 4503081771 — Keter $85,500; PO 4503092456 — $12,000", en: "PO 4503081771 — Keter $85,500; PO 4503092456 — $12,000" } },
      { name: { he: "פתיחת ספק חדש", en: "Vendor onboarding" }, issuedBy: { he: "VM Robotics → לקוח", en: "VM Robotics → client" }, issuedTo: { he: "מחלקת כספים של הלקוח", en: "Client finance dept." }, example: { he: "חבילת Amiad (5 עמ') — ⚠️ דרוש אישור בנק", en: "Amiad pack (5 pp.) — ⚠️ bank verification needed" } },
      { name: { he: "חשבונית מס (שלבים)", en: "Tax invoices (staged)" }, issuedBy: { he: "VM Robotics", en: "VM Robotics" }, issuedTo: { he: "לקוח", en: "Client" }, example: { he: "Keter: 30% + 50% + 20%", en: "Keter: 30% + 50% + 20%" } },
    ],
    notes: [
      {
        title: { he: "התמונה הפיננסית — Keter", en: "Financial picture — Keter" },
        body: {
          he: "עמדת פליטיזציה קובוטית ×2 (PO 4503081771): $85,500, יעד 30.08.26. שדרוג רובוט ×2 (PO 4503092456): $12,000, יעד 01.06.26. סה\"כ $97,500.",
          en: "Cobot palletizing station ×2 (PO 4503081771): $85,500, due 30.08.26. Robot upgrade ×2 (PO 4503092456): $12,000, due 01.06.26. Total $97,500.",
        },
      },
      {
        title: { he: "תנאי תשלום (PO 4503081771)", en: "Payment terms (PO 4503081771)" },
        body: {
          he: "30% בחתימת ההזמנה = $25,650 ← להוציא חשבונית. 50% בשילוח מסין = $42,750. 20% לאחר ההרצה אצל הלקוח = $17,100. שדרוג הרובוט: נטו+78 ימים, החשבונית צריכה להגיע עד ה-25 בחודש.",
          en: "30% on signing = $25,650 ← issue invoice. 50% on shipment from China = $42,750. 20% after commissioning = $17,100. Robot upgrade: net+78 days, invoice must arrive by the 25th of the month.",
        },
      },
    ],
  },
  {
    id: "tax",
    group: "tax",
    title: { he: "5. מסים ורגולציה", en: "5. Tax & Regulatory" },
    intro: {
      he: "VM Robotics — עוסק מורשה, ח.פ 517144416. חייבת להוציא חשבוניות עם מע\"מ, להגיש דיווחים לרשויות המס ולהתמודד עם ניכוי מס במקור מול לקוחות גדולים.",
      en: "VM Robotics — authorized dealer (עוסק מורשה), tax ID 517144416. Must issue invoices with VAT, file reports to the tax authorities, and handle withholding tax at source with large clients.",
    },
    steps: [],
    documents: [
      { name: { he: "אישור ניכוי מס במקור", en: "Tax-withholding certificate" }, issuedBy: { he: "רשות המסים", en: "Tax Authority" }, issuedTo: { he: "VM Robotics / לקוחות", en: "VM Robotics / clients" }, example: { he: "שיעור 5%, בתוקף 01.06.2026–31.03.2027", en: "Rate 5%, valid 01.06.2026–31.03.2027" } },
      { name: { he: "טופס 101", en: "Form 101" }, issuedBy: { he: "עובד → VM Robotics", en: "Employee → VM Robotics" }, issuedTo: { he: "הנהלת חשבונות", en: "Bookkeeping" }, example: { he: "כרטיס עובד, 2026", en: "Employee card, 2026" } },
      { name: { he: "חשבונית מס", en: "Tax invoice" }, issuedBy: { he: "VM Robotics", en: "VM Robotics" }, issuedTo: { he: "כל לקוח", en: "Every client" }, example: { he: "מע\"מ 18%, חובה לכל עסקה", en: "18% VAT, mandatory for every deal" } },
      { name: { he: "שובר מכס 184", en: "Customs voucher 184" }, issuedBy: { he: "מכס", en: "Customs" }, issuedTo: { he: "VM Robotics", en: "VM Robotics" }, example: { he: "תשלום מסי יבוא, №498686483", en: "Import charge payment, #498686483" } },
    ],
    notes: [
      {
        title: { he: "מהו ניכוי מס במקור", en: "What is withholding tax at source" },
        body: {
          he: "חברות גדולות (Keter, Amiad) חייבות לנכות מס מסכום התשלום לספק. ל-VM Robotics יש אישור בשיעור מופחת 5%. כלומר: על חשבונית של ₪10,000 הלקוח מעביר ₪9,500 ו-₪500 ישירות לרשות המסים. את האישור יש למסור לכל לקוח גדול חדש. האישור הנוכחי בתוקף עד 31.03.2027.",
          en: "Large companies (Keter, Amiad) must withhold tax from the payment to a supplier. VM Robotics holds a reduced-rate certificate of 5%. So on a ₪10,000 invoice the client transfers ₪9,500 and remits ₪500 directly to the Tax Authority. The certificate must be given to every new large client. The current certificate is valid until 31.03.2027.",
        },
      },
    ],
  },
];
