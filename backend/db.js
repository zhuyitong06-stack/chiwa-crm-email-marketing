import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { jsonParse, jsonStringify, makeId, normalizeEmail, normalizeTags, nowIso, toBoolean } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDbPath = path.join(__dirname, "data", "crm.sqlite");
const configuredPath = process.env.SQLITE_PATH || defaultDbPath;
const dbPath = path.isAbsolute(configuredPath) ? configuredPath : path.join(__dirname, configuredPath);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

export function initializeDb() {
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      crmCustomerId TEXT,
      email TEXT NOT NULL UNIQUE,
      firstName TEXT,
      lastName TEXT,
      company TEXT,
      phone TEXT,
      country TEXT,
      language TEXT,
      lifecycleStage TEXT,
      tagsJson TEXT NOT NULL DEFAULT '[]',
      source TEXT,
      ownerUserId TEXT,
      marketingOptIn INTEGER NOT NULL DEFAULT 0,
      marketingOptInAt TEXT,
      marketingConsentSource TEXT,
      unsubscribed INTEGER NOT NULL DEFAULT 0,
      unsubscribedAt TEXT,
      bounceStatus TEXT NOT NULL DEFAULT '',
      complaintStatus INTEGER NOT NULL DEFAULT 0,
      lastEmailSentAt TEXT,
      lastEmailReceivedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_threads (
      id TEXT PRIMARY KEY,
      contactId TEXT NOT NULL,
      subject TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      lastMessageAt TEXT,
      assignedTo TEXT,
      source TEXT NOT NULL DEFAULT 'outbound',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (contactId) REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_messages (
      id TEXT PRIMARY KEY,
      threadId TEXT NOT NULL,
      contactId TEXT NOT NULL,
      direction TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'support',
      fromEmail TEXT NOT NULL,
      toEmail TEXT NOT NULL,
      cc TEXT,
      bcc TEXT,
      subject TEXT,
      htmlContent TEXT,
      textContent TEXT,
      resendEmailId TEXT,
      inboundEmailId TEXT,
      providerMessageId TEXT,
      inReplyTo TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      errorMessage TEXT,
      attachmentsJson TEXT NOT NULL DEFAULT '[]',
      readAt TEXT,
      campaignId TEXT,
      sentByAdminId TEXT,
      sentAt TEXT,
      receivedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (threadId) REFERENCES email_threads(id) ON DELETE CASCADE,
      FOREIGN KEY (contactId) REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_events (
      id TEXT PRIMARY KEY,
      messageId TEXT,
      contactId TEXT,
      eventType TEXT NOT NULL,
      resendEventId TEXT UNIQUE,
      payloadJson TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (messageId) REFERENCES email_messages(id) ON DELETE SET NULL,
      FOREIGN KEY (contactId) REFERENCES contacts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS email_drafts (
      id TEXT PRIMARY KEY,
      contactId TEXT NOT NULL,
      threadId TEXT,
      purpose TEXT NOT NULL DEFAULT 'support',
      subject TEXT,
      htmlContent TEXT,
      textContent TEXT,
      signatureText TEXT,
      testRecipient TEXT,
      updatedBy TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (contactId) REFERENCES contacts(id) ON DELETE CASCADE,
      FOREIGN KEY (threadId) REFERENCES email_threads(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sender_identities (
      id TEXT PRIMARY KEY,
      purpose TEXT NOT NULL UNIQUE,
      displayName TEXT NOT NULL,
      email TEXT NOT NULL,
      replyTo TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS signature_templates (
      id TEXT PRIMARY KEY,
      identityId TEXT,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      isDefault INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (identityId) REFERENCES sender_identities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      htmlContent TEXT,
      textContent TEXT,
      fromEmail TEXT,
      segmentFilterJson TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'draft',
      scheduledAt TEXT,
      targetCount INTEGER NOT NULL DEFAULT 0,
      sentCount INTEGER NOT NULL DEFAULT 0,
      failedCount INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'support',
      subjectTemplate TEXT NOT NULL,
      htmlTemplate TEXT,
      textTemplate TEXT,
      variablesJson TEXT NOT NULL DEFAULT '{}',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_email_threads_contact ON email_threads(contactId);
    CREATE INDEX IF NOT EXISTS idx_email_messages_contact ON email_messages(contactId);
    CREATE INDEX IF NOT EXISTS idx_email_messages_resend ON email_messages(resendEmailId);
    CREATE INDEX IF NOT EXISTS idx_email_drafts_contact ON email_drafts(contactId);
    CREATE INDEX IF NOT EXISTS idx_email_events_resend ON email_events(resendEventId);
    CREATE INDEX IF NOT EXISTS idx_email_templates_purpose ON email_templates(purpose);
  `);

  try {
    db.exec("ALTER TABLE email_messages ADD COLUMN readAt TEXT");
  } catch (error) {
    if (!String(error.message).includes("duplicate column")) throw error;
  }

  try {
    db.exec("ALTER TABLE email_messages ADD COLUMN campaignId TEXT");
  } catch (error) {
    if (!String(error.message).includes("duplicate column")) throw error;
  }

  try {
    db.exec("ALTER TABLE campaigns ADD COLUMN targetCount INTEGER NOT NULL DEFAULT 0");
  } catch (error) {
    if (!String(error.message).includes("duplicate column")) throw error;
  }

  db.exec("CREATE INDEX IF NOT EXISTS idx_email_messages_thread_read ON email_messages(threadId, readAt)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_email_messages_campaign ON email_messages(campaignId)");
}

function mapContact(row) {
  if (!row) return null;
  return {
    ...row,
    tags: jsonParse(row.tagsJson, []),
    marketingOptIn: Boolean(row.marketingOptIn),
    unsubscribed: Boolean(row.unsubscribed),
    complaintStatus: Boolean(row.complaintStatus),
  };
}

function contactValues(input) {
  const now = nowIso();
  const email = normalizeEmail(input.email);
  const marketingOptIn = toBoolean(input.marketingOptIn);
  return {
    id: input.id || makeId("contact"),
    crmCustomerId: input.crmCustomerId || input.lead_id || input.id || null,
    email,
    firstName: input.firstName || input.first_name || "",
    lastName: input.lastName || input.last_name || "",
    company: input.company || "",
    phone: input.phone || "",
    country: input.country || "",
    language: input.language || "",
    lifecycleStage: input.lifecycleStage || input.funnelStage || input.outreachStatus || "",
    tagsJson: jsonStringify(normalizeTags(input.tags || input.segment || input.priority), "[]"),
    source: input.source || "frontend-import",
    ownerUserId: input.ownerUserId || input.owner || "",
    marketingOptIn: marketingOptIn ? 1 : 0,
    marketingOptInAt: marketingOptIn ? input.marketingOptInAt || now : null,
    marketingConsentSource: input.marketingConsentSource || "",
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
}

export function upsertContact(input) {
  const values = contactValues(input);
  const statement = db.prepare(`
    INSERT INTO contacts (
      id, crmCustomerId, email, firstName, lastName, company, phone, country, language,
      lifecycleStage, tagsJson, source, ownerUserId, marketingOptIn, marketingOptInAt,
      marketingConsentSource, createdAt, updatedAt
    ) VALUES (
      @id, @crmCustomerId, @email, @firstName, @lastName, @company, @phone, @country, @language,
      @lifecycleStage, @tagsJson, @source, @ownerUserId, @marketingOptIn, @marketingOptInAt,
      @marketingConsentSource, @createdAt, @updatedAt
    )
    ON CONFLICT(email) DO UPDATE SET
      crmCustomerId = COALESCE(excluded.crmCustomerId, contacts.crmCustomerId),
      firstName = COALESCE(NULLIF(excluded.firstName, ''), contacts.firstName),
      lastName = COALESCE(NULLIF(excluded.lastName, ''), contacts.lastName),
      company = COALESCE(NULLIF(excluded.company, ''), contacts.company),
      phone = COALESCE(NULLIF(excluded.phone, ''), contacts.phone),
      country = COALESCE(NULLIF(excluded.country, ''), contacts.country),
      language = COALESCE(NULLIF(excluded.language, ''), contacts.language),
      lifecycleStage = COALESCE(NULLIF(excluded.lifecycleStage, ''), contacts.lifecycleStage),
      tagsJson = CASE WHEN excluded.tagsJson != '[]' THEN excluded.tagsJson ELSE contacts.tagsJson END,
      source = COALESCE(NULLIF(excluded.source, ''), contacts.source),
      ownerUserId = COALESCE(NULLIF(excluded.ownerUserId, ''), contacts.ownerUserId),
      marketingOptIn = CASE WHEN contacts.unsubscribed = 1 THEN contacts.marketingOptIn ELSE MAX(contacts.marketingOptIn, excluded.marketingOptIn) END,
      marketingOptInAt = COALESCE(contacts.marketingOptInAt, excluded.marketingOptInAt),
      marketingConsentSource = COALESCE(NULLIF(excluded.marketingConsentSource, ''), contacts.marketingConsentSource),
      updatedAt = excluded.updatedAt
  `);
  statement.run(values);
  return findContactByEmail(values.email);
}

export function listContacts({ search = "", limit = 100, offset = 0 } = {}) {
  const query = `%${String(search).trim().toLowerCase()}%`;
  const rows = db
    .prepare(`
      SELECT * FROM contacts
      WHERE
        @search = ''
        OR lower(email) LIKE @query
        OR lower(company) LIKE @query
        OR lower(firstName || ' ' || lastName) LIKE @query
      ORDER BY updatedAt DESC
      LIMIT @limit OFFSET @offset
    `)
    .all({ search: String(search || "").trim(), query, limit, offset });
  return rows.map(mapContact);
}

export function findContactById(id) {
  return mapContact(db.prepare("SELECT * FROM contacts WHERE id = ?").get(id));
}

export function findContactByEmail(email) {
  return mapContact(db.prepare("SELECT * FROM contacts WHERE email = ?").get(normalizeEmail(email)));
}

export function deleteContactsByIds(ids = []) {
  const uniqueIds = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!uniqueIds.length) return 0;

  let deleted = 0;
  const statement = db.prepare("DELETE FROM contacts WHERE id = ? OR crmCustomerId = ?");
  db.exec("BEGIN");
  try {
    uniqueIds.forEach((id) => {
      const result = statement.run(id, id);
      deleted += Number(result.changes) || 0;
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return deleted;
}

export function updateContactEmailState(contactId, changes = {}) {
  const current = findContactById(contactId);
  if (!current) return null;
  const next = {
    bounceStatus: changes.bounceStatus ?? current.bounceStatus,
    complaintStatus: changes.complaintStatus === undefined ? Number(current.complaintStatus) : Number(Boolean(changes.complaintStatus)),
    unsubscribed: changes.unsubscribed === undefined ? Number(current.unsubscribed) : Number(Boolean(changes.unsubscribed)),
    unsubscribedAt: changes.unsubscribedAt ?? current.unsubscribedAt,
    marketingOptIn: changes.marketingOptIn === undefined ? Number(current.marketingOptIn) : Number(Boolean(changes.marketingOptIn)),
    marketingOptInAt: changes.marketingOptInAt ?? current.marketingOptInAt,
    marketingConsentSource: changes.marketingConsentSource ?? current.marketingConsentSource,
    lifecycleStage: changes.lifecycleStage ?? current.lifecycleStage,
    lastEmailSentAt: changes.lastEmailSentAt ?? current.lastEmailSentAt,
    lastEmailReceivedAt: changes.lastEmailReceivedAt ?? current.lastEmailReceivedAt,
    updatedAt: nowIso(),
    id: contactId,
  };
  if (next.unsubscribed) {
    next.marketingOptIn = 0;
  }
  db.prepare(`
    UPDATE contacts
    SET bounceStatus = @bounceStatus,
        complaintStatus = @complaintStatus,
        unsubscribed = @unsubscribed,
        unsubscribedAt = @unsubscribedAt,
        marketingOptIn = @marketingOptIn,
        marketingOptInAt = @marketingOptInAt,
        marketingConsentSource = @marketingConsentSource,
        lifecycleStage = @lifecycleStage,
        lastEmailSentAt = @lastEmailSentAt,
        lastEmailReceivedAt = @lastEmailReceivedAt,
        updatedAt = @updatedAt
    WHERE id = @id
  `).run(next);
  return findContactById(contactId);
}

export function createThread({ contactId, subject, source = "outbound" }) {
  const now = nowIso();
  const thread = {
    id: makeId("thread"),
    contactId,
    subject: subject || "",
    status: "open",
    lastMessageAt: now,
    assignedTo: "",
    source,
    createdAt: now,
    updatedAt: now,
  };
  db.prepare(`
    INSERT INTO email_threads (id, contactId, subject, status, lastMessageAt, assignedTo, source, createdAt, updatedAt)
    VALUES (@id, @contactId, @subject, @status, @lastMessageAt, @assignedTo, @source, @createdAt, @updatedAt)
  `).run(thread);
  return thread;
}

export function findThreadById(id) {
  return db.prepare("SELECT * FROM email_threads WHERE id = ?").get(id) || null;
}

export function updateThread(threadId, changes = {}) {
  const current = findThreadById(threadId);
  if (!current) return null;
  const allowedStatuses = new Set(["open", "waiting", "closed"]);
  const status = changes.status === undefined ? current.status : String(changes.status || "").toLowerCase();
  const next = {
    id: threadId,
    status: allowedStatuses.has(status) ? status : current.status,
    assignedTo: changes.assignedTo === undefined ? current.assignedTo : String(changes.assignedTo || "").trim(),
    updatedAt: nowIso(),
  };
  db.prepare(`
    UPDATE email_threads
    SET status = @status,
        assignedTo = @assignedTo,
        updatedAt = @updatedAt
    WHERE id = @id
  `).run(next);
  return findThreadById(threadId);
}

function comparableSubject(subject = "") {
  return String(subject || "")
    .replace(/^(\s*(re|fw|fwd)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();
}

export function findThreadForContactSubject(contactId, subject) {
  const target = comparableSubject(subject);
  if (!contactId || !target) return null;
  const rows = db
    .prepare(`
      SELECT
        email_threads.*,
        SUM(CASE WHEN email_messages.direction = 'outbound' THEN 1 ELSE 0 END) AS outboundCount
      FROM email_threads
      LEFT JOIN email_messages ON email_messages.threadId = email_threads.id
      WHERE email_threads.contactId = ?
      GROUP BY email_threads.id
      ORDER BY outboundCount DESC, email_threads.createdAt ASC
      LIMIT 50
    `)
    .all(contactId);
  return rows.find((row) => comparableSubject(row.subject) === target) || null;
}

export function touchThread(threadId) {
  db.prepare("UPDATE email_threads SET lastMessageAt = ?, updatedAt = ? WHERE id = ?").run(nowIso(), nowIso(), threadId);
}

export function markThreadRead(threadId, read = true) {
  const readAt = read ? nowIso() : null;
  db.prepare(`
    UPDATE email_messages
    SET readAt = @readAt, updatedAt = @updatedAt
    WHERE threadId = @threadId AND direction = 'inbound'
  `).run({ threadId, readAt, updatedAt: nowIso() });
  return findThreadById(threadId);
}

export function createEmailMessage(input) {
  const now = nowIso();
  const message = {
    id: input.id || makeId("msg"),
    threadId: input.threadId,
    contactId: input.contactId,
    direction: input.direction,
    purpose: input.purpose || "support",
    fromEmail: input.fromEmail,
    toEmail: input.toEmail,
    cc: input.cc || "",
    bcc: input.bcc || "",
    subject: input.subject || "",
    htmlContent: input.htmlContent || "",
    textContent: input.textContent || "",
    resendEmailId: input.resendEmailId || "",
    inboundEmailId: input.inboundEmailId || "",
    providerMessageId: input.providerMessageId || "",
    inReplyTo: input.inReplyTo || "",
    status: input.status || "queued",
    errorMessage: input.errorMessage || "",
    attachmentsJson: jsonStringify(input.attachments || [], "[]"),
    readAt: input.readAt || (input.direction === "outbound" ? now : null),
    campaignId: input.campaignId || "",
    sentByAdminId: input.sentByAdminId || "",
    sentAt: input.sentAt || null,
    receivedAt: input.receivedAt || null,
    createdAt: now,
    updatedAt: now,
  };
  db.prepare(`
    INSERT INTO email_messages (
      id, threadId, contactId, direction, purpose, fromEmail, toEmail, cc, bcc, subject,
      htmlContent, textContent, resendEmailId, inboundEmailId, providerMessageId, inReplyTo,
      status, errorMessage, attachmentsJson, readAt, campaignId, sentByAdminId, sentAt, receivedAt, createdAt, updatedAt
    ) VALUES (
      @id, @threadId, @contactId, @direction, @purpose, @fromEmail, @toEmail, @cc, @bcc, @subject,
      @htmlContent, @textContent, @resendEmailId, @inboundEmailId, @providerMessageId, @inReplyTo,
      @status, @errorMessage, @attachmentsJson, @readAt, @campaignId, @sentByAdminId, @sentAt, @receivedAt, @createdAt, @updatedAt
    )
  `).run(message);
  touchThread(message.threadId);
  return message;
}

export function listMessagesForContact(contactId) {
  return db.prepare("SELECT * FROM email_messages WHERE contactId = ? ORDER BY createdAt DESC").all(contactId);
}

export function listInboxMessages({ search = "", status = "", read = "", assignedTo = "", limit = 50, offset = 0 } = {}) {
  const query = `%${String(search).trim().toLowerCase()}%`;
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedRead = String(read || "").trim().toLowerCase();
  return db
    .prepare(`
      SELECT
        email_messages.*,
        contacts.email AS contactEmail,
        contacts.crmCustomerId AS crmCustomerId,
        contacts.company AS contactCompany,
        contacts.firstName AS contactFirstName,
        contacts.lastName AS contactLastName,
        email_threads.subject AS threadSubject,
        email_threads.status AS threadStatus,
        email_threads.assignedTo AS assignedTo,
        (
          SELECT COUNT(*)
          FROM email_messages unread_messages
          WHERE unread_messages.threadId = email_messages.threadId
            AND unread_messages.direction = 'inbound'
            AND unread_messages.readAt IS NULL
        ) AS unreadCount
      FROM email_messages
      JOIN contacts ON contacts.id = email_messages.contactId
      JOIN email_threads ON email_threads.id = email_messages.threadId
      WHERE email_messages.direction = 'inbound'
        AND (@status = '' OR lower(email_threads.status) = @status)
        AND (@assignedTo = '' OR lower(email_threads.assignedTo) LIKE @assignedToQuery)
        AND (
          @read = ''
          OR (@read = 'unread' AND email_messages.readAt IS NULL)
          OR (@read = 'read' AND email_messages.readAt IS NOT NULL)
        )
        AND (
          @search = ''
          OR lower(email_messages.subject) LIKE @query
          OR lower(email_messages.fromEmail) LIKE @query
          OR lower(email_messages.textContent) LIKE @query
          OR lower(email_messages.htmlContent) LIKE @query
          OR lower(email_threads.subject) LIKE @query
          OR lower(email_threads.assignedTo) LIKE @query
          OR lower(contacts.email) LIKE @query
          OR lower(contacts.company) LIKE @query
        )
      ORDER BY COALESCE(email_messages.receivedAt, email_messages.createdAt) DESC
      LIMIT @limit OFFSET @offset
    `)
    .all({
      search: String(search || "").trim(),
      query,
      status: normalizedStatus,
      read: normalizedRead,
      assignedTo: String(assignedTo || "").trim(),
      assignedToQuery: `%${String(assignedTo || "").trim().toLowerCase()}%`,
      limit,
      offset,
    });
}

export function listThreadMessages(threadId) {
  return db.prepare("SELECT * FROM email_messages WHERE threadId = ? ORDER BY createdAt ASC").all(threadId);
}

export function findMessageByProviderId(providerMessageId) {
  if (!providerMessageId) return null;
  return (
    db.prepare("SELECT * FROM email_messages WHERE providerMessageId = ?").get(providerMessageId) ||
    db.prepare("SELECT * FROM email_messages WHERE resendEmailId = ?").get(providerMessageId) ||
    null
  );
}

export function findMessageByInboundEmailId(inboundEmailId) {
  if (!inboundEmailId) return null;
  return db.prepare("SELECT * FROM email_messages WHERE inboundEmailId = ?").get(inboundEmailId) || null;
}

export function updateEmailMessageContent(messageId, changes = {}) {
  const current = db.prepare("SELECT * FROM email_messages WHERE id = ?").get(messageId);
  if (!current) return null;
  const next = {
    id: messageId,
    subject: changes.subject ?? current.subject,
    htmlContent: changes.htmlContent ?? current.htmlContent,
    textContent: changes.textContent ?? current.textContent,
    providerMessageId: changes.providerMessageId ?? current.providerMessageId,
    inReplyTo: changes.inReplyTo ?? current.inReplyTo,
    status: changes.status ?? current.status,
    errorMessage: changes.errorMessage ?? current.errorMessage,
    attachmentsJson: changes.attachments === undefined ? current.attachmentsJson : jsonStringify(changes.attachments || [], "[]"),
    receivedAt: changes.receivedAt ?? current.receivedAt,
    updatedAt: nowIso(),
  };
  db.prepare(`
    UPDATE email_messages
    SET subject = @subject,
        htmlContent = @htmlContent,
        textContent = @textContent,
        providerMessageId = @providerMessageId,
        inReplyTo = @inReplyTo,
        status = @status,
        errorMessage = @errorMessage,
        attachmentsJson = @attachmentsJson,
        receivedAt = @receivedAt,
        updatedAt = @updatedAt
    WHERE id = @id
  `).run(next);
  return db.prepare("SELECT * FROM email_messages WHERE id = ?").get(messageId) || null;
}

export function updateMessageStatusByResendId(resendEmailId, status, errorMessage = "") {
  if (!resendEmailId) return null;
  const updatedAt = nowIso();
  db.prepare(`
    UPDATE email_messages
    SET status = @status, errorMessage = COALESCE(NULLIF(@errorMessage, ''), errorMessage), updatedAt = @updatedAt
    WHERE resendEmailId = @resendEmailId
  `).run({ resendEmailId, status, errorMessage, updatedAt });
  return db.prepare("SELECT * FROM email_messages WHERE resendEmailId = ?").get(resendEmailId) || null;
}

export function findMessageById(messageId) {
  if (!messageId) return null;
  return db.prepare("SELECT * FROM email_messages WHERE id = ?").get(messageId) || null;
}

export function createEmailEvent({ messageId = null, contactId = null, eventType, resendEventId, payload }) {
  const event = {
    id: makeId("evt"),
    messageId,
    contactId,
    eventType,
    resendEventId: resendEventId || makeId("provider_evt"),
    payloadJson: jsonStringify(payload, "{}"),
    createdAt: nowIso(),
  };
  try {
    db.prepare(`
      INSERT INTO email_events (id, messageId, contactId, eventType, resendEventId, payloadJson, createdAt)
      VALUES (@id, @messageId, @contactId, @eventType, @resendEventId, @payloadJson, @createdAt)
    `).run(event);
    return { inserted: true, event };
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) return { inserted: false, event: null };
    throw error;
  }
}

export function createCampaign(input) {
  const now = nowIso();
  const campaign = {
    id: makeId("campaign"),
    name: input.name,
    subject: input.subject,
    htmlContent: input.htmlContent || "",
    textContent: input.textContent || "",
    fromEmail: input.fromEmail || process.env.FROM_MARKETING || "",
    segmentFilterJson: jsonStringify(input.segmentFilter || {}, "{}"),
    status: "draft",
    scheduledAt: input.scheduledAt || null,
    targetCount: Number(input.targetCount) || 0,
    sentCount: 0,
    failedCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.prepare(`
    INSERT INTO campaigns (
      id, name, subject, htmlContent, textContent, fromEmail, segmentFilterJson, status,
      scheduledAt, targetCount, sentCount, failedCount, createdAt, updatedAt
    ) VALUES (
      @id, @name, @subject, @htmlContent, @textContent, @fromEmail, @segmentFilterJson, @status,
      @scheduledAt, @targetCount, @sentCount, @failedCount, @createdAt, @updatedAt
    )
  `).run(campaign);
  return campaign;
}

export function updateCampaign(id, input = {}) {
  const current = findCampaignById(id);
  if (!current) return null;
  const campaign = {
    id,
    name: input.name ?? current.name,
    subject: input.subject ?? current.subject,
    htmlContent: input.htmlContent ?? current.htmlContent ?? "",
    textContent: input.textContent ?? current.textContent ?? "",
    fromEmail: input.fromEmail ?? current.fromEmail ?? process.env.FROM_MARKETING ?? "",
    segmentFilterJson:
      input.segmentFilter === undefined ? current.segmentFilterJson || jsonStringify(current.segmentFilter || {}, "{}") : jsonStringify(input.segmentFilter || {}, "{}"),
    status: input.status ?? current.status ?? "draft",
    scheduledAt: input.scheduledAt === undefined ? current.scheduledAt : input.scheduledAt,
    targetCount: input.targetCount === undefined ? Number(current.targetCount) || 0 : Number(input.targetCount) || 0,
    sentCount: Number(current.sentCount) || 0,
    failedCount: Number(current.failedCount) || 0,
    updatedAt: nowIso(),
  };
  db.prepare(`
    UPDATE campaigns
    SET name = @name,
        subject = @subject,
        htmlContent = @htmlContent,
        textContent = @textContent,
        fromEmail = @fromEmail,
        segmentFilterJson = @segmentFilterJson,
        status = @status,
        scheduledAt = @scheduledAt,
        targetCount = @targetCount,
        sentCount = @sentCount,
        failedCount = @failedCount,
        updatedAt = @updatedAt
    WHERE id = @id
  `).run(campaign);
  return findCampaignById(id);
}

export function findCampaignById(id) {
  const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  if (!row) return null;
  return { ...row, segmentFilter: jsonParse(row.segmentFilterJson, {}) };
}

export function listCampaigns() {
  return db.prepare("SELECT * FROM campaigns ORDER BY createdAt DESC").all().map((row) => ({
    ...row,
    segmentFilter: jsonParse(row.segmentFilterJson, {}),
  }));
}

export function deleteCampaign(id) {
  const result = db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);
  return Number(result.changes) || 0;
}

export function updateCampaignStats(id, { status, targetCount, sentCount, failedCount, scheduledAt } = {}) {
  const current = findCampaignById(id);
  if (!current) return null;
  const next = {
    id,
    status: status ?? current.status,
    targetCount: targetCount === undefined ? Number(current.targetCount) || 0 : Number(targetCount) || 0,
    sentCount: sentCount === undefined ? Number(current.sentCount) || 0 : Number(sentCount) || 0,
    failedCount: failedCount === undefined ? Number(current.failedCount) || 0 : Number(failedCount) || 0,
    scheduledAt: scheduledAt === undefined ? current.scheduledAt : scheduledAt,
    updatedAt: nowIso(),
  };
  db.prepare(`
    UPDATE campaigns
    SET status = @status,
        targetCount = @targetCount,
        sentCount = @sentCount,
        failedCount = @failedCount,
        scheduledAt = @scheduledAt,
        updatedAt = @updatedAt
    WHERE id = @id
  `).run(next);
  return findCampaignById(id);
}

export function campaignReport(campaignId) {
  const campaign = findCampaignById(campaignId);
  if (!campaign) return null;
  const rows = db.prepare("SELECT * FROM email_messages WHERE campaignId = ?").all(campaignId);
  const outbound = rows.filter((message) => message.direction === "outbound");
  const threadIds = [...new Set(outbound.map((message) => message.threadId).filter(Boolean))];
  const contactIds = [...new Set(outbound.map((message) => message.contactId).filter(Boolean))];
  const inbound = threadIds.length
    ? db
        .prepare(`SELECT COUNT(*) AS count FROM email_messages WHERE direction = 'inbound' AND threadId IN (${threadIds.map(() => "?").join(",")})`)
        .get(...threadIds).count
    : 0;
  const unsubscribedContacts = contactIds.length
    ? db.prepare(`SELECT COUNT(*) AS count FROM contacts WHERE unsubscribed = 1 AND id IN (${contactIds.map(() => "?").join(",")})`).get(...contactIds).count
    : 0;
  const countStatus = (status) => outbound.filter((message) => message.status === status).length;
  const opened = outbound.filter((message) => ["opened", "clicked"].includes(message.status)).length;
  const clicked = countStatus("clicked");
  const delivered = outbound.filter((message) => ["delivered", "opened", "clicked"].includes(message.status)).length;
  const sent = outbound.length || Number(campaign.sentCount) || 0;
  return {
    campaign,
    targetCount: Number(campaign.targetCount) || sent,
    sentCount: sent,
    deliveredCount: delivered,
    openedCount: opened,
    clickedCount: clicked,
    replyCount: Number(inbound) || 0,
    bouncedCount: countStatus("bounced"),
    complainedCount: countStatus("complained"),
    unsubscribedCount: Math.max(countStatus("unsubscribed"), Number(unsubscribedContacts) || 0),
    failedCount: outbound.filter((message) => ["failed", "bounced"].includes(message.status)).length + (Number(campaign.failedCount) || 0),
  };
}

export function emailBehaviorAnalytics() {
  const outbound = db
    .prepare(`
      SELECT
        email_messages.*,
        contacts.email AS contactEmail,
        contacts.company AS contactCompany,
        contacts.crmCustomerId AS crmCustomerId
      FROM email_messages
      JOIN contacts ON contacts.id = email_messages.contactId
      WHERE email_messages.direction = 'outbound'
    `)
    .all();
  const inbound = db.prepare("SELECT COUNT(*) AS count FROM email_messages WHERE direction = 'inbound'").get().count || 0;
  const unsubscribedContacts = db.prepare("SELECT COUNT(*) AS count FROM contacts WHERE unsubscribed = 1").get().count || 0;
  const events = db
    .prepare(`
      SELECT
        email_events.*,
        contacts.email AS contactEmail,
        contacts.company AS contactCompany,
        contacts.crmCustomerId AS crmCustomerId,
        email_messages.subject AS subject,
        email_messages.purpose AS purpose
      FROM email_events
      LEFT JOIN contacts ON contacts.id = email_events.contactId
      LEFT JOIN email_messages ON email_messages.id = email_events.messageId
      ORDER BY email_events.createdAt DESC
      LIMIT 50
    `)
    .all();
  const allEvents = db.prepare("SELECT eventType, messageId FROM email_events WHERE messageId IS NOT NULL").all();
  const eventMessageIds = (type) => new Set(allEvents.filter((event) => event.eventType === type && event.messageId).map((event) => event.messageId));
  const openedIds = eventMessageIds("email.opened");
  const clickedIds = eventMessageIds("email.clicked");
  const countStatus = (status) => outbound.filter((message) => message.status === status).length;
  const countByPurpose = (purpose) => outbound.filter((message) => (message.purpose || "support") === purpose).length;
  const sent = outbound.length;
  return {
    totals: {
      sentCount: sent,
      deliveredCount: outbound.filter((message) => ["delivered", "opened", "clicked"].includes(message.status)).length,
      openedCount: outbound.filter((message) => ["opened", "clicked"].includes(message.status) || openedIds.has(message.id)).length,
      clickedCount: outbound.filter((message) => message.status === "clicked" || clickedIds.has(message.id)).length,
      replyCount: Number(inbound) || 0,
      bouncedCount: countStatus("bounced"),
      complainedCount: countStatus("complained"),
      unsubscribedCount: Math.max(countStatus("unsubscribed"), Number(unsubscribedContacts) || 0),
      failedCount: outbound.filter((message) => ["failed", "bounced", "suppressed"].includes(message.status)).length,
    },
    byPurpose: {
      marketing: countByPurpose("marketing"),
      sales: countByPurpose("sales"),
      support: countByPurpose("support"),
      transactional: countByPurpose("transactional"),
    },
    recentEvents: events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      contactEmail: event.contactEmail,
      contactCompany: event.contactCompany,
      crmCustomerId: event.crmCustomerId,
      subject: event.subject,
      purpose: event.purpose,
      createdAt: event.createdAt,
    })),
  };
}

function mapEmailTemplate(row) {
  if (!row) return null;
  return {
    ...row,
    variables: jsonParse(row.variablesJson, {}),
  };
}

export function createEmailTemplate(input) {
  const now = nowIso();
  const template = {
    id: input.id || makeId("template"),
    name: input.name,
    purpose: input.purpose || "support",
    subjectTemplate: input.subjectTemplate || input.subject || "",
    htmlTemplate: input.htmlTemplate || input.htmlContent || "",
    textTemplate: input.textTemplate || input.textContent || "",
    variablesJson: jsonStringify(input.variables || {}, "{}"),
    createdAt: now,
    updatedAt: now,
  };
  db.prepare(`
    INSERT INTO email_templates (
      id, name, purpose, subjectTemplate, htmlTemplate, textTemplate, variablesJson, createdAt, updatedAt
    ) VALUES (
      @id, @name, @purpose, @subjectTemplate, @htmlTemplate, @textTemplate, @variablesJson, @createdAt, @updatedAt
    )
  `).run(template);
  return mapEmailTemplate(db.prepare("SELECT * FROM email_templates WHERE id = ?").get(template.id));
}

export function findEmailTemplateById(id) {
  return mapEmailTemplate(db.prepare("SELECT * FROM email_templates WHERE id = ?").get(id));
}

export function listEmailTemplates({ purpose = "" } = {}) {
  const rows = purpose
    ? db.prepare("SELECT * FROM email_templates WHERE purpose = ? ORDER BY updatedAt DESC").all(purpose)
    : db.prepare("SELECT * FROM email_templates ORDER BY updatedAt DESC").all();
  return rows.map(mapEmailTemplate);
}

export function updateEmailTemplate(id, input) {
  const current = findEmailTemplateById(id);
  if (!current) return null;
  const next = {
    id,
    name: input.name ?? current.name,
    purpose: input.purpose ?? current.purpose,
    subjectTemplate: input.subjectTemplate ?? current.subjectTemplate,
    htmlTemplate: input.htmlTemplate ?? current.htmlTemplate,
    textTemplate: input.textTemplate ?? current.textTemplate,
    variablesJson: input.variables ? jsonStringify(input.variables, "{}") : current.variablesJson,
    updatedAt: nowIso(),
  };
  db.prepare(`
    UPDATE email_templates
    SET name = @name,
        purpose = @purpose,
        subjectTemplate = @subjectTemplate,
        htmlTemplate = @htmlTemplate,
        textTemplate = @textTemplate,
        variablesJson = @variablesJson,
        updatedAt = @updatedAt
    WHERE id = @id
  `).run(next);
  return findEmailTemplateById(id);
}

export function deleteEmailTemplate(id) {
  const result = db.prepare("DELETE FROM email_templates WHERE id = ?").run(id);
  return Number(result.changes) || 0;
}

export function getEligibleMarketingContacts(filters = {}) {
  const leadIds = Array.isArray(filters.leadIds)
    ? filters.leadIds.map(String).map((value) => value.trim().toLowerCase()).filter(Boolean)
    : String(filters.leadIds || filters.leadId || "")
        .split(/[,\s;]+/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
  const priority = String(filters.priority || "").trim();
  const all = db
    .prepare(`
      SELECT * FROM contacts
      WHERE unsubscribed = 0
        AND complaintStatus = 0
        AND bounceStatus != 'hard_bounce'
        AND bounceStatus != 'suppressed'
      ORDER BY updatedAt DESC
    `)
    .all()
    .map(mapContact);

  return all.filter((contact) => {
    if (leadIds.length) {
      const candidates = [contact.id, contact.crmCustomerId].map((value) => String(value || "").toLowerCase());
      if (!leadIds.some((leadId) => candidates.includes(leadId))) return false;
    }
    if (priority && !contact.tags.includes(priority)) return false;
    if (filters.lifecycleStage && contact.lifecycleStage !== filters.lifecycleStage) return false;
    if (filters.source && contact.source !== filters.source) return false;
    if (filters.country && contact.country !== filters.country) return false;
    if (filters.language && contact.language !== filters.language) return false;
    if (filters.tag && !contact.tags.includes(filters.tag)) return false;
    return true;
  });
}
