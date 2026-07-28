const FIREBASE_PROJECT_ID = "contacts-sch";
const FIREBASE_WEB_API_KEY = "AIzaSyBaZa5_RmMqhRH6MazTw5or9BqMZGC1RqM";
const FORM_EMAIL_HEADER = "Email";
const CONTACTS_SHEET_NAME = "contacts";
const CONTACTS_OLD_SHEET_NAME = "contacts_old";
const CONTACTS_OLD_PHONE_HEADER = "phone";
const FORM_RESPONSES_SHEET_NAME = "Form Responses 1";
const FORM_TIMESTAMP_HEADERS = ["Timestamp", "חותמת זמן"];
const FORM_PHONE_HEADER = "מספר טלפון";
const CONTACTS_COLLECTION_NAME = "contacts";
const ALLOWED_PHONES_COLLECTION_NAME = "allowedPhones";
const PASSWORD_RESET_REQUESTS_COLLECTION_NAME = "passwordResetRequests";
const CONTACT_MANAGER_EMAIL = "schneidercontacts@gmail.com";
const CONTACT_MANAGER_DISPLAY_NAME = "מנהל אנשי הקשר";
const CONTACT_OVERRIDES_COLLECTION_NAME = "contactOverrides";

// ספרייה חכמה: עמוד נתונים יחיד כל עוד הוא נכנס במגבלת Firestore,
// וחלוקה אוטומטית לעמודים נוספים רק כאשר הגודל מחייב זאת.
const CONTACT_DIRECTORY_COLLECTION_NAME = "contactDirectory";
const CONTACT_DIRECTORY_META_ID = "meta";
const CONTACT_DIRECTORY_PAGE_PREFIX = "page_";
const CONTACT_DIRECTORY_SCHEMA_VERSION = 3;
// עמודים קטנים נטענים במקביל ומהר יותר במכשירים סלולריים.
// החלוקה היא דינמית לפי גודל בפועל, לא לפי אות או מייל.
const CONTACT_DIRECTORY_TARGET_BYTES = 220000;
const CONTACT_DIRECTORY_MAX_BYTES = 850000;
const DIRECTORY_REBUILD_PENDING_KEY = "contacts_directory_rebuild_pending";
const DIRECTORY_REBUILD_REASON_KEY = "contacts_directory_rebuild_reason";
const DIRECTORY_REBUILD_CONTACTS_KEY = "contacts_directory_pending_contacts";
const DIRECTORY_REBUILD_TRIGGER_HANDLER = "processPendingDirectoryRebuild";

// אינדקס מקומי בגיליון עבור עדכון מייל לפי טלפון.
// הוא מונע סריקה מלאה של כל טבלאות המקור בכל בקשה.
const EMAIL_PHONE_INDEX_SHEET_NAME = "email_phone_index";
const EMAIL_PHONE_INDEX_HEADERS = [
  "phone",
  "locations_json",
  "display_name",
  "updated_at"
];
const ADMIN_OVERRIDE_FIELDS = [
  "id",
  "first_name_he",
  "last_name_he",
  "first_name_en",
  "last_name_en",
  "title_prefix",
  "role",
  "department",
  "hospital",
  "phone",
  "email",
  "source",
  "status",
  "created_at",
  "first_seen_at",
  "is_new_contact",
  "updated_at"
];

const EMAIL_UPDATE_SETTINGS_SHEET_NAME = "app_settings";
const EMAIL_UPDATE_LOG_SHEET_NAME = "email_update_log";
const EMAIL_UPDATE_OPEN_KEY = "email_update_open";
const DISABLE_REPLACED_EMAIL_KEY = "disable_replaced_email";
const MAIN_APP_URL_KEY = "main_app_url";
const DEFAULT_MAIN_APP_URL = "https://schneider-contacts.github.io/contacts-app/";
const PUBLIC_AUTH_ROUTE_CACHE_SECONDS = 2 * 60;
const PUBLIC_AUTH_ROUTE_COOLDOWN_SECONDS = 2;
const PUBLIC_AUTH_ROUTE_SOURCE = "schneider-auth-router";
const PASSWORD_RECOVERY_REQUEST_COLLECTION =
  PASSWORD_RESET_REQUESTS_COLLECTION_NAME;
const PASSWORD_RECOVERY_MAX_PASSWORD_LENGTH = 128;
const ACCESS_REVIEW_STATUS_PENDING = "pending";
const ACCESS_REVIEW_STATUS_TEMPORARY = "temporary_active";
const ACCESS_REVIEW_STATUS_APPROVED = "approved";
const ACCESS_REVIEW_STATUS_REJECTED = "rejected";
const ACCESS_REVIEW_STATUS_REVOKED = "revoked";
const DUPLICATE_SUBMISSION_WINDOW_SECONDS = 24 * 60 * 60;
const DUPLICATE_SUBMISSION_WINDOW_MS =
  DUPLICATE_SUBMISSION_WINDOW_SECONDS * 1000;
const SCRIPT_CACHE_MAX_SECONDS = 6 * 60 * 60;
const SUBMISSION_DEDUPE_PROPERTY_PREFIX = "submission-dedupe-v2:";
const EMAIL_UPDATE_PHONE_PROPERTY_PREFIX = "email-update-phone-v2:";
const DAILY_ACCESS_REPORT_HANDLER = "sendDailyAccessReport";
const DAILY_ACCESS_REPORT_LAST_SENT_KEY = "daily_access_report_last_sent_at";
const DAILY_ACCESS_REPORT_HOUR = 21;
const SUPPORT_CONTACT_CACHE_KEY = "active-manager-support-contact-v2";
const SUPPORT_CONTACT_CACHE_SECONDS = 30 * 60;
const EMAIL_UPDATE_DUPLICATE_CACHE_PREFIX = "email-update-duplicate:";
const FORM_SUBMISSION_DUPLICATE_CACHE_PREFIX = "form-submission-duplicate:";
const REGISTRATION_FORM_CONFIRMATION_MESSAGE =
  "הפרטים נקלטו בהצלחה. אין צורך למלא את הטופס שוב.\n\n" +
  "אם מספר הטלפון כבר קיים בספר אנשי הקשר, הגישה תאושר אוטומטית. " +
  "בכל מקרה אחר הבקשה תועבר לאישור מנהל.\n\n" +
  "להמשך ההרשמה או לבדיקת מצב הגישה, לחצו כאן:\n" +
  DEFAULT_MAIN_APP_URL + "?authMode=register&fresh=1\n\n" +
  "חשוב: מייל האימות מגיע לעיתים לספאם או לדואר זבל. יש לבדוק גם שם.";

const EMAIL_UPDATE_SOURCE_SHEETS = [
  {
    sheetName: "contacts_old",
    phoneHeader: "phone",
    emailHeader: "email",
    firstNameHeader: "first_name_he",
    lastNameHeader: "last_name_he"
  },
  {
    sheetName: "Form Responses 1",
    phoneHeader: "מספר טלפון",
    emailHeader: "Email",
    firstNameHeader: "שם פרטי (עברית)",
    lastNameHeader: "שם משפחה (עברית)"
  }
];

const CONTACT_FIELDS = [
  "id",
  "first_name_he",
  "last_name_he",
  "first_name_en",
  "last_name_en",
  "title_prefix",
  "role",
  "department",
  "hospital",
  "phone",
  "email",
  "source",
  "status",
  "created_at",
  "updated_at"
];

const CONTACT_FIRESTORE_FIELDS = CONTACT_FIELDS.concat([
  "first_seen_at",
  "is_new_contact"
]);
